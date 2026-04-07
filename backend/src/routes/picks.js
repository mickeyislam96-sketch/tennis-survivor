import { Router } from 'express';
import { pool } from '../db/pool.js';
import { getDraw, getLiveDraw, getDeadlines, getApiKeyMap } from '../services/tennisData.js';
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

/**
 * Build a map of playerId â { opponentName, opponentSeed, opponentStatus }
 * for a given round's matches.
 *
 * Variations:
 * - Both players known:  { opponentName: "Stan Wawrinka", opponentSeed: null }
 * - One side TBD (prev round pending):  { opponentName: null, opponentPossible: ["Player A", "Player B"] }
 * - Qualifier placeholder:  { opponentName: "Qualifier" }
 * - Completely unknown:  not in map (no entry)
 */
function buildOpponentMap(roundMatches, allMatches, rounds, currentRound) {
  const map = new Map();
  const prevRoundIndex = rounds.indexOf(currentRound) - 1;
  const prevRound = prevRoundIndex >= 0 ? rounds[prevRoundIndex] : null;
  const prevMatches = prevRound
    ? allMatches.filter(m => m.round === prevRound && !m.bye)
    : [];

  for (const m of roundMatches) {
    if (m.bye) continue;
    const p1 = m.player1Id;
    const p2 = m.player2Id;
    const p1Name = m.player1Name || null;
    const p2Name = m.player2Name || null;

    // For player1, find their opponent (player2) and vice versa
    if (p1) {
      if (p2 && p2Name) {
        map.set(p1, { opponentName: p2Name, opponentId: p2 });
      } else if (!p2 || !p2Name) {
        // Opponent TBD â find the prev-round match that feeds into this slot
        const possibles = findPossibleOpponents(p1, m, prevMatches);
        if (possibles.length > 0) {
          map.set(p1, { opponentName: null, opponentPossible: possibles });
        } else {
          map.set(p1, { opponentName: p2Name || null }); // might be "Qualifier" or null
        }
      }
    }
    if (p2) {
      if (p1 && p1Name) {
        map.set(p2, { opponentName: p1Name, opponentId: p1 });
      } else if (!p1 || !p1Name) {
        const possibles = findPossibleOpponents(p2, m, prevMatches);
        if (possibles.length > 0) {
          map.set(p2, { opponentName: null, opponentPossible: possibles });
        } else {
          map.set(p2, { opponentName: p1Name || null });
        }
      }
    }
  }
  return map;
}

/**
 * For a match where one side is TBD, try to find the two possible opponents
 * from the previous round's unresolved matches.
 */
function findPossibleOpponents(knownPlayerId, match, prevMatches) {
  // Look for an unresolved prev-round match where neither player is the known player
  // and that could feed into this match slot.
  // Heuristic: find prev-round matches where neither player matches knownPlayerId
  // and the match has no winner yet.
  const possibles = [];
  for (const pm of prevMatches) {
    if (pm.winnerId) continue; // already resolved
    if (pm.player1Id === knownPlayerId || pm.player2Id === knownPlayerId) continue;
    // Check if either player from this pending match could be the opponent
    if (pm.player1Name && pm.player2Name) {
      possibles.push(pm.player1Name, pm.player2Name);
    }
  }
  // If we found too many (multiple pending matches), we can't determine which feeds here.
  // In a structured bracket this would use match ordering, but for now just return
  // the first pair found if exactly 2 names.
  // Actually, let's be more careful: only return possibles if there's a clear pair.
  // For now, return all found â the frontend will handle display.
  return possibles.length <= 2 ? possibles : [];
}

