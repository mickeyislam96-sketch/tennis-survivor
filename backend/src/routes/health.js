/**
 * GET /api/health
 *
 * Production health check. Never silently passes.
 *
 * Checks:
 *   1. Required env vars (TENNIS_API_KEY + active tournament key)
 *   2. API-Tennis live call for the active tournament
 *   3. Active data source (live_api | mock_data)
 *   4. In-memory cache status
 *   5. PostgreSQL connectivity
 */

import { Router } from 'express';
import { pool } from '../db/pool.js';
import { TOURNAMENT } from '../config/tournament.js';

// getCacheStatus was removed in the tennisData → dataAdapter refactor.
// Health check now reports cache as "unavailable" rather than crashing.
const getCacheStatus = () => ({ status: 'unavailable', reason: 'cache layer removed in data adapter refactor' });

export const healthRouter = Router();

const API_BASE        = 'https://api.api-tennis.com/tennis';
const HEALTH_TIMEOUT  = 8000;

healthRouter.get('/', async (_req, res) => {
  const checks = {};
  let allOk    = true;

  // ── 1. Env vars ─────────────────────────────────────────────────────────────
  const apiKey       = process.env.TENNIS_API_KEY;
  const tournamentKey = TOURNAMENT.apiTournamentKey;

  checks.env = {
    TENNIS_API_KEY:    apiKey        ? 'present' : 'MISSING',
    TOURNAMENT_KEY:    tournamentKey ? 'present' : 'MISSING',
    ACTIVE_TOURNAMENT: TOURNAMENT.id,
  };

  if (!apiKey)        { checks.env.TENNIS_API_KEY_error = 'Set TENNIS_API_KEY on Railway';     allOk = false; }
  if (!tournamentKey) { checks.env.TOURNAMENT_KEY_warning = `Set ${TOURNAMENT.id.toUpperCase().replace(/-/g,'_')}_TOURNAMENT_KEY on Railway — running on mock data until set`; }

  // ── 2. API-Tennis live call ──────────────────────────────────────────────────
  if (apiKey && tournamentKey) {
    // Use a narrow test range (just the first day) to minimise data returned
    const url =
      `${API_BASE}/?method=get_fixtures` +
      `&APIkey=${apiKey}` +
      `&tournament_key=${tournamentKey}` +
      (TOURNAMENT.apiSeason ? `&tournament_season=${TOURNAMENT.apiSeason}` : '') +
      `&date_start=${TOURNAMENT.apiDateStart}` +
      `&date_stop=${TOURNAMENT.apiDateStart}`; // just first day

    try {
      const controller = new AbortController();
      const timer      = setTimeout(() => controller.abort(), HEALTH_TIMEOUT);
      let httpRes;
      try {
        httpRes = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }

      if (!httpRes.ok) throw new Error(`HTTP ${httpRes.status} ${httpRes.statusText}`);
      const data = await httpRes.json();
      if (data?.success === false) throw new Error(`API error: ${data?.error || 'success=false'}`);
      if (!Array.isArray(data?.result)) throw new Error('Unexpected response — result is not an array');

      checks.tennis_api = {
        status:            'ok',
        fixtures_returned: data.result.length,
        data_source:       'live_api',
      };
    } catch (err) {
      const timedOut = err.name === 'AbortError';
      checks.tennis_api = {
        status:      'FAIL',
        detail:      timedOut ? `Timed out after ${HEALTH_TIMEOUT}ms` : err.message,
        data_source: 'mock_fallback',
      };
      allOk = false;
    }
  } else {
    checks.tennis_api = {
      status:      'skipped',
      reason:      'API keys not configured — running on mock data',
      data_source: 'mock_data',
    };
  }

  // ── 3. In-memory cache status ────────────────────────────────────────────────
  checks.cache = getCacheStatus();

  // ── 4. Active data source summary ───────────────────────────────────────────
  checks.data_source = checks.tennis_api?.data_source ?? 'unknown';

  // ── 5. Database ──────────────────────────────────────────────────────────────
  try {
    await pool.query('SELECT 1');
    checks.database = 'ok';
  } catch (err) {
    checks.database = { status: 'FAIL', detail: err.message };
    allOk = false;
  }

  res.status(allOk ? 200 : 500).json({
    ok:        allOk,
    timestamp: new Date().toISOString(),
    checks,
  });
});
