export const MOCK_GROUPS = [
  {
    id: 'g2',
    name: 'Miami Open 2026 Pool',
    inviteCode: 'MIAMI-2026',
    entryFeeCents: 0,          // Free entry for the Miami launch pool
    prizePoolCents: 0,
    tournamentId: 'miami-2026',
    adminUserId: 'u1',
    createdAt: new Date().toISOString()
  },
  {
    id: 'g3',
    name: 'Monte Carlo 2026 Pool',
    inviteCode: 'MONTE-CARLO-2026',
    entryFeeCents: 0,          // Free entry for the Monte Carlo launch pool
    prizePoolCents: 0,
    tournamentId: 'monte-carlo-2026',
    adminUserId: 'u1',
    createdAt: new Date().toISOString()
  },
];

export const MOCK_USERS = [
  { id: 'u1',  email: 'alice@example.com',   displayName: 'Alice' },
  { id: 'u2',  email: 'bob@example.com',     displayName: 'Bob' },
  { id: 'u3',  email: 'carol@example.com',   displayName: 'Carol' },
  { id: 'u4',  email: 'dan@example.com',     displayName: 'Dan' },
  { id: 'u5',  email: 'emma@example.com',    displayName: 'Emma' },
  { id: 'u6',  email: 'finn@example.com',    displayName: 'Finn' },
  { id: 'u7',  email: 'grace@example.com',   displayName: 'Grace' },
  { id: 'u8',  email: 'harry@example.com',   displayName: 'Harry' },
];

export const MOCK_MEMBERS = [
  // Miami mock members (g2) — practice pool with 8 test users
  { id: 'mem-m1', groupId: 'g2', userId: 'u1', displayName: 'Alice', isAlive: true,  eliminatedRound: null },
  { id: 'mem-m2', groupId: 'g2', userId: 'u2', displayName: 'Bob',   isAlive: true,  eliminatedRound: null },
  { id: 'mem-m3', groupId: 'g2', userId: 'u3', displayName: 'Carol', isAlive: false, eliminatedRound: 'R64' },
  { id: 'mem-m4', groupId: 'g2', userId: 'u4', displayName: 'Dan',   isAlive: false, eliminatedRound: 'R32' },
  { id: 'mem-m5', groupId: 'g2', userId: 'u5', displayName: 'Emma',  isAlive: false, eliminatedRound: 'R32' },
  { id: 'mem-m6', groupId: 'g2', userId: 'u6', displayName: 'Finn',  isAlive: false, eliminatedRound: 'R16' },
  { id: 'mem-m7', groupId: 'g2', userId: 'u7', displayName: 'Grace', isAlive: false, eliminatedRound: 'R16' },
  { id: 'mem-m8', groupId: 'g2', userId: 'u8', displayName: 'Harry', isAlive: false, eliminatedRound: 'R64' },
];

export const MOCK_PICKS = [
  // Miami mock picks
  { id: 'pick1', groupId: 'g2', userId: 'u1', round: 'R1', playerId: 'michelsen-r1', playerName: 'Michelsen', survived: true },
  { id: 'pick2', groupId: 'g2', userId: 'u1', round: 'R64', playerId: 'learner-tien-r64', playerName: 'Learner Tien', survived: true },
];
