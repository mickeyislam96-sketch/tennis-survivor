# Final Serve-ivor — Infrastructure

## Services
- **Frontend**: React + Vite on Vercel (auto-deploys from GitHub `main`)
- **Backend**: Node.js / Express on Railway (auto-deploys from GitHub `main`)
- **Scraper**: Playwright/Chromium on Railway cron (auto-deploys from GitHub `main`/scraper directory). Hourly 10-21 UTC, scrapes FlashScore, POSTs results to backend. Replaced local Mac-based launchd scraper 23 Apr 2026.
- **Email**: Brevo (formerly Sendinblue) HTTP API — sender: noreply@finalserveivor.com
- **Data source**: FlashScore scraper (sole provider, free) — Goalserve fully removed from codebase 22 Apr 2026
- **Domain**: finalserveivor.com (also tennis-survivor.vercel.app)

## Key IDs
- Railway Project: `0ec066c7-c7e1-4abf-8897-3577208c64cd`
- Railway Backend Service: `df618c7b-3678-4595-aaf7-3ff2f0e86d72`
- Railway Scraper Service: `valiant-forgiveness` (in project `successful-embrace` — note: different project name in Railway UI)
- Vercel Project: `prj_HBePdqF7BaXq1qzw7bxu9prRhtyf`
- Vercel Team: `team_ekuiNPY7cIyY2ieq41oWMYvO`
- Madrid group DB ID: `a76829c9-b27c-4f6a-80c9-ae0437767c0a`

## GitHub access
- Repo: `mickeyislam96-sketch/tennis-survivor`
- PAT stored in previous session transcript (search for `ghp_`)
- Push via GitHub Contents API (no git CLI auth in Cowork sandbox)

## API endpoints (notable)
- `POST /api/support` — contact form submissions. Rate limited (5/hr per IP). Sends email directly via Brevo to finalservivor@gmail.com (bypasses approval queue). Attaches user context (name, email, group memberships) if logged in.
- `POST /api/admin/withdrawal` — mark player withdrawal, unlock affected picks, send notification emails.
- `POST /api/admin/scrape-results` — receive FlashScore scraper data (Bearer auth).
- `GET /api/admin/scraper-status` — last scrape time, fixture count.
- `GET /api/admin/api-diag` — data provider diagnostic info.
- `GET /api/ops/summary?hours=24&secret=X` — structured operations overview (tournament state, picks, emails, recent activity).
- `GET /api/ops/log?category=X&hours=48&secret=X` — raw ops log with filters.
- `POST /api/ops/setup-tournament` — create tournament group with invite code, verify data provider.
- `GET /api/ops/health-deep?secret=X` — deep health check (DB, ops_log table, data provider, email service, tournament config).

## Automation (deployed 19 Apr 2026)
- **15-min cron** in `index.js`: autoProcessResults → checkPickReminders → runOpsChecks → sendAdminDigest
- **runOpsChecks** runs: checkDrawRelease → checkWithdrawals → autoSetLockTimes
- **ops_log table**: persistent record of all automated actions (category, action, details JSONB, tournament_id)
- **Daily ops brief**: Cowork scheduled task `fsv-daily-ops-brief` at 8am — calls /api/ops/summary, checks /api/health, checks Vercel deploy status
- Key file: `backend/src/services/opsMonitor.js`

## Scraper configuration (per tournament)
Update these files when running a new tournament:
1. `scraper/src/config.mjs`: FLASHSCORE_URL, RESULTS_URL, ROUND_MAP, TIMEZONE_OFFSET_HOURS
2. Railway env var `DEFAULT_ROUND` (changes as tournament progresses through rounds)
3. Railway cron schedule: `0 10-21 * * *` (hourly) for most tournaments, `*/15 10-21 * * *` (every 15 min) for high-activity tournaments

## FlashScore round mapping (Madrid 2026 reference)
- "1/64-finals" → R64 (seeds enter, round 2 in 96-draw Masters)
- "1/32-finals" → R32 (round 3)
- "1/16-finals" → R16
- "1/8-finals" → QF
- "Quarter-finals" → QF
- "Semi-finals" → SF
- "Final" → F
- R1 matches have no round header on FlashScore — handled via DEFAULT_ROUND env var

## Scraper architecture decisions
- **Playwright over Puppeteer**: better Docker support, can switch to Firefox if FlashScore blocks Chromium
- **Railway cron, not Claude Routines**: scraper is deterministic (no AI needed), Routines are research preview with daily caps, this is production-critical with no backup
- **Separate Railway service, same repo**: scraper runs in isolated container, won't crash API if browser fails
- **FlashScore is ONLY source**: Goalserve removed 22 Apr 2026. If scraper fails, Mickey manually uploads results (no automatic fallback).

## Deployment gotchas
- Every push to `main` auto-deploys to real users — treat every commit as production release
- mnt files can be stale if Mickey hasn't run `git pull` — always diff against GitHub HEAD before pushing from mnt
- React hooks violations have caused 3 white-screen incidents — always check no hooks after early returns
- Railway has no MCP — verify deploys by hitting `/api/health`
- **Scraper relies on FlashScore HTML structure** — if FlashScore redesigns live or results pages, scraper selector paths will break. Monitor first run of each tournament.
