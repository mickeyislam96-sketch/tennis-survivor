import { Router } from 'express';
import { pool } from '../db/pool.js';
import { MOCK_MEMBERS, MOCK_PICKS, MOCK_GROUPS } from '../data/mockGroups.js';
import { getRounds, getDeadlines, getDraw } from '../services/tennisData.js';
import { getTournament } from '../data/tournaments.js';

const ROUNDS = getRounds();

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
    if (match.status !== 'completed' || !match.winnerId) continue;
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
    const lastLocked = [...deadlines].filter((d) => d.isLocked).pop();
    if (lastLocked) {
      currentRound  = lastLocked.round;
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
    const completedMatches = (draw.matches || []).filter(m => m.status === 'completed').length;
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

      // If the tournament is completed, the live draw endpoint no longer
      // carries this tournament's matches — regrading returns null for every
      // pick and would falsely mark every member alive. For completed pools
      // we trust the DB's persisted is_alive / eliminated_round / picks.survived
      // (written at the time by the results processor).
      const tournamentForGroup = getTournament(g.tournament_id);
      const tournamentCompleted = tournamentForGroup?.status === 'completed';

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

        let survivedRounds, eliminatedRound, isAlive;
        if (tournamentCompleted) {
          // Trust the DB. Results processor writes these at tournament time.
          survivedRounds  = picks.filter(p => p.survived === true).length;
          eliminatedRound = m.eliminatedRound || null;
          isAlive         = !!m.isAlive;
        } else {
          // Live tournament (or upcoming) — regrade against current draw.
          const graded = gradeMember(picks, grade);
          survivedRounds  = graded.survivedRounds;
          eliminatedRound = graded.eliminatedRound || m.eliminatedRound;
          isAlive         = picks.length > 0 ? graded.isAlive : m.isAlive;
        }

        // Current round pick (for the "this round's pick" column)
        const currentPick = currentRound
          ? (picks.find(p => p.round === currentRound) || null)
          : null;

        return {
          ...m,
          picksCount: picks.length,
          survivedRounds,
          eliminatedRound,
          isAlive,
          // Expose the pick only when the round is fully locked
          currentRoundPick: (roundIsLocked && currentPick) ? currentPick.playerName : null,
        };
      });

      const alive = members
        .filter(m => m.isAlive)
        .sort((a, b) => b.survivedRounds - a.survivedRounds);
      const eliminated = members
        .filter(m => !m.isAlive)
        .sort((a, b) => (ROUNDS.indexOf(b.eliminatedRound) || 0) - (ROUNDS.indexOf(a.eliminatedRound) || 0));

      // Winner detection:
      // 1. If exactly 1 survivor and 2+ entrants => that player won
      // 2. If nobody alive but tournament completed => player(s) who survived
      //    the most rounds win (last eliminated = winner)
      let hasWinner = false;
      let winnerName = null;
      if (alive.length === 1 && members.length >= 2) {
        hasWinner = true;
        alive[0].isWinner = true;
        winnerName = alive[0].displayName;
      } else if (alive.length === 0 && eliminated.length >= 2) {
        // Everyone eliminated — the person(s) who lasted longest win
        const maxSurvived = eliminated[0].survivedRounds;
        const winners = eliminated.filter(m => m.survivedRounds === maxSurvived);
        if (maxSurvived > 0) {
          hasWinner = true;
          winners.forEach(w => { w.isWinner = true; });
          winnerName = winners.map(w => w.displayName).join(', ');
        }
      }

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
    return {
      ...m,
      picksCount: picks.length,
      survivedRounds,
      eliminatedRound: eliminatedRound || m.eliminatedRound,
      isAlive: picks.length > 0 ? isAlive : m.isAlive,
      currentRoundPick: (roundIsLocked && currentPick) ? currentPick.playerName : null,
    };
  });

  const alive = members.filter(m => m.isAlive).sort((a, b) => b.survivedRounds - a.survivedRounds);
  const eliminated = members.filter(m => !m.isAlive).sort(
    (a, b) => (ROUNDS.indexOf(b.eliminatedRound) || 0) - (ROUNDS.indexOf(a.eliminatedRound) || 0)
  );

  res.json({
    group: { id: group.id, name: group.name, prizePoolCents: group.prizePoolCents },
    leaderboard: [...alive, ...eliminated],
    aliveCount: alive.length,
    currentRound,
    roundIsLocked,
  });
});
