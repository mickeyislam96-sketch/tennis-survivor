import 'dotenv/config';
import cron from 'node-cron';
import { autoProcessResults, processRoundResults } from './services/resultsProcessor.js';
import { checkPickReminders } from './services/emailScheduler.js';

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db/pool.js';
import { sendWelcomeEmail, sendPasswordResetEmail, getPendingEmailsSummary, sendPendingEmails, sendAdminDigest } from './utils/email.js';
import { groupsRouter } from './routes/groups.js';
import { picksRouter } from './routes/picks.js';
import { drawRouter } from './routes/draw.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { authRouter } from './routes/auth.js';
import { tiebreakerRouter } from './routes/tiebreaker.js';
import { poolsRouter } from './routes/pools.js';
import { healthRouter } from './routes/health.js';
import { adminRouter } from './routes/admin.js';
import { matchupRouter } from './routes/matchup.js';
import { paymentsRouter, handleStripeWebhook } from './routes/payments.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

// Lightweight ping for Railway healthcheck — responds before DB is ready
app.get('/ping', (_req, res) => res.json({ ok: true }));

// Auto-initialise schema in the background so the server can start listening immediately.
// This prevents Railway healthcheck timeouts on cold DB starts.
const schemaReady = (async () => {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('Database schema ready.');
  } catch (err) {
    console.error('Schema init error:', err.message);
  }
})();

const ALLOWED_ORIGINS = [
  'https://finalserveivor.com',
  'https://www.finalserveivor.com',
  'https://tennis-survivor.vercel.app',
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5173', 'http://localhost:3000'] : []),
];
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));

// Stripe webhook needs raw body BEFORE express.json() parses it
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

app.use(express.json());

// Global API rate limit — prevents abuse on data-heavy endpoints
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 60,              // 60 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again shortly.' },
});
app.use('/api/', apiLimiter);

