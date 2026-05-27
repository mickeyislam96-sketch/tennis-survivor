/**
 * Regression test for the wrong-event (date-window) overlay guard.
 *
 * 2026-05-26 morning brief: the production scraper was pointed at the wrong
 * (just-completed) tournament and posted a full set of Rome 2026 fixtures.
 * Two of them — Blockx d. Cina and Tirante d. Cadenasso, both played 07 May —
 * overlaid onto the Roland-Garros R1 bracket because those players appear in
 * both draws. They were applied as real `completed` wins (one pool member was
 * falsely credited a survived round). The existing stale-startTime check only
 * fires on `scheduled` matches, so cross-event `completed` fixtures slipped
 * through.
 *
 * The overlay now rejects any fixture whose startTime is outside the active
 * tournament's published window (buffered) BEFORE matching, but only when the
 * seed draw belongs to the active tournament.
 *
 * This test asserts:
 *   1. A foreign fixture dated well before the window (07 May) is dropped and
 *      never applied, even though its players exist in the seed draw and its
 *      status is `completed`.
 *   2. An in-window completed fixture is applied.
 *   3. filterFixturesToTournamentWindow keeps null-startTime fixtures.
 */
import { test, expect } from 'vitest';
import {
  overlayFixtures,
  filterFixturesToTournamentWindow,
} from '../../src/services/seedDrawOverlay.js';
import { TOURNAMENT } from '../../src/config/activeTournament.js';

function buildSeedDraw() {
  return {
    tournament: TOURNAMENT.id, // gate: guard only runs for the active tournament
    rounds: ['R1'],
    players: [
      { id: 'rg-p1', name: 'Blockx, Alexander', country: 'BEL', roundEliminated: null },
      { id: 'rg-p2', name: 'Cina, Federico', country: 'ITA', roundEliminated: null },
      { id: 'rg-p3', name: 'Sinner, Jannik', country: 'ITA', roundEliminated: null },
      { id: 'rg-p4', name: 'Tabur, Clement', country: 'FRA', roundEliminated: null },
    ],
    matches: [
      {
        id: 'm-R1-0', round: 'R1', matchOrder: 0,
        player1Id: 'rg-p1', player1Name: 'Blockx, Alexander',
        player2Id: 'rg-p2', player2Name: 'Cina, Federico',
        winnerId: null, winnerName: null, status: 'scheduled',
      },
      {
        id: 'm-R1-1', round: 'R1', matchOrder: 1,
        player1Id: 'rg-p3', player1Name: 'Sinner, Jannik',
        player2Id: 'rg-p4', player2Name: 'Tabur, Clement',
        winnerId: null, winnerName: null, status: 'scheduled',
      },
    ],
  };
}

test('foreign (out-of-window) completed fixture is dropped, not applied', () => {
  const seedDraw = buildSeedDraw();
  const fixtures = [
    {
      matchId: 'rome-1', round: 'R1',
      player1Id: 'x1', player1Name: 'Blockx, Alexander',
      player2Id: 'x2', player2Name: 'Cina F.',
      winnerId: 'x1', winnerName: 'Blockx, Alexander',
      status: 'completed', startTime: '2026-05-07T09:05:00Z', score: '1-2, 6-4, 1-6, 3-6',
    },
  ];
  const result = overlayFixtures(seedDraw, fixtures);
  const blockxMatch = result.matches.find(m => m.id === 'm-R1-0');
  expect(blockxMatch.status).toBe('scheduled');
  expect(blockxMatch.winnerId).toBeNull();
  expect(blockxMatch.winnerName).toBeNull();
  // When every fixture is out-of-window the overlay returns the clean seed
  // draw unchanged — the contamination never reaches the bracket.
});

test('in-window completed fixture IS applied', () => {
  const seedDraw = buildSeedDraw();
  const fixtures = [
    {
      matchId: 'rg-real-1', round: 'R1',
      player1Id: 'y1', player1Name: 'Sinner, Jannik',
      player2Id: 'y2', player2Name: 'Tabur, Clement',
      winnerId: 'y1', winnerName: 'Sinner, Jannik',
      status: 'completed', startTime: '2026-05-25T13:00:00Z', score: '6-1, 6-2, 6-3',
    },
  ];
  const result = overlayFixtures(seedDraw, fixtures);
  const m = result.matches.find(m => m.id === 'm-R1-1');
  expect(m.status).toBe('completed');
  expect(m.winnerId).toBe('rg-p3');
});

test('filterFixturesToTournamentWindow keeps null-startTime fixtures, drops out-of-window', () => {
  const fixtures = [
    { matchId: 'a', startTime: '2026-05-07T09:05:00Z' },
    { matchId: 'b', startTime: '2026-05-25T09:05:00Z' },
    { matchId: 'c', startTime: null },
    { matchId: 'd' },
  ];
  const kept = filterFixturesToTournamentWindow(fixtures);
  const keptIds = kept.map(f => f.matchId).sort();
  expect(keptIds).toEqual(['b', 'c', 'd']);
});
