export const MOCK_GROUPS = [
  // Monte Carlo 2026 and Miami Open 2026 were closed friends-only runs. They
  // are intentionally kept out of MOCK_GROUPS so the lobby never surfaces
  // orphan pools for tournaments removed from the registry.
  {
    id: 'g4',
    name: 'Madrid 2026 Pool',
    inviteCode: 'MADRID-2026',
    entryFeeCents: 0,
    prizePoolCents: 0,
    tournamentId: 'madrid-2026',
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

export const MOCK_MEMBERS = [];

export const MOCK_PICKS = [];
