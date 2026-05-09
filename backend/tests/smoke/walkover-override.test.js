/**
 * Regression test for the 2026-05-09 Machac/Medvedev walkover incident.
 *
 * Bug: scraper assigned walkover winner by player order. Score was '---' so
 * 0 vs 0 sets satisfied `p1Sets >= p2Sets`, defaulting the winner to player1.
 * In Rome R64, Machac (player1) was shown advancing — but Machac is the one
 * who withdrew. Medvedev should have advanced.
 *
 * Fix layers:
 *   1. Scraper no longer guesses walkover winners — leaves winnerId null.
 *   2. Overlay refuses to apply a scraper-claimed winner when scraper sends
 *      walkover + no winnerId (defence in depth — old scraper builds may
 *      still be in flight when backend redeploys).
 *   3. activeTournament.manualResultOverrides lets admins record the truth.
 *      The overlay applies overrides AFTER scraper data, BEFORE propagation.
 *   4. Walkovers without a confirmed winnerId surface in
 *      /api/admin/walkover-pending so they can't go silent.
 *
 * This test pins layer 3: the override mechanism produces the right winner
 * regardless of what the scraper claimed.
 */
import { test, expect, vi } from 'vitest';
import { overlayFixtures } from '../../src/services/seedDrawOverlay.js';

vi.mock('../../src/config/activeTournament.js', () => ({
  TOURNAMENT: {
    id: 'test-2026',
    manualResultOverrides: [
      {
        round: 'R64',
        matchPlayers: ['Machac, Tomas', 'Medvedev, Daniil'],
        winner: 'Medvedev, Daniil',
        status: 'walkover',
        note: 'Machac withdrew before R64 — Medvedev advances.',
      },
    ],
  },
}));

function buildSeedDraw() {
  return {
    tournament: 'test-2026',
    rounds: ['R64', 'R32'],
    players: [
      { id: 't-machac', name: 'Machac, Tomas', country: 'CZE', roundEliminated: null },
      { id: 't-medvedev', name: 'Medvedev, Daniil', country: 'RUS', roundEliminated: null },
      { id: 't-llamas', name: 'Llamas Ruiz, Pablo', country: 'ESP', roundEliminated: null },
    ],
    matches: [
      // R64 Machac vs Medvedev
      {
        id: 'm-R64-0', round: 'R64', matchOrder: 0,
        player1Id: 't-machac', player1Name: 'Machac, Tomas',
        player2Id: 't-medvedev', player2Name: 'Medvedev, Daniil',
        winnerId: null, winnerName: null, status: 'scheduled',
        startTime: null, bye: false,
      },
      // R32: feeders are R64 match 0 (above) — propagation should pick override winner
      {
        id: 'm-R32-0', round: 'R32', matchOrder: 0,
        player1Id: 't-llamas', player1Name: 'Llamas Ruiz, Pablo',
        player2Id: null, player2Name: null,
        winnerId: null, winnerName: null, status: 'scheduled',
        startTime: null, bye: false,
      },
    ],
  };
}

test('manual override flips a walkover winner from scraper-default to truth', () => {
  const seedDraw = buildSeedDraw();
  // Scraper output mirrors the buggy 2026-05-09 reality: assigned Machac as
  // winner because player ordering put him first. The overlay should ignore
  // this and use the manual override.
  const fixtures = [{
    matchId: 'fs-1', round: 'R64',
    player1Id: 'fs-machac', player1Name: 'Machac T.',
    player2Id: 'fs-medvedev', player2Name: 'Medvedev D.',
    winnerId: 'fs-machac',         // ← what scraper currently claims (wrong)
    winnerName: 'Machac T.',
    status: 'walkover',
    startTime: '2026-05-09T07:00:00Z',
    score: '---',
  }];

  const result = overlayFixtures(seedDraw, fixtures);
  const r64 = result.matches.find(m => m.round === 'R64');
  const r32 = result.matches.find(m => m.round === 'R32');

  expect(r64.winnerName).toBe('Medvedev, Daniil');
  expect(r64.winnerId).toBe('t-medvedev');
  expect(r64.isManualOverride).toBe(true);
  expect(r64.status).toBe('walkover');

  // Propagation: R32 player2 should be Medvedev (R64 winner)
  expect(r32.player2Name).toBe('Medvedev, Daniil');
  expect(r32.player2Id).toBe('t-medvedev');
});

test('walkover with no override and no scraper winnerId is flagged for review', () => {
  const seedDraw = buildSeedDraw();
  // Override targets Machac/Medvedev. Use a different match to test the
  // unconfirmed path.
  seedDraw.matches[0].player1Name = 'Smith, John';
  seedDraw.matches[0].player1Id = 't-smith';
  seedDraw.players.push({ id: 't-smith', name: 'Smith, John', country: 'USA', roundEliminated: null });

  const fixtures = [{
    matchId: 'fs-1', round: 'R64',
    player1Id: 'fs-smith', player1Name: 'Smith J.',
    player2Id: 'fs-medvedev', player2Name: 'Medvedev D.',
    winnerId: null,           // scraper now refuses to guess walkover winners
    winnerName: null,
    status: 'walkover',
    startTime: null,
    score: '---',
  }];

  const result = overlayFixtures(seedDraw, fixtures);
  const r64 = result.matches.find(m => m.round === 'R64');

  // No override matches this pairing, no scraper winnerId → must NOT propagate
  expect(r64.winnerId).toBeFalsy();
  expect(r64.requiresAdminReview).toBe(true);
  expect(r64.status).toBe('walkover');

  // R32 player2 should still be null (no propagation from unconfirmed walkover)
  const r32 = result.matches.find(m => m.round === 'R32');
  expect(r32.player2Id).toBeFalsy();
});
