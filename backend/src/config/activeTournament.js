/**
 * Active tournament configuration.
 *
 * This is the single place to change when switching between tournaments.
 * All tournament-specific settings live here: API keys, round structure,
 * lock time overrides, and R1 lock mode config.
 *
 * Usage: import { TOURNAMENT } from '../config/activeTournament.js';
 */

const ACTIVE_TOURNAMENT_ID = process.env.ACTIVE_TOURNAMENT || 'roland-garros-2026';

// ── Tournament configs ───────────────────────────────────────────────────────
const TOURNAMENTS = {
  'roland-garros-2026': {
    id: 'roland-garros-2026',
    name: 'Roland-Garros',
    shortName: 'Roland Garros',
    year: 2026,
    tourLevel: 'Grand Slam',
    startDate: '2026-05-24',
    endDate: '2026-06-07',
    surface: 'Clay (outdoor)',
    drawSize: 128,
    seedsWithByes: 0,

    // Round structure (128-draw Grand Slam — no byes; seeds play R1).
    // The first round is modelled as 'R1' (NOT 'R128') so it reuses the proven
    // R1 code paths in picks.js / tennisData.js and the existing roundLabels.
    // 'R1' renders as "First Round" (128 players), 'R64' as "Round of 64", etc.
    rounds: ['R1', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'],
    matchesPerRound: { R1: 64, R64: 32, R32: 16, R16: 8, QF: 4, SF: 2, F: 1 },

    // R1 lock mode: false = standard fixed deadline (decision 22 May 2026 —
    // simplest, proven path for the first Grand Slam this codebase has run).
    r1PerMatchLock: false,

    // Lock time overrides (1h before first match of each round).
    // ⚠️  ESTIMATES — UPDATE once the order of play is confirmed for each round.
    // Paris is CEST (UTC+2). RG day sessions start ~11:00 local (09:00 UTC).
    lockTimeOverrides: {
      R1:  '2026-05-24T08:00:00Z',  // Sun 24 May — 10:00 Paris (R1 plays 24-26 May)
      R64: '2026-05-27T08:00:00Z',  // Wed 27 May — UPDATE once OOP confirmed
      R32: '2026-05-29T08:00:00Z',  // Fri 29 May — UPDATE once OOP confirmed
      R16: '2026-05-31T08:00:00Z',  // Sun 31 May — UPDATE once OOP confirmed
      QF:  '2026-06-02T08:00:00Z',  // Tue 2 Jun — UPDATE once OOP confirmed
      SF:  '2026-06-05T09:00:00Z',  // Fri 5 Jun — UPDATE once OOP confirmed
      F:   '2026-06-07T11:00:00Z',  // Sun 7 Jun — final ~14:00 local (UPDATE)
    },

    // Window open overrides — when the pick window opens for each round
    // (evening the previous round's last matches are played).
    windowOpensOverrides: {
      R64: '2026-05-26T17:00:00Z',  // Tue 26 May 6pm UK — end of R1
      R32: '2026-05-28T17:00:00Z',  // Thu 28 May — end of R64
      R16: '2026-05-30T17:00:00Z',  // Sat 30 May — end of R32
      QF:  '2026-06-01T17:00:00Z',  // Mon 1 Jun — end of R16
      SF:  '2026-06-03T17:00:00Z',  // Wed 3 Jun — end of QF
      F:   '2026-06-05T17:00:00Z',  // Fri 5 Jun — end of SF
    },

    // Fallback round dates (used when live data has no start times).
    roundDateFallbacks: {
      R1:  '2026-05-24T09:00:00Z',
      R64: '2026-05-27T09:00:00Z',
      R32: '2026-05-29T09:00:00Z',
      R16: '2026-05-31T09:00:00Z',
      QF:  '2026-06-02T09:00:00Z',
      SF:  '2026-06-05T09:00:00Z',
      F:   '2026-06-07T11:00:00Z',
    },

    manualResultOverrides: [
      {
        round: 'R64',
        matchPlayers: ['Tabilo, Alejandro', 'Vacherot, Valentin'],
        winner: 'Tabilo, Alejandro',
        status: 'walkover',
        note: 'Recorded 2026-06-01: Vacherot withdrew (walkover); Tabilo advanced (confirmed by his completed R32 vs Kouame).',
      },
      {
        round: 'R64',
        matchPlayers: ['de Minaur, Alex', 'Blockx, Alexander'],
        winner: 'de Minaur, Alex',
        status: 'walkover',
        note: 'Recorded 2026-06-01: Blockx withdrew (walkover); de Minaur advanced (confirmed by his completed R32 vs Mensik).',
      },
    ],

    apiTennisTournamentKey: null,
    apiSeason: null,
  },

  'rome-2026': {
    id: 'rome-2026',
    name: 'Internazionali BNL d\'Italia',
    shortName: 'Rome',
    year: 2026,
    tourLevel: 'ATP Masters 1000',
    startDate: '2026-05-05',
    endDate: '2026-05-17',
    surface: 'Clay (outdoor)',
    drawSize: 96,
    seedsWithByes: 32,

    // Round structure (96-draw Masters 1000)
    rounds: ['R1', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'],
    matchesPerRound: { R1: 32, R64: 32, R32: 16, R16: 8, QF: 4, SF: 2, F: 1 },

    // R1 lock mode: false = standard fixed deadline (same as all other rounds).
    // Per-match lock is disabled — fixed deadline is simpler and doesn't require
    // push notifications to work well.
    r1PerMatchLock: false,

    // Lock time overrides (1h before first match of each round).
    // ⚠️  UPDATE THESE once the order of play is confirmed for each round.
    // Rome matches typically start 10:00–11:00 local (08:00–09:00 UTC, CEST = UTC+2).
    // These are conservative estimates based on the official tournament schedule.
    lockTimeOverrides: {
      R1:  '2026-05-06T09:00:00Z',  // Wed 6 May — 11:00 Rome / 10:00 UK (extended by 1h on 5 May to give late joiners more time)
      R64: '2026-05-08T08:00:00Z',  // Fri 8 May — UPDATE once OOP confirmed
      R32: '2026-05-10T08:00:00Z',  // Sun 10 May — UPDATE once OOP confirmed
      R16: '2026-05-12T08:00:00Z',  // Tue 12 May — UPDATE once OOP confirmed
      QF:  '2026-05-13T08:00:00Z',  // Wed 13 May — UPDATE once OOP confirmed
      SF:  '2026-05-15T08:00:00Z',  // Fri 15 May — UPDATE once OOP confirmed
      F:   '2026-05-17T11:00:00Z',  // Sun 17 May — final ~13:00 local / 11:00 UTC
    },

    // Window open overrides — when the pick window opens for each round.
    // Rule: open the evening the previous round's last matches are played.
    windowOpensOverrides: {
      // R1: opens immediately when draw is released (no override needed)
      R64: '2026-05-07T17:00:00Z',  // Thu 7 May 6pm UK — R1 day 2 evening
      R32: '2026-05-09T17:00:00Z',  // Sat 9 May 6pm UK — R64 day 2 evening
      R16: '2026-05-11T17:00:00Z',  // Mon 11 May 6pm UK — R32 day 2 evening
      QF:  '2026-05-12T17:00:00Z',  // Tue 12 May 6pm UK — R16 evening
      SF:  '2026-05-13T17:00:00Z',  // Wed 13 May 6pm UK — QF day 1 evening
      F:   '2026-05-15T17:00:00Z',  // Fri 15 May 6pm UK — SF evening
    },

    // Fallback round dates (used when live API has no start times).
    // Source: official Internazionali BNL d'Italia 2026 schedule.
    roundDateFallbacks: {
      R1:  '2026-05-06T09:00:00Z',  // Wed 6 May + Thu 7 May
      R64: '2026-05-08T09:00:00Z',  // Fri 8 May + Sat 9 May
      R32: '2026-05-10T09:00:00Z',  // Sun 10 May + Mon 11 May
      R16: '2026-05-12T09:00:00Z',  // Tue 12 May
      QF:  '2026-05-13T09:00:00Z',  // Wed 13 May + Thu 14 May
      SF:  '2026-05-15T09:00:00Z',  // Fri 15 May + Sat 16 May
      F:   '2026-05-17T11:00:00Z',  // Sun 17 May (final ~13:00 local)
    },


    // Manual result overrides — applied AFTER scraper data, BEFORE bracket propagation.
    // Use this for matches the scraper cannot reliably resolve:
    //  • Walkovers (FlashScore shows score: '---', so winner cannot be guessed
    //    from score; scraper now refuses to assert a winner).
    //  • Disputed/incorrect scrapes that need a manual correction.
    // History (2026-05-09 incident): Machac/Medvedev R64 — Machac withdrew so
    // Medvedev advanced, but the scraper's walkover-winner heuristic defaulted
    // to player1 (Machac) which was wrong. The bracket showed Machac
    // progressing into R32. This override makes the truth explicit and
    // testable.
    manualResultOverrides: [
      {
        round: 'R64',
        matchPlayers: ['Machac, Tomas', 'Medvedev, Daniil'],
        winner: 'Medvedev, Daniil',
        status: 'walkover',
        note: 'Machac withdrew before R64 — Medvedev advances. Recorded 2026-05-09.',
      },
      {
        round: 'R64',
        matchPlayers: ['van de Zandschulp, Botic', 'Rinderknech, Arthur'],
        winner: 'van de Zandschulp, Botic',
        loserDisplayName: 'Kovacevic, Aleksandar (LL)',
        status: 'completed',
        note: 'Rinderknech withdrew before R64; Kovacevic, Aleksandar entered as Lucky Loser and lost to van de Zandschulp. Recorded 2026-05-10. matchPlayers stays as the seed-draw slot name (Rinderknech) for stable matching; loserDisplayName rewrites the visible loser to the actual LL who played.',
      },
    ],

    // API provider config
    apiTennisTournamentKey: null,
    apiSeason: null,
  },

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

    rounds: ['R1', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'],
    matchesPerRound: { R1: 32, R64: 32, R32: 16, R16: 8, QF: 4, SF: 2, F: 1 },

    r1PerMatchLock: false,

    lockTimeOverrides: {
      R1:  '2026-04-22T09:00:00Z',
      R64: '2026-04-24T09:00:00Z',
      R32: '2026-04-26T09:00:00Z',
      R16: '2026-04-28T09:00:00Z',
      QF:  '2026-04-29T09:00:00Z',
      SF:  '2026-05-01T09:00:00Z',
      F:   '2026-05-03T15:00:00Z',
    },

    windowOpensOverrides: {
      R64: '2026-04-23T13:00:00Z',
      R32: '2026-04-25T17:00:00Z',
      R16: '2026-04-27T17:00:00Z',
      QF:  '2026-04-28T17:00:00Z',
      SF:  '2026-04-30T17:00:00Z',
      F:   '2026-05-01T17:00:00Z',
    },

    roundDateFallbacks: {
      R1:  '2026-04-22T09:00:00Z',
      R64: '2026-04-24T09:00:00Z',
      R32: '2026-04-26T09:00:00Z',
      R16: '2026-04-28T09:00:00Z',
      QF:  '2026-04-29T09:00:00Z',
      SF:  '2026-05-01T09:00:00Z',
      F:   '2026-05-03T15:00:00Z',
    },


    manualResultOverrides: [],

    apiTennisTournamentKey: null,
    apiSeason: null,
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

    manualResultOverrides: [],

    apiTennisTournamentKey: null,
    apiSeason: null,
  },
};

export const TOURNAMENT = TOURNAMENTS[ACTIVE_TOURNAMENT_ID] || TOURNAMENTS['rome-2026'];

export function getTournamentConfig(id) {
  return TOURNAMENTS[id] || null;
}
