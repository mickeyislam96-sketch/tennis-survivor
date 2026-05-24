/**
 * Regression test for the qualifier-placeholder resolution bug.
 *
 * 2026-05-24 (Roland-Garros R1): the seed draw carried 17 `Qualifier N`
 * placeholders (name set, isQualifier: true) for slots whose occupant came
 * through qualifying. The overlay's fixture matcher requires BOTH players to
 * surname-match the same scraper fixture, and "Qualifier 6" never matches a
 * real surname — so when those R1 matches were played the result silently
 * failed to overlay: the match stayed `scheduled`, got no winner, and R64
 * propagation for the slot broke. Two pool members had picked players whose
 * R1 opponent was an unresolved qualifier.
 *
 * Fix: a qualifier-resolution branch in overlayFixtures' replacement loop.
 * A qualifier slot is anchored by its KNOWN opponent; the other side of that
 * opponent's live fixture is, by construction, the real qualifier, so the
 * name is adopted (no cancelled fixture required) and the normal overlay then
 * matches and propagates the result.
 */
import { test, expect } from 'vitest';
import { overlayFixtures } from '../../src/services/seedDrawOverlay.js';

function qualifierSeedDraw() {
  return {
    tournament: 'test-2026',
    rounds: ['R1', 'R64'],
    players: [
      { id: 't-p5', name: 'Landaluce, Martin', country: 'ESP', roundEliminated: null, isQualifier: false },
      { id: 't-q6', name: 'Qualifier 6', country: null, roundEliminated: null, isQualifier: true },
    ],
    matches: [
      {
        id: 'm-R1-0', round: 'R1', matchOrder: 0,
        player1Id: 't-p5', player1Name: 'Landaluce, Martin',
        player2Id: 't-q6', player2Name: 'Qualifier 6',
        winnerId: null, winnerName: null, status: 'scheduled', bye: false,
      },
    ],
  };
}

test('overlay resolves a qualifier placeholder from its known opponents fixture and propagates the result', () => {
  const seedDraw = qualifierSeedDraw();
  const fixtures = [
    {
      matchId: 'fs-1', round: 'R1',
      player1Id: 'fs-lan', player1Name: 'Landaluce M.',
      player2Id: 'fs-bau', player2Name: 'Bautista Agut R.',
      winnerId: 'fs-bau', winnerName: 'Bautista Agut R.',
      status: 'completed', startTime: null, score: '6-3, 6-4',
    },
  ];
  const result = overlayFixtures(seedDraw, fixtures);

  const q = result.players.find(p => p.id === 't-q6');
  expect(q.name).toBe('Bautista Agut R.');
  expect(q.isQualifier).toBe(false);

  const m = result.matches.find(mm => mm.id === 'm-R1-0');
  expect(m.status).toBe('completed');
  expect(m.winnerId).toBe('t-q6');
  expect(m.winnerName).toBe('Bautista Agut R.');
});

test('a qualifier placeholder stays unresolved when no fixture reveals its name', () => {
  const seedDraw = qualifierSeedDraw();
  const fixtures = [
    {
      matchId: 'fs-x', round: 'R1',
      player1Id: 'fs-a', player1Name: 'Someone A.',
      player2Id: 'fs-b', player2Name: 'Otherperson B.',
      winnerId: null, winnerName: null, status: 'scheduled', startTime: null, score: null,
    },
  ];
  const result = overlayFixtures(seedDraw, fixtures);
  const q = result.players.find(p => p.id === 't-q6');
  expect(q.name).toBe('Qualifier 6');
  expect(q.isQualifier).toBe(true);
  const m = result.matches.find(mm => mm.id === 'm-R1-0');
  expect(m.status).toBe('scheduled');
  expect(m.winnerId).toBeFalsy();
});

test('resolution does NOT fire for a real named opponent without a cancelled fixture (LL path unchanged)', () => {
  const seedDraw = {
    tournament: 'test-2026',
    rounds: ['R1'],
    players: [
      { id: 't-p1', name: 'Sinner, Jannik', country: 'ITA', roundEliminated: null, isQualifier: false },
      { id: 't-p2', name: 'Tabur, Clement', country: 'FRA', roundEliminated: null, isQualifier: false },
    ],
    matches: [
      {
        id: 'm-R1-0', round: 'R1', matchOrder: 0,
        player1Id: 't-p1', player1Name: 'Sinner, Jannik',
        player2Id: 't-p2', player2Name: 'Tabur, Clement',
        winnerId: null, winnerName: null, status: 'scheduled', bye: false,
      },
    ],
  };
  const fixtures = [
    {
      matchId: 'fs-1', round: 'R1',
      player1Id: 'fs-sin', player1Name: 'Sinner J.',
      player2Id: 'fs-unk', player2Name: 'Imposter X.',
      winnerId: null, winnerName: null, status: 'scheduled', startTime: null, score: null,
    },
  ];
  const result = overlayFixtures(seedDraw, fixtures);
  const p2 = result.players.find(p => p.id === 't-p2');
  expect(p2.name).toBe('Tabur, Clement');
});
