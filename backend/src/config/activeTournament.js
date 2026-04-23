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

    // Lock time overrides (1h before first match of each round).
    // These are PLACEHOLDER estimates from the official tournament schedule.
    // The scraper should flag when actual order-of-play times differ, but
    // must NOT auto-override these without admin confirmation.
    // Madrid matches typically start at 11:00 local (09:00 UTC).
    lockTimeOverrides: {
      R1:  '2026-04-22T09:00:00Z',  // Wed 22 Apr 10am UK — LOCKED (R1 complete)
      R64: '2026-04-24T09:00:00Z',  // Fri 24 Apr 10am UK — 1h before first R64 match
      R32: '2026-04-26T09:00:00Z',  // Sun 26 Apr 10am UK — 1h before first R32 match
      R16: '2026-04-28T09:00:00Z',  // Tue 28 Apr 10am UK
      QF:  '2026-04-29T09:00:00Z',  // Wed 29 Apr 10am UK
      SF:  '2026-05-01T09:00:00Z',  // Fri 1 May 10am UK
      F:   '2026-05-03T15:00:00Z',  // Sun 3 May 4pm UK (final not before 5pm local)
    },

    // Window open overrides — when the pick window opens for each round.
    // Default logic: 12h after first match of previous round. But that's
    // often too late (e.g. R1 finishes in one day, R64 should open same evening).
    // These overrides ensure windows open at sensible times.
    // Rule: open the evening the previous round's last matches are played.
    windowOpensOverrides: {
      // R1: opens immediately when draw is released (no override needed)
      R64: '2026-04-23T13:00:00Z',  // Wed 23 Apr 2pm UK — R1 day 2, most R1 done
      R32: '2026-04-25T17:00:00Z',  // Fri 25 Apr 6pm UK — R64 day 2 evening
      R16: '2026-04-27T17:00:00Z',  // Sun 27 Apr 6pm UK — R32 day 2 evening
      QF:  '2026-04-28T17:00:00Z',  // Mon 28 Apr 6pm UK — R16 evening
      SF:  '2026-04-30T17:00:00Z',  // Wed 30 Apr 6pm UK — QF day 2 evening
      F:   '2026-05-01T17:00:00Z',  // Thu 1 May 6pm UK — SF evening
    },

    // Fallback round dates (used when live API has no start times).
    // Source: official Madrid Open 2026 schedule (tenngrand.com, atptour.com).
    roundDateFallbacks: {
      R1:  '2026-04-22T09:00:00Z',  // Wed 22 Apr + Thu 23 Apr
      R64: '2026-04-24T09:00:00Z',  // Fri 24 Apr + Sat 25 Apr
      R32: '2026-04-26T09:00:00Z',  // Sun 26 Apr + Mon 27 Apr
      R16: '2026-04-28T09:00:00Z',  // Tue 28 Apr
      QF:  '2026-04-29T09:00:00Z',  // Wed 29 Apr + Thu 30 Apr
      SF:  '2026-05-01T09:00:00Z',  // Fri 1 May
      F:   '2026-05-03T15:00:00Z',  // Sun 3 May (not before 5pm local = 3pm UTC)
    },

    // API provider config
    apiTennisTournamentKey: null, // Legacy — set if falling back to API-Tennis
    apiSeason: null,              // Some APIs break with explicit season param
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
    apiTennisTournamentKey: null,
    apiSeason: null,
  },
};

export const TOURNAMENT = TOURNAMENTS[ACTIVE_TOURNAMENT_ID] || TOURNAMENTS['madrid-2026'];

export function getTournamentConfig(id) {
  return TOURNAMENTS[id] || null;
}