app.use('/api/groups', groupsRouter);
app.use('/api/pools', poolsRouter);
app.use('/api/picks', picksRouter);
app.use('/api/draw', drawRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/auth', authRouter);
app.use('/api/tiebreaker', tiebreakerRouter);
app.use('/api/health', healthRouter);
app.use('/api/matchup', matchupRouter);
app.use('/api/payments', paymentsRouter);

// Email smoke-test — uses sendPasswordResetEmail which throws on failure
// Usage: GET /api/email-test?to=youraddress@gmail.com
app.get('/api/email-test', async (req, res) => {
  const to = req.query.to;
  if (!to) return res.status(400).json({ error: 'Provide ?to=email query param' });
  try {
    await sendPasswordResetEmail({
      email: to,
      displayName: 'Test User',
      resetUrl: 'https://tennis-survivor.vercel.app/reset-password?token=test',
    });
    res.json({ ok: true, message: `Test email sent to ${to}` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DB connectivity check
app.get('/api/db-check', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM users');
    res.json({ ok: true, userCount: Number(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});



// ── One-time migrations ─────────────────────────────────────────────────────
// 1. Fix R1 picks stored as R32 (round mapping bug)
// 2. Replace mock player IDs (mc-*) with real API keys (pre-API_KEY_MAP picks)
import { API_KEY_MAP, MC_PLAYERS } from './data/monteCarloMockDraw.js';

schemaReady.then(async () => {
  try {
    // Migration 1: Rename mislabelled R32 picks to R1
    const r32picks = await pool.query(
      `UPDATE picks SET round = 'R1'
       WHERE round = 'R32' AND created_at < '2026-04-05T11:30:00Z'
       RETURNING id`
    );
    if (r32picks.rowCount > 0) {
      console.log(`[migration] Renamed ${r32picks.rowCount} picks from R32 → R1`);
    }

    // Migration 2: Replace mock IDs with API keys
    let idFixCount = 0;
    for (const [mockId, apiKey] of Object.entries(API_KEY_MAP)) {
      if (apiKey == null) continue; // skip entries with unknown keys
      const upd = await pool.query(
        `UPDATE picks SET player_id = $1 WHERE player_id = $2 RETURNING id`,
        [apiKey, mockId]
      );
      idFixCount += upd.rowCount;
    }
    if (idFixCount > 0) {
      console.log(`[migration] Replaced ${idFixCount} mock player IDs with API keys`);
    }

    // Migration 3: Normalise player names to canonical mock draw names.
    // Some picks stored API-abbreviated names ("A. Rublev", "C. Norrie")
    // instead of full names ("Andrey Rublev", "Cameron Norrie").
    const apiKeyToName = new Map();
    for (const p of MC_PLAYERS) {
      const apiKey = API_KEY_MAP[p.id];
      if (apiKey) apiKeyToName.set(String(apiKey), p.name);
      apiKeyToName.set(p.id, p.name); // also map mock ID just in case
    }
    let nameFixCount = 0;
    for (const [playerId, canonicalName] of apiKeyToName) {
      const upd = await pool.query(
        `UPDATE picks SET player_name = $1
         WHERE player_id = $2 AND player_name IS DISTINCT FROM $1
         RETURNING id`,
        [canonicalName, playerId]
      );
      nameFixCount += upd.rowCount;
    }
    if (nameFixCount > 0) {
      console.log(`[migration] Normalised ${nameFixCount} player names to canonical form`);
    }

    // Migration 4: One-time clear of incorrectly queued pending emails (6 Apr 2026).
    // sendResultEmails() was not filtering by tournament, so emails were
    // queued for both Miami (practice, finished) and Monte Carlo (active).
    // Only deletes emails created before this fix was deployed.
    const emailCleanup = await pool.query(
      `DELETE FROM emails_sent
        WHERE status = 'pending'
          AND created_at < '2026-04-06T09:00:00Z'
        RETURNING id`
    );
    if (emailCleanup.rowCount > 0) {
      console.log(`[migration] Cleared ${emailCleanup.rowCount} incorrectly queued pending emails`);
    }

    // Migration 5: Reverse premature elimination of members whose R16 pick was
    // invalidated while the R16 window was still open (bug: resultsProcessor
    // eliminated members immediately instead of waiting for window to close).
    // Revive members eliminated in R16 whose R16 pick has survived=false but
    // the R16 window hasn't locked yet. Also reset the pick to survived=NULL
    // so they can change it.
    const revive = await pool.query(
      `UPDATE group_members gm
         SET is_alive = true, eliminated_round = NULL
       WHERE gm.is_alive = false
         AND gm.eliminated_round = 'R16'
         AND EXISTS (
           SELECT 1 FROM picks p
            WHERE p.group_id = gm.group_id
              AND p.user_id  = gm.user_id
              AND p.round    = 'R16'
              AND p.survived = false
         )
       RETURNING gm.id, gm.user_id`
    );
    if (revive.rowCount > 0) {
      // Also reset their R16 picks to NULL so they show as pending (changeable)
      await pool.query(
        `UPDATE picks SET survived = NULL
         WHERE round = 'R16' AND survived = false
           AND user_id IN (SELECT unnest($1::uuid[]))`,
        [revive.rows.map(r => r.user_id)]
      );
      console.log(`[migration] Revived ${revive.rowCount} members incorrectly eliminated in R16 (window still open)`);
    }

    // Run results processing after migrations
    if (r32picks.rowCount > 0 || idFixCount > 0) {
      await autoProcessResults();
      console.log('[migration] Results processing complete after migrations');
    }
  } catch (err) {
    console.error('[migration] error:', err.message);
  }
});

// ── Automated results processor + email scheduler — every 15 minutes ─────────
cron.schedule('*/15 * * * *', async () => {
  try { await autoProcessResults(); }
  catch (err) { console.error('[cron] Results error:', err.message); }

  try { await checkPickReminders(); }
  catch (err) { console.error('[cron] Pick reminder error:', err.message); }

  // Notify admin if there are new emails waiting for approval
  try { await sendAdminDigest(); }
  catch (err) { console.error('[cron] Admin digest error:', err.message); }

  // Clean up expired payment orders (pending > 1 hour old)
  try {
    const cleanup = await pool.query(
      `DELETE FROM payment_orders
       WHERE status = 'pending' AND created_at < NOW() - INTERVAL '1 hour'
       RETURNING id`
    );
    if (cleanup.rowCount > 0) {
      console.log(`[cron] Cleaned up ${cleanup.rowCount} expired payment orders`);
    }
  } catch (err) { console.error('[cron] Payment cleanup error:', err.message); }
});

// Admin routes — auth via ADMIN_SECRET env var
app.use('/api/admin', adminRouter);

// Admin: preview or approve pending emails
// POST /api/admin/approve-emails { secret }          → preview (list what's queued)
// POST /api/admin/approve-emails { secret, confirm }  → send all pending emails
app.post('/api/admin/approve-emails', async (req, res) => {
  const { secret, confirm } = req.body;
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || secret !== adminSecret) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  try {
    if (confirm) {
      const result = await sendPendingEmails();
      res.json({ ok: true, action: 'sent', ...result });
    } else {
      const pending = await getPendingEmailsSummary();
      res.json({ ok: true, action: 'preview', count: pending.length, emails: pending });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET version — one-click approve from digest email link
// GET /api/admin/approve-emails?secret=X&confirm=true
app.get('/api/admin/approve-emails', async (req, res) => {
  const { secret, confirm } = req.query;
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || secret !== adminSecret) {
    return res.status(401).send('<html><body style="font-family:sans-serif;padding:40px;"><h2>Unauthorised</h2></body></html>');
  }

  try {
    if (confirm === 'true') {
      const result = await sendPendingEmails();
      const rows = (result.results || []).map(r =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${r.to}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${r.type}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;color:${r.status === 'sent' ? '#16a34a' : '#dc2626'}">${r.status}</td>
        </tr>`
      ).join('');
      res.send(`
        <html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px;max-width:600px;margin:0 auto;">
          <h2 style="color:#16a34a;">Emails sent</h2>
          <p>${result.sent} sent, ${result.failed} failed out of ${result.total} total.</p>
          ${rows ? `<table style="width:100%;border-collapse:collapse;margin-top:16px;">
            <thead><tr style="background:#f5f5f5;">
              <th style="padding:8px 12px;text-align:left;">Recipient</th>
              <th style="padding:8px 12px;text-align:left;">Type</th>
              <th style="padding:8px 12px;text-align:left;">Status</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>` : '<p>No pending emails.</p>'}
        </body></html>
      `);
    } else {
      // Preview mode — show what's pending with an approve button
      const pending = await getPendingEmailsSummary();
      const approveUrl = `https://tennis-survivor-production.up.railway.app/api/admin/approve-emails?secret=${encodeURIComponent(secret)}&confirm=true`;
      const rows = pending.map(e =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${e.recipient_email}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${e.email_type}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${e.round}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${e.subject || ''}</td>
        </tr>`
      ).join('');
      res.send(`
        <html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px;max-width:700px;margin:0 auto;">
          <h2>${pending.length} email${pending.length === 1 ? '' : 's'} pending</h2>
          ${rows ? `<table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <thead><tr style="background:#f5f5f5;">
              <th style="padding:8px 12px;text-align:left;">Recipient</th>
              <th style="padding:8px 12px;text-align:left;">Type</th>
              <th style="padding:8px 12px;text-align:left;">Round</th>
              <th style="padding:8px 12px;text-align:left;">Subject</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>` : '<p>Nothing pending.</p>'}
          ${pending.length > 0 ? `<a href="${approveUrl}" style="display:inline-block;margin-top:16px;padding:14px 36px;background:#16a34a;color:#fff;font-weight:700;text-decoration:none;border-radius:6px;">Approve &amp; Send All</a>` : ''}
        </body></html>
      `);
    }
  } catch (err) {
    res.status(500).send(`<html><body style="font-family:sans-serif;padding:40px;"><h2>Error</h2><p>${err.message}</p></body></html>`);
  }
});

app.listen(PORT, () => {
  console.log(`Final Serve-ivor API running on http://localhost:${PORT}`);
});
