/**
 * Tournament-wrap email — render smoke tests
 *
 * Asserts the broadcast wrap email renders both with pool-winner info
 * and without (in case a tournament has no pool winner declared).
 */
import { test, expect } from 'vitest';
import {
  buildTournamentWrapHTML,
  sendTournamentWrapEmail,
} from '../../src/utils/email.js';

test('renders Rome → Roland Garros wrap with all fields set', () => {
  const html = buildTournamentWrapHTML({
    email: 'user@example.com',
    displayName: 'Test User',
    previousTournamentName: "Internazionali BNL d'Italia",
    previousTournamentShortName: 'Rome',
    championName: 'Sinner',
    scoreLine: '6-4, 6-4',
    poolWinnerName: 'Casper',
    winningPickName: 'Sinner, Jannik',
    nextTournamentName: 'Roland-Garros',
    nextTournamentShortName: 'Roland Garros',
    nextStartsLabel: 'tomorrow',
    nextEntryFeeLabel: '£10',
    nextPoolUrl: 'https://finalserveivor.com/pools',
  });
  expect(html).toContain('Test User');
  expect(html).toContain('Sinner');
  expect(html).toContain('6-4, 6-4');
  expect(html).toContain('Casper');
  expect(html).toContain('Sinner, Jannik');
  expect(html).toContain('Roland-Garros');
  expect(html).toContain('tomorrow');
  expect(html).toContain('£10');
  expect(html).toContain('Enter the Roland Garros pool');
});

test('renders gracefully when pool-winner info is missing', () => {
  const html = buildTournamentWrapHTML({
    email: 'u@x.y',
    displayName: 'X',
    previousTournamentName: 'Test Tournament',
    previousTournamentShortName: 'Test',
    championName: 'Player A',
    scoreLine: '',
    poolWinnerName: '',
    winningPickName: '',
    nextTournamentName: 'Next Event',
    nextTournamentShortName: 'Next',
    nextStartsLabel: 'soon',
    nextEntryFeeLabel: '',
    nextPoolUrl: '#',
  });
  // Shouldn't crash, should still mention the champion and next event
  expect(html).toContain('Player A');
  expect(html).toContain('Next Event');
  expect(html).toContain('Entry details going out shortly');
  // Should NOT mention a pool winner since none was provided
  expect(html).not.toContain('won our pool');
});

test('sendTournamentWrapEmail is exported and callable', () => {
  expect(typeof sendTournamentWrapEmail).toBe('function');
});
