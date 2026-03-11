import { Router } from 'express';
import { pool } from '../db/pool.js';
import { MOCK_MEMBERS, MOCK_PICKS, MOCK_GROUPS } from '../data/mockGroups.js';
import { getRounds, getDeadlines } from '../services/tennisData.js';

const ROUNDS = getRounds();

export const leaderboardRouter = Router();

function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ''));
}

leaderboardRouter.get('/:groupId', async (req, res) => {
  const { groupId } = req.params;

  // Determine current open round
  let currentRound = null;
  try {
    const deadlines = await getDeadlines();
    const now = new Date();
    const openRound = deadlines.find((d) => {
      const lockAt = d.lockAt ? new Date(d.lockAt) : null;
      return !d.isLocked && (!lockAt || now < lockAt);
    });
    currentRound = openRound?.round || null;
  } catch (_) {
    // non-fatal
  }

  if (isUUID(groupId)) {
    try {
      const groupResult = await pool.query(
        `SELECT id::text, name, prize_pool_cents FROM groups WHERE id = $1`,
        [groupId]
      );
      if (groupResult.rows.length === 0) {
        return res.status(404).json({ error: 'Group not found' });
      }
      const g = groupResult.rows[0];

      // Get members with their pick aggregates in one query
      const membersResult = await pool.query(
        `SELECT
           m.id::text,
           m.user_id::text AS "userId",
           m.display_name AS "displayName",
           m.is_alive AS "isAlive",
           m.eliminated_round AS "eliminatedRound",
           COUNT(p.id) AS "picksCount",
           COUNT(p.id) FILTER (WHERE p.survived = true) AS "survivedRounds",
           MAX(p.round) AS "lastRound",
           MAX(p.player_name) FILTER (WHERE p.round = $2) AS "currentRoundPick"
         FROM group_members m
         LEFT JOIN picks p ON p.user_id = m.user_id AND p.group_id = m.group_id
         WHERE m.group_id = $1
         GROUP BY m.id, m.user_id, m.display_name, m.is_alive, m.eliminated_round
         ORDER BY m.joined_at`,
        [groupId, currentRound]
      );

      const members = membersResult.rows.map(m => ({
        ...m,
        picksCount: parseInt(m.picksCount, 10),
        survivedRounds: parseInt(m.survivedRounds, 10),
      }));

      const alive = members
        .filter(m => m.isAlive)
        .sort((a, b) => b.survivedRounds - a.survivedRounds);
      const eliminated = members
        .filter(m => !m.isAlive)
        .sort((a, b) => (ROUNDS.indexOf(b.eliminatedRound) || 0) - (ROUNDS.indexOf(a.eliminatedRound) || 0));

      return res.json({
        group: { id: g.id, name: g.name, prizePoolCents: g.prize_pool_cents },
        leaderboard: [...alive, ...eliminated],
        aliveCount: alive.length,
        currentRound,
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
    const lastRound = picks.length ? ROUNDS.indexOf(picks[picks.length - 1].round) : -1;
    const survivedRounds = picks.filter(p => p.survived === true).length;
    const currentPick = currentRound ? (picks.find(p => p.round === currentRound) || null) : null;
    return {
      ...m,
      picksCount: picks.length,
      lastRound: lastRound >= 0 ? ROUNDS[lastRound] : null,
      survivedRounds,
      currentRoundPick: currentPick ? currentPick.playerName : null,
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
  });
});
