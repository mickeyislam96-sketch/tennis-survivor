/**
 * Mock draw dispatcher.
 *
 * Priority:
 *   1. Seed draw JSON (reusable — created from ATP PDF, lives in data/seedDraws/)
 *   2. Hardcoded mock draw (legacy — Monte Carlo only)
 *   3. Empty fallback
 *
 * The seed draw system is the standard path for Madrid 2026+ tournaments.
 * Hardcoded mocks are kept for completed tournaments (Monte Carlo) only.
 */
import { TOURNAMENT } from '../config/tournament.js';
import { getMonteCarlMockDraw } from './monteCarloMockDraw.js';
import { hasSeedDraw, loadSeedDraw } from './seedDrawLoader.js';

const MOCK_REGISTRY = {
  'monte-carlo-2026': getMonteCarlMockDraw,
};

export function getMockDraw(currentRound, keyMap = null) {
  const tournamentId = TOURNAMENT.id;

  // 1. Seed draw (preferred — reusable JSON-based draw)
  if (hasSeedDraw(tournamentId)) {
    console.log(`[mockDraw] Using seed draw for ${tournamentId}`);
    return loadSeedDraw(tournamentId, currentRound);
  }

  // 2. Hardcoded mock (legacy — Monte Carlo etc.)
  const fn = MOCK_REGISTRY[tournamentId];
  if (fn) {
    return fn(currentRound, keyMap);
  }

  // 3. Empty fallback
  console.error(`[mockDraw] No mock or seed draw for tournament: ${tournamentId}`);
  return { players: [], matches: [], rounds: [], currentRound, dataSource: 'mock_empty' };
}
