import 'dotenv/config';
import cron from 'node-cron';
import { autoProcessResults } from './services/resultsProcessor.js';

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db/pool.js';
import { sendWelcomeEmail, sendPasswordResetEmail } from './utils/email.js';
import { groupsRouter } from './routes/groups.js';
import { picksRouter } from './routes/picks.js';
import { drawRouter } from './routes/draw.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { authRouter } from './routes/auth.js';
import { tiebreakerRouter } from './routes/tiebreaker.js';
import { poolsRouter } from './routes/pools.js';
import { healthRouter } from './routes/health.js';
import { adminRouter } from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

// Auto-initialise schema on startup (CREATE TABLE IF NOT EXISTS is idempotent)
try {
  const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('Database schema ready.');
} catch (err) {
  console.error('Schema init error:', err.message);
}

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
});

// Admin routes — auth via ADMIN_SECRET env var
app.use('/api/admin', adminRouter);

app.listen(PORT, () => {
  console.log(`Final Serve-ivor API running on http://localhost:${PORT}`);
});
