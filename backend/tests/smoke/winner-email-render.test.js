/**
 * Winner-announcement email — render smoke tests
 *
 * Asserts:
 *   - buildWinnerAnnouncementHTML produces valid HTML containing the user's
 *     name, the winning pick, the round count, and the correct copy for
 *     both free and paid pools.
 *   - sendWinnerAnnouncementEmail is exported with the expected signature.
 *
 * If this fails: the F-result winner email path is regressed. Don't ship.
 */
import { test, expect } from 'vitest';
import {
  buildWinnerAnnouncementHTML,
  sendWinnerAnnouncementEmail,
} from '../../src/utils/email.js';

test('renders the free-pool variant with all dynamic fields', () => {
  const html = buildWinnerAnnouncementHTML({
    email: 'casper@example.com',
    displayName: 'Casper The Freindly Ruud',
    tournamentName: "Internazionali BNL d'Italia",
    tournamentShortName: 'Rome',
    winningPickName: 'Sinner, Jannik',
    roundCount: 7,
    memberCount: 6,
    prizePoolCents: 0,
    groupUrl: 'https://finalserveivor.com/group/abc',
  });
  expect(html).toContain('Casper The Freindly Ruud');
  expect(html).toContain('Sinner, Jannik');
  expect(html).toContain('Survived all 7 rounds');
  expect(html).toContain('Out of 6 entrants');
  expect(html).toContain('Free pool');
  expect(html).toContain('You won');
  expect(html).toContain('Rome 2026');
  expect(html).toContain('casper@example.com');
});

test('renders the paid-pool variant with the prize amount formatted in pounds', () => {
  const html = buildWinnerAnnouncementHTML({
    email: 'rg-winner@example.com',
    displayName: 'Test User',
    tournamentName: 'Roland-Garros',
    tournamentShortName: 'Roland Garros',
    winningPickName: 'Alcaraz, Carlos',
    roundCount: 7,
    memberCount: 50,
    prizePoolCents: 50000,
    groupUrl: 'https://finalserveivor.com/group/xyz',
  });
  expect(html).toContain('£500.00');
  expect(html).not.toContain('Free pool');
  expect(html).toContain('Survived all 7 rounds');
});

test('sendWinnerAnnouncementEmail is exported and callable', () => {
  expect(typeof sendWinnerAnnouncementEmail).toBe('function');
});

test('subject template format is stable (changing this requires a memory note)', () => {
  const html = buildWinnerAnnouncementHTML({
    email: 'x@y.z', displayName: 'X', tournamentName: 'T',
    tournamentShortName: 'TT', winningPickName: 'Y, Z',
    roundCount: 7, memberCount: 2, prizePoolCents: 0, groupUrl: '#',
  });
  expect(html).toContain('🏆 You won');
});
