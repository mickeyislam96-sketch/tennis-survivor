/**
 * Miami Open 2026 — tournament configuration.
 * 96-player draw: 32 seeds with R1 byes, 64 players in R1 (32 matches).
 * Rounds: R1 → R64 → R32 → R16 → QF → SF → F
 */

export const MIAMI_2026 = {
  id: 'miami-2026',
  name: 'Miami Open',
  shortName: 'Miami',
  apiTournamentKey: process.env.MIAMI_TOURNAMENT_KEY || process.env.INDIAN_WELLS_TOURNAMENT_KEY || process.env.TOURNAMENT_KEY,

  // Draw parameters
  drawSize: 96,
  seedsWithByes: 32, // seeds skip R1, enter at R64

  // Round order — must match API progression
  rounds: ['R1', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'],

  // Number of matches per round
  matchesPerRound: { R1: 32, R64: 32, R32: 16, R16: 8, QF: 4, SF: 2, F: 1 },

  // Date range to query from API-Tennis
  apiDateStart: '2026-03-16',
  apiDateStop:  '2026-03-30',
  apiSeason:    '2026',

  // Hard overrides for lock times (ISO UTC). These take precedence over everything.
  // Set to 1 hour before the first scheduled match of each round.
  lockTimeOverrides: {
    R1:  '2026-03-19T13:00:00Z',
    R32: '2026-03-22T18:00:00Z',
    R16: '2026-03-24T14:00:00Z',
  },

  // Fallback schedule — used when API has no data at all.
  roundDates: {
    R1:  '2026-03-19T13:00:00Z',
    R64: '2026-03-21T11:00:00Z',
    R32: '2026-03-22T19:00:00Z',
    R16: '2026-03-25T11:00:00Z',
    QF:  '2026-03-26T11:00:00Z',
    SF:  '2026-03-28T11:00:00Z',
    F:   '2026-03-30T11:00:00Z',
  },

  // Round date fallback — used when API has fixtures but no start times yet.
  roundDateFallback: {
    R1:  '2026-03-19T13:00:00Z',
    R64: '2026-03-21T11:00:00Z',
    R32: '2026-03-22T19:00:00Z',
    R16: '2026-03-25T11:00:00Z',
    QF:  '2026-03-26T11:00:00Z',
    SF:  '2026-03-28T11:00:00Z',
    F:   '2026-03-30T11:00:00Z',
  },

  // Extra round name mappings specific to this tournament's API labels.
  // Merged with the global ROUND_MAP in tennisData.js.
  // "1/64-finals" = R1 (Miami-specific nomenclature for 96-draw)
  roundNameOverrides: {
    'atp miami - 1/64-finals': 'R1',
    'atp miami - 1/32-finals': 'R64',
    'atp miami - 1/16-finals': 'R32',
    'atp miami - 1/8-finals':  'R16',
    'atp miami - 1/4-finals':  'QF',
    'atp miami - 1/2-finals':  'SF',
    'atp miami - final':       'F',
  },
};
