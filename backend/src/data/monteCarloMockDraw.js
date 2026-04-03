/**
 * Monte Carlo Masters 2026 — real draw.
 *
 * 64-player draw with 8 byes for top 8 seeds.
 * Layout:
 *   - 24 R1 matches among 48 unseeded/qualifier players
 *   - 16 R32 matches (8 seeds with byes + 8 R1 winner pairs)
 *   - R16/QF/SF/F bracket from R32 winners
 *
 * Seeds: Alcaraz(1), Sinner(2), Zverev(3), Musetti(4), de Minaur(5),
 *        Auger-Aliassime(6), Medvedev(7), Bublik(8)
 *
 * Rounds: R1 (24) → R32 (16) → R16 (8) → QF (4) → SF (2) → F (1)
 *
 * Seeding rule: seeds are placed as player1 in their matches so they win in mock mode.
 */

import { ROUNDS, MATCHES_PER_ROUND } from '../config/tournament.js';

// ── Players ───────────────────────────────────────────────────────────────────

const MC_PLAYERS = [
  // ── Seeds (8 seeds with R1 byes, enter at R32) ───────────────────────────
  { id: 'mc-s1',   name: 'Carlos Alcaraz',              seed: 1,  country: 'ESP' },
  { id: 'mc-s2',   name: 'Jannik Sinner',               seed: 2,  country: 'ITA' },
  { id: 'mc-s3',   name: 'Alexander Zverev',            seed: 3,  country: 'GER' },
  { id: 'mc-s4',   name: 'Lorenzo Musetti',             seed: 4,  country: 'ITA' },
  { id: 'mc-s5',   name: 'Alex de Minaur',              seed: 5,  country: 'AUS' },
  { id: 'mc-s6',   name: 'Felix Auger-Aliassime',       seed: 6,  country: 'CAN' },
  { id: 'mc-s7',   name: 'Daniil Medvedev',             seed: 7,  country: 'RUS' },
  { id: 'mc-s8',   name: 'Alexander Bublik',            seed: 8,  country: 'KAZ' },

  // ── R1 Non-seeds & Qualifiers (24 matches = 48 players) ─────────────────
  // Match M0: Baez vs Wawrinka
  { id: 'mc-p9',   name: 'Sebastian Baez',              country: 'ARG' },
  { id: 'mc-p10',  name: 'Stan Wawrinka',               seed: 'WC', country: 'SUI' },

  // Match M1: Etcheverry vs Dimitrov
  { id: 'mc-p11',  name: 'Tomas Martin Etcheverry',     country: 'ARG' },
  { id: 'mc-p12',  name: 'Grigor Dimitrov',             country: 'BUL' },

  // Match M2: Atmane vs Tiafoe [14]
  { id: 'mc-p13',  name: 'Terence Atmane',              country: 'FRA' },
  { id: 'mc-p14',  name: 'Frances Tiafoe',              seed: 14, country: 'USA' },

  // Match M3: Lehecka [11] vs Qualifier
  { id: 'mc-p15',  name: 'Jiri Lehecka',                seed: 11, country: 'CZE' },
  { id: 'mc-q1',   name: 'Qualifier',                   country: 'Q' },

  // Match M4: Fucsovics vs Tabilo
  { id: 'mc-p17',  name: 'Marton Fucsovics',            country: 'HUN' },
  { id: 'mc-p18',  name: 'Alejandro Tabilo',            country: 'CHI' },

  // Match M5: Monfils vs Griekspoor
  { id: 'mc-p19',  name: 'Gael Monfils',                seed: 'WC', country: 'FRA' },
  { id: 'mc-p20',  name: 'Tallon Griekspoor',           country: 'NED' },

  // Match M6: Vacherot vs Majchrzak
  { id: 'mc-p21',  name: 'Valentin Vacherot',           country: 'MON' },
  { id: 'mc-p22',  name: 'Kamil Majchrzak',             country: 'POL' },

  // Match M7: Mensik vs Marozsan
  { id: 'mc-p23',  name: 'Jakub Mensik',                country: 'CZE' },
  { id: 'mc-p24',  name: 'Fabian Marozsan',             country: 'HUN' },

  // Match M8: Hurkacz vs Darderi [15]
  { id: 'mc-p25',  name: 'Hubert Hurkacz',              country: 'POL' },
  { id: 'mc-p26',  name: 'Luciano Darderi',             seed: 15, country: 'ITA' },

  // Match M9: Cobolli [10] vs Qualifier
  { id: 'mc-p27',  name: 'Flavio Cobolli',              seed: 10, country: 'ITA' },
  { id: 'mc-q2',   name: 'Qualifier',                   country: 'Q' },

  // Match M10: Shapovalov vs Qualifier
  { id: 'mc-p29',  name: 'Denis Shapovalov',            country: 'CAN' },
  { id: 'mc-q3',   name: 'Qualifier',                   country: 'Q' },

  // Match M11: Norrie vs Kecmanovic
  { id: 'mc-p31',  name: 'Cameron Norrie',              country: 'GBR' },
  { id: 'mc-p32',  name: 'Miomir Kecmanovic',           country: 'SRB' },

  // Match M12: Qualifier vs Berrettini [WC]
  { id: 'mc-q4',   name: 'Qualifier',                   country: 'Q' },
  { id: 'mc-p34',  name: 'Matteo Berrettini',           seed: 'WC', country: 'ITA' },

  // Match M13: Fonseca vs Diallo
  { id: 'mc-p35',  name: 'Joao Fonseca',                country: 'BRA' },
  { id: 'mc-p36',  name: 'Gabriel Diallo',              country: 'CAN' },

  // Match M14: Rinderknech vs Khachanov [12]
  { id: 'mc-p37',  name: 'Arthur Rinderknech',          country: 'FRA' },
  { id: 'mc-p38',  name: 'Karen Khachanov',             seed: 12, country: 'RUS' },

  // Match M15: Rublev [13] vs Borges
  { id: 'mc-p39',  name: 'Andrey Rublev',               seed: 13, country: 'RUS' },
  { id: 'mc-p40',  name: 'Nuno Borges',                 country: 'POR' },

  // Match M16: Bergs vs Mannarino
  { id: 'mc-p41',  name: 'Zizou Bergs',                 country: 'BEL' },
  { id: 'mc-p42',  name: 'Adrian Mannarino',            country: 'FRA' },

  // Match M17: Qualifier vs Mpetshi Perricard
  { id: 'mc-q5',   name: 'Qualifier',                   country: 'Q' },
  { id: 'mc-p44',  name: 'Giovanni Mpetshi Perricard',  country: 'FRA' },

  // Match M18: Cilic vs Qualifier
  { id: 'mc-p45',  name: 'Marin Cilic',                 country: 'CRO' },
  { id: 'mc-q6',   name: 'Qualifier',                   country: 'Q' },

  // Match M19: Moutet vs Qualifier
  { id: 'mc-p47',  name: 'Corentin Moutet',             country: 'FRA' },
  { id: 'mc-q7',   name: 'Qualifier',                   country: 'Q' },

  // Match M20: Popyrin vs Ruud [9]
  { id: 'mc-p49',  name: 'Alexei Popyrin',              country: 'AUS' },
  { id: 'mc-p50',  name: 'Casper Ruud',                 seed: 9,  country: 'NOR' },

  // Match M21: Cerundolo [16] vs Tsitsipas
  { id: 'mc-p51',  name: 'Francisco Cerundolo',         seed: 16, country: 'ARG' },
  { id: 'mc-p52',  name: 'Stefanos Tsitsipas',          country: 'GRE' },

  // Match M22: Altmaier vs Machac
  { id: 'mc-p53',  name: 'Daniel Altmaier',             country: 'GER' },
  { id: 'mc-p54',  name: 'Tomas Machac',                country: 'CZE' },

  // Match M23: Kouame vs Humbert
  { id: 'mc-p55',  name: 'Moise Kouame',                seed: 'WC', country: 'FRA' },
  { id: 'mc-p56',  name: 'Ugo Humbert',                 country: 'FRA' },
];

