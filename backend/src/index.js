import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db/pool.js';
import { groupsRouter } from './routes/groups.js';
import { picksRouter } from './routes/picks.js';
import { drawRouter } from './routes/draw.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { authRouter } from './routes/auth.js';
import { tiebreakerRouter } from './routes/tiebreaker.js';

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

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/groups', groupsRouter);
app.use('/api/picks', picksRouter);
app.use('/api/draw', drawRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/auth', authRouter);
app.use('/api/tiebreaker', tiebreakerRouter);

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Tennis Survivor API running on http://localhost:${PORT}`);
});
