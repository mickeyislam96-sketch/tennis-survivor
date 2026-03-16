// Miami Open presented by Itau 2026 — Real draw as released 16 March 2026
// 96 players: 32 seeds with R1 byes, 64 players compete in R1 (32 matches).
// Rounds: R1 → R64 → R32 → R16 → QF → SF → F
//
// QUALIFIERS: 13 qualifier/lucky-loser slots in the draw.
// Update the 'Qualifier N' names below as qualifying results come in:
//   Qualifier 1  — vs Giron     → winner faces Darderi      (top half)
//   Qualifier 2  — vs Kouame    → winner faces Lehecka      (top half)
//   Qualifier 3  — vs Q4        → winner faces Musetti      (top half)
//   Qualifier 4  — vs Q3        → winner faces Musetti      (top half)
//   Qualifier 5  — vs Navone    → winner faces Vacherot     (top half)
//   Qualifier 6  — vs Tsitsipas → winner faces De Minaur    (top half)
//   Qualifier 7  — vs Royer     → winner faces Cerundolo    (bottom half)
//   Qualifier 8  — vs Halys     → winner faces Davidovich F.(bottom half)
//   Qualifier 9  — vs Fucsovics → winner faces Auger-Alias. (bottom half)
//   Qualifier 10 — vs Cazaux    → winner faces Tiafoe       (bottom half)
//   Qualifier 11 — vs Baez      → winner faces Mensik       (bottom half)
//   Qualifier 12 — vs Michelsen → winner faces Norrie       (bottom half)
//   Qualifier 13 — vs Dzumhur   → winner faces Sinner       (bottom half)

import { ROUNDS, MATCHES_PER_ROUND } from '../config/tournament.js';

const SEEDS_WITH_BYES = 32;

