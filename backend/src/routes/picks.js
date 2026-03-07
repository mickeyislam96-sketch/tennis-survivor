import { Router } from 'express';
import { getDraw, getDeadlines } from '../services/tennisData.js';
import { getRounds } from '../services/tennisData.js';
import { MOCK_PICKS } from '../data/mockGroups.js';

export const picksRouter = Router();

const ROUNDS = getRounds();

async function getAvailablePlayers(userId, groupId, currentRound) {
  const draw = await getDraw(currentRound);
  return (draw.players || []).filter(
    (p) =>
      !p.roundEliminated
  );
}

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

picksRouter.get('/history', (req, res) => {
  const { userId, groupId } = req.query;
  const picks = MOCK_PICKS.filter(
    p => p.userId === userId && p.groupId === groupId
  ).sort((a, b) => ROUNDS.indexOf(a.round) - ROUNDS.indexOf(b.round));
  res.json(picks);
});

picksRouter.post('/', async (req, res) => {
  try {
    const { userId, groupId, round, playerId, playerName } = req.body;
    if (!userId || !groupId || !round || !playerId) {
      return res.status(400).json({ error: 'userId, groupId, round, playerId required' });
    }
    const deadlines = await getDeadlines();
    const roundDeadline = Array.isArray(deadlines)
      ? deadlines.find((d) => d.round === round)
      : null;

    if (roundDeadline) {
      const now = new Date();
      const lockAt = roundDeadline.lockAt ? new Date(roundDeadline.lockAt) : null;
      const isLocked = lockAt && now >= lockAt;
      const isOpen = roundDeadline.isOpen !== false;
      if (isLocked) {
        return res.status(400).json({ error: 'Picks for this round are locked' });
      }
      if (!isOpen) {
        return res.status(400).json({ error: 'Picks for this round are not yet open' });
      }
    }

    const available = await getAvailablePlayers(userId, groupId, round);
    if (!available.some((p) => p.id === playerId)) {
      return res.status(400).json({ error: 'Player not available for pick' });
    }

    const myPicks = MOCK_PICKS.filter((p) => p.userId === userId && p.groupId === groupId);
    const alreadyUsedId = myPicks.some((p) => p.playerId === playerId);
    const normalizedName = (playerName || '').toLowerCase().trim();
    const alreadyUsedName =
      normalizedName &&
      myPicks.some((p) => (p.playerName || '').toLowerCase().trim() === normalizedName);
    if (alreadyUsedId || alreadyUsedName) {
      return res.status(400).json({ error: 'Player already used in a previous round' });
    }
    const existing = MOCK_PICKS.find(
      (p) => p.userId === userId && p.groupId === groupId && p.round === round
    );
    if (existing) {
      return res.status(400).json({ error: 'Already picked for this round' });
    }
    const pick = {
      id: 'pick' + Date.now(),
      groupId,
      userId,
      round,
      playerId,
      playerName: playerName || available.find((p) => p.id === playerId)?.name,
      survived: null,
      createdAt: new Date().toISOString(),
    };
    MOCK_PICKS.push(pick);
    res.status(201).json(pick);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to submit pick' });
  }
});
