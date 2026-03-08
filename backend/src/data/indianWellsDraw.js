// BNP Paribas Open Indian Wells 2026 - Mock draw
// 96 players, 32 seeds get byes in R1. Rounds: R1, R64, R32, R16, QF, SF, F

import { ROUNDS, MATCHES_PER_ROUND } from '../config/tournament.js';

const SEEDS_WITH_BYES = 32;
const DRAW_SIZE = 96;

// Top 32 seeds (get byes in R1) + next 64 for R1 matches
const MOCK_PLAYERS = [
  { id: 'p1', name: 'Carlos Alcaraz', seed: 1 },
  { id: 'p2', name: 'Jannik Sinner', seed: 2 },
  { id: 'p3', name: 'Novak Djokovic', seed: 3 },
  { id: 'p4', name: 'Daniil Medvedev', seed: 4 },
  { id: 'p5', name: 'Alexander Zverev', seed: 5 },
  { id: 'p6', name: 'Andrey Rublev', seed: 6 },
  { id: 'p7', name: 'Holger Rune', seed: 7 },
  { id: 'p8', name: 'Casper Ruud', seed: 8 },
  { id: 'p9', name: 'Taylor Fritz', seed: 9 },
  { id: 'p10', name: 'Stefanos Tsitsipas', seed: 10 },
  { id: 'p11', name: 'Grigor Dimitrov', seed: 11 },
  { id: 'p12', name: 'Hubert Hurkacz', seed: 12 },
  { id: 'p13', name: 'Tommy Paul', seed: 13 },
  { id: 'p14', name: 'Ben Shelton', seed: 14 },
  { id: 'p15', name: 'Karen Khachanov', seed: 15 },
  { id: 'p16', name: 'Ugo Humbert', seed: 16 },
  { id: 'p17', name: 'Alex de Minaur', seed: 17 },
  { id: 'p18', name: 'Sebastian Korda', seed: 18 },
  { id: 'p19', name: 'Frances Tiafoe', seed: 19 },
  { id: 'p20', name: 'Francisco Cerundolo', seed: 20 },
  { id: 'p21', name: 'Adrian Mannarino', seed: 21 },
  { id: 'p22', name: 'Lorenzo Musetti', seed: 22 },
  { id: 'p23', name: 'Tallon Griekspoor', seed: 23 },
  { id: 'p24', name: 'Jan-Lennard Struff', seed: 24 },
  { id: 'p25', name: 'Nicolas Jarry', seed: 25 },
  { id: 'p26', name: 'Alejandro Davidovich Fokina', seed: 26 },
  { id: 'p27', name: 'Sebastian Baez', seed: 27 },
  { id: 'p28', name: 'Cameron Norrie', seed: 28 },
  { id: 'p29', name: 'Arthur Fils', seed: 29 },
  { id: 'p30', name: 'Tomas Martin Etcheverry', seed: 30 },
  { id: 'p31', name: 'Mariano Navone', seed: 31 },
  { id: 'p32', name: 'Jiri Lehecka', seed: 32 },
  ...Array.from({ length: 64 }, (_, i) => ({
    id: `p${33 + i}`,
    name: `Player ${33 + i}`,
    seed: 33 + i,
  })),
];

function buildIndianWellsMatches() {
  const matches = [];
  // R1: 32 matches among 64 players (indices 32-95). Seeds 1-32 (indices 0-31) have byes.
  const r1Players = MOCK_PLAYERS.slice(SEEDS_WITH_BYES);
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
  // R64: 32 matches. We don't build full bracket; we simulate by having 32 "winners" from R1 + 32 byes.
  // For mock we create 32 R64 matches with placeholder pairs (winners from R1 vs bye players).
  // Simplified: R64 match i = winner of R1 match i vs seed (i+1). So we need 32 R64 matches.
  let r64Winners = []; // will be filled when we resolve R1
  let byePlayers = MOCK_PLAYERS.slice(0, SEEDS_WITH_BYES);
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
  // R32, R16, QF, SF, F: use same pattern - pair consecutive "winners" from previous round
  const restRounds = ['R32', 'R16', 'QF', 'SF', 'F'];
  let prevWinners = [...MOCK_PLAYERS.slice(0, 64)]; // placeholder: 64 "entrants" to R32
  let matchId = 0;
  for (const round of restRounds) {
    const count = MATCHES_PER_ROUND[round];
    for (let i = 0; i < count; i++) {
      const p1 = prevWinners[i * 2] || MOCK_PLAYERS[i * 2];
      const p2 = prevWinners[i * 2 + 1] || MOCK_PLAYERS[i * 2 + 1];
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
      matchId++;
    }
    prevWinners = prevWinners.slice(0, count * 2);
  }
  return matches;
}

// Realistic start times per round — used by pick-window deadline logic
const ROUND_START_TIMES = {
  R1:  '2026-03-05T11:00:00Z',
  R64: '2026-03-06T11:00:00Z',
  R32: '2026-03-08T11:00:00Z',
  R16: '2026-03-10T11:00:00Z',
  QF:  '2026-03-12T11:00:00Z',
  SF:  '2026-03-14T11:00:00Z',
  F:   '2026-03-16T11:00:00Z',
};

/**
 * Return mock draw for Indian Wells 2026.
 *
 * Actual state as of March 8 2026:
 *   R1  — completed (March 5-6). Top 32 seeds had byes, didn't play.
 *   R64 — completed (March 6-7). Seeds entered for the first time.
 *   R32 — in progress (started March 8). Users pick for this round.
 *   R16, QF, SF, F — scheduled.
 */
export function getIndianWellsMockDraw(currentRound = 'R32') {
  const roundIndex = ROUNDS.indexOf(currentRound);
  const players = MOCK_PLAYERS.map((p) => ({ ...p, roundEliminated: null }));
  const matches = buildIndianWellsMatches();
  const eliminated = new Set();

  matches.forEach((m) => {
    const r = ROUNDS.indexOf(m.round);

    // Every match gets a realistic start time so deadline logic has timestamps
    m.startTime = ROUND_START_TIMES[m.round] || null;

    if (r < roundIndex) {
      // Past rounds: mark completed with player1 winning (mock result)
      m.status = 'completed';
      m.winnerId = m.player1Id;
      m.winnerName = m.player1Name;
      eliminated.add(m.player2Id);
    } else if (r === roundIndex) {
      // Current round: in progress, NO winner set yet — users are picking now
      m.status = 'in_progress';
    }
    // Future rounds: stay scheduled with no winner
  });

  // Mark each eliminated player with the round they lost in
  eliminated.forEach((id) => {
    const p = players.find((x) => x.id === id);
    if (!p) return;
    const lostMatch = matches.find(
      (m) => m.status === 'completed' &&
             (m.player1Id === id || m.player2Id === id) &&
             m.winnerId !== id
    );
    if (lostMatch) p.roundEliminated = lostMatch.round;
  });

  return {
    players,
    matches,
    rounds: ROUNDS,
    currentRound,
    tournament: 'BNP Paribas Open Indian Wells 2026',
    byesInR1: SEEDS_WITH_BYES,
  };
}

export { MOCK_PLAYERS };
