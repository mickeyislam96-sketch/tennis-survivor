import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../db/pool.js';
import { getDraw, getDeadlines } from '../services/tennisData.js';
import { getRounds } from '../services/tennisData.js';
import { MOCK_PICKS } from '../data/mockGroups.js';
import { TOURNAMENT } from '../config/activeTournament.js';
import { fetchFixtures, getR1MatchTimes, hasMatchStarted, isR1Closed } from '../services/dataAdapter.js';

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
  const isR1 = currentRound === 'R1';
  const usePerMatchLock = isR1 && TOURNAMENT.r1PerMatchLock;

  // ── R1 per-match lock path ─────────────────────────────────────────────
  // For R1: return all R1 players whose match has NOT yet started.
  // Each player includes their match start time and opponent info.
  if (usePerMatchLock) {
    try {
      const { fixtures } = await fetchFixtures();

      if (fixtures.length > 0) {
        const r1Fixtures = fixtures.filter(f => f.round === 'R1');
        const now = new Date();
        const availablePlayers = [];

        for (const f of r1Fixtures) {
          const matchStarted =
            ['live', 'completed', 'walkover', 'retired'].includes(f.status) ||
            (f.startTime && now >= new Date(f.startTime));

          if (matchStarted) continue; // both players in this match are unavailable

          // Add both players from this unstarted match
          const p1 = (draw.players || []).find(p => p.id === f.player1Id);
          const p2 = (draw.players || []).find(p => p.id === f.player2Id);

          if (p1 && !p1.roundEliminated) {
            availablePlayers.push({
              ...p1,
              matchStartTime: f.startTime || null,
              opponentId: f.player2Id,
              opponentName: f.player2Name || p2?.name || 'TBD',
              matchStatus: f.status,
            });
          }
          if (p2 && !p2.roundEliminated) {
            availablePlayers.push({
              ...p2,
              matchStartTime: f.startTime || null,
              opponentId: f.player1Id,
              opponentName: f.player1Name || p1?.name || 'TBD',
              matchStatus: f.status,
            });
          }
        }

        if (availablePlayers.length > 0) return availablePlayers;
      }
    } catch (e) {
      console.warn('[picks] R1 per-match lock available players failed, using fallback:', e.message);
    }

    // Fallback for R1: use draw data (no per-match filtering)
    const r1Matches = (draw.matches || []).filter(m => m.round === 'R1');
    const r1PlayerIds = new Set(
      r1Matches.flatMap(m => [m.player1Id, m.player2Id]).filter(Boolean)
    );
    return (draw.players || [])
      .filter(p => !p.roundEliminated && r1PlayerIds.has(p.id));
  }

  // ── R2+ standard path (existing logic) ─────────────────────────────────
  // Build pending/confirmed sets from the previous round up-front.
  const prevRoundIndex = ROUNDS.indexOf(currentRound) - 1;
  const pendingFromPrevRound = new Set();
  if (prevRoundIndex >= 0) {
    const prevRound = ROUNDS[prevRoundIndex];
    (draw.matches || [])
      .filter(m => m.round === prevRound)
      .forEach(m => {
        if (!m.winnerId) {
          if (m.player1Id) pendingFromPrevRound.add(m.player1Id);
          if (m.player2Id) pendingFromPrevRound.add(m.player2Id);
        }
      });
  }

  // Build the set of players who actually have a match this round.
  const roundMatches = (draw.matches || []).filter(m => m.round === currentRound);
  if (roundMatches.length > 0) {
    const playingThisRound = new Set(
      roundMatches.flatMap(m => [m.player1Id, m.player2Id]).filter(Boolean)
    );

    // Supplement with players from the previous round who may still advance.
    if (prevRoundIndex >= 0) {
      const prevRound = ROUNDS[prevRoundIndex];
      (draw.matches || [])
        .filter(m => m.round === prevRound)
        .forEach(m => {
          if (m.winnerId) {
            playingThisRound.add(m.winnerId);
          } else {
            const p1Confirmed = m.player1Id && playingThisRound.has(m.player1Id);
            const p2Confirmed = m.player2Id && playingThisRound.has(m.player2Id);
            if (!p1Confirmed && !p2Confirmed) {
              if (m.player1Id) playingThisRound.add(m.player1Id);
              if (m.player2Id) playingThisRound.add(m.player2Id);
            }
          }
        });
    }

    const playerPool = (draw.players || [])
      .filter(p => !p.roundEliminated && playingThisRound.has(p.id))
      .map(p => pendingFromPrevRound.has(p.id) ? { ...p, pendingPrevRound: true } : p);

    if (playerPool.length > 0) return playerPool;
  }

  // Fallback: return all non-eliminated players.
  return (draw.players || [])
    .filter(p => !p.roundEliminated)
    .map(p => pendingFromPrevRound.has(p.id) ? { ...p, pendingPrevRound: true } : p);
}

// GET /api/picks/available?groupId=&round=
picksRouter.get('/available', async (req, res) => {
  try {
    const { groupId, round } = req.query;
    const userId = req.userId || req.query.userId;  // JWT or legacy query param
    if (!userId || !groupId) {
      return res.status(400).json({ error: 'userId and groupId required' });
    }
    const available = await getAvailablePlayers(userId, groupId, round || 'R32');
    res.json(available);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to load available players' });
  }
});

