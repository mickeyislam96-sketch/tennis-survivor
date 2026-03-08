/**
 * GET /api/pools
 * Returns all available tournament pools, enriched with tournament metadata
 * and the requesting user's membership status.
 */
import { Router } from 'express';
import { MOCK_GROUPS, MOCK_MEMBERS } from '../data/mockGroups.js';
import { TOURNAMENTS } from '../data/tournaments.js';

export const poolsRouter = Router();

poolsRouter.get('/', (req, res) => {
  const userId = req.query.userId;

  const pools = MOCK_GROUPS.map(group => {
    const tournament = TOURNAMENTS.find(t => t.id === group.tournamentId) || null;
    const members = MOCK_MEMBERS.filter(m => m.groupId === group.id);
    const isMember = userId ? members.some(m => m.userId === userId) : false;
    const aliveCount = members.filter(m => m.isAlive).length;

    return {
      id: group.id,
      name: group.name,
      inviteCode: group.inviteCode,
      entryFeeCents: group.entryFeeCents,
      prizePoolCents: group.prizePoolCents,
      tournamentId: group.tournamentId,
      tournament,
      memberCount: members.length,
      aliveCount,
      isMember,
    };
  });

  res.json(pools);
});
