import { Router } from 'express';
import { pool } from '../db/pool.js';
import { MOCK_MEMBERS, MOCK_PICKS, MOCK_GROUPS } from '../data/mockGroups.js';
import { getRounds, getDeadlines, getDraw } from '../services/tennisData.js';
import { getTournament } from '../data/tournaments.js';

const ROUNDS = getRounds();

// Statuses that indicate a match has a winner (normal completion, retirement, walkover)
const DECIDED_STATUSES = new Set(['completed', 'retired', 'walkover']);

/**
 * Decide whether the pool has a winner.
 *
 * Product rule (Mickey, 2026-05-15 — Option B): a winner is only declared
 * once the tournament's tour event has finished. Until then `hasWinner`
 * stays false and no `isWinner` flag is set, even if one survivor remains.
 *
 *   - tournamentCompleted=false   => never declare a winner.
 *   - tournamentCompleted=true    => sole survivor wins; otherwise the
 *                                    player(s) with the most survivedRounds
 *                                    win (tie => multiple winners).
 *
 * Pure function — exported so unit tests can pin this behaviour.
 * Returns { hasWinner, winnerName, winners[] }. The caller is responsible
 * for setting `isWinner: true` on the returned winners.
 */
export function detectWinner({ alive, eliminated, members, tournamentCompleted }) {
  if (!tournamentCompleted) {
    return { hasWinner: false, winnerName: null, winners: [] };
  }
  if (alive.length === 1 && members.length >= 2) {
    return {
      hasWinner: true,
      winnerName: alive[0].displayName,
      winners: [alive[0]],
    };
  }
  if (alive.length === 0 && eliminated.length >= 2) {
    const maxSurvived = eliminated[0].survivedRounds;
    if (maxSurvived > 0) {
      const winners = eliminated.filter(m => m.survivedRounds === maxSurvived);
      return {
        hasWinner: true,
        winnerName: winners.map(w => w.displayName).join(', '),
        winners,
      };
    }
  }
  return { hasWinner: false, winnerName: null, winners: [] };
}


// Leaderboard sort rule (Mickey, 2026-05-10):
//   1. Alive members first, sorted by survivedRounds DESC
//      (more rounds survived = higher).
//   2. Then eliminated members, sorted by elimination recency DESC
//      (most recent round = higher; e.g. R64 elim above R1 elim).
//   3. Within ties (same survivedRounds, or same eliminatedRound),
//      sort alphabetically by displayName ASC.
// roundIndex() returns the position of a round in ROUNDS, or -Infinity if
// missing/invalid — that pushes unknown rounds to the bottom of the
// eliminated section rather than aliasing them to R1 (the previous
// `|| 0` bug). DO NOT inline this — see backend/tests/smoke/leaderboard-sort.test.js.
function roundIndex(round) {
  if (!round) return -Infinity;
  const i = ROUNDS.indexOf(round);
  return i === -1 ? -Infinity : i;
}
function compareDisplayName(a, b) {
  return String(a.displayName || '').localeCompare(String(b.displayName || ''), undefined, { sensitivity: 'base' });
}
export function sortLeaderboard(members) {
  const alive = members.filter(m => m.isAlive).sort((a, b) => {
    const d = b.survivedRounds - a.survivedRounds;
    return d !== 0 ? d : compareDisplayName(a, b);
  });
  const eliminated = members.filter(m => !m.isAlive).sort((a, b) => {
    const d = roundIndex(b.eliminatedRound) - roundIndex(a.eliminatedRound);
    return d !== 0 ? d : compareDisplayName(a, b);
  });
  return { alive, eliminated };
}

export const leaderboardRouter = Router();

function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ''));
}

/**
 * Build a grader function from live draw data.
 *
 * Returns grade(playerId, round) â true (survived) | false (eliminated) | null (pending)
 *
 * Logic:
 *  - If there's a completed match in `round` where the player WON  â true
 *  - If there's a completed match in `round` where the player LOST â false
 *  - Otherwise â null (match not played yet)
 */
