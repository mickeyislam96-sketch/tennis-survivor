---
name: Data provider strategy — FlashScore primary
description: FlashScore scraper replaced Goalserve as primary data for Madrid 2026. Scraper runs every 20min via Cowork scheduled task + Chrome MCP. Goalserve/API-Tennis kept as fallbacks. Matchstat for H2H intelligence.
type: project
---
## FlashScore Scraper — Primary Data Provider (22 Apr 2026)

**Status:** Active and running for Madrid 2026 R1. Replaced Goalserve which returned 0 fixtures on tournament day 1.

**How it works:**
1. Cowork scheduled task `flashscore-scraper` triggers every 20 minutes
2. Chrome MCP navigates to FlashScore Madrid page, injects JavaScript to extract DOM data
3. 66-name mapping converts abbreviated names ("Z. Bergs") to full seed draw names ("Zizou Bergs")
4. POST to `POST /api/admin/scrape-results` (auth: Bearer ADMIN_SECRET)
5. Backend stores in `scraped_results` PostgreSQL table + in-memory cache (30-min TTL)
6. `getDraw()` reads scraper data first, overlays onto seed draw JSON

**Key files:**
- `backend/src/services/scraperCache.js` — two-tier cache (in-memory + PostgreSQL), 30-min TTL
- `backend/src/routes/admin.js` — `POST /api/admin/scrape-results` and `GET /api/admin/scraper-status`
- `backend/src/db/schema.sql` — `scraped_results` table definition
- Scheduled task: `flashscore-scraper` (on Mickey's Mac, every 20 min)

**Name mapping is critical:** `normaliseName()` sorts name parts alphabetically for matching. FlashScore abbreviated names don't match full names under this normaliser. The scheduled task prompt has a hardcoded mapping of all 66 R1 player names. When new players enter in later rounds (seeded players in R64+), the mapping must be extended.

**Why FlashScore over APIs:**
- Goalserve: returned 0 fixtures for Madrid on day 1, unreliable at tournament start
- API-Tennis: failed repeatedly during Monte Carlo, empty responses
- FlashScore: free, always has live data, browser scraping bypasses cloud IP blocks

**Provider chain:** Scraper → Goalserve → API-Tennis → Sofascore → mock

## Goalserve Tennis API — Fallback Provider

**Status (22 Apr 2026):** Demoted to fallback. Was primary from 20-21 Apr, but returned 0 fixtures on Madrid tournament day. Adapter fully implemented and functional when data exists.

**Key config:** `GOALSERVE_API_KEY` and `TENNIS_DATA_PROVIDER=goalserve` set in Railway. `goalserveTournamentId: '21256'` in `activeTournament.js`.

## Matchstat Tennis API — Intelligence Layer

**Status (21 Apr 2026):** Active. `MATCHSTAT_API_KEY` set in Railway. Name cache covers top 200 ATP players.

**Purpose:** H2H records, player profiles, surface stats, recent form. Supplements live data (whether from scraper or Goalserve).

**Free tier:** 500 req/month. Sufficient for Madrid (~10 users, ~55 unique matchup lookups).
