import 'dotenv/config';
import cron from 'node-cron';
import { autoProcessResults, processRoundResults } from './services/resultsProcessor.js';

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

app.use(cors({ origin: '*', credentials: false }));
app.use(express.json());

app.use('/api/groups', groupsRouter);
app.use('/api/pools', poolsRouter);
app.use('/api/picks', picksRouter);
app.use('/api/draw', drawRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/auth', authRouter);
app.use('/api/tiebreaker', tiebreakerRouter);

app.get('/api/health', (_, res) => res.json({ ok: true }));

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


// ── Temporary migration endpoint — bulk-add all registered users to a group ──
app.post('/api/admin/bulk-join', async (req, res) => {
  const { groupId, secret } = req.body;
  if (secret !== 'fsv-miami-migrate-2026') {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  try {
    const users = await pool.query('SELECT id::text, display_name FROM users');
    let added = 0;
    for (const user of users.rows) {
      try {
        await pool.query(
          `INSERT INTO group_members (group_id, user_id, display_name, is_alive)
           VALUES ($1, $2, $3, true)
           ON CONFLICT (group_id, user_id) DO NOTHING`,
          [groupId, user.id, user.display_name]
        );
        added++;
      } catch (_) {}
    }
    const count = await pool.query(
      'SELECT COUNT(*) FROM group_members WHERE group_id = $1', [groupId]
    );
    res.json({ ok: true, usersFound: users.rows.length, added, totalMembers: Number(count.rows[0].count) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ── Automated results processor — every 15 minutes ───────────────────────────
cron.schedule('*/15 * * * *', async () => {
  try { await autoProcessResults(); }
  catch (err) { console.error('[cron] Results error:', err.message); }
});

// Admin: manually trigger results processing
// POST /api/admin/process-results { secret, round? }
app.post('/api/admin/process-results', async (req, res) => {
  const { secret, round } = req.body;
  if (secret !== 'fsv-miami-2026') {
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

app.listen(PORT, () => {
  console.log(`Final Serve-ivor API running on http://localhost:${PORT}`);
});
