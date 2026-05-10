/**
 * Pin the leaderboard sort rule (Mickey, 2026-05-10):
 *
 *   1. Alive members first, sorted by survivedRounds DESC.
 *   2. Then eliminated members, sorted by elimination recency DESC
 *      (more recent round = higher).
 *   3. Within ties, alphabetical by displayName.
 *
 * History: prior to this test, the eliminated-section sort used
 * `(ROUNDS.indexOf(b.eliminatedRound) || 0) - ...`. The `|| 0` is a JS
 * footgun — `indexOf` returns -1 for unknown rounds, and `-1 || 0` is
 * `-1` (truthy), not 0. So a member with a typo'd or stale round would
 * sort BELOW R1 elims rather than reasonable fallback behaviour.
 * Fixed via roundIndex() helper which uses `-Infinity` for unknown rounds.
 */
import { describe, test, expect } from 'vitest';
import { sortLeaderboard } from '../../src/routes/leaderboard.js';

const m = (overrides) => ({
  displayName: 'Anon', isAlive: true, survivedRounds: 0, eliminatedRound: null, ...overrides,
});

describe('sortLeaderboard', () => {
  test('alive members rank above eliminated', () => {
    const { alive, eliminated } = sortLeaderboard([
      m({ displayName: 'Eliminated A', isAlive: false, eliminatedRound: 'R64' }),
      m({ displayName: 'Alive A', isAlive: true, survivedRounds: 1 }),
    ]);
    expect(alive).toHaveLength(1);
    expect(eliminated).toHaveLength(1);
    expect(alive[0].displayName).toBe('Alive A');
    expect(eliminated[0].displayName).toBe('Eliminated A');
  });

  test('alive sorted by survivedRounds DESC', () => {
    const { alive } = sortLeaderboard([
      m({ displayName: 'Bob',   isAlive: true, survivedRounds: 1 }),
      m({ displayName: 'Alice', isAlive: true, survivedRounds: 3 }),
      m({ displayName: 'Carol', isAlive: true, survivedRounds: 2 }),
    ]);
    expect(alive.map(x => x.displayName)).toEqual(['Alice', 'Carol', 'Bob']);
  });

  test('alive ties broken alphabetically (case-insensitive)', () => {
    const { alive } = sortLeaderboard([
      m({ displayName: 'charlie', isAlive: true, survivedRounds: 2 }),
      m({ displayName: 'Bob',     isAlive: true, survivedRounds: 2 }),
      m({ displayName: 'alice',   isAlive: true, survivedRounds: 2 }),
    ]);
    expect(alive.map(x => x.displayName)).toEqual(['alice', 'Bob', 'charlie']);
  });

  test('eliminated sorted by recency DESC (R64 above R1)', () => {
    const { eliminated } = sortLeaderboard([
      m({ displayName: 'EarlyOut', isAlive: false, eliminatedRound: 'R1' }),
      m({ displayName: 'LateOut',  isAlive: false, eliminatedRound: 'QF' }),
      m({ displayName: 'MidOut',   isAlive: false, eliminatedRound: 'R32' }),
    ]);
    expect(eliminated.map(x => x.displayName)).toEqual(['LateOut', 'MidOut', 'EarlyOut']);
  });

  test('eliminated ties broken alphabetically', () => {
    const { eliminated } = sortLeaderboard([
      m({ displayName: 'Charlie', isAlive: false, eliminatedRound: 'R1' }),
      m({ displayName: 'Alice',   isAlive: false, eliminatedRound: 'R1' }),
      m({ displayName: 'Bob',     isAlive: false, eliminatedRound: 'R1' }),
    ]);
    expect(eliminated.map(x => x.displayName)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  test('unknown eliminatedRound sorts to bottom (NOT aliased to R1 per the old `|| 0` bug)', () => {
    const { eliminated } = sortLeaderboard([
      m({ displayName: 'BogusRound', isAlive: false, eliminatedRound: 'XYZ' }),
      m({ displayName: 'NullRound',  isAlive: false, eliminatedRound: null }),
      m({ displayName: 'R1Out',      isAlive: false, eliminatedRound: 'R1' }),
      m({ displayName: 'R64Out',     isAlive: false, eliminatedRound: 'R64' }),
    ]);
    // R64 first, then R1, then unknowns (alphabetical between unknowns)
    expect(eliminated.map(x => x.displayName)).toEqual(['R64Out', 'R1Out', 'BogusRound', 'NullRound']);
  });

  test('full Rome 2026 today scenario', () => {
    const today = [
      m({ displayName: 'Casper',    isAlive: true, survivedRounds: 2 }),
      m({ displayName: 'Mick',      isAlive: true, survivedRounds: 2 }),
      m({ displayName: 'Sabalenka', isAlive: true, survivedRounds: 2 }),
      m({ displayName: 'Rafa',      isAlive: false, eliminatedRound: 'R64' }),
      m({ displayName: 'Mark',      isAlive: false, eliminatedRound: 'R1' }),
      m({ displayName: 'Servena',   isAlive: false, eliminatedRound: 'R1' }),
    ];
    const { alive, eliminated } = sortLeaderboard(today);
    expect([...alive, ...eliminated].map(x => x.displayName)).toEqual([
      'Casper', 'Mick', 'Sabalenka',
      'Rafa', 'Mark', 'Servena',
    ]);
  });
});
