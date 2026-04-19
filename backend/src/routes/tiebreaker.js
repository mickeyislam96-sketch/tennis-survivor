import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

export const tiebreakerRouter = Router();

// Tiebreaker questions for the Final (sets, games, aces, etc.)
const TIEBREAKER_QUESTIONS = [
  { key: 'total_sets', label: 'Total sets in the match', type: 'number' },
  { key: 'total_games', label: 'Total games in the match', type: 'number' },
  { key: 'aces_winner', label: 'Aces by the winner', type: 'number' }
];

tiebreakerRouter.get('/questions', (_, res) => {
  res.json(TIEBREAKER_QUESTIONS);
});

tiebreakerRouter.post('/answer', (req, res) => {
  const { groupId, matchId, questionKey, answerValue } = req.body;
  const userId = req.userId || req.body.userId;  // JWT or legacy
  if (!groupId || !userId || !questionKey || answerValue == null) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  res.status(201).json({
    id: 'tb' + Date.now(),
    groupId,
    userId,
    matchId,
    questionKey,
    answerValue,
    createdAt: new Date().toISOString()
  });
});
