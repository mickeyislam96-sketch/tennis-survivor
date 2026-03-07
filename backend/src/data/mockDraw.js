// Mock Grand Slam draw: 128 players, 7 rounds (R128, R64, R32, R16, QF, SF, F)
// For demo we use a small subset; full 128 can be loaded from API later.

const ROUNDS = ['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'];

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
  ...Array.from({ length: 96 }, (_, i) => ({
    id: `p${33 + i}`,
    name: `Player ${33 + i}`,
    seed: 33 + i
  }))
];

// Matches per round: R128=64, R64=32, R32=16, R16=8, QF=4, SF=2, F=1
const MATCHES_PER_ROUND = { R128: 64, R64: 32, R32: 16, R16: 8, QF: 4, SF: 2, F: 1 };

function buildMockMatches() {
  const matches = [];
  let playerIndex = 0;
  for (const round of ROUNDS) {
    const count = MATCHES_PER_ROUND[round];
    for (let i = 0; i < count; i++) {
      const p1 = MOCK_PLAYERS[playerIndex % MOCK_PLAYERS.length];
      const p2 = MOCK_PLAYERS[(playerIndex + 1) % MOCK_PLAYERS.length];
      playerIndex += 2;
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
        status: 'scheduled'
      });
    }
  }
  return matches;
}

// Simulate some results for earlier rounds (mock "live" state)
function getDrawWithResults(currentRound = 'R32') {
  const roundIndex = ROUNDS.indexOf(currentRound);
  const players = MOCK_PLAYERS.map(p => ({
    ...p,
    roundEliminated: null
  }));
  const matches = buildMockMatches();
  const eliminated = new Set();
  matches.forEach(m => {
    const r = ROUNDS.indexOf(m.round);
    if (r < roundIndex) {
      m.status = 'completed';
      m.winnerId = m.player1Id;
      m.winnerName = m.player1Name;
      eliminated.add(m.player2Id);
    } else if (r === roundIndex) {
      m.status = 'in_progress';
      // Deterministic for demo: player1 wins
      m.winnerId = m.player1Id;
      m.winnerName = m.player1Name;
      eliminated.add(m.player2Id);
    }
  });
  eliminated.forEach(id => {
    const p = players.find(x => x.id === id);
    if (p) p.roundEliminated = currentRound;
  });
  return { players, matches, rounds: ROUNDS, currentRound };
}

export { ROUNDS, MOCK_PLAYERS, buildMockMatches, getDrawWithResults };