function buildGrader(draw) {
  // Map: playerId â Set of rounds they WON
  const wonRounds = {};
  // Map: playerId â Set of rounds they LOST
  const lostRounds = {};
  // Name-based fallback maps (normalised lower-case name)
  const wonRoundsByName = {};
  const lostRoundsByName = {};

  for (const match of (draw.matches || [])) {
    if (!DECIDED_STATUSES.has(match.status) || !match.winnerId) continue;
    const loserId   = match.winnerId === match.player1Id ? match.player2Id   : match.player1Id;
    const loserName = (match.winnerId === match.player1Id ? match.player2Name : match.player1Name || '').toLowerCase().trim();
    const winnerName = (match.winnerName || '').toLowerCase().trim();

    if (!wonRounds[match.winnerId]) wonRounds[match.winnerId] = new Set();
    wonRounds[match.winnerId].add(match.round);

    if (!lostRounds[loserId]) lostRounds[loserId] = new Set();
    lostRounds[loserId].add(match.round);

    // Also index by name so real picks can be graded against mock data (IDs differ)
    if (winnerName) {
      if (!wonRoundsByName[winnerName]) wonRoundsByName[winnerName] = new Set();
      wonRoundsByName[winnerName].add(match.round);
    }
    if (loserName) {
      if (!lostRoundsByName[loserName]) lostRoundsByName[loserName] = new Set();
      lostRoundsByName[loserName].add(match.round);
    }
  }

  return function grade(playerId, round, playerName) {
    // Primary: match by player ID (canonical key from unified data adapter)
    if (lostRounds[playerId]?.has(round)) return false;
    if (wonRounds[playerId]?.has(round))  return true;
    // Fallback: match by normalised player name (handles any ID-space drift
    // between stored picks and live draw data)
    const normName = (playerName || '').toLowerCase().trim();
    if (normName) {
      if (lostRoundsByName[normName]?.has(round)) return false;
      if (wonRoundsByName[normName]?.has(round))  return true;
    }
    return null;
  };
}

/**
 * Given a list of picks (each with .round, .playerId) and a grader,
 * compute summary stats for one member.
 *
 * Returns { survivedRounds, eliminatedRound, isAlive }
 */
function gradeMember(picks, grade) {
  let survivedRounds = 0;
  let eliminatedRound = null;
  let isAlive = true;

  // Process picks in round order so we get the right eliminatedRound
  const ordered = [...picks].sort(
    (a, b) => ROUNDS.indexOf(a.round) - ROUNDS.indexOf(b.round)
  );

  for (const pick of ordered) {
    const result = grade(pick.playerId || pick.player_id, pick.round, pick.playerName || pick.player_name);
    if (result === true) {
      survivedRounds++;
    } else if (result === false) {
      isAlive = false;
      eliminatedRound = pick.round;
      break; // once eliminated, stop counting
    }
    // null = pending, leave as-is
  }

  return { survivedRounds, eliminatedRound, isAlive };
}

