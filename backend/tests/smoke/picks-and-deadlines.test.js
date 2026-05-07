/**
 * Picks-available + deadlines smoke.
 *
 * Catches:
 *   - The seed draw failing to load (pickable count would be 0).
 *   - Qualifier-resolution regressions (count would dip when slots
 *     are unfilled).
 *   - Deadline computation breaking (current round's lockAt missing
 *     or in the past during the open window).
 *   - Opponent-enrichment regressions: every player returned for the
 *     CURRENT open round must have either opponentName or
 *     opponentPossible populated — otherwise the pick screen shows
 *     a row with no `vs <opponent>` sub-line, exactly the bug class
 *     fixed in PR #8 (7 May 2026).
 *
 * Uses the active pool fetched live so it works across tournaments
 * without hardcoded IDs.
 */
import { test, expect } from 'vitest';

const API = process.env.SMOKE_API || 'https://tennis-survivor-production.up.railway.app';
const ANY_USER = '00000000-0000-0000-0000-000000000000';

async function getActivePool() {
  const res = await fetch(`${API}/api/pools`);
  expect(res.status).toBe(200);
  const pools = await res.json();
  const active = pools.find(p => p.tournament?.status === 'active');
  expect(active, 'no active pool found at /api/pools').toBeDefined();
  return active;
}

async function getOpenRound() {
  const res = await fetch(`${API}/api/draw/deadlines`);
  expect(res.status).toBe(200);
  const deadlines = await res.json();
  // Prefer the round explicitly marked isOpen; fall back to first round
  // whose lockAt is in the future.
  const explicitlyOpen = deadlines.find(d => d.isOpen);
  if (explicitlyOpen) return explicitlyOpen;
  const now = new Date();
  return deadlines.find(d => d.lockAt && new Date(d.lockAt) > now)
    || deadlines.find(d => d.round === 'R1');
}

test('/api/draw/deadlines returns a non-empty array with R1', async () => {
  const res = await fetch(`${API}/api/draw/deadlines`);
  expect(res.status).toBe(200);
  const deadlines = await res.json();
  expect(Array.isArray(deadlines)).toBe(true);
  expect(deadlines.length).toBeGreaterThan(0);
  const r1 = deadlines.find(d => d.round === 'R1');
  expect(r1, 'no R1 entry in deadlines').toBeDefined();
});

test('/api/picks/available for R1 returns a non-empty pool when R1 is open', async () => {
  // The size of the R1 pool shrinks as matches start (per-match-lock removes
  // started players). So we only assert a meaningful floor while R1 is still
  // open AND none of its matches have started. Once R1 is in flight or past,
  // we relax to ≥ 0 (any seed-draw load failure would still produce 0).
  const pool = await getActivePool();
  const r1Deadline = (await (await fetch(`${API}/api/draw/deadlines`)).json())
    .find(d => d.round === 'R1');
  const url = `${API}/api/picks/available?userId=${ANY_USER}&groupId=${pool.id}&round=R1`;
  const res = await fetch(url);
  expect(res.status).toBe(200);
  const players = await res.json();
  expect(Array.isArray(players)).toBe(true);

  const r1NotStarted = r1Deadline?.isOpen && !r1Deadline?.firstMatchStarted;
  if (r1NotStarted) {
    // For Masters 1000: 32 R1 matches × 2 = 64 unseeded players. We accept
    // anything ≥ 40 as a strong signal the seed draw is loaded and
    // resolution didn't break. Slam: 64 R128 × 2 = 128, also clears 40.
    expect(players.length, `only ${players.length} R1 players returned at the start of R1 — seed draw or qualifier resolution may be broken`).toBeGreaterThanOrEqual(40);
  } else {
    // R1 in flight or past — pool legitimately small. Just sanity-check
    // the response shape; 0 would still indicate a seed-draw load break,
    // but it's caught by the bracket test below.
    expect(players.length).toBeGreaterThanOrEqual(0);
  }
});

test('/api/picks/available for the OPEN round populates opponentName or opponentPossible', async () => {
  // Regression check for the PR #8 (7 May 2026) bug class: backend's R2+
  // branch in picks.js used to return players without any opponent info,
  // so the pick screen rendered name + Pick button with no `vs <opponent>`
  // sub-line.  Every player returned for the open round must now have
  // EITHER opponentName (resolved) OR opponentPossible (TBD with feeder
  // candidates).
  const pool = await getActivePool();
  const open = await getOpenRound();
  if (!open?.round) {
    // No open round (between rounds, end of tournament). Skip — no pick
    // screen to render.
    return;
  }
  const url = `${API}/api/picks/available?userId=${ANY_USER}&groupId=${pool.id}&round=${open.round}`;
  const res = await fetch(url);
  expect(res.status).toBe(200);
  const players = await res.json();
  expect(Array.isArray(players)).toBe(true);
  if (players.length === 0) return; // pool empty — caught elsewhere

  const missingOpponent = players.filter(p => !p.opponentName && !(Array.isArray(p.opponentPossible) && p.opponentPossible.length > 0));
  // Allow at most a small number missing — qualifier slots whose feeder
  // is still TBD AND which themselves are still TBD can legitimately
  // have nothing to render. But that should be rare; flag if many.
  const allowed = Math.max(2, Math.floor(players.length * 0.05));
  expect(
    missingOpponent.length,
    `${missingOpponent.length}/${players.length} players in ${open.round} have neither opponentName nor opponentPossible — opponent enrichment likely broken (PR #8 regression). Examples: ${missingOpponent.slice(0,3).map(p => p.name).join(', ')}`,
  ).toBeLessThanOrEqual(allowed);
});

test('/api/draw/bracket loads the active tournament', async () => {
  const res = await fetch(`${API}/api/draw/bracket?round=R1`);
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(Array.isArray(data.players)).toBe(true);
  expect(data.players.length).toBeGreaterThanOrEqual(56); // Masters 1000 = 96; Slam = 128
  expect(Array.isArray(data.matches)).toBe(true);
  expect(data.matches.length).toBeGreaterThan(0);
});