async function getAvailablePlayers(userId, groupId, currentRound) {
  // Get both live API data (real results) and mock draw (complete structure).
  // Live draw may only have current/future round fixtures (e.g. R32 but no R1).
  // Mock draw always has the full player list and bracket structure.
  const liveDraw = await getLiveDraw(currentRound);
  const mockDraw = await getDraw(currentRound);

  // Build a reverse map: API player key â mock player ID
  const apiToMock = new Map();
  const mockToApi = new Map();
  for (const [mockId, apiKey] of Object.entries(getApiKeyMap())) {
    if (apiKey == null) continue; // skip qualifiers/LLs with unknown keys
    apiToMock.set(String(apiKey), mockId);
    mockToApi.set(mockId, String(apiKey));
  }

  // Back-fill from live overlay: getDraw() discovers API keys via name matching
  // for players missing from getApiKeyMap(). Harvest those discovered keys.
  for (const m of (mockDraw.matches || [])) {
    if (m.player1ApiKey && !mockToApi.has(m.player1Id)) {
      mockToApi.set(m.player1Id, String(m.player1ApiKey));
      apiToMock.set(String(m.player1ApiKey), m.player1Id);
    }
    if (m.player2ApiKey && !mockToApi.has(m.player2Id)) {
      mockToApi.set(m.player2Id, String(m.player2ApiKey));
      apiToMock.set(String(m.player2ApiKey), m.player2Id);
    }
  }

  const prevRoundIndex = ROUNDS.indexOf(currentRound) - 1;
  const pendingFromPrevRound = new Set();   // mock IDs
  const confirmedFromPrevRound = new Set(); // mock IDs
  const eliminatedFromPrevRound = new Set(); // mock IDs

  if (prevRoundIndex >= 0) {
    const prevRound = ROUNDS[prevRoundIndex];

    // 1) Check live API for prev-round results (uses API player IDs)
    const livePrevMatches = (liveDraw.matches || []).filter(m => m.round === prevRound);
    const liveConfirmedApi = new Set(); // API IDs confirmed by live data
    const liveEliminatedApi = new Set(); // API IDs eliminated by live data
    for (const m of livePrevMatches) {
      if (m.bye && m.winnerId) {
        liveConfirmedApi.add(String(m.winnerId));
      } else if (m.winnerId) {
        liveConfirmedApi.add(String(m.winnerId));
        const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
        if (loserId) liveEliminatedApi.add(String(loserId));
      }
      // If no winner, both players are still pending â handled below via mock
    }

    // 2) Use mock draw for the complete prev-round structure
    const mockPrevMatches = (mockDraw.matches || []).filter(m => m.round === prevRound);
    for (const m of mockPrevMatches) {
      if (m.bye && m.winnerId) {
        // Seed with bye â confirmed
        confirmedFromPrevRound.add(m.winnerId);
      } else if (!m.bye) {
        const p1Mock = m.player1Id;
        const p2Mock = m.player2Id;
        const p1Api = mockToApi.get(p1Mock);
        const p2Api = mockToApi.get(p2Mock);

        // Check if live API has a result for this match
        const p1LiveConfirmed = p1Api && liveConfirmedApi.has(p1Api);
        const p2LiveConfirmed = p2Api && liveConfirmedApi.has(p2Api);
        const p1LiveEliminated = p1Api && liveEliminatedApi.has(p1Api);
        const p2LiveEliminated = p2Api && liveEliminatedApi.has(p2Api);

        if (p1LiveConfirmed) confirmedFromPrevRound.add(p1Mock);
        else if (p1LiveEliminated) eliminatedFromPrevRound.add(p1Mock);
        else if (p1Mock) pendingFromPrevRound.add(p1Mock);

        if (p2LiveConfirmed) confirmedFromPrevRound.add(p2Mock);
        else if (p2LiveEliminated) eliminatedFromPrevRound.add(p2Mock);
        else if (p2Mock) pendingFromPrevRound.add(p2Mock);
      }
    }
  }

  // Simplified eligibility: for R1, only players in R1 matches (seeds have
  // byes and shouldn't be pickable in R1). For R32+, ALL non-eliminated
  // non-qualifier players are eligible â no dependency on bracket slot data.
  // This avoids the fragile coupling between bracket propagation and pick pool.
  let r1PlayerIds = null;
  if (currentRound === ROUNDS[0]) {
    // First round: restrict to players actually playing this round
    r1PlayerIds = new Set();
    const r1Matches = (mockDraw.matches || []).filter(m => m.round === currentRound && !m.bye);
    for (const m of r1Matches) {
      if (m.player1Id) r1PlayerIds.add(m.player1Id);
      if (m.player2Id) r1PlayerIds.add(m.player2Id);
    }
  }

  // Build opponent info from current round matches (prefer live, fall back to mock)
  const mockRoundMatches = (mockDraw.matches || []).filter(m => m.round === currentRound && !m.bye);
  const liveRoundMatches = (liveDraw.matches || []).filter(m => m.round === currentRound && !m.bye);
  const allMatches = [...(liveDraw.matches || []), ...(mockDraw.matches || [])];
  const opponentMap = liveRoundMatches.length > 0
    ? buildOpponentMap(liveRoundMatches, allMatches, ROUNDS, currentRound)
    : buildOpponentMap(mockRoundMatches, allMatches, ROUNDS, currentRound);

  // Build the pick pool from mock draw's full player list.
  // R1: filtered to R1 match participants only (excludes seeds with byes).
  // R32+: all non-eliminated players (simple and robust).
  const mockPlayers = mockDraw.players || [];
  const playerPool = [];
  for (const p of mockPlayers) {
    if (isQualifierPlaceholder(p)) continue;
    if (r1PlayerIds && !r1PlayerIds.has(p.id)) continue; // R1 restriction
    if (eliminatedFromPrevRound.has(p.id)) continue;
    if (p.roundEliminated) continue;

    // Use the API ID if available (so picks match the results processor)
    const apiId = mockToApi.get(p.id);
    const playerId = apiId || p.id;

    const enriched = { ...p, id: playerId };
    const mockId = p.id;

    if (pendingFromPrevRound.has(mockId)) {
      enriched.pendingPrevRound = true;
      enriched.status = 'at_risk';
    } else if (confirmedFromPrevRound.has(mockId) || prevRoundIndex < 0) {
      enriched.status = 'confirmed';
    } else {
      enriched.status = 'confirmed';
    }

    // Add opponent info (check both API and mock IDs)
    const opp = opponentMap.get(playerId) || opponentMap.get(mockId);
    if (opp) Object.assign(enriched, opp);

    playerPool.push(enriched);
  }

  return playerPool;
}

