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

/**
 * Build a map of playerId → { opponentName, opponentSeed, opponentStatus }
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
        // Opponent TBD — find the prev-round match that feeds into this slot
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
  // For now, return all found — the frontend will handle display.
  return possibles.length <= 2 ? possibles : [];
}

async function getAvailablePlayers(userId, groupId, currentRound) {
  const draw = await getDraw(currentRound);

  // Build pending/confirmed sets from the previous round up-front.
  // This runs regardless of whether the current round's draw exists yet —
  // so the fallback path can still tag players whose prev-round match is pending.
  // Bye entries (m.bye) are excluded — they represent seed byes, not real matches.
  const prevRoundIndex = ROUNDS.indexOf(currentRound) - 1;
  const pendingFromPrevRound = new Set();
  if (prevRoundIndex >= 0) {
    const prevRound = ROUNDS[prevRoundIndex];
    (draw.matches || [])
      .filter(m => m.round === prevRound && !m.bye)
      .forEach(m => {
        if (!m.winnerId) {
          if (m.player1Id) pendingFromPrevRound.add(m.player1Id);
          if (m.player2Id) pendingFromPrevRound.add(m.player2Id);
        }
      });
  }

  // Build the set of players who actually have a match this round.
  // Bye entries are excluded so seeds don't appear in R1 pick pool.
  const roundMatches = (draw.matches || []).filter(m => m.round === currentRound && !m.bye);
  if (roundMatches.length > 0) {
    const playingThisRound = new Set(
      roundMatches.flatMap(m => [m.player1Id, m.player2Id]).filter(Boolean)
    );

    // Supplement with players from the previous round who may still advance.
    // Winners are confirmed; players in unresolved matches are added speculatively
    // and flagged pendingPrevRound:true so the UI can warn of the risk.
    if (prevRoundIndex >= 0) {
      const prevRound = ROUNDS[prevRoundIndex];
      (draw.matches || [])
        .filter(m => m.round === prevRound)
        .forEach(m => {
          if (m.winnerId) {
            playingThisRound.add(m.winnerId);
          } else {
            // Pending in the API — but check whether one player is already
            // confirmed in the current round's fixtures. If so, the match is
            // effectively settled (walkover / withdrawal / API lag) and we must
            // not speculatively add the other player.
            const p1Confirmed = m.player1Id && playingThisRound.has(m.player1Id);
            const p2Confirmed = m.player2Id && playingThisRound.has(m.player2Id);
            if (!p1Confirmed && !p2Confirmed) {
              // Genuinely pending — add both speculatively.
              if (m.player1Id) playingThisRound.add(m.player1Id);
              if (m.player2Id) playingThisRound.add(m.player2Id);
            }
            // If one side is already confirmed, skip — they are already in the
            // set and the other player should not be added (Musetti / Jorda case).
          }
        });
    }

    // Build a lookup: playerId → opponent info from current round matches
    const opponentMap = buildOpponentMap(roundMatches, draw.matches || [], ROUNDS, currentRound);

    const pool = (draw.players || [])
      .filter(p => !p.roundEliminated && playingThisRound.has(p.id))
      .filter(p => !isQualifierPlaceholder(p))
      .map(p => {
        const enriched = pendingFromPrevRound.has(p.id) ? { ...p, pendingPrevRound: true } : { ...p };
        const opp = opponentMap.get(p.id);
        if (opp) Object.assign(enriched, opp);
        return enriched;
      });

    // If the main path yields players, return them. If it yields zero (e.g. a mock
    // draw inconsistency where currentRound participants are already marked eliminated),
    // fall through to the non-round-filtered fallback below.
    if (pool.length > 0) return pool;
  }

  // Fallback: the current round's draw isn't published yet (or main path was empty).
  // Return all non-eliminated players, tagging those with unresolved prev-round matches.
  return (draw.players || [])
    .filter(p => !p.roundEliminated)
    .filter(p => !isQualifierPlaceholder(p))
    .map(p => pendingFromPrevRound.has(p.id) ? { ...p, pendingPrevRound: true } : p);
}

/** Qualifier placeholders are removed from the pick pool until real names are known. */
function isQualifierPlaceholder(player) {
  return player.name === 'Qualifier' || player.id?.startsWith('mc-q');
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
         ORDER BY array_position($3::text[], round)`,
        [userId, groupId, ROUNDS]
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