leaderboardRouter.get('/:groupId', async (req, res) => {
  const { groupId } = req.params;

  // Determine which round's pick to show on the leaderboard.
  // ALWAYS show the most recently locked round's picks (visible to all).
  // Users want to see each other's picks once a window closes.
  // If no round is locked yet, no pick column is shown.
  let currentRound = null;
  let roundIsLocked = false;
  let openRound = null; // the currently open round (picks hidden in modal)
  try {
    const deadlines = await getDeadlines();
    // Find the latest locked round using the known round order (not date sorting).
    // ROUNDS is ordered R1 → R64 → R32 → ... → F, so the last locked entry
    // in round-order is the one whose picks should be displayed.
    const lockedRounds = deadlines.filter((d) => d.isLocked);
    if (lockedRounds.length > 0) {
      const latest = lockedRounds.reduce((best, d) =>
        ROUNDS.indexOf(d.round) > ROUNDS.indexOf(best.round) ? d : best
      );
      currentRound  = latest.round;
      roundIsLocked = true;
    }
    const currentlyOpen = deadlines.find((d) => d.isOpen);
    if (currentlyOpen) openRound = currentlyOpen.round;
  } catch (_) {}

  // Get draw data for grading picks.
  // Use getDraw (not getLiveDraw) because getDraw overlays live API data onto
  // the mock draw AND applies manual result overrides from tournament config.
  // getLiveDraw only returns raw API fixtures — missing any manual overrides.
  let grade = () => null; // default: all pending
  try {
    const draw = await getDraw('F');
    const completedMatches = (draw.matches || []).filter(m => DECIDED_STATUSES.has(m.status) && m.winnerId).length;
    console.log(`[leaderboard] draw source: ${draw.dataSource || 'unknown'}, completed matches: ${completedMatches}`);
    grade = buildGrader(draw);
  } catch (e) {
    console.error('[leaderboard] getDraw failed:', e.message);
  }

  if (isUUID(groupId)) {
    try {
      const groupResult = await pool.query(
        `SELECT id::text, name, prize_pool_cents, tournament_id FROM groups WHERE id = $1`,
        [groupId]
      );
      if (groupResult.rows.length === 0) {
        return res.status(404).json({ error: 'Group not found' });
      }
      const g = groupResult.rows[0];

      // Get all members
      const membersResult = await pool.query(
        `SELECT m.id::text, m.user_id::text AS "userId", m.display_name AS "displayName",
                m.is_alive AS "isAlive", m.eliminated_round AS "eliminatedRound", m.joined_at
         FROM group_members m
         WHERE m.group_id = $1
         ORDER BY m.joined_at`,
        [groupId]
      );

      // Get all picks for this group
      const picksResult = await pool.query(
        `SELECT user_id::text AS "userId", round, player_id AS "playerId", player_name AS "playerName", survived
         FROM picks WHERE group_id = $1`,
        [groupId]
      );

      // Group picks by userId
      const picksByUser = {};
      for (const p of picksResult.rows) {
        if (!picksByUser[p.userId]) picksByUser[p.userId] = [];
        picksByUser[p.userId].push(p);
      }

      const members = membersResult.rows.map(m => {
        const picks = picksByUser[m.userId] || [];

        // Grade picks using live draw data
        const { survivedRounds, eliminatedRound, isAlive } = gradeMember(picks, grade);

        // Current round pick (for the "this round's pick" column)
        const currentPick = currentRound
          ? (picks.find(p => p.round === currentRound) || null)
          : null;

        // Single source of truth for this member's alive state. When a member
        // has graded picks, the live grade wins; otherwise fall back to the DB
        // flag. CRITICAL: when the member is alive, NEVER carry over a stale
        // DB eliminatedRound/eliminatingPick. A prior tournament (or a since-
        // corrected contaminated result) can leave group_members.eliminated_round
        // populated while the member is actually alive — surfacing that produced
        // a row that was simultaneously "ALIVE" and "eliminated by X".
        // (2026-05-26 brief: Rafa showed isAlive + eliminatingPick=Fritz while
        // Fritz's R1 match was still scheduled.)
        const effectiveIsAlive = picks.length > 0 ? isAlive : m.isAlive;
        const effectiveElimRound = effectiveIsAlive ? null : (eliminatedRound || m.eliminatedRound);
        return {
          ...m,
          picksCount: picks.length,
          survivedRounds,
          eliminatedRound: effectiveElimRound,
          isAlive: effectiveIsAlive,
          // Expose the pick only when the round is fully locked
          currentRoundPick: (roundIsLocked && currentPick) ? currentPick.playerName : null,
          // For eliminated members: show which pick got them knocked out
          eliminatingPick: (() => {
            if (!effectiveElimRound) return null;
            const elimPick = picks.find(p => p.round === effectiveElimRound);
            return elimPick ? elimPick.playerName : null;
          })(),
        };
      });

      const { alive, eliminated } = sortLeaderboard(members);

      // Winner detection (Mickey, 2026-05-15 — Option B):
      // A winner is only declared once the tournament's tour event has
      // finished (tournament.status === 'completed'). Until then, even a
      // sole survivor is shown as 'alive (1 of N)' with no winner badge.
      // Rule: prize money is only awarded for finishing the whole tournament.
      // See morning brief 2026-05-15 + project_paid_launch_decisions.md.
      const tournament = getTournament(g.tournament_id);
      const tournamentCompleted = tournament?.status === 'completed';
      const { hasWinner, winnerName, winners } = detectWinner({
        alive, eliminated, members, tournamentCompleted,
      });
      winners.forEach(w => { w.isWinner = true; });

      return res.json({
        group: { id: g.id, name: g.name, prizePoolCents: g.prize_pool_cents },
        leaderboard: [...alive, ...eliminated],
        aliveCount: alive.length,
        hasWinner,
        winnerName,
        currentRound,
        roundIsLocked,
        openRound,
      });
    } catch (e) {
      console.error('DB leaderboard error:', e.message);
      return res.status(500).json({ error: 'Failed to load leaderboard' });
    }
  }

  // Mock fallback
  const group = MOCK_GROUPS.find(g => g.id === groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const members = MOCK_MEMBERS.filter(m => m.groupId === groupId).map(m => {
    const picks = MOCK_PICKS.filter(p => p.userId === m.userId && p.groupId === groupId);
    const { survivedRounds, eliminatedRound, isAlive } = gradeMember(picks, grade);
    const currentPick = currentRound ? (picks.find(p => p.round === currentRound) || null) : null;
    const effectiveIsAlive = picks.length > 0 ? isAlive : m.isAlive;
    return {
      ...m,
      picksCount: picks.length,
      survivedRounds,
      eliminatedRound: effectiveIsAlive ? null : (eliminatedRound || m.eliminatedRound),
      isAlive: effectiveIsAlive,
      currentRoundPick: (roundIsLocked && currentPick) ? currentPick.playerName : null,
    };
  });

  const { alive, eliminated } = sortLeaderboard(members);

  res.json({
    group: { id: group.id, name: group.name, prizePoolCents: group.prizePoolCents },
    leaderboard: [...alive, ...eliminated],
    aliveCount: alive.length,
    currentRound,
    roundIsLocked,
  });
});
