#!/usr/bin/env node
//
// scripts/validate-tournament.mjs — pre-flight check for a tournament transition.
//
// Run this after editing the tournament registries / activeTournament config /
// seed draw, and BEFORE pushing.
//
// Usage:
//   node scripts/validate-tournament.mjs rome-2026
//
// Checks:
//   1. ID exists in backend/src/config/activeTournament.js TOURNAMENTS
//   2. ID exists in backend/src/data/tournaments.js TOURNAMENTS
//   3. ID exists in frontend/src/data/tournaments.js TOURNAMENTS
//   4. Both registries agree on startDate, endDate, name, shortName
//   5. activeTournament.js has matching round structure + lockTimeOverrides
//   6. backend/src/data/seedDraws/<id>.json exists and is valid JSON
//   7. seed draw drawSize / rounds match activeTournament config
//   8. seedDraw seeds count == seedsWithByes (sanity check)
//
// Exits non-zero on any failure.

import fs from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const id = process.argv[2];
if (!id) {
  console.error('Usage: node scripts/validate-tournament.mjs <tournament-id>');
  console.error('Example: node scripts/validate-tournament.mjs rome-2026');
  process.exit(2);
}

let failures = 0;
const ok   = (msg) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
const fail = (msg) => { console.log(`  \x1b[31m✗\x1b[0m ${msg}`); failures++; };
const step = (msg) => console.log(`\n— ${msg}`);

// 1–3. Load registries via dynamic import. The two tournaments.js files are
// pure data so they import cleanly. activeTournament.js reads process.env on
// import; we override ACTIVE_TOURNAMENT first to avoid side effects.
process.env.ACTIVE_TOURNAMENT = id;

let activeCfg, beReg, feReg;
try {
  const m = await import(`file://${repoRoot}/backend/src/config/activeTournament.js`);
  activeCfg = m.getTournamentConfig(id);
} catch (e) { fail(`activeTournament.js failed to load: ${e.message}`); process.exit(1); }
try {
  const m = await import(`file://${repoRoot}/backend/src/data/tournaments.js`);
  beReg = m.TOURNAMENTS.find(t => t.id === id);
} catch (e) { fail(`backend tournaments.js failed: ${e.message}`); process.exit(1); }
try {
  const m = await import(`file://${repoRoot}/frontend/src/data/tournaments.js`);
  feReg = m.TOURNAMENTS.find(t => t.id === id);
} catch (e) { fail(`frontend tournaments.js failed: ${e.message}`); process.exit(1); }

step('1. Registry presence');
activeCfg ? ok(`activeTournament.js TOURNAMENTS["${id}"] exists`) : fail(`activeTournament.js missing entry for "${id}"`);
beReg     ? ok(`backend/src/data/tournaments.js has "${id}"`)    : fail(`backend/src/data/tournaments.js missing "${id}"`);
feReg     ? ok(`frontend/src/data/tournaments.js has "${id}"`)   : fail(`frontend/src/data/tournaments.js missing "${id}"`);

if (!activeCfg || !beReg || !feReg) {
  console.log('\n❌ Cannot continue without all three registries. Add the missing entry first.');
  process.exit(1);
}

step('2. Cross-registry agreement');
const must = ['name', 'shortName', 'startDate', 'endDate'];
for (const field of must) {
  if (beReg[field] === feReg[field]) ok(`${field} matches across BE/FE registries (${beReg[field]})`);
  else fail(`${field} mismatch: BE=${beReg[field]} | FE=${feReg[field]}`);
}
// activeCfg.startDate doesn't have to equal registry startDate (lobby vs play),
// but flag a >1 day gap as suspicious.
const dayMs = 86400000;
const gapMs = Math.abs(new Date(activeCfg.startDate) - new Date(beReg.startDate));
if (gapMs <= dayMs) ok(`activeCfg.startDate within 1 day of registry (${activeCfg.startDate} vs ${beReg.startDate})`);
else fail(`activeCfg.startDate diverges by >1 day from registry: ${activeCfg.startDate} vs ${beReg.startDate}`);

step('3. Round structure consistency');
if (Array.isArray(activeCfg.rounds) && activeCfg.rounds.length >= 2) ok(`rounds defined (${activeCfg.rounds.join(',')})`);
else fail('rounds array missing or too short on activeCfg');
if (activeCfg.matchesPerRound && Object.keys(activeCfg.matchesPerRound).length === activeCfg.rounds.length) {
  ok('matchesPerRound has an entry per round');
} else {
  fail(`matchesPerRound mismatch: rounds=${activeCfg.rounds?.length} entries, matchesPerRound has ${Object.keys(activeCfg.matchesPerRound || {}).length}`);
}

step('4. Lock-time overrides (warnings only — fill in once OOP is announced)');
const missingLocks = (activeCfg.rounds || []).filter(r => !activeCfg.lockTimeOverrides?.[r]);
if (missingLocks.length === 0) ok('all rounds have lockTimeOverrides set');
else console.log(`  \x1b[33m!\x1b[0m rounds without lockTime: ${missingLocks.join(', ')} — set 1h before first match once OOP announced`);

step('5. Seed draw');
const sdPath = path.join(repoRoot, `backend/src/data/seedDraws/${id}.json`);
if (!fs.existsSync(sdPath)) {
  fail(`seed draw missing: backend/src/data/seedDraws/${id}.json`);
} else {
  ok(`seed draw file exists: ${path.relative(repoRoot, sdPath)}`);
  let sd;
  try { sd = JSON.parse(fs.readFileSync(sdPath, 'utf8')); ok('seed draw is valid JSON'); }
  catch (e) { fail(`seed draw JSON parse error: ${e.message}`); sd = null; }
  if (sd) {
    if (sd.tournament === id) ok(`seedDraw.tournament = "${id}"`);
    else fail(`seedDraw.tournament = "${sd.tournament}", expected "${id}"`);
    if (sd.drawSize === activeCfg.drawSize) ok(`drawSize matches (${sd.drawSize})`);
    else fail(`drawSize mismatch: seedDraw=${sd.drawSize}, activeCfg=${activeCfg.drawSize}`);
    if (Array.isArray(sd.rounds) && sd.rounds.join() === activeCfg.rounds.join()) ok('rounds match');
    else fail(`rounds mismatch: seedDraw=${(sd.rounds || []).join(',')}, activeCfg=${activeCfg.rounds.join(',')}`);
    const seedCount = Object.keys(sd.seeds || {}).length;
    if (seedCount === activeCfg.seedsWithByes) {
      ok(`${seedCount} seeds defined (matches seedsWithByes)`);
    } else if (seedCount > activeCfg.seedsWithByes) {
      // LL/alternate replacements legitimately push the count above seedsWithByes.
      console.log(`  \x1b[33m!\x1b[0m ${seedCount} seeds defined, expected ${activeCfg.seedsWithByes} — likely a withdrawal/LL replacement, OK if intentional`);
    } else {
      fail(`seed count too low: seedDraw has ${seedCount}, activeCfg.seedsWithByes=${activeCfg.seedsWithByes}`);
    }
  }
}

step('6. Frontend & backend draw flags align');
if (beReg.drawAvailable === feReg.drawAvailable) ok(`drawAvailable matches (${beReg.drawAvailable})`);
else fail(`drawAvailable mismatch: BE=${beReg.drawAvailable}, FE=${feReg.drawAvailable}`);

console.log('');
if (failures === 0) {
  console.log('✅ Tournament config is internally consistent. Safe to push.');
  process.exit(0);
} else {
  console.log(`❌ ${failures} check(s) failed. Fix before pushing.`);
  process.exit(1);
}
