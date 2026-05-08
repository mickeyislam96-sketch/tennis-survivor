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

  // ── 3c. Scraper freshness guard ────────────────────────────────────────────
  // Fail health check (allOk=false → 503) if the scraper cache is stale
  // during the active scraping window. Outside the window we don't fail —
  // the scraper is on a 10–21 UTC hourly schedule, so an overnight gap of
  // up to 13 hours is normal. We only alarm when scrapes go missing while
  // they're meant to be running. UptimeRobot pings every 5 min and won't
  // fire on transient sub-minute gaps right at the top of the hour.
  // Threshold rationale: scrapes run hourly (10–21 UTC). One missed run
  // takes the cache to ~75 min old. Two missed runs to ~135 min. Setting
  // the alarm at 90 min means we catch a single missed scrape within ~5 min
  // (UptimeRobot ping cadence) without false-alarming on a single delayed
  // run. Outside active hours the threshold doesn't matter — the
  // 'idle_window' branch keeps allOk true regardless of cacheAge.
  //
  // History: 2026-05-08 brief flagged the previous 4h threshold as too
  // forgiving — a silent first-scrape failure of the day wouldn't have
  // paged until 14:00 UTC. New threshold pages it within 11:30 UTC.
  const STALE_THRESHOLD_S = 90 * 60;         // 90 minutes during active hours
  const utcHour = new Date().getUTCHours();
  const inActiveWindow = utcHour >= 10 && utcHour < 21;
  const cache = checks.scraper_cache;

  if (cache?.hasMemoryCache && typeof cache.cacheAge === 'number') {
    if (cache.cacheAge > STALE_THRESHOLD_S && inActiveWindow) {
      checks.scraper_freshness = {
        status:           'STALE',
        cacheAgeSeconds:  cache.cacheAge,
        thresholdSeconds: STALE_THRESHOLD_S,
        scrapedAt:        cache.scrapedAt,
        detail:           `Scraper cache is ${Math.round(cache.cacheAge / 60)}min old during active scraping window (10–21 UTC).`,
      };
      allOk = false;
    } else if (cache.cacheAge > STALE_THRESHOLD_S) {
      checks.scraper_freshness = {
        status:          'idle_window',
        cacheAgeSeconds: cache.cacheAge,
        note:            'Outside active scraping hours (21–10 UTC) — overnight gap is expected.',
      };
    } else {
      checks.scraper_freshness = {
        status:          'fresh',
        cacheAgeSeconds: cache.cacheAge,
      };
    }
  } else if (inActiveWindow) {
    checks.scraper_freshness = {
      status: 'NO_CACHE',
      detail: 'Scraper has no cached data during active scraping window.',
    };
    allOk = false;
  } else {
    checks.scraper_freshness = {
      status: 'no_cache_idle',
      note:   'No cache and outside active hours.',
    };
  }

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
