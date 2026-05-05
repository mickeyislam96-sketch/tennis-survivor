/**
 * Invite-link round-trip — regression test for the case-sensitivity bug.
 *
 * On 5 May 2026, Rome 2026's invite code was stored mixed-case
 * (ROME-2026-POOL-bxxhnp) but the lookup endpoint uppercased the URL
 * parameter and ran a case-sensitive WHERE invite_code = $1. Result:
 * silent 404 for everyone clicking the invite link.
 *
 * This test guards against the same class of bug ever shipping again.
 * It picks up the active tournament's pool from /api/pools, then
 * round-trips the invite code through /api/groups/invite/:code in
 * three forms (as-stored, fully uppercase, fully lowercase). All
 * three must return 200 and the same group ID.
 */
import { test, expect } from 'vitest';

const API = process.env.SMOKE_API || 'https://tennis-survivor-production.up.railway.app';

async function getActivePool() {
  const res = await fetch(`${API}/api/pools`);
  expect(res.status).toBe(200);
  const pools = await res.json();
  const active = pools.find(p => p.tournament?.status === 'active');
  expect(active, 'no active pool found at /api/pools').toBeDefined();
  return active;
}

test('active pool can be looked up by its invite code (as stored)', async () => {
  const pool = await getActivePool();
  const res = await fetch(`${API}/api/groups/invite/${pool.inviteCode}`);
  expect(res.status, `lookup of as-stored code ${pool.inviteCode} returned ${res.status}`).toBe(200);
  const data = await res.json();
  expect(data.id).toBe(pool.id);
});

test('active pool can be looked up by uppercased invite code', async () => {
  const pool = await getActivePool();
  const upper = pool.inviteCode.toUpperCase();
  const res = await fetch(`${API}/api/groups/invite/${upper}`);
  expect(res.status, `lookup of uppercased code ${upper} returned ${res.status}`).toBe(200);
  const data = await res.json();
  expect(data.id).toBe(pool.id);
});

test('active pool can be looked up by lowercased invite code', async () => {
  const pool = await getActivePool();
  const lower = pool.inviteCode.toLowerCase();
  const res = await fetch(`${API}/api/groups/invite/${lower}`);
  expect(res.status, `lookup of lowercased code ${lower} returned ${res.status}`).toBe(200);
  const data = await res.json();
  expect(data.id).toBe(pool.id);
});

test('non-existent invite code returns 404', async () => {
  const res = await fetch(`${API}/api/groups/invite/THIS-DOES-NOT-EXIST-${Date.now()}`);
  expect(res.status).toBe(404);
});
