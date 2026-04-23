---
name: FlashScore scraper infrastructure
description: Railway cron service (Playwright/Chromium) for live tennis data. Deploys from scraper/ directory, runs hourly 10-21 UTC, 3-pass name matching, POST to backend, PostgreSQL + in-memory cache. Sole live data provider.
type: project
lastUpdated: 23 Apr 2026 (session 26c)
---

## FlashScore Scraper System — Cloud Deployment (23 Apr 2026)

**Current status:** LIVE in production for Madrid 2026. Railway cron service `valiant-forgiveness` deployed and running. Replaced Chrome MCP scheduled task and local launchd scraper. Sole live data provider (Goalserve fully removed).

### Architecture Overview
- **Deployment:** Standalone Railway cron service in Docker container. Separate from main backend service.
- **Language:** Node.js + Playwright (Chromium browser automation)
- **Trigger:** Railway cron `0 10-21 * * *` (hourly 11AM-10PM UK/BST). Change to `*/15 10-21 * * *` for high-activity tournaments (Rome onwards).
- **Data extraction:** Playwright navigates to FlashScore live page + results page, extracts from DOM via JavaScript selectors
- **Pages:** Summary page (default) — has live stage data ("set 1", "finished", "cancelled"). Results tab lacks this.
- **Qualification filtering:** Detects `Qualification` text in `.event__header`, sets `isMainDraw = false`, skips all qualification matches below that boundary
- **Output:** Array of fixture objects POSTed to `/api/admin/scrape-results` with Bearer auth
- **Storage:** `scraped_results` PostgreSQL table + in-memory cache (30-min TTL)
- **Consumption:** `getDraw()` in tennisData.js → `overlayFixtures()` in seedDrawOverlay.js

### Why Railway Cron Over Claude Routines
- **Deterministic scraper:** No AI reasoning needed — pure DOM extraction and HTTP POST. Routines are designed for agentic decision-making with live API planning.
- **Production reliability:** Railway gives full Docker control, logs, zero usage caps. Claude Routines are research preview with daily run limits, not suitable for production-critical infrastructure.
- **No session dependency:** Scraper runs even when Mickey's laptop is offline and no Cowork session is active.
- **Scaling:** From hourly to 15-min runs for busy tournaments (Italy/France) — just change cron schedule.
- **Decision:** Routines should be reserved for future tasks that need AI reasoning during execution (e.g., dynamic tournament scheduling, strategic withdrawal recommendations).

### Directory Structure
```
scraper/
  package.json         — Playwright + Express
  railway.toml         — cron schedule + env config
  Dockerfile           — node:20-alpine + playwright
  .dockerignore        — exclude git/node_modules
  src/
    config.mjs         — tournament-specific URLs, round mapping, timezone
    scrape.mjs         — Playwright browser, DOM extraction, score parsing
```

### Configuration (per tournament)
Update these files when running a new tournament:

1. **`scraper/src/config.mjs`**
   - `FLASHSCORE_URL` — tournament live page URL (e.g. flashscore.co.uk/tennis/atp-singles/madrid)
   - `RESULTS_URL` — results page URL for additional data
   - `ROUND_MAP` — object mapping FlashScore round labels to internal codes
   - `TIMEZONE_OFFSET_HOURS` — for parsing local times (e.g. +1 for BST)

2. **Railway env var `DEFAULT_ROUND`**
   - Set to active round at start of tournament (R1 for Madrid)
   - Update as tournament progresses (R64, R32, etc.)

3. **Railway cron schedule in `railway.toml`**
   - Madrid (hourly): `0 10-21 * * *`
   - Rome+ (15-min): `*/15 10-21 * * *`

### Key Technical Details

**FlashScore Round Mapping (96-draw Masters)**
- `(no header)` → R1 — uses `DEFAULT_ROUND` env var because FlashScore doesn't label R1 on live page
- `1/64-finals` → R64 (64 players, seeds entering)
- `1/32-finals` → R32 (32 players)
- `1/16-finals` → R16 (16 players)
- `1/8-finals` / `Quarter-finals` → QF
- `Semi-finals` → SF
- `Final` → F

**Name Matching — 3-Pass Strategy (CRITICAL FIX 23 Apr)**
Problem: FlashScore sends abbreviated names (`"Sinner J."`) but seed draw has full names (`"Jannik Sinner"`).

Solution: `seedDrawOverlay.js` implements 3-pass matching:
1. **Exact normalised match** — strip accents, lowercase, compare token-by-token
2. **Fuzzy Levenshtein > 0.85** — handles typos and partial abbreviations
3. **Surname subset matching** — extract parts ≥3 chars, check if shorter set is subset of longer
   - `["sinner"]` ⊂ `["jannik","sinner"]` → match ✓
   - Handles compound surnames: Carreno-Busta, Van De Zandschulp
   - Handles double initials: Etcheverry T. M.

