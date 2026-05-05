/**
 * /api/health smoke test
 *
 * Asserts:
 *   - 200 OK with ok: true
 *   - active tournament is set
 *   - data source is real (not mock)
 *   - scraper freshness check is present and not in an alarm state
 *
 * If this fails: production is alarming and UptimeRobot should already
 * be paging. Run scripts/smoke.sh for a fuller picture.
 */
import { test, expect } from 'vitest';

const API = process.env.SMOKE_API || 'https://tennis-survivor-production.up.railway.app';
const ALLOWED_FRESHNESS = new Set(['fresh', 'idle_window', 'no_cache_idle']);

test('/api/health returns 200 with ok=true', async () => {
  const res = await fetch(`${API}/api/health`);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
});

test('/api/health reports an active tournament and a real data source', async () => {
  const res = await fetch(`${API}/api/health`);
  const body = await res.json();
  expect(body.checks.env.tournament).toBeTruthy();
  expect(body.checks.env.tournament).not.toBe('');
  expect(body.checks.data_source).not.toBe('mock_data');
  expect(body.checks.data_source).not.toBe('mock_fallback');
});

test('/api/health scraper_freshness is fresh or expectedly idle (not STALE)', async () => {
  const res = await fetch(`${API}/api/health`);
  const body = await res.json();
  const status = body.checks?.scraper_freshness?.status;
  expect(status, `freshness payload was: ${JSON.stringify(body.checks?.scraper_freshness)}`).toBeDefined();
  expect(ALLOWED_FRESHNESS.has(status), `freshness=${status} — expected one of ${[...ALLOWED_FRESHNESS].join(', ')}`).toBe(true);
});

test('/api/health database check passes', async () => {
  const res = await fetch(`${API}/api/health`);
  const body = await res.json();
  expect(body.checks.database).toBe('ok');
});
