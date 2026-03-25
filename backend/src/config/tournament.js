/**
 * Active tournament configuration.
 *
 * Set the ACTIVE_TOURNAMENT env var on Railway to switch tournaments.
 * Valid values: 'miami-2026', 'monte-carlo-2026'
 *
 * Defaults to 'monte-carlo-2026' — the next upcoming tournament.
 */

import { MIAMI_2026 } from './tournaments/miami-2026.js';
import { MONTE_CARLO_2026 } from './tournaments/monte-carlo-2026.js';

const TOURNAMENT_REGISTRY = {
  'miami-2026':       MIAMI_2026,
  'monte-carlo-2026': MONTE_CARLO_2026,
};

const activeTournamentId = process.env.ACTIVE_TOURNAMENT || 'monte-carlo-2026';
const activeTournament = TOURNAMENT_REGISTRY[activeTournamentId];

if (!activeTournament) {
  throw new Error(
    `Unknown ACTIVE_TOURNAMENT: "${activeTournamentId}". ` +
    `Valid options: ${Object.keys(TOURNAMENT_REGISTRY).join(', ')}`
  );
}

export const TOURNAMENT = activeTournament;

// Named exports for backwards compatibility — code that imports
// { ROUNDS } or { MATCHES_PER_ROUND } from this file continues to work.
export const ROUNDS            = activeTournament.rounds;
export const MATCHES_PER_ROUND = activeTournament.matchesPerRound;

// Legacy export kept for any old references
export const INDIAN_WELLS_2026 = MIAMI_2026;
