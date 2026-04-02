/**
 * Monte Carlo Masters 2026 — mock draw.
 *
 * 56-player draw. Top 8 seeds get R1 byes (enter directly at R32).
 * Layout:
 *   [0..7]   — 8 seeds in draw order (seed[i] faces R1 winner from match i)
 *   [8..55]  — 48 non-seeds in R1, in match-pair order
 *
 * Rounds: R1 (24 matches) → R32 (16 matches) → R16 → QF → SF → F
 *
 * NOTE: Player names are approximate based on typical Monte Carlo entries.
 * Update once the actual 2026 draw is released.
 */

import { ROUNDS, MATCHES_PER_ROUND } from '../config/tournament.js';

const SEEDS_WITH_BYES = 8; // Top 8 seeds enter at R32

// ── Players ───────────────────────────────────────────────────────────────────
// Seeds in draw order (each faces the winner of R1 match with matching index)
const MC_PLAYERS = [
  // ── Seeds (top 8 get byes into R32) ──────────────────────────────────────
  { id: 'mc-s1',  name: 'Jannik Sinner',              seed: 1  }, // faces R1-M0 winner
  { id: 'mc-s2',  name: 'Carlos Alcaraz',              seed: 2  }, // faces R1-M1 winner
  { id: 'mc-s3',  name: 'Alexander Zverev',            seed: 3  }, // faces R1-M2 winner
  { id: 'mc-s4',  name: 'Daniil Medvedev',             seed: 4  }, // faces R1-M3 winner
  { id: 'mc-s5',  name: 'Casper Ruud',                 seed: 5  }, // faces R1-M4 winner
  { id: 'mc-s6',  name: 'Stefanos Tsitsipas',          seed: 6  }, // faces R1-M5 winner
  { id: 'mc-s7',  name: 'Andrey Rublev',               seed: 7  }, // faces R1-M6 winner
  { id: 'mc-s8',  name: 'Holger Rune',                 seed: 8  }, // faces R1-M7 winner

  // ── Non-seeds in R1 (24 matches = 48 players) ───────────────────────────
  // M0 → winner vs Sinner (S1)
  { id: 'mc-p9',  name: 'Sebastian Baez' },
  { id: 'mc-p10', name: 'Alejandro Davidovich Fokina' },
  // M1 → winner vs Alcaraz (S2)
  { id: 'mc-p11', name: 'Arthur Fils' },
  { id: 'mc-p12', name: 'Lorenzo Musetti' },
  // M2 → winner vs Zverev (S3)
  { id: 'mc-p13', name: 'Tommy Paul' },
  { id: 'mc-p14', name: 'Alex de Minaur' },
  // M3 → winner vs Medvedev (S4)
  { id: 'mc-p15', name: 'Taylor Fritz' },
  { id: 'mc-p16', name: 'Ben Shelton' },
  // M4 → winner vs Ruud (S5)
  { id: 'mc-p17', name: 'Hubert Hurkacz' },
  { id: 'mc-p18', name: 'Felix Auger-Aliassime' },
  // M5 → winner vs Tsitsipas (S6)
  { id: 'mc-p19', name: 'Jack Draper' },
  { id: 'mc-p20', name: 'Ugo Humbert' },
  // M6 → winner vs Rublev (S7)
  { id: 'mc-p21', name: 'Frances Tiafoe' },
  { id: 'mc-p22', name: 'Sebastian Korda' },
  // M7 → winner vs Rune (S8)
  { id: 'mc-p23', name: 'Grigor Dimitrov' },
  { id: 'mc-p24', name: 'Karen Khachanov' },
  // M8 → R32 left half
  { id: 'mc-p25', name: 'Nicolas Jarry' },
  { id: 'mc-p26', name: 'Tomas Martin Etcheverry' },
  // M9
  { id: 'mc-p27', name: 'Flavio Cobolli' },
  { id: 'mc-p28', name: 'Francisco Cerundolo' },
  // M10
  { id: 'mc-p29', name: 'Jiri Lehecka' },
  { id: 'mc-p30', name: 'Alejandro Tabilo' },
  // M11
  { id: 'mc-p31', name: 'Jan-Lennard Struff' },
  { id: 'mc-p32', name: 'Adrian Mannarino' },
  // M12
  { id: 'mc-p33', name: 'Matteo Berrettini' },
  { id: 'mc-p34', name: 'Mariano Navone' },
  // M13
  { id: 'mc-p35', name: 'Jakub Mensik' },
  { id: 'mc-p36', name: 'Miomir Kecmanovic' },
  // M14
  { id: 'mc-p37', name: 'Cameron Norrie' },
  { id: 'mc-p38', name: 'Luciano Darderi' },
  // M15
  { id: 'mc-p39', name: 'Tomas Machac' },
  { id: 'mc-p40', name: 'Matteo Arnaldi' },
  // M16
  { id: 'mc-p41', name: 'Alexandre Muller' },
  { id: 'mc-p42', name: 'Alexander Bublik' },
  // M17
  { id: 'mc-p43', name: 'Quentin Halys' },
  { id: 'mc-p44', name: 'Zhizhen Zhang' },
  // M18
  { id: 'mc-p45', name: 'Maxime Cressy' },
  { id: 'mc-p46', name: 'Arthur Rinderknech' },
  // M19
  { id: 'mc-p47', name: 'Gabriel Diallo' },
  { id: 'mc-p48', name: 'Botic van de Zandschulp' },
  // M20
  { id: 'mc-p49', name: 'Yibing Wu' },
  { id: 'mc-p50', name: 'Valentin Royer' },
  // M21
  { id: 'mc-p51', name: 'Laslo Djere' },
  { id: 'mc-p52', name: 'Corentin Moutet' },
  // M22
  { id: 'mc-p53', name: 'Benoit Paire' },
  { id: 'mc-p54', name: 'Mikael Ymer' },
  // M23 (last R1 match — winner faces a non-seeded R32 slot)
  { id: 'mc-p55', name: 'Qualifier 1' },
  { id: 'mc-p56', name: 'Qualifier 2' },
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

  // ── R1: 24 matches among 48 non-seeds ─────────────────────────────────────
  const r1Players = MC_PLAYERS.slice(SEEDS_WITH_BYES); // indices 8..55
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

  // ── R32: 16 matches ──────────────────────────────────────────────────────
  // First 8 matches: seed[i] vs R1 winner[i] (seeds 1-8)
  // Next 8 matches:  R1 winner pairs (matches 8-23 in R1)
  const seeds     = MC_PLAYERS.slice(0, SEEDS_WITH_BYES);
  const r1Matches = matches.filter(m => m.round === 'R1');

  // Seed matches: seed as player1 so seeds win in mock
  for (let i = 0; i < SEEDS_WITH_BYES; i++) {
    const r1Match  = r1Matches[i];
    const r1Winner = { id: r1Match.player1Id, name: r1Match.player1Name };
    const seed     = seeds[i];
    matches.push({
      id: `m-R32-${i}`,
      round: 'R32', matchOrder: i,
      player1Id: seed.id, player1Name: seed.name,     // seed wins in mock
      player2Id: r1Winner.id, player2Name: r1Winner.name,
      winnerId: null, winnerName: null,
      status: 'scheduled', bye: false,
    });
  }
  // Non-seeded R32 matches: R1 winners 8-23 pair up
  for (let i = 0; i < 8; i++) {
    const m1 = r1Matches[SEEDS_WITH_BYES + i * 2];
    const m2 = r1Matches[SEEDS_WITH_BYES + i * 2 + 1];
    const p1 = { id: m1.player1Id, name: m1.player1Name };
    const p2 = { id: m2.player1Id, name: m2.player1Name };
    matches.push({
      id: `m-R32-${SEEDS_WITH_BYES + i}`,
      round: 'R32', matchOrder: SEEDS_WITH_BYES + i,
      player1Id: p1.id, player1Name: p1.name,
      player2Id: p2.id, player2Name: p2.name,
      winnerId: null, winnerName: null,
      status: 'scheduled', bye: false,
    });
  }

  // ── R16 → QF → SF → F: pair consecutive R32 winners ─────────────────────
  const laterRounds   = ['R16', 'QF', 'SF', 'F'];
  const r32Matches    = matches.filter(m => m.round === 'R32');
  let prevWinners     = r32Matches.map(m => ({ id: m.player1Id, name: m.player1Name }));

  for (const round of laterRounds) {
    const count       = MATCHES_PER_ROUND[round];
    const roundMatches = [];
    for (let i = 0; i < count; i++) {
      const p1 = prevWinners[i * 2];
      const p2 = prevWinners[i * 2 + 1];
      const m = {
        id: `m-${round}-${i}`, round, matchOrder: i,
        player1Id: p1.id, player1Name: p1.name,
        player2Id: p2.id, player2Name: p2.name,
        winnerId: null, winnerName: null,
        status: 'scheduled', bye: false,
      };
      matches.push(m);
      roundMatches.push(m);
    }
    prevWinners = roundMatches.map(m => ({ id: m.player1Id, name: m.player1Name }));
  }

  return matches;
}

