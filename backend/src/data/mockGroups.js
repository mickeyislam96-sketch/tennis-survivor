// Mock groups are no longer used as "demo pools" in the lobby — every active
// tournament now has a real DB group, and the /pools endpoint already filters
// out mock entries when a DB pool exists for the same tournament.
//
// Past mock groups (Madrid 2026, Monte Carlo, Miami) were removed once their
// DB equivalents went live. Leave this array empty so retired tournaments
// can never accidentally surface a stale invite code or member count.
//
// MOCK_USERS / MOCK_MEMBERS / MOCK_PICKS are still referenced by the mock
// fallback paths in routes that haven't been fully migrated to DB-only —
// keep them in place.
export const MOCK_GROUPS = [];

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