// ─────────────────────────────────────────────────────────────────────────────
// MIAMI_PLAYERS layout
//   [0..31]  — 32 seeds, ordered by their draw position (seed[i] faces R1 winner[i])
//   [32..95] — 64 R1 players, in match-pair order: pair (i*2, i*2+1) = R1 match i
// ─────────────────────────────────────────────────────────────────────────────
const MIAMI_PLAYERS = [
  // ── TOP HALF seeds (draw order, faces R1 match with same index) ───────────
  { id: 'p1',  name: 'Carlos Alcaraz',               seed: 1  },  // faces M0 winner
  { id: 'p2',  name: 'Sebastian Korda',               seed: 32 },  // faces M1 winner
  { id: 'p3',  name: 'Luciano Darderi',               seed: 17 },  // faces M2 winner
  { id: 'p4',  name: 'Karen Khachanov',               seed: 14 },  // faces M3 winner
  { id: 'p5',  name: 'Casper Ruud',                   seed: 11 },  // faces M4 winner
  { id: 'p6',  name: 'Jiri Lehecka',                  seed: 21 },  // faces M5 winner
  { id: 'p7',  name: 'Jack Draper',                   seed: 25 },  // faces M6 winner
  { id: 'p8',  name: 'Taylor Fritz',                  seed: 6  },  // faces M7 winner
  { id: 'p9',  name: 'Lorenzo Musetti',               seed: 4  },  // faces M8 winner
  { id: 'p10', name: 'Tomas Martin Etcheverry',       seed: 29 },  // faces M9 winner
  { id: 'p11', name: 'Tommy Paul',                    seed: 22 },  // faces M10 winner
  { id: 'p12', name: 'Flavio Cobolli',                seed: 13 },  // faces M11 winner
  { id: 'p13', name: 'Alexander Bublik',              seed: 10 },  // faces M12 winner
  { id: 'p14', name: 'Valentin Vacherot',             seed: 24 },  // faces M13 winner
  { id: 'p15', name: 'Arthur Fils',                   seed: 28 },  // faces M14 winner
  { id: 'p16', name: 'Alex de Minaur',                seed: 5  },  // faces M15 winner
  // ── BOTTOM HALF seeds ────────────────────────────────────────────────────
  { id: 'p17', name: 'Ben Shelton',                   seed: 8  },  // faces M16 winner
  { id: 'p18', name: 'Ugo Humbert',                   seed: 31 },  // faces M17 winner
  { id: 'p19', name: 'Francisco Cerundolo',           seed: 18 },  // faces M18 winner
  { id: 'p20', name: 'Daniil Medvedev',               seed: 9  },  // faces M19 winner
  { id: 'p21', name: 'Alejandro Davidovich Fokina',   seed: 16 },  // faces M20 winner
  { id: 'p22', name: 'Learner Tien',                  seed: 20 },  // faces M21 winner
  { id: 'p23', name: 'Brandon Nakashima',             seed: 27 },  // faces M22 winner
  { id: 'p24', name: 'Alexander Zverev',              seed: 3  },  // faces M23 winner
  { id: 'p25', name: 'Felix Auger-Aliassime',         seed: 7  },  // faces M24 winner
  { id: 'p26', name: 'Arthur Rinderknech',            seed: 26 },  // faces M25 winner
  { id: 'p27', name: 'Frances Tiafoe',                seed: 19 },  // faces M26 winner
  { id: 'p28', name: 'Jakub Mensik',                  seed: 12 },  // faces M27 winner
  { id: 'p29', name: 'Andrey Rublev',                 seed: 15 },  // faces M28 winner
  { id: 'p30', name: 'Cameron Norrie',                seed: 23 },  // faces M29 winner
  { id: 'p31', name: 'Corentin Moutet',               seed: 30 },  // faces M30 winner
  { id: 'p32', name: 'Jannik Sinner',                 seed: 2  },  // faces M31 winner

  // ── R1 players in match-pair order ───────────────────────────────────────
  // M0  → winner faces Alcaraz (S1)
  { id: 'p33', name: 'Fabian Marozsan' },
  { id: 'p34', name: 'Joao Fonseca' },
  // M1  → winner faces Korda (S32)
  { id: 'p35', name: 'Giovanni Mpetshi Perricard' },
  { id: 'p36', name: 'Camilo Ugo Carabelli' },
  // M2  → winner faces Darderi (S17)
  { id: 'p37', name: 'Marcos Giron' },
  { id: 'p38', name: 'Qualifier 1' },
  // M3  → winner faces Khachanov (S14)
  { id: 'p39', name: 'James Duckworth' },
  { id: 'p40', name: 'Roberto Bautista Agut' },
  // M4  → winner faces Ruud (S11)
  { id: 'p41', name: 'Ethan Quinn' },
  { id: 'p42', name: 'Hubert Hurkacz' },
  // M5  → winner faces Lehecka (S21)
  { id: 'p43', name: 'Moise Kouame' },
  { id: 'p44', name: 'Qualifier 2' },
  // M6  → winner faces Draper (S25)
  { id: 'p45', name: 'Reilly Opelka' },
  { id: 'p46', name: 'Nuno Borges' },
  // M7  → winner faces Fritz (S6)
  { id: 'p47', name: 'Denis Shapovalov' },
  { id: 'p48', name: 'Botic van de Zandschulp' },
  // M8  → winner faces Musetti (S4)
  { id: 'p49', name: 'Qualifier 3' },
  { id: 'p50', name: 'Qualifier 4' },
  // M9  → winner faces Etcheverry (S29)
  { id: 'p51', name: 'Zizou Bergs' },
  { id: 'p52', name: 'Jenson Brooksby' },
  // M10 → winner faces Paul (S22)
  { id: 'p53', name: 'Zhizhen Zhang' },
  { id: 'p54', name: 'Adrian Mannarino' },
  // M11 → winner faces Cobolli (S13)
  { id: 'p55', name: 'Raphael Collignon' },
  { id: 'p56', name: 'Grigor Dimitrov' },
  // M12 → winner faces Bublik (S10)
  { id: 'p57', name: 'Alexandre Muller' },
  { id: 'p58', name: 'Matteo Berrettini' },
  // M13 → winner faces Vacherot (S24)
  { id: 'p59', name: 'Qualifier 5' },
  { id: 'p60', name: 'Mariano Navone' },
  // M14 → winner faces Fils (S28)
  { id: 'p61', name: 'Darwin Blanch' },
  { id: 'p62', name: 'Jan-Lennard Struff' },
  // M15 → winner faces De Minaur (S5)
  { id: 'p63', name: 'Stefanos Tsitsipas' },
  { id: 'p64', name: 'Qualifier 6' },
  // M16 → winner faces Shelton (S8)
  { id: 'p65', name: 'Matteo Arnaldi' },
  { id: 'p66', name: 'Alexander Shevchenko' },
  // M17 → winner faces Humbert (S31)
  { id: 'p67', name: 'Gabriel Diallo' },
  { id: 'p68', name: 'Yibing Wu' },
  // M18 → winner faces Cerundolo (S18)
  { id: 'p69', name: 'Valentin Royer' },
  { id: 'p70', name: 'Qualifier 7' },
  // M19 → winner faces Medvedev (S9)
  { id: 'p71', name: 'Aleksandar Kovacevic' },
  { id: 'p72', name: 'Rei Sakamoto' },
  // M20 → winner faces Davidovich Fokina (S16)
  { id: 'p73', name: 'Quentin Halys' },
  { id: 'p74', name: 'Qualifier 8' },
  // M21 → winner faces Tien (S20)
  { id: 'p75', name: 'Kamil Majchrzak' },
  { id: 'p76', name: 'Miomir Kecmanovic' },
  // M22 → winner faces Nakashima (S27)
  { id: 'p77', name: 'Marin Cilic' },
  { id: 'p78', name: 'Alexei Popyrin' },
  // M23 → winner faces Zverev (S3)
  { id: 'p79', name: 'Martin Damm' },
  { id: 'p80', name: 'Jacob Fearnley' },
  // M24 → winner faces Auger-Aliassime (S7)
  { id: 'p81', name: 'Qualifier 9' },
  { id: 'p82', name: 'Marton Fucsovics' },
  // M25 → winner faces Rinderknech (S26)
  { id: 'p83', name: 'Terence Atmane' },
  { id: 'p84', name: 'Daniel Altmaier' },
  // M26 → winner faces Tiafoe (S19)
  { id: 'p85', name: 'Arthur Cazaux' },
  { id: 'p86', name: 'Qualifier 10' },
  // M27 → winner faces Mensik (S12)
  { id: 'p87', name: 'Qualifier 11' },
  { id: 'p88', name: 'Sebastian Baez' },
  // M28 → winner faces Rublev (S15)
  { id: 'p89', name: 'Alejandro Tabilo' },
  { id: 'p90', name: 'Francisco Comesana' },
  // M29 → winner faces Norrie (S23)
  { id: 'p91', name: 'Alex Michelsen' },
  { id: 'p92', name: 'Qualifier 12' },
  // M30 → winner faces Moutet (S30)
  { id: 'p93', name: 'Emilio Nava' },
  { id: 'p94', name: 'Tomas Machac' },
  // M31 → winner faces Sinner (S2)
  { id: 'p95', name: 'Qualifier 13' },
  { id: 'p96', name: 'Damir Dzumhur' },
];

