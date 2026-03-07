import { Router } from 'express';
import { MOCK_MEMBERS, MOCK_PICKS, MOCK_GROUPS } from '../data/mockGroups.js';
import { getRounds } from '../services/tennisData.js';

const ROUNDS = getRounds();

export const leaderboardRouter = Router();

leaderboardRouter.get('/:groupId', (req, res) => {
  const { groupId } = req.params;
  const group = MOCK_GROUPS.find(g => g.id === groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const members = MOCK_MEMBERS.filter(m => m.groupId === groupId).map(m => {
    const picks = MOCK_PICKS.filter(p => p.userId === m.userId && p.groupId === groupId);
    const lastRound = picks.length ? ROUNDS.indexOf(picks[picks.length - 1].round) : -1;
    const survivedRounds = picks.filter(p => p.survived === true).length;
    return {
      ...m,
      picksCount: picks.length,
      lastRound: lastRound >= 0 ? ROUNDS[lastRound] : null,
      survivedRounds
    };
  });

  const alive = members.filter(m => m.isAlive).sort((a, b) => b.survivedRounds - a.survivedRounds);
  const eliminated = members.filter(m => !m.isAlive).sort(
    (a, b) => (ROUNDS.indexOf(b.eliminatedRound) || 0) - (ROUNDS.indexOf(a.eliminatedRound) || 0)
  );

  res.json({
    group: { id: group.id, name: group.name, prizePoolCents: group.prizePoolCents },
    leaderboard: [...alive, ...eliminated],
    aliveCount: alive.length
  });
});
