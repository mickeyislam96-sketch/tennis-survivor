/**
 * Mock draw dispatcher.
 * Routes to the correct tournament mock based on ACTIVE_TOURNAMENT env var.
 * Falls back to Monte Carlo mock (the current active tournament).
 */
import { TOURNAMENT } from '../config/tournament.js';
import { getMonteCarlMockDraw } from './monteCarloMockDraw.js';

const MOCK_REGISTRY = {
  'monte-carlo-2026': getMonteCarlMockDraw,
};

export function getMockDraw(currentRound, keyMap = null) {
  const fn = MOCK_REGISTRY[TOURNAMENT.id];
  if (!fn) {
    // Defensive fallback: return an empty-but-valid draw structure
    console.error(`[mockDraw] No mock registered for tournament: ${TOURNAMENT.id}`);
    return { players: [], matches: [], rounds: [], currentRound, dataSource: 'mock_empty' };
  }
  return fn(currentRound, keyMap);
}
