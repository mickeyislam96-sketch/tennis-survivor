---
name: Data provider strategy — FlashScore scraper primary
description: FlashScore scraper is the sole live data provider for Madrid 2026+. Goalserve fully removed from codebase 22 Apr. API-Tennis and Sofascore kept as automatic fallbacks. Matchstat for H2H intelligence.
type: project
originSessionId: eef33f22-e27e-4430-aded-bae2f2c4e464
---
## FlashScore Scraper — Primary Data Provider (22 Apr 2026)

**Status:** Active and running for Madrid 2026. Sole live data provider since 22 Apr (Goalserve fully removed from codebase).

**How it works:**
1. Railway cron service (`/scraper/` directory) runs Playwright headless Chromium every hour (10-21 UTC)
2. Scrapes both FlashScore live page and results page, extracts match data from DOM
3. Transforms raw data to internal fixture format with round normalisation, status detection, winner extraction
4. POSTs fixtures to `POST /api/admin/scrape-results` (auth: Bearer ADMIN_SECRET)
5. Triggers `POST /api/admin/process-results` to grade picks and update eliminations
6. Backend stores in `scraped_results` PostgreSQL table + in-memory cache
7. `getDraw()` reads scraper data first, overlays onto seed draw JSON via `overlayFixtures()` in `seedDrawOverlay.js`

**Key files:**
- `scraper/src/scrape.mjs` — Playwright scraper (Railway cron service, fully server-side)
- `scraper/src/config.mjs` — tournament-specific config (URLs, round mapping, timezone offset)
- `backend/src/services/scraperCache.js` — two-tier cache (in-memory + PostgreSQL). Stale data always served (match results don't un-happen).
- `backend/src/services/seedDrawOverlay.js` — `overlayFixtures()` matches scraper names to seed draw via `normaliseName()` (2-pass: exact + fuzzy Levenshtein)
- `backend/src/routes/admin.js` — `POST /api/admin/scrape-results` and `GET /api/admin/scraper-status`
- `backend/src/db/schema.sql` — `scraped_results` table definition

**Name matching:** `normaliseName()` in `seedDrawOverlay.js` handles FlashScore abbreviated names. No hardcoded mapping in the scraper itself.

**Why FlashScore over APIs:**
- API-Tennis: failed repeatedly during Monte Carlo, empty responses
- FlashScore: free, always has live data, browser scraping bypasses cloud IP blocks

**Provider chain (dataAdapter.js):** Scraper → API-Tennis → Sofascore → mock

**Goalserve: REMOVED** — Fully deleted from codebase on 22 Apr 2026. Was never reliable (returned 0 fixtures on Madrid day 1). All adapter code, config fields, admin endpoints, cron warming, and env var references removed. `GOALSERVE_API_KEY` env var can be deleted from Railway.

## Matchstat Tennis API — Intelligence Layer

**Status (24 Apr 2026):** Active. Mickey upgraded to paid tier. `MATCHSTAT_API_KEY` set in Railway. Name cache covers top 200 ATP players via rankings pagination. Search fallback covers all players outside cache.

**Purpose:** H2H records, player profiles, surface stats, recent form. Supplements live scraper data.

**Search fallback (added 24 Apr):** `searchPlayerId()` in `matchstatAdapter.js` uses `/atp/player/search/{surname}` endpoint when rankings-based cache misses (qualifiers, lucky losers, lower-ranked players). `resolvePlayerId()` tries cache first, then search. All 5 data-fetching functions now use `await resolvePlayerId()` (was sync `lookupPlayerId()`).

**Coverage:** Top 200 from rankings cache + any player findable via search API. Only truly obscure players (not in Matchstat's database at all) will have no data.
