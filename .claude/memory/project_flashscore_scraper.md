---
name: FlashScore scraper infrastructure
description: Railway cron service using Playwright headless Chromium. Scrapes FlashScore hourly (10-21 UTC), POSTs to backend, triggers results processing. Fully server-side, no Mac dependency.
type: project
originSessionId: 81530973-b319-4515-9fa5-b300d1ff6264
---
## FlashScore Scraper System

**Built:** 22 Apr 2026. Migrated from Cowork scheduled task to Railway cron service. Primary data source for Madrid 2026. Goalserve fully removed from codebase 22 Apr.

### Architecture
- **Runtime:** Separate Railway service (`012860d6-07a0-48f1-8818-ccc4625188a0`) running as a cron job
- **Container:** Docker image based on `mcr.microsoft.com/playwright:v1.52.0-noble` with headless Chromium
- **Schedule:** `0 10-21 * * *` (every hour on the hour, 10:00-21:00 UTC)
- **Scraping:** Playwright navigates to FlashScore live page + results page, extracts match data from DOM
- **Pages scraped:** Both live/upcoming page AND results page. Results override live data for completed matches (more authoritative).
- **Qualification filter:** Tracks main draw vs qualification sections. Main-draw-specific labels (1/32, 1/64, etc.) set a flag; subsequent ambiguous labels (Semi-finals, Final) are treated as qualification and skipped.
- **Transport:** POST to `/api/admin/scrape-results` with Bearer auth, then triggers `POST /api/admin/process-results`
- **matchId:** FlashScore element IDs (`g_2_XXXXX`) prefixed with `fs-`, or hash-generated fallback
- **Storage:** `scraped_results` PostgreSQL table + in-memory cache (30-min TTL) in `scraperCache.js`
- **Consumption:** `getDraw()` in `tennisData.js` reads scraper data for seed draw overlay via `seedDrawOverlay.js`

### Scraper Service Files (in repo under `/scraper/`)
- `scraper/src/scrape.mjs` -- main scraper: launch browser, extract matches, transform, POST, trigger results
- `scraper/src/config.mjs` -- tournament-specific config: FlashScore URLs, round mapping, timezone offset
- `scraper/Dockerfile` -- Playwright Docker image with Chromium
- `scraper/railway.toml` -- cron schedule and build config
- `scraper/package.json` -- single dependency: playwright

### Per-Round Config That Needs Updating
- **`DEFAULT_ROUND`** env var on Railway scraper service: matches at the top of the FlashScore live page sometimes appear without a round header. This env var tells the scraper what round to assign them. Must be updated as the tournament progresses (R1 -> R64 -> R32 -> R16 -> QF -> SF -> F).
- **`FLASHSCORE_URL`** and **`RESULTS_URL`** env vars: default to Madrid URLs in config.mjs. Override via Railway env vars for different tournaments.
- **`TIMEZONE_OFFSET`** env var: defaults to 2 (CEST for Madrid/Rome/Paris). Set to 1 for BST tournaments.

### Round Mapping (96-draw Masters 1000)
FlashScore uses "1/X-finals" notation where X = remaining players:
- No header or "1st Round" -> R1 (32 unseeded matches)
- "1/64-finals" or "2nd Round" -> R64 (seeds enter)
- "1/32-finals" or "3rd Round" -> R32
- "1/16-finals" -> R16
- "1/8-finals" or "Quarter-finals" -> QF
- "Semi-finals" -> SF
- "Final" -> F

### Winner Detection
- **Completed:** Counts sets won from score string (e.g. "6-4, 7-5"), higher set count wins
- **Walkover/Retired:** Same set counting, but uses walkover/retired status. Walkover sets `isWithdrawal: true` and identifies `withdrawnPlayerId`
- **Live/Scheduled:** No winner assigned

### Backend Files
- `backend/src/services/scraperCache.js` -- two-tier cache (in-memory + PostgreSQL). Stale data always served (match results don't un-happen).
- `backend/src/services/seedDrawOverlay.js` -- `overlayFixtures()` matches scraper names to seed draw via `normaliseName()`
- `backend/src/routes/admin.js` -- `POST /api/admin/scrape-results` and `GET /api/admin/scraper-status`
- `backend/src/db/schema.sql` -- `scraped_results` table

### Key Limitations
- Name matching depends on `normaliseName()` in seedDrawOverlay.js (2-pass: exact + fuzzy Levenshtein). No hardcoded mapping in the scraper itself.
- Scraper depends on FlashScore DOM structure -- if they change CSS classes, extraction breaks
- `DEFAULT_ROUND` env var must be manually updated per round
- Lock time overrides in `activeTournament.js` still need manual updates per round