// GET /api/picks/history?groupId=
picksRouter.get('/history', async (req, res) => {
  const userId = req.userId || req.query.userId;  // JWT or legacy query param
  const { groupId } = req.query;

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
    const { groupId, round, playerId, playerName } = req.body;
  const userId = req.userId || req.body.userId;  // JWT or legacy
    if (!userId || !groupId || !round || !playerId) {
      return res.status(400).json({ error: 'userId, groupId, round, playerId required' });
    }

    // Validate pick window — R1 per-match lock (if enabled), otherwise round-level lock
    const isR1 = round === 'R1';
    const usePerMatchLock = isR1 && TOURNAMENT.r1PerMatchLock;

    if (usePerMatchLock) {
      // R1 per-match lock: check if this specific player's match has started
      try {
        const { fixtures } = await fetchFixtures();
        if (fixtures.length > 0) {
          // Check if ALL R1 matches have started (window fully closed)
          if (isR1Closed(fixtures)) {
            return res.status(400).json({ error: 'All Round 1 matches have started. Pick window is closed.' });
          }

          // Check if this specific player's match has started
          const matchTimes = getR1MatchTimes(fixtures);
          const playerMatch = matchTimes.get(playerId);
          if (playerMatch && hasMatchStarted(playerMatch)) {
            return res.status(400).json({
              error: `This player's match has already started. Choose a player whose match hasn't begun yet.`
            });
          }
        }
        // If no fixture data available, allow the pick (graceful degradation)
      } catch (e) {
        console.warn('[picks] R1 per-match lock check failed, allowing pick:', e.message);
      }
    } else {
      // R2+ round-level lock: existing deadline-based logic
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
    }

    // Check if the user is eliminated — eliminated players cannot submit picks
    if (isUUID(userId) && isUUID(groupId)) {
      const memberCheck = await pool.query(
        'SELECT is_alive FROM group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, userId]
      );
      if (memberCheck.rows.length > 0 && memberCheck.rows[0].is_alive === false) {
        return res.status(403).json({ error: 'You have been eliminated and can no longer make picks' });
      }
    }

    // Validate player is in the draw and not eliminated
    const available = await getAvailablePlayers(userId, groupId, round);
    if (!available.some(p => p.id === playerId)) {
      return res.status(400).json({ error: 'Player not available for pick' });
    }

    const resolvedName = playerName || available.find(p => p.id === playerId)?.name || '';

    if (isUUID(userId) && isUUID(groupId)) {
      try {
        // Check player not already used in a DIFFERENT round by this user in this group.
        // We exclude the current round so that changing a pick mid-window is allowed —
        // the existing pick for THIS round is being replaced, not double-counted.
        const usedResult = await pool.query(
          'SELECT player_id, player_name FROM picks WHERE user_id = $1 AND group_id = $2 AND round != $3',
          [userId, groupId, round]
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

        // UPSERT — insert new pick, or update player if they're changing within the open window.
        // The survived field is reset to NULL on change since the round hasn't been graded yet.
        const result = await pool.query(
          `INSERT INTO picks (group_id, user_id, round, player_id, player_name, survived)
           VALUES ($1, $2, $3, $4, $5, NULL)
           ON CONFLICT (group_id, user_id, round)
           DO UPDATE SET player_id = EXCLUDED.player_id,
                         player_name = EXCLUDED.player_name,
                         survived = NULL
           RETURNING id::text, group_id::text, user_id::text, round, player_id, player_name, survived, created_at`,
          [groupId, userId, round, playerId, resolvedName]
        );
        return res.status(201).json(rowToPick(result.rows[0]));
      } catch (e) {
        console.error('DB picks upsert error:', e.message);
        return res.status(500).json({ error: 'Failed to submit pick' });
      }
    }

    // Mock fallback
    const myPicks = MOCK_PICKS.filter(p => p.userId === userId && p.groupId === groupId);
    // Exclude current round from "already used" check (same logic as DB path)
    const otherRoundPicks = myPicks.filter(p => p.round !== round);
    const alreadyUsedId = otherRoundPicks.some(p => p.playerId === playerId);
    const normalizedName = resolvedName.toLowerCase().trim();
    const alreadyUsedName = normalizedName && otherRoundPicks.some(
      p => (p.playerName || '').toLowerCase().trim() === normalizedName
    );
    if (alreadyUsedId || alreadyUsedName) {
      return res.status(400).json({ error: 'Player already used in a previous round' });
    }
    // Update existing pick if one exists (change), otherwise push a new one
    const existingIdx = MOCK_PICKS.findIndex(
      p => p.userId === userId && p.groupId === groupId && p.round === round
    );
    if (existingIdx >= 0) {
      MOCK_PICKS[existingIdx] = { ...MOCK_PICKS[existingIdx], playerId, playerName: resolvedName, survived: null };
      return res.status(201).json(MOCK_PICKS[existingIdx]);
    }

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
