---
name: FlashScore scraper infrastructure
description: Chrome MCP scraper for live tennis data. Scheduled task every 20min, JavaScript DOM extraction, 97-name mapping, POST to backend, PostgreSQL + in-memory cache.
type: project
originSessionId: 81530973-b319-4515-9fa5-b300d1ff6264
---
## FlashScore Scraper System

**Built:** 22 Apr 2026. Primary data source for Madrid 2026. Goalserve fully removed from codebase 22 Apr.

### Architecture
- **Trigger:** Cowork scheduled task `flashscore-scraper` (cron: every hour, with jitter)
- **Scraping:** Chrome MCP navigates to FlashScore Summary page, injects JavaScript to extract match data from DOM
- **Page:** Summary page (default landing) — NOT Results tab. Summary has live stage data ("set 1", "finished", "cancelled").
- **Qualification filter:** `.event__header` elements with "Qualification" in text trigger `isMainDraw = false`, skipping all qualification matches below that header.
- **DOM selectors:** `.event__round`, `.event__match`, `.event__header`, `.event__homeParticipant span[class*="wcl-name"]`, `[class*="stage"]`, `.event__part--home/away`
- **Name mapping:** 97 hardcoded FlashScore abbreviated name to full name mappings
- **Transport:** POST to `/api/admin/scrape-results` with Bearer auth
- **matchId:** Required by backend. Generated as MD5 hash (first 12 chars) of `"{round}_{player1Name}_{player2Name}"`
- **Storage:** `scraped_results` PostgreSQL table + in-memory cache (30-min TTL) in `scraperCache.js`
- **Consumption:** `getDraw()` in `tennisData.js` reads scraper data for seed draw overlay

### Key Fixes Applied (22 Apr 2026, first live run + session 24)
1. **Summary page over Results page** — Results tab lacks live stage info (no "set 1"/"set 2"/"cancelled" etc). Summary has all status data.
2. **Qualification match filtering** — Without `.event__header` detection, qualification finals/semis (21 Apr) were included as main draw matches. Fixed by tracking `isMainDraw` flag toggled by header text.
3. **Round mapping: both "" and "1/64-finals" = R1** — FlashScore shows today's R1 with no round header, tomorrow's R1 as "1/64-finals". Both are R1 for Madrid's 96-draw (unseeded-only matches). The original mapping had "1/64-finals" -> "R64" which was wrong during R1.
4. **matchId field required** — Backend rejects fixtures without `matchId`. Generated from MD5 of round+players.
5. **Scraper-status auth** — Uses Bearer header, not `?secret=` query param.
6. **Score parsing — tiebreak fix** — Original filter `if h >= 40 or a >= 40` incorrectly stripped tiebreak encodings like 63-77. Fixed to `if h in {15, 30, 40} or a in {15, 30, 40}`.
7. **Cancelled fixture collision** — When a player withdraws and is replaced (e.g. Collignon→Prizmic), FlashScore shows both cancelled and completed matches. Name mapping can map both to the same seed draw player, causing `findFixtureMatch()` to match the cancelled one first, blocking the real result. Fix: filter all cancelled fixtures before POSTing to backend.
8. **Results processor trigger** — Scraper POSTs fixtures to `scraperCache` but `autoProcessResults()` must be called separately to update `picks.survived`, `group_members.is_alive`, and send emails. Added `POST /api/admin/process-results` as Step 9 in the scheduled task. **CRITICAL: the leaderboard computes elimination on-the-fly (appears correct) but DB-level settlement requires this separate call.**

### Scheduled Task Details
- Task ID: `flashscore-scraper`
- Location: Mickey's Mac (`/Users/mikaeelislam/Documents/Claude/Scheduled/flashscore-scraper/SKILL.md`)
- **Requires manual Chrome MCP permission approval** — user must click "Run now" once to pre-approve tool permissions

### Key Limitations
- Chrome MCP JavaScript tool output truncates — must retrieve data in batches of 8 matches
- Name mapping must be manually extended when new players enter the draw (e.g. seeded players first appear in R64)
- Scraper depends on FlashScore DOM structure — if they change CSS classes, extraction breaks
- No automatic error recovery — if Chrome MCP fails, scrape is silently skipped until next cycle
- **Round mapping needs updating when R1 ends** — once R1 is complete and R64 begins, "1/64-finals" should map to "R64" instead of "R1"

### Backend Files
- `backend/src/services/scraperCache.js` — `getScrapedResults()`, `setScrapedResults()`, in-memory + PostgreSQL. **Critical fix 22 Apr:** stale data always served (match results don't un-happen). Only returns null when genuinely no data anywhere.
- `backend/src/services/seedDrawOverlay.js` — `overlayFixtures()` (renamed from `overlayGoalserve` on 22 Apr) matches scraper names to seed draw
- `backend/src/routes/admin.js` — `POST /api/admin/scrape-results` (validates Bearer token, stores fixtures)
- `backend/src/routes/admin.js` — `GET /api/admin/scraper-status` (last scrape time, fixture count, Bearer auth)
- `backend/src/db/schema.sql` — `scraped_results` table (tournament_id, round, fixtures JSONB, scraped_at)

### Name Mapping (97 players, verified 22 Apr 2026)
66 R1 players + 31 seeded players entering at R64.

Tricky names verified against live FlashScore:
- "De Minaur A." -> Alex de Minaur (capitalised particle)
- "Davidovich Fokina A." -> Alejandro Davidovich Fokina (compound surname)
- "Etcheverry T. M." -> Tomas Martin Etcheverry (double initials)
- "Cerundolo F." -> Francisco Cerundolo vs "Cerundolo J. M." -> Juan Manuel Cerundolo
- "Collignon R." -> Dino Prizmic (Collignon withdrew, Prizmic is lucky loser replacement)

### Madrid R1 Day 1 Results (22 Apr 2026)
First live scraper run: 34 fixtures posted (4 completed, 3 live, 2 cancelled, 25 scheduled).
- Completed: Cilic d. Bergs, Nava d. Brooksby, Kopriva d. Zhang, Buse d. Mannarino
- Cancelled: Michelsen vs Cina (Michelsen withdrew), Collignon vs Berrettini (Collignon replaced by Prizmic)
- Buse's win correctly resolved a user's pick (confirmed by Mickey)

### Seed Draw Updates (22 Apr 2026)
13 qualifier placeholders filled with actual players from FlashScore data:
- pos 3->Trungelliti, 4->Merida Aguilar, 5->Moller, 22->Lajovic, 37->Basilashvili
- pos 61->Faria, 67->Kypson, 69->Bonzi, 70->Droguet, 93->Gaubas
- pos 101->Budkov Kjaer, 107->Vallejo, 118->Damm
- Collignon (pos 35) withdrawn -> replaced by Prizmic (LL)
