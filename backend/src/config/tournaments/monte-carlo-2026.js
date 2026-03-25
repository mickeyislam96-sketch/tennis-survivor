/**
 * Monte Carlo Masters 2026 — tournament configuration.
 * ATP Masters 1000, clay. Rolex Monte-Carlo Masters.
 *
 * Draw structure: ~56 players
 *   - Top seeds get byes directly into R32 (second round)
 *   - R1 (first round): non-seeded players play off for spots in R32
 *   - R32 (second round): seeds enter + R1 winners
 *   - R16, QF, SF, Final
 *
 * NOTE: Exact API round names must be verified once MONTE_CARLO_TOURNAMENT_KEY
 * is set and /api/draw/debug is checked. Update roundNameOverrides below.
 *
 * Tournament dates: ~6–13 April 2026
 * Draw release: ~4 April 2026
 */

export const MONTE_CARLO_2026 = {
  id: 'monte-carlo-2026',
  name: 'Rolex Monte-Carlo Masters',
  shortName: 'Monte Carlo',
  apiTournamentKey: process.env.MONTE_CARLO_TOURNAMENT_KEY,

  // Draw parameters
  drawSize: 56,
  seedsWithByes: 8, // top 8 seeds skip R1, enter at R32

  // Round order
  // NOTE: Monte Carlo has NO R64 layer — seeds enter directly at R32.
  rounds: ['R1', 'R32', 'R16', 'QF', 'SF', 'F'],

  // 56 players: 8 seeds (byes) + 48 non-seeds
  // R1: 24 matches (48 non-seeds fight for 24 R32 spots)
  // R32: 16 matches (24 R1 winners + 8 seeded byes = 32 players)
  // R16: 8 matches, QF: 4, SF: 2, F: 1
  matchesPerRound: { R1: 24, R32: 16, R16: 8, QF: 4, SF: 2, F: 1 },

  // Date range to query from API-Tennis
  // Adjust once the exact 2026 schedule is confirmed.
  apiDateStart: '2026-04-04',
  apiDateStop:  '2026-04-14',
  apiSeason:    '2026',

  // Lock time overrides (set 1h before first match of each round).
  // TODO: Update these once the exact schedule is published.
  // These are estimates based on typical Monte Carlo scheduling.
  lockTimeOverrides: {
    R1:  '2026-04-06T09:00:00Z', // ~1h before first R1 match (~10am local = 8am UTC+2)
    R32: '2026-04-07T09:00:00Z', // ~1h before seeds enter on day 2
    // R16, QF, SF, F: add once schedule confirmed
  },

  // Fallback schedule — used when API returns no data.
  // Times are UTC. Monte Carlo is UTC+2 in April.
  // Typical start: 10:00 local = 08:00 UTC.
  roundDates: {
    R1:  '2026-04-06T09:00:00Z',
    R32: '2026-04-07T09:00:00Z',
    R16: '2026-04-09T09:00:00Z',
    QF:  '2026-04-10T09:00:00Z',
    SF:  '2026-04-11T09:00:00Z',
    F:   '2026-04-13T10:00:00Z',
  },

  // Round date fallback — API has fixtures but no times yet.
  roundDateFallback: {
    R1:  '2026-04-06T09:00:00Z',
    R32: '2026-04-07T09:00:00Z',
    R16: '2026-04-09T09:00:00Z',
    QF:  '2026-04-10T09:00:00Z',
    SF:  '2026-04-11T09:00:00Z',
    F:   '2026-04-13T10:00:00Z',
  },

  // API round name mappings for Monte Carlo.
  // IMPORTANT: Verify these against /api/draw/debug once the tournament key is active.
  // API-Tennis typically returns names like "First Round", "Second Round" or
  // fraction notation. The global ROUND_MAP handles common names already.
  roundNameOverrides: {
    // Fraction notation: in a 56-draw, "1/32-finals" typically = the first main-draw round
    // Adjust if API returns different labels.
    'atp monte-carlo - 1/32-finals': 'R1',
    'atp monte-carlo - 1/16-finals': 'R32',
    'atp monte-carlo - 1/8-finals':  'R16',
    'atp monte-carlo - 1/4-finals':  'QF',
    'atp monte-carlo - 1/2-finals':  'SF',
    'atp monte-carlo - final':       'F',
    // Also try without hyphen
    'atp monte carlo - 1/32-finals': 'R1',
    'atp monte carlo - 1/16-finals': 'R32',
    'atp monte carlo - 1/8-finals':  'R16',
    'atp monte carlo - 1/4-finals':  'QF',
    'atp monte carlo - 1/2-finals':  'SF',
    'atp monte carlo - final':       'F',
  },
};