// Round start times (UTC). Monte Carlo is CEST = UTC+2 in April.
const ROUND_START_TIMES = {
  R1:  '2026-04-06T09:00:00Z', // Mon 6 Apr, 11:00 CEST
  R32: '2026-04-07T09:00:00Z', // Tue 7 Apr, 11:00 CEST
  R16: '2026-04-08T09:00:00Z', // Wed 8 Apr, 11:00 CEST
  QF:  '2026-04-10T09:00:00Z', // Fri 10 Apr, 11:00 CEST
  SF:  '2026-04-11T10:00:00Z', // Sat 11 Apr, 12:00 CEST
  F:   '2026-04-12T12:00:00Z', // Sun 12 Apr, 14:00 CEST
};

function buildMonteCarloMatches() {
  const matches = [];
  const seeds = MC_PLAYERS.slice(0, 8);         // Seeds (indices 0-7)
  const r1Players = MC_PLAYERS.slice(8);        // All non-seeds (indices 8-55)

  // ── R1: 24 matches among 48 non-seeds (indices 8-55) ────────────────────
  // Pair up: [8,9], [10,11], [12,13], ..., [54,55]
  for (let i = 0; i < MATCHES_PER_ROUND.R1; i++) {
    const p1 = r1Players[i * 2];
    const p2 = r1Players[i * 2 + 1];
    matches.push({
      id: `m-R1-${i}`,
      round: 'R1',
      matchOrder: i,
      player1Id: p1.id, player1Name: p1.name,
      player2Id: p2.id, player2Name: p2.name,
      winnerId: null, winnerName: null,
      status: 'scheduled', bye: false,
    });
  }

  // ── R32: 16 matches (explicit bracket mapping) ────────────────────────────
  // Correct Monte Carlo 2026 bracket structure (non-sequential seed placement).
  // Seeds are placed as player1 (win in mock mode). Structure:
  //   Match 0: Alcaraz [1] vs M0 winner
  //   Match 1-2: R1 pairs
  //   Match 3: Bublik [8] vs M5 winner
  //   ... etc
  const R32_BRACKET = [
    { type: 'seed', seedIdx: 0, r1Idx: 0 },    // Alcaraz [1] vs M0
    { type: 'r1r1', r1Idx1: 1, r1Idx2: 2 },    // M1 vs M2
    { type: 'r1r1', r1Idx1: 3, r1Idx2: 4 },    // M3 vs M4
    { type: 'seed', seedIdx: 7, r1Idx: 5 },     // Bublik [8] vs M5
    { type: 'seed', seedIdx: 3, r1Idx: 6 },     // Musetti [4] vs M6
    { type: 'r1r1', r1Idx1: 7, r1Idx2: 8 },    // M7 vs M8
    { type: 'r1r1', r1Idx1: 9, r1Idx2: 10 },   // M9 vs M10
    { type: 'seed', seedIdx: 4, r1Idx: 11 },    // de Minaur [5] vs M11
    { type: 'seed', seedIdx: 6, r1Idx: 12 },    // Medvedev [7] vs M12
    { type: 'r1r1', r1Idx1: 13, r1Idx2: 14 },  // M13 vs M14
    { type: 'r1r1', r1Idx1: 15, r1Idx2: 16 },  // M15 vs M16
    { type: 'seed', seedIdx: 2, r1Idx: 17 },    // Zverev [3] vs M17
    { type: 'seed', seedIdx: 5, r1Idx: 18 },    // FAA [6] vs M18
    { type: 'r1r1', r1Idx1: 19, r1Idx2: 20 },  // M19 vs M20
    { type: 'r1r1', r1Idx1: 21, r1Idx2: 22 },  // M21 vs M22
    { type: 'seed', seedIdx: 1, r1Idx: 23 },    // Sinner [2] vs M23
  ];

  const r1Matches = matches.filter(m => m.round === 'R1');

  for (let i = 0; i < R32_BRACKET.length; i++) {
    const slot = R32_BRACKET[i];
    let p1, p2;

    if (slot.type === 'seed') {
      // Seed vs R1 winner — seed as player1 (wins in mock mode)
      const seed = seeds[slot.seedIdx];
      const r1Match = r1Matches[slot.r1Idx];
      p1 = { id: seed.id, name: seed.name };
      p2 = { id: r1Match.player1Id, name: r1Match.player1Name };
    } else {
      // R1 winner vs R1 winner — player1 of first match wins in mock mode
      const m1 = r1Matches[slot.r1Idx1];
      const m2 = r1Matches[slot.r1Idx2];
      p1 = { id: m1.player1Id, name: m1.player1Name };
      p2 = { id: m2.player1Id, name: m2.player1Name };
    }

    matches.push({
      id: `m-R32-${i}`,
      round: 'R32',
      matchOrder: i,
      player1Id: p1.id, player1Name: p1.name,
      player2Id: p2.id, player2Name: p2.name,
      winnerId: null, winnerName: null,
      status: 'scheduled', bye: false,
    });
  }

  // ── R16 → QF → SF → F: pair consecutive winners ────────────────────────
  // All winners come from R32 matches (player1 wins in mock mode)
  const laterRounds = ['R16', 'QF', 'SF', 'F'];
  const r32Matches = matches.filter(m => m.round === 'R32');
  let prevWinners = r32Matches.map(m => ({ id: m.player1Id, name: m.player1Name }));

  for (const round of laterRounds) {
    const count = MATCHES_PER_ROUND[round];
    const roundMatches = [];
    for (let i = 0; i < count; i++) {
      const p1 = prevWinners[i * 2];
      const p2 = prevWinners[i * 2 + 1];
      const m = {
        id: `m-${round}-${i}`,
        round,
        matchOrder: i,
        player1Id: p1.id, player1Name: p1.name,
        player2Id: p2.id, player2Name: p2.name,
        winnerId: null, winnerName: null,
        status: 'scheduled', bye: false,
      };
      matches.push(m);
      roundMatches.push(m);
    }
    // Next round: winners are all player1s (seeds/strong players win in mock)
    prevWinners = roundMatches.map(m => ({ id: m.player1Id, name: m.player1Name }));
  }

  return matches;
}