function buildMiamiMatches() {
  const matches = [];

  // ── R1: 32 matches among 64 unseeded players ─────────────────────────────
  const r1Players = MIAMI_PLAYERS.slice(SEEDS_WITH_BYES);
  for (let i = 0; i < MATCHES_PER_ROUND.R1; i++) {
    const p1 = r1Players[i * 2];
    const p2 = r1Players[i * 2 + 1];
    matches.push({
      id: `m-R1-${i}`,
      round: 'R1',
      matchOrder: i,
      player1Id: p1.id,
      player1Name: p1.name,
      player2Id: p2.id,
      player2Name: p2.name,
      winnerId: null,
      winnerName: null,
      status: 'scheduled',
      bye: false,
    });
  }

  // ── R64: 32 matches — R1 winner[i] vs seed[i] ────────────────────────────
  const byePlayers = MIAMI_PLAYERS.slice(0, SEEDS_WITH_BYES);
  for (let i = 0; i < MATCHES_PER_ROUND.R64; i++) {
    const r1Match = matches[i];
    const p1 = { id: r1Match.player1Id, name: r1Match.player1Name };
    const p2 = byePlayers[i];
    matches.push({
      id: `m-R64-${i}`,
      round: 'R64',
      matchOrder: i,
      player1Id: p1.id,
      player1Name: p1.name,
      player2Id: p2.id,
      player2Name: p2.name,
      winnerId: null,
      winnerName: null,
      status: 'scheduled',
      bye: false,
    });
  }

  // ── R32 → R16 → QF → SF → F: pair consecutive winners ───────────────────
  const laterRounds = ['R32', 'R16', 'QF', 'SF', 'F'];
  let prevWinners = [...MIAMI_PLAYERS.slice(0, 64)];
  for (const round of laterRounds) {
    const count = MATCHES_PER_ROUND[round];
    for (let i = 0; i < count; i++) {
      const p1 = prevWinners[i * 2]     || MIAMI_PLAYERS[i * 2];
      const p2 = prevWinners[i * 2 + 1] || MIAMI_PLAYERS[i * 2 + 1];
      matches.push({
        id: `m-${round}-${i}`,
        round,
        matchOrder: i,
        player1Id: p1.id,
        player1Name: p1.name,
        player2Id: p2.id,
        player2Name: p2.name,
        winnerId: null,
        winnerName: null,
        status: 'scheduled',
        bye: false,
      });
    }
    prevWinners = prevWinners.slice(0, count * 2);
  }

  return matches;
}

