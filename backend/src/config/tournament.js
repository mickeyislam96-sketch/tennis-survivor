/**
 * Active tournament configuration.
 *
 * Re-exports from activeTournament.js — single source of truth.
 * This file exists for backwards compatibility with the 9+ modules
 * that import { TOURNAMENT, ROUNDS, MATCHES_PER_ROUND } from here.
 *
 * Set the ACTIVE_TOURNAMENT env var on Railway to switch tournaments.
 */

import { TOURNAMENT } from './activeTournament.js';

export { TOURNAMENT };
export const ROUNDS            = TOURNAMENT.rounds;
export const MATCHES_PER_ROUND = TOURNAMENT.matchesPerRound;