/** Qualifier placeholders are removed from the pick pool until real names are known. */
function isQualifierPlaceholder(player) {
  return player.name === 'Qualifier' || player.name === 'TBD';
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
// Returns picks with live-graded survived status (no cron dependency).
picksRouter.get('/history', async (req, res) => {
  const { userId, groupId } = req.query;

  // Build a live grader from current draw data so survived is always fresh
  const mockToApi = new Map();
  for (const [mockId, apiKey] of Object.entries(getApiKeyMap())) {
    if (apiKey == null) continue; // skip qualifiers/LLs with unknown keys
    mockToApi.set(mockId, String(apiKey));
  }
  let liveGrade = null;
  try {
    const draw = await getLiveDraw();
    if (draw.matches && draw.matches.length > 0) {
      const wonRounds = {};
      const lostRounds = {};
      for (const m of draw.matches) {
        if (m.status !== 'completed' || !m.winnerId) continue;
        const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
        if (!wonRounds[m.winnerId]) wonRounds[m.winnerId] = new Set();
        wonRounds[m.winnerId].add(m.round);
        if (!lostRounds[loserId]) lostRounds[loserId] = new Set();
        lostRounds[loserId].add(m.round);
      }
      liveGrade = (playerId, round) => {
        if (lostRounds[playerId]?.has(round)) return false;
        if (wonRounds[playerId]?.has(round)) return true;
        // Try translating mock ID to API key
        const translated = mockToApi.get(playerId);
        if (translated) {
          if (lostRounds[translated]?.has(round)) return false;
          if (wonRounds[translated]?.has(round)) return true;
        }
        return null;
      };
    }
  } catch (_) {}

  if (isUUID(userId) && isUUID(groupId)) {
    try {
      const result = await pool.query(
        `SELECT id::text, group_id::text, user_id::text, round, player_id, player_name, survived, created_at
         FROM picks
         WHERE user_id = $1 AND group_id = $2
         ORDER BY array_position($3::text[], round)`,
        [userId, groupId, ROUNDS]
      );
      const picks = result.rows.map(rowToPick).map(p => {
        // Overlay live grading if DB hasn't caught up yet
        if (p.survived == null && liveGrade) {
          const live = liveGrade(p.playerId, p.round);
          if (live !== null) return { ...p, survived: live };
        }
        return p;
      });
      return res.json(picks);
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

    // Validate user is actually a member of this group
    if (isUUID(userId) && isUUID(groupId)) {
      const memberCheck = await pool.query(
        'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, userId]
      );
      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: 'You must join the group before making a pick' });
      }
    }

    // Validate player is in the draw and not eliminated
    const available = await getAvailablePlayers(userId, groupId, round);
    if (!Array.isArray(available) || !available.some(p => p.id === playerId)) {
      return res.status(400).json({ error: 'Player not available for pick' });
    }

    // Always prefer the canonical name from the mock draw (full names like
    // "Andrey Rublev") over whatever the frontend sends (which might be an
    // API-abbreviated form like "A. Rublev").
    const canonicalName = available.find(p => p.id === playerId)?.name;
    const resolvedName = canonicalName || playerName || '';

    if (isUUID(userId) && isUUID(groupId)) {
      try {
        // Check player not already used in a DIFFERENT round by this user in this group.
        // We exclude the current round so that changing a pick mid-window is allowed â
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

        // Re-check deadline right before write (closes race window between initial check and DB write)
        const freshDeadlines = await getDeadlines();
        const freshRD = Array.isArray(freshDeadlines) ? freshDeadlines.find(d => d.round === round) : null;
        if (freshRD) {
          const lockAt2 = freshRD.lockAt ? new Date(freshRD.lockAt) : null;
          if (lockAt2 && new Date() >= lockAt2) {
            return res.status(400).json({ error: 'Picks for this round are locked' });
          }
        }

        // UPSERT â insert new pick, or update player if they're changing within the open window.
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
