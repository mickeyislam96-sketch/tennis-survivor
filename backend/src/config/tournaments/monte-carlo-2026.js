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
  sofascoreUniqueTournamentId: 2391, // Sofascore permanent ID for Monte Carlo

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
  // API "1/N-finals" labels the round that PRODUCES N players, not the round
  // where N players compete.  For MC's 56-draw:
  //   1/32-finals = R1 (48 non-seeds play off, producing 24 + 8 byes = 32)
  //   1/16-finals = R32 (seeds enter, 32 → 16)
  //   1/8-finals  = R16, 1/4 = QF, 1/2 = SF
  // Evidence: API returns 17 non-qual fixtures under 1/32-finals (= 24 R1 - 7 qual slots).
  fractionDenomMap: { 32: 'R1', 16: 'R32', 8: 'R16', 4: 'QF', 2: 'SF' },

  // Date range to query from API-Tennis (covers qualifying through final)
  apiDateStart: '2026-04-04',
  apiDateStop:  '2026-04-13',
  // apiSeason omitted — API-Tennis returns empty when tournament_season is
  // included for Monte Carlo. Omitting it returns correct fixtures.
  apiSeason:    null,

  // Manual result overrides — for matches where API-Tennis has no fixture
  // (e.g. qualifiers/LLs missing from their index). Each entry maps a mock
  // player ID (the WINNER) to the mock player ID of the loser.
  // Format: { winnerId, winnerName, loserId, round }
  manualResults: [
    // RBA (mc-q4) has no API key; API-Tennis never indexed this fixture.
    // Berrettini beat Bautista Agut in R1 (confirmed 7 Apr).
    { winnerId: 'mc-p34', winnerName: 'Matteo Berrettini', loserId: 'mc-q4', round: 'R1' },
    // Dzumhur (mc-p23) replaced Mensik as LL; API-Tennis never indexed this fixture.
    // Marozsan beat Dzumhur 6-2 6-1 in R1 (confirmed 7 Apr).
    { winnerId: 'mc-p24', winnerName: 'Fabian Marozsan', loserId: 'mc-p23', round: 'R1' },
    // Sinner beat Humbert 6-3 6-0 in R32 (confirmed 7 Apr). API not returning result.
    { winnerId: 'mc-s2', winnerName: 'Jannik Sinner', loserId: 'mc-p56', round: 'R32' },
    // Zverev beat Fonseca in QF (confirmed 10 Apr). API not returning result yet.
    { winnerId: 'mc-s3', winnerName: 'Alexander Zverev', loserId: 'mc-p35', round: 'QF' },
    // Sinner beat Auger-Aliassime in QF (confirmed 10 Apr). API not returning result.
    { winnerId: 'mc-s2', winnerName: 'Jannik Sinner', loserId: 'mc-s6', round: 'QF' },
    // Vacherot beat de Minaur in QF (confirmed 10 Apr). API not returning result.
    { winnerId: 'mc-p21', winnerName: 'Valentin Vacherot', loserId: 'mc-s5', round: 'QF' },
    // Alcaraz beat Bublik 2-0 in QF (confirmed 10 Apr). API not returning result.
    { winnerId: 'mc-s1', winnerName: 'Carlos Alcaraz', loserId: 'mc-s8', round: 'QF' },
    // Sinner beat Zverev in SF (confirmed 11 Apr).
    { winnerId: 'mc-s2', winnerName: 'Jannik Sinner', loserId: 'mc-s3', round: 'SF' },
    // Alcaraz beat Vacherot in SF (confirmed 11 Apr).
    { winnerId: 'mc-s1', winnerName: 'Carlos Alcaraz', loserId: 'mc-p21', round: 'SF' },
    // FINAL: Sinner beat Alcaraz 2-0 in straight sets (confirmed 12 Apr).
    { winnerId: 'mc-s2', winnerName: 'Jannik Sinner', loserId: 'mc-s1', round: 'F' },
  ],

  // Lock time overrides — 1h before first match of each round.
  // These take precedence over API-derived and fallback times.
  // Play typically starts 10:00 BST / 11:00 CEST (09:00 UTC).
  // Main draw confirmed: starts Sunday 5 April (not Monday 6).
  lockTimeOverrides: {
    R1:  '2026-04-05T11:30:00Z', // Sun 5 Apr, 12:30 BST — qualifying in the morning
    R32: '2026-04-07T10:00:00Z', // Tue 7 Apr, 11:00 BST / 12:00 CEST — no R32 matches before 11:30 BST
    R16: '2026-04-09T09:00:00Z', // Wed 8 Apr, 11:00 BST / 12:00 CEST
    QF:  '2026-04-10T09:00:00Z', // Fri 10 Apr, 10:00 BST / 11:00 CEST
    SF:  '2026-04-11T09:00:00Z', // Sat 11 Apr, 10:00 BST / 11:00 CEST (later start)
    F:   '2026-04-12T11:00:00Z', // Sun 12 Apr, 12:00 BST / 13:00 CEST (typical final time)
  },

  // How many hours after the previous round locks before the next pick window opens.
  // Gives admins time to review results and correct errors before players submit.
  pickWindowBufferHours: 4,

  // Per-round overrides for when the pick window opens.
  // Takes precedence over the buffer calculation.
  windowOpensOverrides: {
    R16: '2026-04-07T16:00:00Z', // Mon 7 Apr, 5pm BST — let R32 results settle before R16 opens
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
  // CORRECTED 2026-04-05: API "1/32-finals" = R1 (preliminary round), NOT R32.
  // Evidence: 17 non-qual fixtures under "1/32-finals" = 24 R1 matches - 7 qual slots.
  // Fixtures are non-seed vs non-seed (e.g. Norrie vs Kecmanovic) on R1 day (Apr 5).
  // The API labels the round that PRODUCES N remaining players, not the round OF N.
  roundNameOverrides: {
    // With hyphen (Monte-Carlo)
    'atp monte-carlo - 1/32-finals': 'R1',
    'atp monte-carlo - 1/16-finals': 'R32',
    'atp monte-carlo - 1/8-finals':  'R16',
    'atp monte-carlo - 1/4-finals':  'QF',
    'atp monte-carlo - 1/2-finals':  'SF',
    'atp monte-carlo - final':       'F',
    // Without hyphen
    'atp monte carlo - 1/32-finals': 'R1',
    'atp monte carlo - 1/16-finals': 'R32',
    'atp monte carlo - 1/8-finals':  'R16',
    'atp monte carlo - 1/4-finals':  'QF',
    'atp monte carlo - 1/2-finals':  'SF',
    'atp monte carlo - final':       'F',
    // Rolex prefix variant
    'rolex monte-carlo masters - 1/32-finals': 'R1',
    'rolex monte-carlo masters - 1/16-finals': 'R32',
    'rolex monte-carlo masters - 1/8-finals':  'R16',
    'rolex monte-carlo masters - 1/4-finals':  'QF',
    'rolex monte-carlo masters - 1/2-finals':  'SF',
    'rolex monte-carlo masters - final':       'F',
    // Bare fraction names (safety fallback)
    '1/32-finals': 'R1',
    '1/16-finals': 'R32',
    '1/8-finals':  'R16',
    '1/4-finals':  'QF',
    '1/2-finals':  'SF',
  },
};
