/**
 * Monte Carlo Masters 2026 — tournament configuration.
 * ATP Masters 1000, clay. Rolex Monte-Carlo Masters.
 *
 * Draw structure: 56 players
 *   - Top 8 seeds get byes directly into R32 (second round)
 *   - R1 (first round): non-seeded players play off for spots in R32
 *   - R32 (second round): seeds enter + R1 winners
 *   - R16 (third round), QF, SF, Final
 *
 * Tournament dates: 5–12 April 2026
 * Draw released: Friday 3 April 2026 at 5pm CEST
 * Qualifying: Sat 4 Apr – Sun 5 Apr
 * Main draw play: Mon 6 Apr – Sun 12 Apr
 *
 * Schedule (confirmed from ATP / LTA / search results):
 *   Sun 5 Apr  — First round (R1), starts 10:00 BST / 11:00 CEST
 *   Mon 6 Apr  — First round continued (R1)
 *   Tue 7 Apr  — Second round (R32, seeds enter)
 *   Wed 8 Apr  — Third round (R16)
 *   Thu 9 Apr  — Third round continued (R16)
 *   Fri 10 Apr — Quarter-finals
 *   Sat 11 Apr — Semi-finals
 *   Sun 12 Apr — Final
 *
 * All times below are UTC. Monte Carlo is CEST (UTC+2) in April.
 * Typical first match: 11:00 CEST = 09:00 UTC.
 */

export const MONTE_CARLO_2026 = {
  id: 'monte-carlo-2026',
  name: 'Rolex Monte-Carlo Masters',
  shortName: 'Monte Carlo',
  apiTournamentKey: process.env.MONTE_CARLO_TOURNAMENT_KEY || '1970',

  // Draw parameters
  drawSize: 56,
  seedsWithByes: 8, // top 8 seeds skip R1, enter at R32

  // Round order — no R64 layer; seeds enter directly at R32.
  rounds: ['R1', 'R32', 'R16', 'QF', 'SF', 'F'],

  // 56 players: 8 seeds (byes) + 48 non-seeds
  // R1: 24 matches (48 non-seeds fight for 24 R32 spots)
  // R32: 16 matches (24 R1 winners + 8 seeded byes = 32 players)
  // R16: 8 matches, QF: 4, SF: 2, F: 1
  matchesPerRound: { R1: 24, R32: 16, R16: 8, QF: 4, SF: 2, F: 1 },

  // Explicit fraction denominator mapping for 56-draw.
  // API "1/N-finals" means N players remain. For MC:
  //   32 players = R32 (seeds enter), 16 = R16, 8 = QF, 4 = SF, 2 = F
  // R1 has 48 players — no standard fraction, API labels it separately.
  fractionDenomMap: { 32: 'R32', 16: 'R16', 8: 'QF', 4: 'SF', 2: 'F' },

  // Date range to query from API-Tennis (covers qualifying through final)
  apiDateStart: '2026-04-04',
  apiDateStop:  '2026-04-13',
  apiSeason:    '2026',  // Confirmed: tournament_season=2026 returns MC fixtures (2025 returns empty)

  // Lock time overrides — 1h before first match of each round.
  // These take precedence over API-derived and fallback times.
  // Play typically starts 10:00 BST / 11:00 CEST (09:00 UTC).
  // Main draw confirmed: starts Sunday 5 April (not Monday 6).
  lockTimeOverrides: {
    R1:  '2026-04-05T11:30:00Z', // Sun 5 Apr, 12:30 BST — qualifying in the morning
    R32: '2026-04-07T08:00:00Z', // Tue 7 Apr, 09:00 BST / 10:00 CEST
    R16: '2026-04-08T08:00:00Z', // Wed 8 Apr, 09:00 BST / 10:00 CEST
    QF:  '2026-04-10T08:00:00Z', // Fri 10 Apr, 09:00 BST / 10:00 CEST
    SF:  '2026-04-11T09:00:00Z', // Sat 11 Apr, 10:00 BST / 11:00 CEST (later start)
    F:   '2026-04-12T11:00:00Z', // Sun 12 Apr, 12:00 BST / 13:00 CEST (typical final time)
  },

  // Fallback schedule — used when API returns no data at all.
  roundDates: {
    R1:  '2026-04-05T09:00:00Z', // Sun 5 Apr, 10:00 BST / 11:00 CEST
    R32: '2026-04-07T09:00:00Z', // Tue 7 Apr, 10:00 BST / 11:00 CEST
    R16: '2026-04-08T09:00:00Z', // Wed 8 Apr, 10:00 BST / 11:00 CEST
    QF:  '2026-04-10T09:00:00Z', // Fri 10 Apr, 10:00 BST / 11:00 CEST
    SF:  '2026-04-11T10:00:00Z', // Sat 11 Apr, 11:00 BST / 12:00 CEST
    F:   '2026-04-12T12:00:00Z', // Sun 12 Apr, 13:00 BST / 14:00 CEST
  },

  // Round date fallback — API has fixtures but no start times yet.
  roundDateFallback: {
    R1:  '2026-04-05T09:00:00Z',
    R32: '2026-04-07T09:00:00Z',
    R16: '2026-04-08T09:00:00Z',
    QF:  '2026-04-10T09:00:00Z',
    SF:  '2026-04-11T10:00:00Z',
    F:   '2026-04-12T12:00:00Z',
  },

  // API round name mappings for Monte Carlo.
  // VERIFIED against /api/draw/debug: API returns "1/32-finals" for the round with
  // 32 players (16 matches, seeds enter) = our R32.  NOT R1.
  // MC 56-draw: R1 has 48 players (24 matches), R32 has 32 players (16 matches).
  // API fraction denominator = number of players remaining, so:
  //   1/32-finals = R32 (seeds enter), 1/16-finals = R16, etc.
  roundNameOverrides: {
    // With hyphen (Monte-Carlo)
    'atp monte-carlo - 1/32-finals': 'R32',
    'atp monte-carlo - 1/16-finals': 'R16',
    'atp monte-carlo - 1/8-finals':  'QF',
    'atp monte-carlo - 1/4-finals':  'SF',
    'atp monte-carlo - 1/2-finals':  'F',
    'atp monte-carlo - final':       'F',
    // Without hyphen
    'atp monte carlo - 1/32-finals': 'R32',
    'atp monte carlo - 1/16-finals': 'R16',
    'atp monte carlo - 1/8-finals':  'QF',
    'atp monte carlo - 1/4-finals':  'SF',
    'atp monte carlo - 1/2-finals':  'F',
    'atp monte carlo - final':       'F',
    // Rolex prefix variant
    'rolex monte-carlo masters - 1/32-finals': 'R32',
    'rolex monte-carlo masters - 1/16-finals': 'R16',
    'rolex monte-carlo masters - 1/8-finals':  'QF',
    'rolex monte-carlo masters - 1/4-finals':  'SF',
    'rolex monte-carlo masters - 1/2-finals':  'F',
    'rolex monte-carlo masters - final':       'F',
    // Bare fraction names (safety fallback — if prefix stripping yields just the fraction)
    '1/32-finals': 'R32',
    '1/16-finals': 'R16',
    '1/8-finals':  'QF',
    '1/4-finals':  'SF',
    '1/2-finals':  'F',
  },
};
