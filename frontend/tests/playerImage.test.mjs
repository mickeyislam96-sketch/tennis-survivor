// Regression tests for shortName() — covers both the canonical
// "Surname, Firstname" format used by seed draws and API responses,
// and the legacy "Firstname Lastname" format that may arrive from
// other data sources.
//
// Run with: cd frontend && node --test tests/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shortName } from '../src/utils/playerImage.js';

test('canonical Surname, Firstname — single first name', () => {
  assert.equal(shortName('Sinner, Jannik'),         'Sinner, J.');
  assert.equal(shortName('Djokovic, Novak'),        'Djokovic, N.');
  assert.equal(shortName('Alcaraz, Carlos'),        'Alcaraz, C.');
});

test('canonical format — multi-name first names', () => {
  assert.equal(shortName('Cerundolo, Juan Manuel'),       'Cerundolo, J.M.');
  assert.equal(shortName('Bautista Agut, Roberto'),       'Bautista Agut, R.');
  assert.equal(shortName('Mpetshi Perricard, Giovanni'),  'Mpetshi Perricard, G.');
});

test('canonical format — multi-word surnames', () => {
  assert.equal(shortName('Carreno Busta, Pablo'),         'Carreno Busta, P.');
  assert.equal(shortName('Davidovich Fokina, Alejandro'), 'Davidovich Fokina, A.');
  assert.equal(shortName('Llamas Ruiz, Pablo'),           'Llamas Ruiz, P.');
});

test('hyphenated names get split into separate initials', () => {
  assert.equal(shortName('Struff, Jan-Lennard'),    'Struff, J.-L.');
  assert.equal(shortName('Auger-Aliassime, Felix'), 'Auger-Aliassime, F.');
});

test('legacy "Firstname Lastname" format', () => {
  assert.equal(shortName('Carlos Alcaraz'),         'Alcaraz, C.');
  assert.equal(shortName('Carlos Alcaraz Garfia'),  'Alcaraz Garfia, C.');
  assert.equal(shortName('Roger Federer'),          'Federer, R.');
});

test('placeholders pass through verbatim', () => {
  assert.equal(shortName('TBD'),          'TBD');
  assert.equal(shortName('Qualifier 13'), 'Qualifier 13');
  assert.equal(shortName('BYE'),          'BYE');
});

test('null / empty / single-token edge cases', () => {
  assert.equal(shortName(null),       '—');
  assert.equal(shortName(undefined),  '—');
  assert.equal(shortName(''),         '—');
  assert.equal(shortName('   '),      '—');
  assert.equal(shortName('Madonna'),  'Madonna');
});

test('whitespace handling', () => {
  assert.equal(shortName('  Sinner, Jannik  '), 'Sinner, J.');
  assert.equal(shortName('Sinner,  Jannik'),    'Sinner, J.');
});
