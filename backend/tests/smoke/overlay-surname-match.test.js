/**
 * Regression test for the surname-overlay double-barrel bug.
 *
 * 7 May 2026: Basilashvili vs Merida R1 result didn't settle because
 * surnameSubsetMatch was strict-subset only:
 *   seed     "Merida, Daniel"     → ["merida","daniel"]
 *   scraper  "Merida Aguilar D."  → ["merida","aguilar"]
 * Neither side was a strict subset of the other → match failed.
 *
 * Fix: Pass 3b (shared-token overlap) in seedDrawOverlay's findFixtureMatch.
 * This test asserts the overlay merges a fixture even when one side has a
 * double-barrel surname recorded differently in scraper vs seed.
 */
import { test, expect } from 'vitest';
import { overlayFixtures } from '../../src/services/seedDrawOverlay.js';

test('overlay merges fixture when seed has single surname and scraper has double-barrel', () => {
  const seedDraw = {
    tournament: 'test-2026',
    rounds: ['R1', 'R64'],
    players: [
      { id: 't-p1', name: 'Basilashvili, Nikoloz', country: 'GEO', roundEliminated: null },
      { id: 't-p2', name: 'Merida, Daniel', country: 'ESP', roundEliminated: null },
    ],
    matches: [
      {
        id: 'm-R1-0', round: 'R1', matchOrder: 0,
        player1Id: 't-p1', player1Name: 'Basilashvili, Nikoloz',
        player2Id: 't-p2', player2Name: 'Merida, Daniel',
        winnerId: null, winnerName: null, status: 'scheduled', bye: false,
      },
    ],
  };
  const fixtures = [
    {
      matchId: 'fs-1', round: 'R1',
      player1Id: 'fs-bas', player1Name: 'Basilashvili N.',
      player2Id: 'fs-mer', player2Name: 'Merida Aguilar D.',
      winnerId: 'fs-bas', winnerName: 'Basilashvili N.',
      status: 'completed', startTime: null, score: '6-3, 6-4',
    },
  ];
  const result = overlayFixtures(seedDraw, fixtures);
  const m = result.matches[0];
  expect(m.status).toBe('completed');
  expect(m.winnerId).toBe('t-p1');
  expect(m.winnerName).toBe('Basilashvili, Nikoloz');
});

test('overlay does NOT over-match unrelated players who happen to share one surname token', () => {
  // If we had two unrelated players whose surnames each shared a token
  // with the wrong side, Pass 3b could in theory false-match. The both-
  // sides constraint should still block it.
  const seedDraw = {
    tournament: 'test-2026',
    rounds: ['R1'],
    players: [
      { id: 't-p1', name: 'Smith, John',  country: 'USA', roundEliminated: null },
      { id: 't-p2', name: 'Jones, Mike',  country: 'USA', roundEliminated: null },
    ],
    matches: [
      {
        id: 'm-R1-0', round: 'R1', matchOrder: 0,
        player1Id: 't-p1', player1Name: 'Smith, John',
        player2Id: 't-p2', player2Name: 'Jones, Mike',
        winnerId: null, winnerName: null, status: 'scheduled', bye: false,
      },
    ],
  };
  // Fixture is between completely different people (Brown vs Davis) — no
  // surname overlap at all.
  const fixtures = [
    {
      matchId: 'fs-1', round: 'R1',
      player1Id: 'fs-br', player1Name: 'Brown A.',
      player2Id: 'fs-da', player2Name: 'Davis B.',
      winnerId: 'fs-br', winnerName: 'Brown A.',
      status: 'completed', startTime: null, score: '6-0, 6-0',
    },
  ];
  const result = overlayFixtures(seedDraw, fixtures);
  const m = result.matches[0];
  // Match should NOT be merged — neither side shares a token
  expect(m.status).toBe('scheduled');
  expect(m.winnerId).toBe(null);
});

test('overlay merges fixture when scraper has single surname and seed has double-barrel', () => {
  // Inverse case: seed full name, scraper abbreviated to one half.
  const seedDraw = {
    tournament: 'test-2026',
    rounds: ['R1'],
    players: [
      { id: 't-p1', name: 'Carreno Busta, Pablo', country: 'ESP', roundEliminated: null },
      { id: 't-p2', name: 'Sinner, Jannik',       country: 'ITA', roundEliminated: null },
    ],
    matches: [
      {
        id: 'm-R1-0', round: 'R1', matchOrder: 0,
        player1Id: 't-p1', player1Name: 'Carreno Busta, Pablo',
        player2Id: 't-p2', player2Name: 'Sinner, Jannik',
        winnerId: null, winnerName: null, status: 'scheduled', bye: false,
      },
    ],
  };
  const fixtures = [
    {
      matchId: 'fs-1', round: 'R1',
      player1Id: 'fs-c', player1Name: 'Carreno-Busta P.',
      player2Id: 'fs-s', player2Name: 'Sinner J.',
      winnerId: 'fs-s', winnerName: 'Sinner J.',
      status: 'completed', startTime: null, score: '6-2, 6-2',
    },
  ];
  const result = overlayFixtures(seedDraw, fixtures);
  const m = result.matches[0];
  expect(m.status).toBe('completed');
  expect(m.winnerName).toBe('Sinner, Jannik');
});
