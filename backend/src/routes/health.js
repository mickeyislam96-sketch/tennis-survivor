/**
 * GET /api/health
 *
 * Production health check. Never silently passes.
 *
 * Checks (in order):
 *   1. Required env vars are present (TENNIS_API_KEY + tournament key)
 *   2. API-Tennis responds successfully with a real HTTP call
 *   3. Which data source is active (live_api | mock_data)
 *   4. PostgreSQL database is reachable
 *
 * Response:
 *   HTTP 200  { ok: true,  ... }  — all checks passed
 *   HTTP 500  { ok: false, ... }  — at least one check failed
 */

import { Router } from 'express';
import { pool } from '../db/pool.js';

export const healthRouter = Router();

const API_BASE = 'https://api.api-tennis.com/tennis';
const HEALTH_TIMEOUT_MS = 8000;

// A narrow date range to minimise data returned by the test call.
// We use the tournament start date so there will always be fixtures to return.
const TEST_DATE_START = '2026-03-19';
const TEST_DATE_STOP  = '2026-03-20';

healthRouter.get('/', async (_req, res) => {
  const checks = {};
  let allOk = true;

  // ── 1. Env vars ─────────────────────────────────────────────────────────────
  const apiKey       = process.env.TENNIS_API_KEY;
  const tournamentKey =
    process.env.MIAMI_TOURNAMENT_KEY ||
    process.env.INDIAN_WELLS_TOURNAMENT_KEY ||
    process.env.TOURNAMENT_KEY;

  checks.env = {
    TENNIS_API_KEY:  apiKey        ? 'present' : 'MISSING',
    TOURNAMENT_KEY:  tournamentKey ? 'present' : 'MISSING',
  };

  if (!apiKey)        { checks.env.TENNIS_API_KEY_error  = 'Set TENNIS_API_KEY on Railway';  allOk = false; }
  if (!tournamentKey) { checks.env.TOURNAMENT_KEY_error   = 'Set MIAMI_TOURNAMENT_KEY on Railway'; allOk = false; }

  // ── 2. API-Tennis live call ──────────────────────────────────────────────────
  if (apiKey && tournamentKey) {
    const url =
      `${API_BASE}/?method=get_fixtures` +
      `&APIkey=${apiKey}` +
      `&tournament_key=${tournamentKey}` +
      `&tournament_season=2026` +
      `&date_start=${TEST_DATE_START}` +
      `&date_stop=${TEST_DATE_STOP}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

      let httpRes;
      try {
        httpRes = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }

      if (!httpRes.ok) {
        throw new Error(`HTTP ${httpRes.status} ${httpRes.statusText}`);
      }

      const data = await httpRes.json();

      if (data?.success === false) {
        throw new Error(`API error: ${data?.error || 'success=false'}`);
      }
      if (!Array.isArray(data?.result)) {
        throw new Error('Unexpected response shape — result is not an array');
      }

      checks.tennis_api = {
        status:            'ok',
        fixtures_returned: data.result.length,
        data_source:       'live_api',
      };
    } catch (err) {
      const timedOut = err.name === 'AbortError';
      checks.tennis_api = {
        status:      'FAIL',
        detail:      timedOut ? `Timed out after ${HEALTH_TIMEOUT_MS}ms` : err.message,
        data_source: 'mock_fallback',
      };
      allOk = false;
    }
  } else {
    // Keys missing — app will fall back to mock data at runtime
    checks.tennis_api = {
      status:      'skipped',
      reason:      'API keys not configured — app is running on mock data',
      data_source: 'mock_data',
    };
    // allOk already set to false above when keys were missing
  }

  // ── 3. Active data source summary ────────────────────────────────────────────
  checks.data_source = checks.tennis_api?.data_source ?? 'unknown';

  // ── 4. Database ──────────────────────────────────────────────────────────────
  try {
    await pool.query('SELECT 1');
    checks.database = 'ok';
  } catch (err) {
    checks.database = { status: 'FAIL', detail: err.message };
    allOk = false;
  }

  // ── Response ─────────────────────────────────────────────────────────────────
  res.status(allOk ? 200 : 500).json({
    ok:        allOk,
    timestamp: new Date().toISOString(),
    checks,
  });
});
