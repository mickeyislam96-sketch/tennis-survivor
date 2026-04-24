/**
 * scraperCache.js — Shared cache for FlashScore-scraped match results.
 *
 * Two-tier storage:
 *   1. In-memory cache (fast, lost on restart)
 *   2. PostgreSQL `scraped_results` table (durable, survives Railway restarts)
 *
 * The admin endpoint writes here; dataAdapter.js and tennisData.js read from here.
 *
 * Cache TTL: scraped data is trusted for up to 30 minutes (scraper runs every 15).
 * If the in-memory cache is empty (e.g. after Railway restart), we load from DB.
 */

import { pool } from '../db/pool.js';

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// In-memory cache
let scraperCache = {
  fixtures: null,   // Array of internal fixture format objects
  fetchedAt: 0,     // Timestamp when data was last received from scraper
  scrapedAt: null,   // ISO timestamp from the scraper itself (when it actually ran)
};

/**
 * Store scraped results from the admin endpoint.
 * Writes to both in-memory cache and database.
 *
 * @param {Array} fixtures — Array of internal fixture format objects
 * @param {string} scrapedAt — ISO timestamp of when the scrape actually ran
 * @returns {{ stored: number }}
 */
export async function setScrapedResults(fixtures, scrapedAt) {
  if (!Array.isArray(fixtures) || fixtures.length === 0) {
    throw new Error('fixtures must be a non-empty array');
  }

  // Update in-memory cache
  scraperCache = {
    fixtures,
    fetchedAt: Date.now(),
    scrapedAt: scrapedAt || new Date().toISOString(),
  };

  console.log(`[scraperCache] In-memory cache updated: ${fixtures.length} fixtures`);

  // Persist to database (replace all existing rows for this tournament)
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Clear previous scraped data
      await client.query('DELETE FROM scraped_results');

      // Batch insert new results
      if (fixtures.length > 0) {
        // Build a multi-row INSERT for efficiency
        const values = [];
        const placeholders = [];
        let paramIdx = 1;

        for (const f of fixtures) {
          placeholders.push(
            `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, ` +
            `$${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, ` +
            `$${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, ` +
            `$${paramIdx++}, $${paramIdx++})`
          );
          values.push(
            f.matchId,
            f.round,
            f.player1Id,
            f.player1Name,
            f.player2Id,
            f.player2Name,
            f.winnerId || null,
            f.winnerName || null,
            f.status || 'scheduled',
            f.startTime || null,
            f.score || null,
            f.isWithdrawal || false,
            f.withdrawnPlayerId || null,
            scrapedAt || new Date().toISOString(),
          );
        }

        await client.query(
          `INSERT INTO scraped_results
             (match_id, round, player1_id, player1_name, player2_id, player2_name,
              winner_id, winner_name, status, start_time, score,
              is_withdrawal, withdrawn_player_id, scraped_at)
           VALUES ${placeholders.join(', ')}`,
          values,
        );
      }

      await client.query('COMMIT');
      console.log(`[scraperCache] DB persisted: ${fixtures.length} rows`);
    } catch (dbErr) {
      await client.query('ROLLBACK');
      // Log but don't throw — in-memory cache is still valid
      console.error(`[scraperCache] DB persist failed (in-memory cache still valid):`, dbErr.message);
    } finally {
      client.release();
    }
  } catch (poolErr) {
    console.error(`[scraperCache] DB connection failed:`, poolErr.message);
  }

  return { stored: fixtures.length };
}

/**
 * Get scraped results. Checks in-memory cache first, then DB.
 * Returns null if no data or data is stale (> CACHE_TTL).
 *
 * @returns {Array|null} Array of internal fixture format objects, or null
 */
export async function getScrapedResults() {
  // 1. Check in-memory cache — always return if data exists
  // IMPORTANT: Match results don't un-happen. Stale data is still valid.
  // A match completed 2 hours ago is still completed. The TTL only controls
  // freshness logging — it never causes data to be discarded.
  if (scraperCache.fixtures && scraperCache.fixtures.length > 0) {
    const age = Date.now() - scraperCache.fetchedAt;
    const fresh = age < CACHE_TTL;
    console.log(`[scraperCache] Serving from memory: ${scraperCache.fixtures.length} fixtures, ` +
      `age: ${Math.round(age / 1000)}s${fresh ? '' : ' (stale but valid)'}`);
    return scraperCache.fixtures;
  }

  // 2. Try loading from database — always return if rows exist
  try {
    const result = await pool.query(
      `SELECT match_id, round, player1_id, player1_name, player2_id, player2_name,
              winner_id, winner_name, status, start_time, score,
              is_withdrawal, withdrawn_player_id, scraped_at
         FROM scraped_results
        ORDER BY match_id`
    );

    if (result.rows.length === 0) {
      console.log('[scraperCache] No data in DB');
      return null;
    }

    const latestScrapedAt = result.rows[0].scraped_at;
    const scrapedAge = latestScrapedAt ? Date.now() - new Date(latestScrapedAt).getTime() : 0;

    // Convert DB rows to internal fixture format
    const fixtures = result.rows.map(row => ({
      matchId: row.match_id,
      round: row.round,
      player1Id: row.player1_id,
      player1Name: row.player1_name,
      player2Id: row.player2_id,
      player2Name: row.player2_name,
      winnerId: row.winner_id,
      winnerName: row.winner_name,
      status: row.status,
      startTime: row.start_time ? new Date(row.start_time).toISOString() : null,
      score: row.score,
      isWithdrawal: row.is_withdrawal || false,
      withdrawnPlayerId: row.withdrawn_player_id,
    }));

    // Backfill in-memory cache
    scraperCache = {
      fixtures,
      fetchedAt: Date.now(),
      scrapedAt: latestScrapedAt,
    };

    console.log(`[scraperCache] Loaded from DB: ${fixtures.length} fixtures` +
      (scrapedAge > CACHE_TTL ? ` (scraped ${Math.round(scrapedAge / 1000)}s ago, stale but valid)` : ''));
    return fixtures;
  } catch (err) {
    console.error('[scraperCache] DB read failed:', err.message);
    return null;
  }
}

/**
 * Get cache status for admin diagnostics.
 */
export function getScraperCacheStatus() {
  return {
    hasMemoryCache: !!(scraperCache.fixtures && scraperCache.fixtures.length > 0),
    fixtureCount: scraperCache.fixtures?.length || 0,
    cacheAge: scraperCache.fetchedAt ? Math.round((Date.now() - scraperCache.fetchedAt) / 1000) : null,
    scrapedAt: scraperCache.scrapedAt,
    cacheTtlSeconds: CACHE_TTL / 1000,
  };
}

/**
 * Invalidate the in-memory cache (e.g. for testing).
 * DB data is preserved — next read will reload from DB.
 */
export function invalidateScraperCache() {
  scraperCache = { fixtures: null, fetchedAt: 0, scrapedAt: null };
  console.log('[scraperCache] Memory cache invalidated');
}

/**
 * Get the timestamp when scraper data was last received.
 * Used by tennisData.js draw cache to detect when overlay results can be reused.
 * Returns 0 if no data has been received.
 */
export function getScraperFetchedAt() {
  return scraperCache.fetchedAt;
}