/**
 * Return the Monte Carlo mock draw.
 *
 * currentRound: the round treated as "in progress" (no winner yet).
 * All rounds before currentRound are marked completed (player1 wins in mock).
 * All rounds after are scheduled.
 *
 * Expected MATCHES_PER_ROUND:
 *   R1: 24, R32: 16, R16: 8, QF: 4, SF: 2, F: 1
 */
export function getMonteCarlMockDraw(currentRound = 'R1') {
  const roundIndex = ROUNDS.indexOf(currentRound);
  const players = MC_PLAYERS.map(p => ({ ...p, roundEliminated: null }));
  const matches = buildMonteCarloMatches();
  const eliminated = new Set();

  matches.forEach(m => {
    const r = ROUNDS.indexOf(m.round);
    m.startTime = ROUND_START_TIMES[m.round] || null;
    if (r < roundIndex) {
      // Round completed: player1 wins (seeds/strong players dominate in mock)
      m.status = 'completed';
      m.winnerId = m.player1Id;
      m.winnerName = m.player1Name;
      eliminated.add(m.player2Id);
    } else if (r === roundIndex) {
      m.status = 'in_progress';
    }
  });

  // Mark eliminated players with their elimination round
  eliminated.forEach(id => {
    const p = players.find(x => x.id === id);
    if (!p) return;
    const lostMatch = matches.find(
      m => m.status === 'completed' && (m.player1Id === id || m.player2Id === id) && m.winnerId !== id
    );
    if (lostMatch) p.roundEliminated = lostMatch.round;
  });

  return {
    players,
    matches,
    rounds: ROUNDS,
    currentRound,
    tournament: 'Rolex Monte-Carlo Masters 2026',
    seedsWithByes: 8,
    dataSource: 'mock',
  };
}

export { MC_PLAYERS };
