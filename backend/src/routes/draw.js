import { Router } from 'express';
import { getDraw, getRounds, getDeadlines, getRawFixtures } from '../services/tennisData.js';

export const drawRouter = Router();

// Admin guard — diagnostic endpoints. Backed by the central admin auth
// module so every call writes to admin_audit_log automatically.
import { checkSecret } from '../auth/adminAuth.js';

async function requireAdmin(req, res, next) {
  if (!await checkSecret(req, res)) return;
  next();
}

drawRouter.get('/rounds', (_, res) => {
  res.json(getRounds());
});

// Debug endpoint — shows raw API fixture fields so we can verify round mapping.
// Visit /api/draw/debug in browser or curl to inspect.
drawRouter.get('/debug', requireAdmin, async (_, res) => {
  try {
    const raw = await getRawFixtures();
    if (!raw || raw.length === 0) {
      return res.json({ message: 'No live API data — check TENNIS_API_KEY and TOURNAMENT_KEY env vars', fixtures: [] });
    }
    // Show all fixtures with the key fields we need to diagnose round splitting
    const all = raw.map(f => ({
      key: f.event_key,
      p1: f.event_first_player,
      p1key: f.first_player_key,
      p2: f.event_second_player,
      p2key: f.second_player_key,
      date: f.event_date,
      status: f.event_status,
      winner: f.event_winner,
      round: f.tournament_round,
      qualification: f.event_qualification,
      type: f.event_type_type,
    }));
    // Group by tournament_round so we can see the split clearly
    const byRound = {};
    raw.forEach(f => {
      const r = f.tournament_round || 'unknown';
      byRound[r] = (byRound[r] || 0) + 1;
    });
    res.json({ total: raw.length, byRound, all_fields: Object.keys(raw[0]), fixtures: all });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// (Removed: /fix-mock-ids and /fix-names — MC-only migration endpoints, no longer needed)

// Diagnostic: dump all picks for a group to debug grading
drawRouter.get('/debug-picks', requireAdmin, async (req, res) => {
  try {
    const groupId = req.query.groupId || '2d0d1477-0761-49c8-aaf7-d54ad466062f';
    const { pool: dbPool } = await import('../db/pool.js');
    const result = await dbPool.query(
      `SELECT p.round, p.player_id, p.player_name, p.survived, p.created_at,
              gm.display_name
       FROM picks p
       JOIN group_members gm ON gm.group_id = p.group_id AND gm.user_id = p.user_id
       WHERE p.group_id = $1::uuid
       ORDER BY p.round, gm.display_name`,
      [groupId]
    );
    res.json({ count: result.rowCount, picks: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// (Removed: /live-completed — used getLiveDraw which was removed in tennisData refactor)

drawRouter.get('/bracket', async (req, res) => {
  try {
    const round = req.query.round || 'R32';
    const data = await getDraw(round);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to load draw' });
  }
});

drawRouter.get('/players', async (req, res) => {
  try {
    const round = req.query.round || 'R32';
    const data = await getDraw(round);
    const stillIn = (data.players || []).filter((p) => !p.roundEliminated);
    res.json(stillIn);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to load players' });
  }
});

drawRouter.get('/deadlines', async (_, res) => {
  try {
    const deadlines = await getDeadlines();
    res.json(deadlines);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to load deadlines' });
  }
});
