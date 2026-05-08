/**
 * Regression test for the stale-startTime overlay bug.
 *
 * 2026-05-08 morning brief: 23/32 R64 cards on /draw showed "7 May 08:00"
 * dates a full day before R64 actually played. Root cause was the scraper's
 * parseStartTime defaulting the date to scrape-time when FlashScore omitted
 * the date prefix on time-only displays for next-day fixtures.
 *
 * The overlay now drops a startTime if the match is `scheduled` (not decided,
 * not live) AND the proposed startTime is more than 6 hours in the past.
 * Decided/live matches keep their startTime regardless — those are real.
 *
 * This test asserts:
 *   1. A scheduled match offered a stale startTime gets that startTime dropped.
 *   2. A completed match offered a past startTime keeps it (matches in the past
 *      are valid for completed matches).
 *   3. A scheduled match offered a future startTime keeps it (normal case).
 */
import { test, expect, vi, afterEach, beforeEach } from 'vitest';
import { overlayFixtures } from '../../src/services/seedDrawOverlay.js';

const NOW = new Date('2026-05-08T08:51:00Z');
const HOURS_AGO_25 = new Date(NOW.getTime() - 25 * 60 * 60 * 1000).toISOString();
const HOURS_AHEAD_3 = new Date(NOW.getTime() + 3 * 60 * 60 * 1000).toISOString();
const MINUTES_AGO_30 = new Date(NOW.getTime() - 30 * 60 * 1000).toISOString();

function buildSeedDraw() {
  return {
    tournament: 'test-2026',
    rounds: ['R1'],
    players: [
      { id: 't-p1', name: 'Sinner, Jannik', country: 'ITA', roundEliminated: null },
      { id: 't-p2', name: 'Ofner, Sebastian', country: 'AUT', roundEliminated: null },
    ],
    matches: [
      {
        id: 'm-R1-0', round: 'R1', matchOrder: 0,
        player1Id: 't-p1', player1Name: 'Sinner, Jannik',
        player2Id: 't-p2', player2Name: 'Ofner, Sebastian',
        winnerId: null, winnerName: null, status: 'scheduled',
        startTime: null, bye: false,
      },
    ],
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

test('scheduled match drops a stale startTime (>6h in the past)', () => {
  const seedDraw = buildSeedDraw();
  const fixtures = [{
    matchId: 'fs-1', round: 'R1',
    player1Id: 'fs-p1', player1Name: 'Sinner J.',
    player2Id: 'fs-p2', player2Name: 'Ofner S.',
    winnerId: null, winnerName: null,
    status: 'scheduled',
    startTime: HOURS_AGO_25,  // a full day ago — the bug we are fixing
    score: null,
  }];

  const result = overlayFixtures(seedDraw, fixtures);
  const m = result.matches[0];

  expect(m.status).toBe('scheduled');
  expect(m.startTime).toBeNull();
});

test('completed match keeps its startTime even if it is in the past', () => {
  const seedDraw = buildSeedDraw();
  const fixtures = [{
    matchId: 'fs-1', round: 'R1',
    player1Id: 'fs-p1', player1Name: 'Sinner J.',
    player2Id: 'fs-p2', player2Name: 'Ofner S.',
    winnerId: 'fs-p1', winnerName: 'Sinner J.',
    status: 'completed',
    startTime: HOURS_AGO_25,
    score: '6-3, 6-4',
  }];

  const result = overlayFixtures(seedDraw, fixtures);
  const m = result.matches[0];

  expect(m.status).toBe('completed');
  expect(m.startTime).toBe(HOURS_AGO_25);
  expect(m.winnerId).toBe('t-p1');
});

test('scheduled match keeps a near-future startTime', () => {
  const seedDraw = buildSeedDraw();
  const fixtures = [{
    matchId: 'fs-1', round: 'R1',
    player1Id: 'fs-p1', player1Name: 'Sinner J.',
    player2Id: 'fs-p2', player2Name: 'Ofner S.',
    winnerId: null, winnerName: null,
    status: 'scheduled',
    startTime: HOURS_AHEAD_3,
    score: null,
  }];

  const result = overlayFixtures(seedDraw, fixtures);
  const m = result.matches[0];

  expect(m.status).toBe('scheduled');
  expect(m.startTime).toBe(HOURS_AHEAD_3);
});

test('scheduled match keeps a recent startTime (within the 6h window)', () => {
  // A match that may be about to start or just started but the scraper
  // hasn't seen its status flip yet. We keep the time so countdowns and
  // R1 per-match locks behave correctly.
  const seedDraw = buildSeedDraw();
  const fixtures = [{
    matchId: 'fs-1', round: 'R1',
    player1Id: 'fs-p1', player1Name: 'Sinner J.',
    player2Id: 'fs-p2', player2Name: 'Ofner S.',
    winnerId: null, winnerName: null,
    status: 'scheduled',
    startTime: MINUTES_AGO_30,
    score: null,
  }];

  const result = overlayFixtures(seedDraw, fixtures);
  const m = result.matches[0];

  expect(m.startTime).toBe(MINUTES_AGO_30);
});

test('live match keeps its startTime regardless of staleness', () => {
  const seedDraw = buildSeedDraw();
  const fixtures = [{
    matchId: 'fs-1', round: 'R1',
    player1Id: 'fs-p1', player1Name: 'Sinner J.',
    player2Id: 'fs-p2', player2Name: 'Ofner S.',
    winnerId: null, winnerName: null,
    status: 'live',
    startTime: HOURS_AGO_25,
    score: '6-4, 3-2',
  }];

  const result = overlayFixtures(seedDraw, fixtures);
  const m = result.matches[0];

  expect(m.status).toBe('live');
  expect(m.startTime).toBe(HOURS_AGO_25);
});
