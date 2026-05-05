import 'dotenv/config';
import cron from 'node-cron';
import { autoProcessResults } from './services/resultsProcessor.js';
import { checkPickReminders } from './services/emailScheduler.js';
import { runOpsChecks } from './services/opsMonitor.js';


import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db/pool.js';
import { sendAdminDigest } from './utils/email.js';
import { csrfProtection, optionalAuth } from './middleware/auth.js';
import { groupsRouter } from './routes/groups.js';
import { picksRouter } from './routes/picks.js';
import { drawRouter } from './routes/draw.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { authRouter } from './routes/auth.js';
import { tiebreakerRouter } from './routes/tiebreaker.js';
import { poolsRouter } from './routes/pools.js';
import { healthRouter } from './routes/health.js';
import { paymentsRouter } from './routes/payments.js';
import { adminRouter } from './routes/admin.js';
import { supportRouter } from './routes/support.js';
import { opsRouter } from './routes/ops.js';
import { matchupRouter } from './routes/matchup.js';
import { checkTournamentScoping } from './db/tournamentScopeCheck.js';

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

    // Verify tournament_id denormalisation is healthy
    await checkTournamentScoping();
  } catch (err) {
    console.error('Schema init error:', err.message);
  }

  // Scraper cache warms automatically on first read from DB
})();

// ── Security headers ────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://finalserveivor.com", "https://www.finalserveivor.com"],
      fontSrc:    ["'self'", "https://fonts.gstatic.com"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,  // Allow cross-origin images (player headshots)
}));

// ── Startup env-var validation ──────────────────────────────────────────────
const REQUIRED_ENV = ['DATABASE_URL', 'ADMIN_SECRET'];
const WARN_ENV     = ['BREVO_API_KEY'];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[FATAL] Missing required env var: ${key}. Server may malfunction.`);
  }
}
for (const key of WARN_ENV) {
  if (!process.env[key]) {
    console.warn(`[WARN] Missing env var: ${key}. Feature will be degraded.`);
  }
}

const ALLOWED_ORIGINS = [
  'https://finalserveivor.com',
  'https://www.finalserveivor.com',
  'https://tennis-survivor.vercel.app',
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5173', 'http://localhost:3000'] : []),
];
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(csrfProtection);
app.use(optionalAuth);  // Attach req.userId from JWT when present (non-blocking)

app.use('/api/groups', groupsRouter);
app.use('/api/pools', poolsRouter);
app.use('/api/picks', picksRouter);
app.use('/api/draw', drawRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/auth', authRouter);
app.use('/api/tiebreaker', tiebreakerRouter);
app.use('/api/health', healthRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/support', supportRouter);
app.use('/api/ops', opsRouter);
app.use('/api/matchup', matchupRouter);

// REMOVED: /api/email-test and /api/db-check — security risk (unauthenticated).
// Use admin endpoints for diagnostics instead.



// ── Automated operations — every 15 minutes ─────────────────────────────────
cron.schedule('*/15 * * * *', async () => {
  const cronStart = Date.now();

  // 1. Process match results and grade picks
  try { await autoProcessResults(); }
  catch (err) { console.error('[cron] Results error:', err.message); }

  // 2. Send pick reminders (24h before lock)
  try { await checkPickReminders(); }
  catch (err) { console.error('[cron] Pick reminder error:', err.message); }

  // 3. Ops monitor: draw detection, withdrawals, lock time auto-setting
  try { await runOpsChecks(); }
  catch (err) { console.error('[cron] Ops monitor error:', err.message); }

  // 4. Admin digest — no-op (emails now send directly, no queue)
  try { await sendAdminDigest(); }
  catch (err) { console.error('[cron] Admin digest error:', err.message); }

  const elapsed = Date.now() - cronStart;
  if (elapsed > 30000) {
    console.warn(`[cron] Slow cycle: ${elapsed}ms`);
  }
});

// Admin routes are now in routes/admin.js, mounted at /api/admin above.
// process-results, approve-emails, and 15+ more endpoints are available there.

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Final Serve-ivor API running on 0.0.0.0:${PORT}`);

  // Queue system removed 21 Apr 2026. Old pending emails flushed in commit 7d31b4c.

});
