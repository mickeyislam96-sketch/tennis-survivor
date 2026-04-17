import 'dotenv/config';
import cron from 'node-cron';
import { autoProcessResults, processRoundResults } from './services/resultsProcessor.js';
import { checkPickReminders } from './services/emailScheduler.js';

import express from 'express';
import cors from 'cors';
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
import { paymentsRouter } from './routes/payments.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

// Lightweight ping for Railway healthcheck — responds before DB is ready so
// the container can pass healthcheck even on cold-start DB latency.
app.get('/ping', (_req, res) => res.json({ ok: true }));

// Auto-initialise schema in the background so the server can start listening
// immediately. CREATE TABLE IF NOT EXISTS is idempotent so it's safe to run
// on every boot. Errors are logged but don't block the server from coming up.
(async () => {
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
app.use(express.json());

app.use('/api/groups', groupsRouter);
app.use('/api/pools', poolsRouter);
app.use('/api/picks', picksRouter);
app.use('/api/draw', drawRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/auth', authRouter);
app.use('/api/tiebreaker', tiebreakerRouter);
app.use('/api/health', healthRouter);
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



// ── Automated results processor — every 15 minutes ───────────────────────────
cron.schedule('*/15 * * * *', async () => {
  try { await autoProcessResults(); }
  catch (err) { console.error('[cron] Results error:', err.message); }

  try { await checkPickReminders(); }
  catch (err) { console.error('[cron] Pick reminder error:', err.message); }

  // Notify admin if there are emails waiting for approval
  try { await sendAdminDigest(); }
  catch (err) { console.error('[cron] Admin digest error:', err.message); }
});

// Admin: manually trigger results processing
// POST /api/admin/process-results { secret, round? }
app.post('/api/admin/process-results', async (req, res) => {
  const { secret, round } = req.body;
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || secret !== adminSecret) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  try {
    const result = round
      ? await processRoundResults(round)
      : await autoProcessResults();
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

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

app.listen(PORT, () => {
  console.log(`Final Serve-ivor API running on http://localhost:${PORT}`);
});
