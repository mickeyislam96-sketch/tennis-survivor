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

/**
 * Check if a player is a qualifier placeholder (unnamed — not yet known).
 * These should appear in the bracket but NOT in the pick pool.
 */
function isQualifierPlaceholder(p) {
  if (!p?.name) return true;
  const n = p.name.trim().toLowerCase();
  return n.startsWith('qualifier') || n === 'tbd' || n === 'bye';
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

          if (p1 && !p1.roundEliminated && !isQualifierPlaceholder(p1)) {
            availablePlayers.push({
              ...p1,
              matchStartTime: f.startTime || null,
              opponentId: f.player2Id,
              opponentName: f.player2Name || p2?.name || 'TBD',
              matchStatus: f.status,
            });
          }
          if (p2 && !p2.roundEliminated && !isQualifierPlaceholder(p2)) {
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
    // Exclude bye matches — seeds with byes don't play R1
    const r1Matches = (draw.matches || []).filter(m => m.round === 'R1' && !m.bye);
    const r1PlayerIds = new Set(
      r1Matches.flatMap(m => [m.player1Id, m.player2Id]).filter(Boolean)
    );
    return (draw.players || [])
      .filter(p => !p.roundEliminated && r1PlayerIds.has(p.id) && !isQualifierPlaceholder(p));
  }

  // ── R1 without per-match lock ──────────────────────────────────────────
  // Seeds have R1 byes — they don't play R1 and must not appear in the pool.
  // This runs when r1PerMatchLock is disabled (standard fixed-deadline R1).
  if (isR1) {
    const r1Matches = (draw.matches || []).filter(m => m.round === 'R1' && !m.bye);
    const r1PlayerIds = new Set(
      r1Matches.flatMap(m => [m.player1Id, m.player2Id]).filter(Boolean)
    );
    // Build opponent + start time map from R1 matches
    const opponentMap = {};
    for (const m of r1Matches) {
      if (m.player1Id) {
        opponentMap[m.player1Id] = {
          opponentId: m.player2Id,
          opponentName: m.player2Name || 'TBD',
          matchStartTime: m.startTime || null,
          matchStatus: m.status || 'scheduled',
        };
      }
      if (m.player2Id) {
        opponentMap[m.player2Id] = {
          opponentId: m.player1Id,
          opponentName: m.player1Name || 'TBD',
          matchStartTime: m.startTime || null,
          matchStatus: m.status || 'scheduled',
        };
      }
    }
    return (draw.players || [])
      .filter(p => !p.roundEliminated && r1PlayerIds.has(p.id) && !isQualifierPlaceholder(p))
      .map(p => ({ ...p, ...(opponentMap[p.id] || {}) }));
  }

  // ── R2+ standard path ─────────────────────────────────────────────────
  // Build pending/confirmed sets from the previous round up-front.
  const prevRoundIndex = ROUNDS.indexOf(currentRound) - 1;
  const prevRound = prevRoundIndex >= 0 ? ROUNDS[prevRoundIndex] : null;
  const pendingFromPrevRound = new Set();
  const prevRoundMatchesSorted = [];
  if (prevRound) {
    const prevMatches = (draw.matches || [])
      .filter(m => m.round === prevRound)
      .sort((a, b) => (a.matchOrder ?? 0) - (b.matchOrder ?? 0));
    prevRoundMatchesSorted.push(...prevMatches);
    for (const m of prevMatches) {
      if (!m.winnerId) {
        if (m.player1Id) pendingFromPrevRound.add(m.player1Id);
        if (m.player2Id) pendingFromPrevRound.add(m.player2Id);
      }
    }
  }

  // Sort current-round matches by matchOrder so feeder relationship works
  // (feederN_index = currentMatchIndex * 2 + 0/1 in matchOrder space).
  const roundMatches = (draw.matches || [])
    .filter(m => m.round === currentRound)
    .sort((a, b) => (a.matchOrder ?? 0) - (b.matchOrder ?? 0));

  // Build opponent map for this round.
  // For each match slot, identify all "candidate" players that could end up
  // playing in that slot:
  //   - If the slot has a player ID set (seed entered, or winner propagated)
  //     → that player is the only candidate.
  //   - Otherwise → walk back to the prev-round feeder match. If feeder has
  //     a winner, use that single candidate; if not, the candidates are both
  //     feeder players (TBD).
  // Then for each candidate in slot1, their opponent info reflects slot2 (and
  // vice versa). Single candidate on the other side → opponentName. Multiple
  // candidates → opponentPossible array (frontend renders "vs A or B").
  const opponentMap = {};
  function slotCandidates(slotPlayerId, slotPlayerName, feeder) {
    if (slotPlayerId) {
      return [{ id: slotPlayerId, name: slotPlayerName || null }];
    }
    if (!feeder) return [];
    if (feeder.winnerId) {
      return [{ id: feeder.winnerId, name: feeder.winnerName || null }];
    }
    const cands = [];
    if (feeder.player1Id) cands.push({ id: feeder.player1Id, name: feeder.player1Name || null });
    if (feeder.player2Id) cands.push({ id: feeder.player2Id, name: feeder.player2Name || null });
    return cands;
  }
  for (let i = 0; i < roundMatches.length; i++) {
    const m = roundMatches[i];
    const feeder1 = prevRoundMatchesSorted[i * 2] || null;
    const feeder2 = prevRoundMatchesSorted[i * 2 + 1] || null;
    const slot1 = slotCandidates(m.player1Id, m.player1Name, feeder1);
    const slot2 = slotCandidates(m.player2Id, m.player2Name, feeder2);

    const baseEntry = {
      matchStartTime: m.startTime || null,
      matchStatus: m.status || 'scheduled',
    };
    const opponentEntry = (otherSlot) => {
      if (otherSlot.length === 1) {
        return { opponentId: otherSlot[0].id, opponentName: otherSlot[0].name };
      }
      const possibles = otherSlot.map(c => c.name).filter(Boolean);
      return { opponentName: null, opponentPossible: possibles };
    };
    for (const c of slot1) {
      opponentMap[c.id] = { ...opponentEntry(slot2), ...baseEntry };
    }
    for (const c of slot2) {
      opponentMap[c.id] = { ...opponentEntry(slot1), ...baseEntry };
    }
  }

  // Build the set of players who actually have a match this round.
  if (roundMatches.length > 0) {
    const playingThisRound = new Set(
      roundMatches.flatMap(m => [m.player1Id, m.player2Id]).filter(Boolean)
    );

    // Supplement with players from the previous round who may still advance.
    if (prevRound) {
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
      .filter(p => !p.roundEliminated && playingThisRound.has(p.id) && !isQualifierPlaceholder(p))
      .map(p => ({
        ...p,
        ...(opponentMap[p.id] || {}),
        ...(pendingFromPrevRound.has(p.id) ? { pendingPrevRound: true } : {}),
      }));

    if (playerPool.length > 0) return playerPool;
  }

  // Fallback: return all non-eliminated players (without opponent info — the
  // round structure doesn't yet allow us to resolve matchups).
  return (draw.players || [])
    .filter(p => !p.roundEliminated && !isQualifierPlaceholder(p))
    .map(p => ({
      ...p,
      ...(opponentMap[p.id] || {}),
      ...(pendingFromPrevRound.has(p.id) ? { pendingPrevRound: true } : {}),
    }));
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
  const requestingUserId = req.userId;  // from JWT (the person making the request)
  const targetUserId = req.userId || req.query.userId;  // whose picks to fetch
  const { groupId } = req.query;

  // Determine which round is currently open (unlocked) so we can hide
  // other users' picks for that round
  let openRound = null;
  const isOwnPicks = requestingUserId && requestingUserId === targetUserId;
  if (!isOwnPicks) {
    try {
      const deadlines = await getDeadlines();
      const currentlyOpen = deadlines.find((d) => d.isOpen);
      if (currentlyOpen) openRound = currentlyOpen.round;
    } catch (_) {}
  }

  if (isUUID(targetUserId) && isUUID(groupId)) {
    try {
      const result = await pool.query(
        `SELECT id::text, group_id::text, user_id::text, round, player_id, player_name, survived, created_at
         FROM picks
         WHERE user_id = $1 AND group_id = $2
         ORDER BY array_position(ARRAY['R1','R64','R32','R16','QF','SF','F']::text[], round)`,
        [targetUserId, groupId]
      );
      let picks = result.rows.map(rowToPick);
      // Strip open-round picks when viewing someone else's history
      if (openRound) {
        picks = picks.filter(p => p.round !== openRound);
      }
      return res.json(picks);
    } catch (e) {
      console.error('DB picks history error:', e.message);
    }
  }

  // Mock fallback
  let picks = MOCK_PICKS.filter(
    p => p.userId === targetUserId && p.groupId === groupId
  ).sort((a, b) => ROUNDS.indexOf(a.round) - ROUNDS.indexOf(b.round));
  if (openRound) {
    picks = picks.filter(p => p.round !== openRound);
  }
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

    // Membership + eliminated check.
    // CRITICAL: previously this only rejected eliminated members, silently
    // accepting picks from non-members. That created phantom picks for
    // accounts whose join failed (the pick screen showed a 'current pick'
    // not present in the leaderboard, since group_members had no row).
    // Now: must be a member, and must be alive.
    if (isUUID(userId) && isUUID(groupId)) {
      const memberCheck = await pool.query(
        'SELECT is_alive FROM group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, userId]
      );
      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: 'You are not a member of this pool. Click the invite link to join first.' });
      }
      if (memberCheck.rows[0].is_alive === false) {
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
          `INSERT INTO picks (group_id, user_id, round, player_id, player_name, survived, tournament_id)
           VALUES ($1, $2, $3, $4, $5, NULL, $6)
           ON CONFLICT (group_id, user_id, round)
           DO UPDATE SET player_id = EXCLUDED.player_id,
                         player_name = EXCLUDED.player_name,
                         survived = NULL,
                         tournament_id = EXCLUDED.tournament_id
           RETURNING id::text, group_id::text, user_id::text, round, player_id, player_name, survived, created_at`,
          [groupId, userId, round, playerId, resolvedName, TOURNAMENT.id]
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
