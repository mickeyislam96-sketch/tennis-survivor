---
name: Data provider strategy — FlashScore scraper primary
description: FlashScore scraper is the sole live data provider for Madrid 2026+. Goalserve fully removed from codebase 22 Apr. API-Tennis and Sofascore kept as automatic fallbacks. Matchstat for H2H intelligence.
type: project
---
## FlashScore Scraper — Primary Data Provider (22 Apr 2026)

**Status:** Active and running for Madrid 2026. Sole live data provider since 22 Apr (Goalserve fully removed from codebase).

**How it works:**
1. Cowork scheduled task `flashscore-scraper` triggers every hour (with jitter)
2. Chrome MCP navigates to FlashScore Madrid page, injects JavaScript to extract DOM data
3. 97-name mapping converts abbreviated names ("Z. Bergs") to full seed draw names ("Zizou Bergs")
4. POST to `POST /api/admin/scrape-results` (auth: Bearer ADMIN_SECRET)
5. Backend stores in `scraped_results` PostgreSQL table + in-memory cache
6. `getDraw()` reads scraper data first, overlays onto seed draw JSON via `overlayFixtures()` in `seedDrawOverlay.js`

**Key files:**
- `backend/src/services/scraperCache.js` — two-tier cache (in-memory + PostgreSQL). Critical design: stale data always served (match results don't un-happen). Only returns null when genuinely no data anywhere.
- `backend/src/services/seedDrawOverlay.js` — `overlayFixtures()` matches scraper names to seed draw via `normaliseName()` (2-pass: exact + fuzzy Levenshtein)
- `backend/src/routes/admin.js` — `POST /api/admin/scrape-results` and `GET /api/admin/scraper-status`
- `backend/src/db/schema.sql` — `scraped_results` table definition
- Scheduled task: `flashscore-scraper` (on Mickey's Mac, every hour)

**Name mapping is critical:** `normaliseName()` sorts name parts alphabetically for matching. FlashScore abbreviated names don't match full names under this normaliser. The scheduled task prompt has a hardcoded mapping of all 97 player names (66 R1 + 31 seeded). When new players enter in later rounds, the mapping must be extended.

**Why FlashScore over APIs:**
- API-Tennis: failed repeatedly during Monte Carlo, empty responses
- FlashScore: free, always has live data, browser scraping bypasses cloud IP blocks

**Provider chain (dataAdapter.js):** Scraper → API-Tennis → Sofascore → mock

**Goalserve: REMOVED** — Fully deleted from codebase on 22 Apr 2026. Was never reliable (returned 0 fixtures on Madrid day 1). All adapter code, config fields, admin endpoints, cron warming, and env var references removed. `GOALSERVE_API_KEY` env var can be deleted from Railway.

## Matchstat Tennis API — Intelligence Layer

**Status (21 Apr 2026):** Active. `MATCHSTAT_API_KEY` set in Railway. Name cache covers top 200 ATP players.

**Purpose:** H2H records, player profiles, surface stats, recent form. Supplements live scraper data.

**Free tier:** 500 req/month. Sufficient for Madrid (~10 users, ~55 unique matchup lookups).
