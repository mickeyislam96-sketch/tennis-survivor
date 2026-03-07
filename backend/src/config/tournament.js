// BNP Paribas Open Indian Wells 2026 - Masters 1000
// 96 players: 32 seeds get byes; R1 has 32 matches (64 players), then R64, R32, R16, QF, SF, F

export const INDIAN_WELLS_2026 = {
  name: 'BNP Paribas Open',
  event: 'Indian Wells',
  season: '2026',
  drawSize: 96,
  seedsWithByes: 32,
};

// Round order: R1 (first round, 32 matches), R64, R32, R16, QF, SF, F
export const ROUNDS = ['R1', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'];

// Matches per round: R1 = 32 (64 players, 32 byes), R64=32, R32=16, R16=8, QF=4, SF=2, F=1
export const MATCHES_PER_ROUND = { R1: 32, R64: 32, R32: 16, R16: 8, QF: 4, SF: 2, F: 1 };
