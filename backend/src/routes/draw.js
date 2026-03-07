import { Router } from 'express';
import { getDraw, getRounds, getDeadlines } from '../services/tennisData.js';

export const drawRouter = Router();

drawRouter.get('/rounds', (_, res) => {
  res.json(getRounds());
});

drawRouter.get('/bracket', async (req, res) => {
  try {
    const round = req.query.round || 'R32';
    const data = await getDraw(round);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to load draw' });
  }
});

drawRouter.get('/players', async (req, res) => {
  try {
    const round = req.query.round || 'R32';
    const data = await getDraw(round);
    const stillIn = (data.players || []).filter((p) => !p.roundEliminated);
    res.json(stillIn);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to load players' });
  }
});

drawRouter.get('/deadlines', async (_, res) => {
  try {
    const deadlines = await getDeadlines();
    res.json(deadlines);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to load deadlines' });
  }
});
