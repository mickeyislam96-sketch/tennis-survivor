/**
 * Admin control endpoints.
 *
 * All routes require the ADMIN_SECRET env var to be set and passed as
 * { secret: "..." } in the request body (POST) or ?secret=... (GET).
 *
 * These are emergency / operational tools — not user-facing.
 *
 * Available endpoints:
 *   POST /api/admin/process-results       — manually trigger results processing
 *   POST /api/admin/set-lock-override     — force a round's lock time (emergency)
 *   POST /api/admin/clear-lock-override   — remove a runtime lock override
 *   POST /api/admin/invalidate-cache      — flush the API-Tennis data cache
 *   POST /api/admin/eliminate-non-pickers — manually eliminate non-pickers for a round
 *   GET  /api/admin/status                — system status summary
 */

import { Router } from 'express';
import { autoProcessResults, processRoundResults, eliminateNonPickers } from '../services/resultsProcessor.js';
import {
  setRuntimeLockOverride,
  clearRuntimeLockOverride,
  getRuntimeLockOverrides,
  invalidateCache,
  getCacheStatus,
  getDeadlines,
} from '../services/tennisData.js';
import { TOURNAMENT, ROUNDS } from '../config/tournament.js';
import { pool } from '../db/pool.js';

export const adminRouter = Router();

function getAdminSecret() {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    console.error('[admin] ADMIN_SECRET env var is not set — all admin requests will be rejected');
  }
  return secret;
}

function checkSecret(req, res) {
  const secret = req.body?.secret || req.query?.secret;
  if (!secret || secret !== getAdminSecret()) {
    res.status(401).json({ error: 'Unauthorised — invalid admin secret' });
    return false;
  }
  return true;
}

