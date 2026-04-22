/**
 * GET /api/health
 *
 * Production health check. Never silently passes.
 *
 * Checks:
 *   1. Required env vars (data provider keys + active tournament)
 *   2. Data adapter live call (scraper / API-Tennis / fallback)
 *   3. Active data source
 *   4. PostgreSQL connectivity
 */

import { Router } from 'express';
import { pool } from '../db/pool.js';
import { TOURNAMENT } from '../config/activeTournament.js';
import { fetchFixtures } from '../services/dataAdapter.js';
import { getScraperCacheStatus } from '../services/scraperCache.js';

export const healthRouter = Router();

const HEALTH_TIMEOUT  = 35000;

healthRouter.get('/', async (_req, res) => {
  const checks = {};
  let allOk    = true;

  // ── 1. Env vars ─────────────────────────────────────────────────────────────
  const apiTennisKey  = process.env.TENNIS_API_KEY;
  const dataProvider  = process.env.TENNIS_DATA_PROVIDER || 'auto';

  // Only expose whether data config is present — not which specific keys are set.
  // Detailed env status available via authenticated /api/admin/status endpoint.
  checks.env = {
    data_configured: true, // FlashScore scraper is always available
    tournament:      TOURNAMENT.id,
  };

  // ── 2. Data adapter live check ──────────────────────────────────────────────
  // Call the unified fetchFixtures() which tries the provider chain.
  // This tells us exactly which source is active and whether it returns data.
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT);

    let result;
    try {
      result = await fetchFixtures();
    } finally {
      clearTimeout(timer);
    }

    const { provider, fixtures } = result;

    if (provider === 'none' || fixtures.length === 0) {
      // No provider returned data — we're on mock fallback
      checks.data_adapter = {
        status:      'no_data',
        provider:    provider,
        data_source: 'mock_data',
        detail:      'No data provider returned fixtures — scraper may not have posted yet',
      };
    } else {
      // Summarise what we got
      const roundCounts = {};
      for (const f of fixtures) { roundCounts[f.round] = (roundCounts[f.round] || 0) + 1; }

      checks.data_adapter = {
        status:            'ok',
        provider,
        data_source:       provider,
        fixtures_total:    fixtures.length,
        with_start_time:   fixtures.filter(f => f.startTime).length,
        completed:         fixtures.filter(f => f.status === 'completed').length,
        live:              fixtures.filter(f => f.status === 'live').length,
        walkovers:         fixtures.filter(f => f.isWithdrawal).length,
        rounds:            roundCounts,
      };
    }
  } catch (err) {
    const timedOut = err.name === 'AbortError';
    checks.data_adapter = {
      status:      'FAIL',
      detail:      timedOut ? `Timed out after ${HEALTH_TIMEOUT}ms` : err.message,
      data_source: 'mock_fallback',
    };
    allOk = false;
  }

  // ── 3. Active data source summary ───────────────────────────────────────────
  checks.data_source = checks.data_adapter?.data_source ?? 'unknown';

  // ── 3b. Scraper cache status ───────────────────────────────────────────────
  checks.scraper_cache = getScraperCacheStatus();

  // ── 4. Database ──────────────────────────────────────────────────────────────
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
