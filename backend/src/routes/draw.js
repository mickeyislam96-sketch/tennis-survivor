import { Router } from 'express';
import { getDraw, getRounds, getDeadlines, getRawFixtures } from '../services/tennisData.js';

export const drawRouter = Router();

drawRouter.get('/rounds', (_, res) => {
  res.json(getRounds());
});

// Debug endpoint — shows raw API fixture fields so we can verify round mapping.
// Visit /api/draw/debug in browser or curl to inspect.
drawRouter.get('/debug', async (_, res) => {
  try {
    const raw = await getRawFixtures();
    if (!raw || raw.length === 0) {
      return res.json({ message: 'No live API data — check TENNIS_API_KEY and INDIAN_WELLS_TOURNAMENT_KEY env vars', fixtures: [] });
    }
    const sample = raw.slice(0, 3).map(f => ({
      event_key: f.event_key,
      event_first_player: f.event_first_player,
      event_second_player: f.event_second_player,
      event_date: f.event_date,
      event_status: f.event_status,
      event_winner: f.event_winner,
      event_round: f.event_round,
      tournament_round: f.tournament_round,
      event_stage: f.event_stage,
      round: f.round,
      // Show all field names on the first fixture so we can see everything
      _all_fields: Object.keys(f),
    }));
    res.json({ total: raw.length, sample });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
