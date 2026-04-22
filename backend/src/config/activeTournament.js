/**
 * Active tournament configuration.
 *
 * This is the single place to change when switching between tournaments.
 * All tournament-specific settings live here: API keys, round structure,
 * lock time overrides, and R1 lock mode config.
 *
 * Usage: import { TOURNAMENT } from '../config/activeTournament.js';
 */

const ACTIVE_TOURNAMENT_ID = process.env.ACTIVE_TOURNAMENT || 'madrid-2026';

// ── Tournament configs ───────────────────────────────────────────────────────
const TOURNAMENTS = {
  'madrid-2026': {
    id: 'madrid-2026',
    name: 'Mutua Madrid Open',
    shortName: 'Madrid',
    year: 2026,
    tourLevel: 'ATP Masters 1000',
    startDate: '2026-04-22',
    endDate: '2026-05-03',
    surface: 'Clay (outdoor)',
    drawSize: 96,
    seedsWithByes: 32,

    // Round structure (96-draw Masters 1000)
    rounds: ['R1', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'],
    matchesPerRound: { R1: 32, R64: 32, R32: 16, R16: 8, QF: 4, SF: 2, F: 1 },

    // R1 lock mode: false = standard fixed deadline (like all other rounds).
    // true = per-match lock (players removed as their match starts).
    // Standard deadline is simpler for users and works without push notifications.
    // Per-match lock may be revisited when mobile app has push notifications.
    r1PerMatchLock: false,

    // Lock time overrides (set 1h before first match of each round).
    // UPDATE THESE once the order of play is announced for each round.
    lockTimeOverrides: {
      R1:  null,  // TBD — set once R1 schedule is announced (1h before first match)
      R64: null,  // TBD — set once R64 schedule is announced
      R32: null,  // TBD
      R16: null,  // TBD
      QF:  null,  // TBD
      SF:  null,  // TBD
      F:   null,  // TBD
    },

    // Window open overrides (when pick window opens for each round)
    windowOpensOverrides: {
      // R1 opens immediately when draw is released
      // R64: delay if R1 results still coming in
    },

    // Fallback round dates (used when live API has no start times yet)
    // Men's main draw starts Wed 22 Apr. Final Sun 3 May.
    roundDateFallbacks: {
      R1:  '2026-04-22T10:00:00Z',  // Wed 22 Apr — Day 1 (extended 1h for testing)
      R64: '2026-04-24T09:00:00Z',  // Fri 24 Apr — estimated
      R32: '2026-04-26T09:00:00Z',  // Sun 26 Apr — estimated
      R16: '2026-04-28T09:00:00Z',  // Tue 28 Apr — estimated
      QF:  '2026-04-30T09:00:00Z',  // Thu 30 Apr — estimated
      SF:  '2026-05-02T09:00:00Z',  // Sat 2 May — estimated
      F:   '2026-05-03T13:00:00Z',  // Sun 3 May — men's final
    },

    // API provider config
    // Goalserve: set GOALSERVE_API_KEY env var in Railway.
    // goalserveTournamentId: set after first successful API call — the adapter
    // logs discovered tournament IDs to help you find the right one.
    // If null, the adapter matches by tournament name ("Madrid").
    goalserveTournamentId: '21256',  // Discovered from Goalserve livescore home scan (ATP Madrid)
    apiTennisTournamentKey: null, // Legacy — set if falling back to API-Tennis
    apiSeason: null,              // Some APIs break with explicit season param

    // Round name overrides for Goalserve round normalisation.
    // The adapter has broad defaults, but if Goalserve uses unexpected labels
    // for Madrid, add them here. The adapter logs unknown labels to help.
    roundNameOverrides: {
      // e.g. 'atp madrid - 1/64-finals': 'R1'
      // Populated once we see actual API output
    },
  },

  'monte-carlo-2026': {
    id: 'monte-carlo-2026',
    name: 'Rolex Monte-Carlo Masters',
    shortName: 'Monte Carlo',
    year: 2026,
    tourLevel: 'ATP Masters 1000',
    startDate: '2026-04-06',
    endDate: '2026-04-13',
    surface: 'Clay (outdoor)',
    drawSize: 56,
    seedsWithByes: 8,
    rounds: ['R1', 'R32', 'R16', 'QF', 'SF', 'F'],
    matchesPerRound: { R1: 24, R32: 16, R16: 8, QF: 4, SF: 2, F: 1 },
    r1PerMatchLock: false,
    lockTimeOverrides: {},
    windowOpensOverrides: {},
    roundDateFallbacks: {},
    goalserveTournamentId: null,
    apiTennisTournamentKey: null,
    apiSeason: null,
    roundNameOverrides: {},
  },
};

export const TOURNAMENT = TOURNAMENTS[ACTIVE_TOURNAMENT_ID] || TOURNAMENTS['madrid-2026'];

export function getTournamentConfig(id) {
  return TOURNAMENTS[id] || null;
}
