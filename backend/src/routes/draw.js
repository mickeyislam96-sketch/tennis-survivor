import { Router } from 'express';
import { getDraw, getLiveDraw, getRounds, getDeadlines, getRawFixtures } from '../services/tennisData.js';

export const drawRouter = Router();

// Admin guard — diagnostic/fix endpoints require ?secret=ADMIN_SECRET
function requireAdmin(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.query.secret !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
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

// One-shot migration: replace mock player IDs with API keys
drawRouter.get('/fix-mock-ids', requireAdmin, async (_, res) => {
  try {
    const { API_KEY_MAP } = await import('../data/monteCarloMockDraw.js');
    const { pool: dbPool } = await import('../db/pool.js');
    const { autoProcessResults } = await import('../services/resultsProcessor.js');

    let fixed = 0;
    const details = [];
    for (const [mockId, apiKey] of Object.entries(API_KEY_MAP)) {
      const upd = await dbPool.query(
        `UPDATE picks SET player_id = $1 WHERE player_id = $2 RETURNING id, player_name`,
        [apiKey, mockId]
      );
      if (upd.rowCount > 0) {
        fixed += upd.rowCount;
        details.push({ mockId, apiKey, updated: upd.rows.map(r => r.player_name) });
      }
    }

    let gradeResult = null;
    if (fixed > 0) {
      gradeResult = await autoProcessResults();
    }

    res.json({ ok: true, fixed, details, gradeResult });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, stack: e.stack });
  }
});

// One-shot fix: normalise abbreviated player names to canonical mock draw names
drawRouter.get('/fix-names', requireAdmin, async (_, res) => {
  try {
    const { API_KEY_MAP, MC_PLAYERS } = await import('../data/monteCarloMockDraw.js');
    const { pool: dbPool } = await import('../db/pool.js');
    const apiKeyToName = new Map();
    for (const p of MC_PLAYERS) {
      const apiKey = API_KEY_MAP[p.id];
      if (apiKey) apiKeyToName.set(String(apiKey), p.name);
    }
    let fixed = 0;
    const details = [];
    for (const [apiKey, canonicalName] of apiKeyToName) {
      const upd = await dbPool.query(
        `UPDATE picks SET player_name = $1
         WHERE player_id = $2 AND player_name IS DISTINCT FROM $1
         RETURNING id, player_name AS old_name`,
        [canonicalName, apiKey]
      );
      if (upd.rowCount > 0) {
        fixed += upd.rowCount;
        details.push({ apiKey, canonicalName, oldNames: upd.rows.map(r => r.old_name) });
      }
    }
    res.json({ ok: true, fixed, details });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, stack: e.stack });
  }
});

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

// Diagnostic: what the results processor sees (getLiveDraw completed matches)
drawRouter.get('/live-completed', requireAdmin, async (_, res) => {
  try {
    const draw = await getLiveDraw();
    const completed = (draw.matches || []).filter(m => m.status === 'completed' && m.winnerId);
    res.json({
      dataSource: draw.dataSource,
      totalMatches: (draw.matches || []).length,
      completed: completed.map(m => ({
        id: m.id, round: m.round,
        p1Id: m.player1Id, p1Name: m.player1Name,
        p2Id: m.player2Id, p2Name: m.player2Name,
        winnerId: m.winnerId, winnerName: m.winnerName,
        score: m.score,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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
