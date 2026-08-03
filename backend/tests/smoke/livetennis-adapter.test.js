/**
 * Live Tennis API adapter — pure mapping tests.
 *
 * Offline by design: no network, no DB, no API key. These assert the two
 * things that matter about an optional provider:
 *
 *   1. With LIVETENNIS_API_KEY unset it is inert — fetchLiveTennisFixtures()
 *      returns null without making a request, so the dataAdapter chain
 *      behaves exactly as it did before the provider existed.
 *   2. Its output conforms to the internal fixture format, and it drops
 *      what it cannot identify instead of guessing (unknown round, doubles,
 *      another tournament, an unresolved winner).
 */
import { test, expect, vi, afterEach } from 'vitest';

import { TOURNAMENT } from '../../src/config/activeTournament.js';
import {
  fetchLiveTennisFixtures,
  normalizeLiveTennisRound,
  normalizeLiveTennisStatus,
  renderLiveTennisScore,
  toInternalFixture,
} from '../../src/services/livetennisAdapter.js';

// Named off the active tournament config so this test keeps working whichever
// tournament ACTIVE_TOURNAMENT points at.
const TOURNAMENT_NAME = `ATP ${TOURNAMENT.shortName}`;

function buildMatch(overrides = {}) {
  return {
    id: 21131,
    tournament: TOURNAMENT_NAME,
    surface: 'clay',
    indoor: false,
    format: 'BO3',
    round: '1/8-finals',
    status: 'completed',
    event_status: null,
    is_doubles: false,
    scheduled_time: '2026-05-12T09:00:00Z',
    players: {
      p1: { id: 501, name: 'Jannik Sinner' },
      p2: { id: 502, name: 'Casper Ruud' },
    },
    score: { sets: [2, 0], games: [[6, 6], [3, 4]] },
    winner: 1,
    ...overrides,
  };
}

afterEach(() => {
  delete process.env.LIVETENNIS_API_KEY;
  vi.unstubAllGlobals();
});

test('is inert with no API key — returns null and makes no request', async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);

  await expect(fetchLiveTennisFixtures()).resolves.toBeNull();
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('maps a completed match into the internal fixture format', () => {
  const fixture = toInternalFixture(buildMatch());

  expect(fixture).toEqual({
    matchId: '21131',
    round: 'R16',
    player1Id: '501',
    player1Name: 'Jannik Sinner',
    player2Id: '502',
    player2Name: 'Casper Ruud',
    winnerId: '501',
    winnerName: 'Jannik Sinner',
    status: 'completed',
    startTime: '2026-05-12T09:00:00.000Z',
    score: '6-3, 6-4',
    isWithdrawal: false,
    withdrawnPlayerId: null,
  });
});

test('winner 2 resolves to player 2', () => {
  expect(toInternalFixture(buildMatch({ winner: 2 }))).toMatchObject({
    winnerId: '502',
    winnerName: 'Casper Ruud',
  });
});

test('an unresolved winner stays null rather than defaulting to a player', () => {
  expect(toInternalFixture(buildMatch({ status: 'live', winner: null }))).toMatchObject({
    status: 'live',
    winnerId: null,
    winnerName: null,
  });
});

test('drops doubles, other tournaments, and unmappable rounds', () => {
  expect(toInternalFixture(buildMatch({ is_doubles: true }))).toBeNull();
  expect(toInternalFixture(buildMatch({ tournament: 'Some Other Open 250' }))).toBeNull();
  expect(toInternalFixture(buildMatch({ round: 'Qualifying Round 2' }))).toBeNull();
  expect(toInternalFixture(buildMatch({ round: null }))).toBeNull();
});

test('round normalisation covers the vocabularies the codebase already handles', () => {
  expect(normalizeLiveTennisRound('1/4-finals')).toBe('QF');
  expect(normalizeLiveTennisRound('Quarterfinals')).toBe('QF');
  expect(normalizeLiveTennisRound('Round of 16')).toBe('R16');
  expect(normalizeLiveTennisRound('Final')).toBe('F');
  expect(normalizeLiveTennisRound(`ATP ${TOURNAMENT.shortName} - 1/2-finals`)).toBe('SF');
  expect(normalizeLiveTennisRound('R32')).toBe('R32');
  expect(normalizeLiveTennisRound('something else')).toBeNull();
});

test('status enum drives the internal status; event_status only refines it', () => {
  expect(normalizeLiveTennisStatus('upcoming', null)).toBe('scheduled');
  expect(normalizeLiveTennisStatus('live', null)).toBe('live');
  expect(normalizeLiveTennisStatus('completed', null)).toBe('completed');
  expect(normalizeLiveTennisStatus('cancelled', null)).toBe('cancelled');
  expect(normalizeLiveTennisStatus('completed', 'Walkover')).toBe('walkover');
  expect(normalizeLiveTennisStatus('completed', 'Retired')).toBe('retired');
});

test('a walkover is flagged as a withdrawal, without naming a player', () => {
  const fixture = toInternalFixture(buildMatch({ event_status: 'Walkover', winner: 1 }));

  expect(fixture).toMatchObject({
    status: 'walkover',
    isWithdrawal: true,
    withdrawnPlayerId: null,
  });
});

test('score renders player-major games, or nothing at all', () => {
  expect(renderLiveTennisScore({ games: [[6, 7, 6], [4, 6, 2]] })).toBe('6-4, 7-6, 6-2');
  expect(renderLiveTennisScore({ games: [[6], [4]] })).toBe('6-4');
  // Ragged or absent data yields null rather than a half-written line.
  expect(renderLiveTennisScore({ games: [[6, 3], [4]] })).toBeNull();
  expect(renderLiveTennisScore({ games: [] })).toBeNull();
  expect(renderLiveTennisScore(null)).toBeNull();
});

test('falls back to a synthetic player id when the provider omits one', () => {
  const fixture = toInternalFixture(buildMatch({
    players: { p1: { name: 'Jannik Sinner' }, p2: { id: 502, name: 'Casper Ruud' } },
  }));

  expect(fixture.player1Id).toBe('21131-p1');
  expect(fixture.player2Id).toBe('502');
});

test('an invalid scheduled_time becomes null, not an Invalid Date', () => {
  expect(toInternalFixture(buildMatch({ scheduled_time: 'not-a-date' })).startTime).toBeNull();
  expect(toInternalFixture(buildMatch({ scheduled_time: null })).startTime).toBeNull();
});
