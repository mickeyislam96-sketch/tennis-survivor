import { Router } from 'express';
import { pool } from '../db/pool.js';
import { getDraw, getDeadlines } from '../services/tennisData.js';
import { getRounds } from '../services/tennisData.js';
import { MOCK_PICKS } from '../data/mockGroups.js';

export const picksRouter = Router();

const ROUNDS = getRounds();

function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ''));
}

function rowToPick(p) {
  return {
    id: p.id,
    groupId: p.group_id,
    userId: p.user_id,
    round: p.round,
    playerId: p.player_id,
    playerName: p.player_name,
    survived: p.survived,
    createdAt: p.created_at,
  };
}

async function getAvailablePlayers(userId, groupId, currentRound) {
  const draw = await getDraw(currentRound);
  return (draw.players || []).filter(p => !p.roundEliminated);
}

// GET /api/picks/available?userId=&groupId=&round=
picksRouter.get('/available', async (req, res) => {
  try {
    const { userId, groupId, round } = req.query;
    if (!userId || !groupId) {
      return res.status(400).json({ error: 'userId and groupId required' });
    }
    const available = await getAvailablePlayers(userId, groupId, round || 'R32');
    res.json(available);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to load available players' });
  }
});

// GET /api/picks/history?userId=&groupId=
picksRouter.get('/history', async (req, res) => {
  const { userId, groupId } = req.query;

  if (isUUID(userId) && isUUID(groupId)) {
    try {
      const result = await pool.query(
        `SELECT id::text, group_id::text, user_id::text, round, player_id, player_name, survived, created_at
         FROM picks
         WHERE user_id = $1 AND group_id = $2
         ORDER BY array_position(ARRAY['R1','R64','R32','R16','QF','SF','F']::text[], round)`,
        [userId, groupId]
      );
      return res.json(result.rows.map(rowToPick));
    } catch (e) {
      console.error('DB picks history error:', e.message);
    }
  }

  // Mock fallback
  const picks = MOCK_PICKS.filter(
    p => p.userId === userId && p.groupId === groupId
  ).sort((a, b) => ROUNDS.indexOf(a.round) - ROUNDS.indexOf(b.round));
  res.json(picks);
});

// POST /api/picks
picksRouter.post('/', async (req, res) => {
  try {
    const { userId, groupId, round, playerId, playerName } = req.body;
    if (!userId || !groupId || !round || !playerId) {
      return res.status(400).json({ error: 'userId, groupId, round, playerId required' });
    }

    // Validate pick window
    const deadlines = await getDeadlines();
    const roundDeadline = Array.isArray(deadlines)
      ? deadlines.find(d => d.round === round)
      : null;

    if (roundDeadline) {
      const now = new Date();
      const lockAt = roundDeadline.lockAt ? new Date(roundDeadline.lockAt) : null;
      const isLocked = lockAt && now >= lockAt;
      const isOpen = roundDeadline.isOpen !== false;
      if (isLocked) return res.status(400).json({ error: 'Picks for this round are locked' });
      if (!isOpen) return res.status(400).json({ error: 'Picks for this round are not yet open' });
    }

    // Validate player is in the draw and not eliminated
    const available = await getAvailablePlayers(userId, groupId, round);
    if (!available.some(p => p.id === playerId)) {
      return res.status(400).json({ error: 'Player not available for pick' });
    }

    const resolvedName = playerName || available.find(p => p.id === playerId)?.name || '';

    if (isUUID(userId) && isUUID(groupId)) {
      try {
        // Check player not already used by this user in this group
        const usedResult = await pool.query(
          'SELECT player_id, player_name FROM picks WHERE user_id = $1 AND group_id = $2',
          [userId, groupId]
        );
        const usedIds = new Set(usedResult.rows.map(p => p.player_id));
        const usedNames = new Set(usedResult.rows.map(p => (p.player_name || '').toLowerCase().trim()));

        const normalizedName = resolvedName.toLowerCase().trim();
        if (usedIds.has(playerId)) {
          return res.status(400).json({ error: 'Player already used in a previous round' });
        }
        if (normalizedName && usedNames.has(normalizedName)) {
          return res.status(400).json({ error: 'Player already used in a previous round' });
        }

        // Insert — UNIQUE(group_id, user_id, round) will reject duplicate picks for same round
        const result = await pool.query(
          `INSERT INTO picks (group_id, user_id, round, player_id, player_name, survived)
           VALUES ($1, $2, $3, $4, $5, NULL)
           RETURNING id::text, group_id::text, user_id::text, round, player_id, player_name, survived, created_at`,
          [groupId, userId, round, playerId, resolvedName]
        );
        return res.status(201).json(rowToPick(result.rows[0]));
      } catch (e) {
        if (e.code === '23505') {
          return res.status(400).json({ error: 'Already picked for this round' });
        }
        console.error('DB picks insert error:', e.message);
        return res.status(500).json({ error: 'Failed to submit pick' });
      }
    }

    // Mock fallback
    const myPicks = MOCK_PICKS.filter(p => p.userId === userId && p.groupId === groupId);
    const alreadyUsedId = myPicks.some(p => p.playerId === playerId);
    const normalizedName = resolvedName.toLowerCase().trim();
    const alreadyUsedName = normalizedName && myPicks.some(
      p => (p.playerName || '').toLowerCase().trim() === normalizedName
    );
    if (alreadyUsedId || alreadyUsedName) {
      return res.status(400).json({ error: 'Player already used in a previous round' });
    }
    const existing = MOCK_PICKS.find(
      p => p.userId === userId && p.groupId === groupId && p.round === round
    );
    if (existing) return res.status(400).json({ error: 'Already picked for this round' });

    const pick = {
      id: 'pick' + Date.now(),
      groupId,
      userId,
      round,
      playerId,
      playerName: resolvedName,
      survived: null,
      createdAt: new Date().toISOString(),
    };
    MOCK_PICKS.push(pick);
    res.status(201).json(pick);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to submit pick' });
  }
});