**Same 3-pass approach used for:**
- Fixture matching (find scraper fixture in seed draw)
- Winner identification (map winner name to seed draw player)
- Withdrawal mapping (detect lucky loser replacements)

**Result:** No hardcoded name mapping table needed. New players auto-matched on first appearance.

**Score Parsing**
- Strips sets-won prefix: "2-0 6-7 6-4" → extract `6-7` and `6-4`
- Detects tiebreaks: encode as `77-63` means 7-6 tiebreak 7-3
- Filter check: `if score in {15, 30, 40}` (not `>= 40` which breaks tiebreaks)

**Auto-Withdrawal Detection (23 Apr)**
When a player withdraws and is replaced (lucky loser):
1. Scraper sees both a cancelled fixture (original player) and a new fixture (replacement)
2. Backend receives both but replacement player isn't in seed draw
3. `overlayFixtures()` pre-pass detects: replacement unknown, original cancelled
4. Auto-swaps the seed draw player in memory, marks as LL
5. No manual seed draw edits needed for future withdrawals

Example: Van De Zandschulp withdrew, Garin entered as LL. System auto-detected and updated bracket progression correctly.

### Backend Files Modified

| File | Purpose |
|---|---|
| `backend/src/services/scraperCache.js` | Two-tier cache (memory + DB). **Critical:** always serves stale data (match results don't un-happen), only returns null when zero data exists |
| `backend/src/services/seedDrawOverlay.js` | `overlayFixtures()` — 3-pass name matching, fixture/winner/withdrawal mapping, auto-LL detection |
| `backend/src/routes/admin.js` | `POST /api/admin/scrape-results` (Bearer auth), `GET /api/admin/scraper-status` |
| `backend/src/db/schema.sql` | `scraped_results` table (tournament_id, round, fixtures JSONB, scraped_at) |
| `backend/src/services/dataAdapter.js` | Provider chain: Scraper (first) → API-Tennis → Sofascore → mock |
| `backend/src/services/tennisData.js` | `getDraw()` reads scraper via `overlayFixtures()` |

### Deployment & Runtime

**Railway Service: `valiant-forgiveness`**
- Project: `successful-embrace` (note different name than main backend project)
- Region: europe-west4 (Netherlands)
- Root: `/scraper`
- Branch: `main` (auto-deploys on push)
- Env vars: `ADMIN_SECRET`, `BACKEND_URL`, `DEFAULT_ROUND`

**Docker image**
- Base: `mcr.microsoft.com/playwright:v1.52.0-noble` (includes Chromium + dependencies)
- Alternative: can switch to Firefox if FlashScore blocks Chromium

**Cron execution**
- Railway triggers container ~1 min before schedule (deterministic jitter)
- Script runs, POSTs results, exits (0 = success, non-zero logs error)
- Logs available in Railway dashboard
- No external dependencies (Playwright is pre-installed in base image)

### Known Limitations & Gotchas

1. **FlashScore DOM stability** — If FlashScore redesigns their live page CSS classes (`.event__match`, `.event__header`, etc.), selectors break. Monitor first run of each tournament. Mitigation: use data-attributes or more stable selectors if possible.

2. **Missing players** — If a new player enters the draw after scraper first runs, they won't be in the seed draw until manually added. Name matching handles the pairing, but fixture display shows unknown player until draw is updated.

3. **Timezone off-by-one** — Scraper runs 10-21 UTC. If tournament changes timezones (e.g. India rounds), need to adjust `TIMEZONE_OFFSET_HOURS` and cron schedule.

4. **No retry logic** — If a single scrape fails (network error, FlashScore down), it's silently skipped. Next scheduled run will post whatever data has changed. OK for 1-hour cadence; might need exponential backoff if switching to 15-min.

5. **Stale cache collision** — If scraper hasn't run for >30 min but DB is fresh, in-memory cache is bypassed and DB serves stale. This is intentional (avoid losing results) but can cause race conditions if debugging. Watch the `scraped_at` timestamps.

### Session History

**22 Apr 2026 — First live run**
- 34 fixtures posted (12 completed, 2 live, 17 scheduled, 3 cancelled)
- 4 completed matches correctly processed and picks graded
- Name mapping: 97 total (66 R1 + 31 seeds)
- Issues: cancelled fixture collision (Collignon→Prizmic), tiebreak score filtering, results processor not triggered

**23 Apr 2026 — Cloud deployment**
- Built `scraper/` directory with Playwright-based Docker container
- Deployed to Railway cron service
- Switched from Chrome MCP scheduled task (laptop-dependent) to production service
- Critical fixes: country suffix stripping, 3-pass name matching, auto-withdrawal detection
- Full pipeline verified end-to-end: scraper → overlay → bracket progression → pick grading → emails

**23 Apr 2026 — By Round redesign**
- Implemented scoreboard-style match cards for draw viewer
- Integrated score parsing with tiebreak decoding
- Winner detection with bold green styling
- Live/finished/scheduled status badges
- Sort: live → finished → scheduled
