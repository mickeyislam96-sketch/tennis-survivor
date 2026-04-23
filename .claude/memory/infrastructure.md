# Final Serve-ivor — Infrastructure

## Services
- **Frontend**: React + Vite on Vercel (auto-deploys from GitHub `main`)
- **Backend**: Node.js / Express on Railway (auto-deploys from GitHub `main`)
- **Scraper**: Railway cron service running Playwright/Chromium in Docker container. Deployed 23 Apr 2026. Auto-deploys from `main`, runs hourly 10-21 UTC (11AM-10PM UK/BST), scrapes FlashScore live + results pages, POSTs fixtures to backend. Replaced local Mac-based launchd scraper. Separate directory: `scraper/` with 6 files (package.json, Dockerfile, railway.toml, src/config.mjs, src/scrape.mjs, .dockerignore).
- **Email**: Brevo (formerly Sendinblue) HTTP API — sender: noreply@finalserveivor.com. All emails send directly (no queue). DNS records: SPF, DKIM, DMARC authenticated. SPF needs update (see note below).
- **Data source**: FlashScore scraper (sole live provider, free) — Goalserve fully removed 22 Apr 2026. Provider chain for API fallback: Scraper → API-Tennis (legacy) → Sofascore → mock
- **Domain**: finalserveivor.com (also tennis-survivor.vercel.app)

## Key IDs
- Railway Project: `0ec066c7-c7e1-4abf-8897-3577208c64cd`
- Railway Backend Service: `df618c7b-3678-4595-aaf7-3ff2f0e86d72`
- Railway Scraper Service: `valiant-forgiveness` (in Railway project `successful-embrace` — note: different project name than main backend)
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
2. Railway env var `DEFAULT_ROUND` (start R1, update as tournament progresses through rounds)
3. Railway cron schedule: `0 10-21 * * *` (hourly) for Madrid/Australia, `*/15 10-21 * * *` (every 15 min) for Rome onwards

## FlashScore round mapping (96-draw Masters)
- (no header) → R1 (uses DEFAULT_ROUND env var — FlashScore doesn't label first day)
- "1/64-finals" → R64 (seeds enter as round 2)
- "1/32-finals" → R32
- "1/16-finals" → R16
- "1/8-finals" / "Quarter-finals" → QF
- "Semi-finals" → SF
- "Final" → F

## Scraper architecture decisions
- **Playwright over Puppeteer**: better Docker support, can switch to Firefox if FlashScore blocks Chromium
- **Railway cron, not Claude Routines**: scraper is deterministic (no AI reasoning needed), Routines are research preview with daily run caps and agentic overhead. Routines reserved for future tasks needing AI decision-making.
- **Separate Railway service**: scraper runs in isolated Docker container, won't crash API if browser fails, scales independently
- **FlashScore is ONLY source**: Goalserve removed 22 Apr 2026. If scraper fails, Mickey manually uploads results. Provider chain for fallback: Scraper → API-Tennis → Sofascore → mock
- **3-pass name matching**: eliminates hardcoded 97-player mapping table, auto-handles abbreviated names, compounds, double initials
- **Auto-withdrawal detection**: pre-pass detects lucky loser replacements and updates bracket in-memory, zero manual edits needed

## Deployment gotchas
- Every push to `main` auto-deploys to real users — treat every commit as production release
- mnt files can be stale if Mickey hasn't run `git pull` — always diff against GitHub HEAD before pushing from mnt
- React hooks violations have caused 3 white-screen incidents — always check no hooks after early returns
- Railway has no MCP — verify deploys by hitting `/api/health` (backend) or check Railway dashboard (scraper)
- **Scraper depends on FlashScore DOM selectors** — if FlashScore redesigns live/results page CSS, scraper breaks. Monitor first run of each tournament.
- **Email deliverability** — SPF record at Namecheap needs update: `v=spf1 include:spf.sendinblue.com ~all` (currently just `~all`, causing new domain to land in spam). DKIM verified.
- **Scraper service is separate** — `valiant-forgiveness` runs independently from main backend. Check Railway dashboard for scraper logs (no MCP available).