/**
 * Return the Monte Carlo mock draw.
 *
 * currentRound: the round treated as "in progress" (no winner yet).
 * All rounds before currentRound are marked completed (player1 wins).
 * All rounds after are scheduled.
 */
export function getMonteCarlMockDraw(currentRound = 'R1') {
  const roundIndex = ROUNDS.indexOf(currentRound);
  const players    = MC_PLAYERS.map(p => ({ ...p, roundEliminated: null }));
  const matches    = buildMonteCarloMatches();
  const eliminated = new Set();

  matches.forEach(m => {
    const r = ROUNDS.indexOf(m.round);
    m.startTime = ROUND_START_TIMES[m.round] || null;
    if (r < roundIndex) {
      m.status    = 'completed';
      m.winnerId  = m.player1Id;
      m.winnerName = m.player1Name;
      eliminated.add(m.player2Id);
    } else if (r === roundIndex) {
      m.status = 'in_progress';
    }
  });

  eliminated.forEach(id => {
    const p = players.find(x => x.id === id);
    if (!p) return;
    const lostMatch = matches.find(
      m => m.status === 'completed' && (m.player1Id === id || m.player2Id === id) && m.winnerId !== id
    );
    if (lostMatch) p.roundEliminated = lostMatch.round;
  });

  return {
    players, matches, rounds: ROUNDS, currentRound,
    tournament: 'Rolex Monte-Carlo Masters 2026',
    seedsWithByes: SEEDS_WITH_BYES,
    dataSource: 'mock',
  };
}

export { MC_PLAYERS };
