/**
 * ops.js — Operations endpoints.
 *
 * All routes require ADMIN_SECRET for auth.
 * These power the daily brief and tournament setup automation.
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getOpsSummary, setupTournament, logOps } from '../services/opsMonitor.js';
import { pool } from '../db/pool.js';
import { TOURNAMENT } from '../config/activeTournament.js';

export const opsRouter = Router();

// Rate-limit ops routes
opsRouter.use(rateLimit({
  windowMs: 60 * 1000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests.' },
}));

// ── Auth middleware ──────────────────────────────────────────────────────────
// Accepts Authorization: Bearer <secret> or body.secret (POST). No query params.
function requireAdmin(req, res, next) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return res.status(401).json({ error: 'Unauthorised' });

  let provided = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    provided = authHeader.slice(7);
  }
  if (!provided && req.body?.secret) {
    provided = req.body.secret;
  }

  if (!provided || provided !== adminSecret) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  next();
}

opsRouter.use(requireAdmin);

// ── GET /api/ops/summary ────────────────────────────────────────────────────
// Returns a structured overview of the last N hours of operations.
// This is what the daily Cowork scheduled task reads to generate the brief.
//
// Query params:
//   hours (default: 24) — how far back to look
//
opsRouter.get('/summary', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const summary = await getOpsSummary(hours);
    res.json(summary);
  } catch (err) {
    console.error('[ops] Summary error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/ops/log ────────────────────────────────────────────────────────
// Raw ops log with filtering. For debugging and detailed review.
//
// Query params:
//   category — filter by category (results, withdrawal, draw, lock_time, etc.)
//   hours (default: 48) — how far back to look
//   limit (default: 100) — max entries
//
opsRouter.get('/log', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 48;
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const category = req.query.category || null;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    let query = `SELECT id, category, action, details, tournament_id, created_at
                   FROM ops_log
                  WHERE tournament_id = $1 AND created_at >= $2`;
    const params = [TOURNAMENT.id, since];

    if (category) {
      query += ` AND category = $3`;
      params.push(category);
    }

    query += ` ORDER BY created_at DESC LIMIT ${limit}`;

    const { rows } = await pool.query(query, params);
    res.json({ count: rows.length, entries: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ops/setup-tournament ──────────────────────────────────────────
// Create a new tournament group with all DB records.
//
// Body: {
//   tournamentId: 'madrid-2026',       — must match an activeTournament config
//   groupName: 'Madrid 2026',          — display name
//   entryFeeCents: 0,                  — 0 for free, 1000 for £10
//   adminUserId: 'uuid'               — optional, defaults to null
// }
//
opsRouter.post('/setup-tournament', async (req, res) => {
  try {
    const { tournamentId, groupName, entryFeeCents, adminUserId } = req.body;

    if (!tournamentId || !groupName) {
      return res.status(400).json({ error: 'tournamentId and groupName are required' });
    }

    const result = await setupTournament({
      tournamentId,
      groupName,
      entryFeeCents: entryFeeCents || 0,
      adminUserId: adminUserId || null,
    });

    res.json(result);
  } catch (err) {
    console.error('[ops] Tournament setup error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/ops/health-deep ────────────────────────────────────────────────
// Deep health check: tests every component the automation depends on.
// Returns pass/fail for each with details.
//
opsRouter.get('/health-deep', async (req, res) => {
  const checks = {};

  // 1. Database
  try {
    const start = Date.now();
    const { rows } = await pool.query('SELECT 1 AS ok');
    checks.database = { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    checks.database = { status: 'fail', error: err.message };
  }

  // 2. Ops log table exists
  try {
    await pool.query('SELECT COUNT(*) FROM ops_log LIMIT 1');
    checks.opsLogTable = { status: 'ok' };
  } catch (err) {
    checks.opsLogTable = { status: 'fail', error: err.message };
  }

  // 3. Data provider
  try {
    const { fetchFixtures } = await import('../services/dataAdapter.js');
    const start = Date.now();
    const { provider, fixtures } = await fetchFixtures();
    checks.dataProvider = {
      status: fixtures.length > 0 ? 'ok' : 'no_data',
      provider,
      fixtureCount: fixtures.length,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    checks.dataProvider = { status: 'fail', error: err.message };
  }

  // 4. Tournament config
  checks.tournamentConfig = {
    status: 'ok',
    id: TOURNAMENT.id,
    name: TOURNAMENT.name,
    r1PerMatchLock: TOURNAMENT.r1PerMatchLock,
    goalserveKeySet: !!process.env.GOALSERVE_API_KEY,
  };

  // 5. Email service
  checks.emailService = {
    status: process.env.BREVO_API_KEY ? 'ok' : 'no_key',
    brevoKeySet: !!process.env.BREVO_API_KEY,
  };

  // 6. Active groups for tournament
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count FROM groups WHERE tournament_id = $1`,
      [TOURNAMENT.id]
    );
    checks.tournamentGroups = {
      status: 'ok',
      count: Number(rows[0].count),
    };
  } catch (err) {
    checks.tournamentGroups = { status: 'fail', error: err.message };
  }

  const allOk = Object.values(checks).every(c => c.status === 'ok');
  res.status(allOk ? 200 : 207).json({
    overall: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  });
});
