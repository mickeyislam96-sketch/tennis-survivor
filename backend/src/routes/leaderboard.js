import { Router } from 'express';
import { MOCK_MEMBERS, MOCK_PICKS, MOCK_GROUPS } from '../data/mockGroups.js';
import { getRounds, getDeadlines } from '../services/tennisData.js';

const ROUNDS = getRounds();

export const leaderboardRouter = Router();

leaderboardRouter.get('/:groupId', async (req, res) => {
  const { groupId } = req.params;
  const group = MOCK_GROUPS.find(g => g.id === groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  // Determine current open round so we can show each player's pick for it
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
    // non-fatal — leaderboard still works without current-round pick column
  }

  const members = MOCK_MEMBERS.filter(m => m.groupId === groupId).map(m => {
    const picks = MOCK_PICKS.filter(p => p.userId === m.userId && p.groupId === groupId);
    const lastRound = picks.length ? ROUNDS.indexOf(picks[picks.length - 1].round) : -1;
    const survivedRounds = picks.filter(p => p.survived === true).length;
    const currentPick = currentRound
      ? (picks.find(p => p.round === currentRound) || null)
      : null;
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