// ── POST /api/admin/process-results ──────────────────────────────────────────
// Trigger results processing. Optionally for a specific round only.
adminRouter.post('/process-results', async (req, res) => {
  if (!checkSecret(req, res)) return;
  const { round } = req.body;
  try {
    const result = round
      ? await processRoundResults(round)
      : await autoProcessResults();
    res.json({ ok: true, result });
  } catch (err) {
    console.error('[admin] process-results error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/admin/set-lock-override ────────────────────────────────────────
// Override the lock time for a round. Use when API data is wrong or delayed.
// Body: { secret, round: "R32", lockAt: "2026-04-07T09:00:00Z" }
adminRouter.post('/set-lock-override', async (req, res) => {
  if (!checkSecret(req, res)) return;
  const { round, lockAt } = req.body;
  if (!round || !lockAt) {
    return res.status(400).json({ error: 'round and lockAt are required' });
  }
  if (!ROUNDS.includes(round)) {
    return res.status(400).json({ error: `Unknown round "${round}". Valid: ${ROUNDS.join(', ')}` });
  }
  const date = new Date(lockAt);
  if (Number.isNaN(date.getTime())) {
    return res.status(400).json({ error: 'lockAt must be a valid ISO date string' });
  }
  try {
    setRuntimeLockOverride(round, date.toISOString());
    res.json({ ok: true, round, lockAt: date.toISOString(), message: `Lock override set for ${round}` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/admin/clear-lock-override ──────────────────────────────────────
// Remove a runtime lock override for a round.
// Body: { secret, round: "R32" }
adminRouter.post('/clear-lock-override', async (req, res) => {
  if (!checkSecret(req, res)) return;
  const { round } = req.body;
  if (!round || !ROUNDS.includes(round)) {
    return res.status(400).json({ error: `Unknown round "${round}". Valid: ${ROUNDS.join(', ')}` });
  }
  clearRuntimeLockOverride(round);
  res.json({ ok: true, round, message: `Lock override cleared for ${round}` });
});

// ── POST /api/admin/invalidate-cache ─────────────────────────────────────────
// Flush the in-memory API cache so the next request fetches fresh data.
adminRouter.post('/invalidate-cache', async (req, res) => {
  if (!checkSecret(req, res)) return;
  invalidateCache();
  res.json({ ok: true, message: 'Cache invalidated — next request will fetch fresh data from API' });
});

// ── POST /api/admin/eliminate-non-pickers ────────────────────────────────────
// Manually eliminate players who didn't pick for a specific round.
// Only use after confirming the pick window is closed.
// Body: { secret, round: "R32" }
adminRouter.post('/eliminate-non-pickers', async (req, res) => {
  if (!checkSecret(req, res)) return;
  const { round } = req.body;
  if (!round || !ROUNDS.includes(round)) {
    return res.status(400).json({ error: `Unknown round "${round}". Valid: ${ROUNDS.join(', ')}` });
  }
  try {
    const count = await eliminateNonPickers(round);
    res.json({ ok: true, round, eliminated: count, message: `${count} non-pickers eliminated for ${round}` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/admin/status ─────────────────────────────────────────────────────
// System status overview — current tournament, cache, deadlines, runtime overrides.
adminRouter.get('/status', async (req, res) => {
  if (!checkSecret(req, res)) return;
  try {
    const [deadlines, dbResult] = await Promise.all([
      getDeadlines().catch(() => null),
      pool.query(`SELECT
        (SELECT COUNT(*) FROM users)         AS users,
        (SELECT COUNT(*) FROM groups)        AS groups,
        (SELECT COUNT(*) FROM group_members) AS members,
        (SELECT COUNT(*) FROM picks)         AS picks,
        (SELECT COUNT(*) FROM picks WHERE survived IS NULL) AS pending_picks,
        (SELECT COUNT(*) FROM group_members WHERE is_alive = true) AS alive_members
      `).catch(() => null),
    ]);

    res.json({
      ok: true,
      tournament: {
        id:        TOURNAMENT.id,
        name:      TOURNAMENT.name,
        rounds:    ROUNDS,
        apiKeySet: !!TOURNAMENT.apiTournamentKey,
      },
      cache:           getCacheStatus(),
      runtimeOverrides: getRuntimeLockOverrides(),
      deadlines,
      db:              dbResult?.rows?.[0] ?? null,
      timestamp:       new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/admin/regenerate-invite ─────────────────────────────────────────
// Generate a new invite code for a group.
// Body: { secret, groupId }
adminRouter.post('/regenerate-invite', async (req, res) => {
  if (!checkSecret(req, res)) return;
  const { groupId } = req.body;
  if (!groupId) return res.status(400).json({ error: 'groupId is required' });
  try {
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    // Get group name for prefix
    const group = await pool.query('SELECT name FROM groups WHERE id = $1::uuid', [groupId]);
    if (group.rows.length === 0) return res.status(404).json({ error: 'Group not found' });
    const prefix = group.rows[0].name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
    const newCode = `${prefix}-${suffix}`;
    await pool.query('UPDATE groups SET invite_code = $1 WHERE id = $2::uuid', [newCode, groupId]);
    res.json({ ok: true, groupId, inviteCode: newCode });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/admin/fix-r1-picks ────────────────────────────────────────────
// One-time migration: rename picks from round='R32' to round='R1'.
// These picks were submitted while the round mapping bug was active (API
// "1/32-finals" was incorrectly mapped to R32 instead of R1). The picks were
// actually R1 picks — non-seeds playing in the first round.
// After renaming, triggers results processing so R1 wins/losses get graded.
adminRouter.post('/fix-r1-picks', async (req, res) => {
  if (!checkSecret(req, res)) return;
  try {
    // Only rename picks that haven't been graded yet and were created before
    // the R32 window properly opened (i.e. before R1 lock time).
    // Safety: also check there are NO existing R1 picks (to avoid duplicates).
    const existingR1 = await pool.query(
      `SELECT COUNT(*) FROM picks WHERE round = 'R1'`
    );
    if (Number(existingR1.rows[0].count) > 0) {
      return res.json({
        ok: false,
        message: `Already ${existingR1.rows[0].count} R1 picks in DB — migration may have already run. Aborting to avoid duplicates.`,
      });
    }

    const result = await pool.query(
      `UPDATE picks SET round = 'R1' WHERE round = 'R32' RETURNING id::text, user_id::text, player_name, round`
    );

    console.log(`[admin] fix-r1-picks: renamed ${result.rowCount} picks from R32 → R1`);

    // Now trigger results processing so R1 matches get graded
    let gradeResult = null;
    if (result.rowCount > 0) {
      gradeResult = await autoProcessResults();
    }

    res.json({
      ok: true,
      renamed: result.rowCount,
      picks: result.rows,
      gradeResult,
    });
  } catch (err) {
    console.error('[admin] fix-r1-picks error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/admin/picks/:groupId ────────────────────────────────────────────
// View all picks for a group (useful for debugging / manual review).
adminRouter.get('/picks/:groupId', async (req, res) => {
  if (!checkSecret(req, res)) return;
  const { groupId } = req.params;
  try {
    const result = await pool.query(
      `SELECT p.user_id::text, gm.display_name, p.round, p.player_name, p.survived, p.created_at
         FROM picks p
         JOIN group_members gm ON gm.group_id = p.group_id AND gm.user_id = p.user_id
        WHERE p.group_id = $1::uuid
        ORDER BY gm.display_name, array_position($2::text[], p.round)`,
      [groupId, ROUNDS]
    );
    res.json({ ok: true, picks: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
