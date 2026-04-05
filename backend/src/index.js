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
import { matchupRouter } from './routes/matchup.js';

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
app.use(express.json());

app.use('/api/groups', groupsRouter);
app.use('/api/pools', poolsRouter);
app.use('/api/picks', picksRouter);
app.use('/api/draw', drawRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/auth', authRouter);
app.use('/api/tiebreaker', tiebreakerRouter);
app.use('/api/health', healthRouter);
app.use('/api/matchup', matchupRouter);

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

    // Run results processing after migrations
    if (r32picks.rowCount > 0 || idFixCount > 0) {
      await autoProcessResults();
      console.log('[migration] Results processing complete after migrations');
    }
  } catch (err) {
    console.error('[migration] error:', err.message);
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
