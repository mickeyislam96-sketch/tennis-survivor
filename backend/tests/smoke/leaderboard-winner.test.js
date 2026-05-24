/**
 * Pin the winner-detection rule (Mickey, 2026-05-15 — Option B):
 *
 *   A winner is only declared once the tournament's tour event has
 *   finished (tournament.status === 'completed'). Until then, hasWinner
 *   stays false and no isWinner flag is set, even if one survivor remains.
 *   Rule rationale: prize money is only awarded for finishing the whole
 *   tournament. See morning brief 2026-05-15.
 *
 * History: prior to this rule, `/api/leaderboard` declared a winner the
 * moment `aliveCount === 1` (sole-survivor branch). For Rome 2026 on
 * 2026-05-15, that meant Casper was flagged isWinner: true at QF while
 * `/api/pools` still returned winnerName: null — the two endpoints
 * disagreed, and the sole survivor's later picks would still flip them
 * to is_alive: false if those picks lost, producing a "winner shown as
 * eliminated" state. This test pins the new behaviour.
 */
import { describe, test, expect } from 'vitest';
import { detectWinner } from '../../src/routes/leaderboard.js';

const m = (overrides) => ({
  displayName: 'Anon', isAlive: true, survivedRounds: 0, eliminatedRound: null, ...overrides,
});

describe('detectWinner — tournament still active', () => {
  test('sole survivor: NOT crowned while tournament is active', () => {
    const survivor = m({ displayName: 'Casper', isAlive: true, survivedRounds: 5 });
    const eliminated = [
      m({ displayName: 'Mark',    isAlive: false, survivedRounds: 0, eliminatedRound: 'R1' }),
      m({ displayName: 'Servena', isAlive: false, survivedRounds: 0, eliminatedRound: 'R1' }),
      m({ displayName: 'Rafa',    isAlive: false, survivedRounds: 1, eliminatedRound: 'R64' }),
      m({ displayName: 'Mick',    isAlive: false, survivedRounds: 2, eliminatedRound: 'R32' }),
      m({ displayName: 'Sabby',   isAlive: false, survivedRounds: 4, eliminatedRound: 'QF' }),
    ];
    const result = detectWinner({
      alive: [survivor], eliminated, members: [survivor, ...eliminated], tournamentCompleted: false,
    });
    expect(result.hasWinner).toBe(false);
    expect(result.winnerName).toBeNull();
    expect(result.winners).toEqual([]);
  });

  test('all eliminated mid-tournament: still no winner', () => {
    const eliminated = [
      m({ displayName: 'A', isAlive: false, survivedRounds: 3, eliminatedRound: 'R16' }),
      m({ displayName: 'B', isAlive: false, survivedRounds: 1, eliminatedRound: 'R64' }),
    ];
    const result = detectWinner({
      alive: [], eliminated, members: eliminated, tournamentCompleted: false,
    });
    expect(result.hasWinner).toBe(false);
    expect(result.winnerName).toBeNull();
  });
});

describe('detectWinner — tournament completed', () => {
  test('sole survivor crowned once tournament completes', () => {
    const survivor = m({ displayName: 'Casper', isAlive: true, survivedRounds: 6 });
    const eliminated = [
      m({ displayName: 'A', isAlive: false, survivedRounds: 4, eliminatedRound: 'QF' }),
      m({ displayName: 'B', isAlive: false, survivedRounds: 1, eliminatedRound: 'R64' }),
    ];
    const result = detectWinner({
      alive: [survivor], eliminated, members: [survivor, ...eliminated], tournamentCompleted: true,
    });
    expect(result.hasWinner).toBe(true);
    expect(result.winnerName).toBe('Casper');
    expect(result.winners).toEqual([survivor]);
  });

  test('all eliminated: most-rounds-survived wins (lasted-longest)', () => {
    const eliminated = [
      // Sorted by recency DESC (caller responsibility) — index 0 has max survivedRounds.
      m({ displayName: 'Rafa',  isAlive: false, survivedRounds: 5, eliminatedRound: 'F'  }),
      m({ displayName: 'Sabby', isAlive: false, survivedRounds: 4, eliminatedRound: 'QF' }),
      m({ displayName: 'Mick',  isAlive: false, survivedRounds: 2, eliminatedRound: 'R32' }),
    ];
    const result = detectWinner({
      alive: [], eliminated, members: eliminated, tournamentCompleted: true,
    });
    expect(result.hasWinner).toBe(true);
    expect(result.winnerName).toBe('Rafa');
    expect(result.winners.map(w => w.displayName)).toEqual(['Rafa']);
  });

  test('all eliminated with tied max survivedRounds: both crowned (comma-joined name)', () => {
    const eliminated = [
      m({ displayName: 'Rafa', isAlive: false, survivedRounds: 5, eliminatedRound: 'F' }),
      m({ displayName: 'Nole', isAlive: false, survivedRounds: 5, eliminatedRound: 'F' }),
      m({ displayName: 'Mick', isAlive: false, survivedRounds: 2, eliminatedRound: 'R32' }),
    ];
    const result = detectWinner({
      alive: [], eliminated, members: eliminated, tournamentCompleted: true,
    });
    expect(result.hasWinner).toBe(true);
    expect(result.winnerName).toBe('Rafa, Nole');
    expect(result.winners).toHaveLength(2);
  });

  test('all eliminated at R1 (0 rounds survived): NO winner', () => {
    const eliminated = [
      m({ displayName: 'A', isAlive: false, survivedRounds: 0, eliminatedRound: 'R1' }),
      m({ displayName: 'B', isAlive: false, survivedRounds: 0, eliminatedRound: 'R1' }),
    ];
    const result = detectWinner({
      alive: [], eliminated, members: eliminated, tournamentCompleted: true,
    });
    expect(result.hasWinner).toBe(false);
  });

  test('single-member pool: no winner (need 2+ entrants for branch 1)', () => {
    const onlyMember = m({ displayName: 'Solo', isAlive: true, survivedRounds: 3 });
    const result = detectWinner({
      alive: [onlyMember], eliminated: [], members: [onlyMember], tournamentCompleted: true,
    });
    expect(result.hasWinner).toBe(false);
  });
});