// Approximate round start times — Miami Open 2026
const ROUND_START_TIMES = {
  R1:  '2026-03-18T11:00:00Z',
  R64: '2026-03-19T11:00:00Z',
  R32: '2026-03-21T11:00:00Z',
  R16: '2026-03-23T11:00:00Z',
  QF:  '2026-03-25T11:00:00Z',
  SF:  '2026-03-27T11:00:00Z',
  F:   '2026-03-29T11:00:00Z',
};

/**
 * Return mock draw for Miami Open 2026.
 *
 * currentRound controls which round is treated as "in progress":
 *   - Rounds before currentRound → completed (player1 wins, for mock purposes)
 *   - currentRound              → in_progress (no winner yet; users pick now)
 *   - Rounds after currentRound → scheduled
 *
 * Default is 'R1' since the draw was released on 16 March and matches begin 18 March.
 */
export function getMiamiMockDraw(currentRound = 'R1') {
  const roundIndex = ROUNDS.indexOf(currentRound);
  const players = MIAMI_PLAYERS.map((p) => ({ ...p, roundEliminated: null }));
  const matches = buildMiamiMatches();
  const eliminated = new Set();

  matches.forEach((m) => {
    const r = ROUNDS.indexOf(m.round);
    m.startTime = ROUND_START_TIMES[m.round] || null;

    if (r < roundIndex) {
      m.status = 'completed';
      m.winnerId = m.player1Id;
      m.winnerName = m.player1Name;
      eliminated.add(m.player2Id);
    } else if (r === roundIndex) {
      m.status = 'in_progress';
    }
    // future rounds remain 'scheduled'
  });

  eliminated.forEach((id) => {
    const p = players.find((x) => x.id === id);
    if (!p) return;
    const lostMatch = matches.find(
      (m) =>
        m.status === 'completed' &&
        (m.player1Id === id || m.player2Id === id) &&
        m.winnerId !== id,
    );
    if (lostMatch) p.roundEliminated = lostMatch.round;
  });

  return {
    players,
    matches,
    rounds: ROUNDS,
    currentRound,
    tournament: 'Miami Open presented by Itau 2026',
    byesInR1: SEEDS_WITH_BYES,
  };
}

export { MIAMI_PLAYERS };
