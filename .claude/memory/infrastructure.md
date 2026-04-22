# Final Serve-ivor — Infrastructure

## Services
- **Frontend**: React + Vite on Vercel (auto-deploys from GitHub `main`)
- **Backend**: Node.js / Express on Railway (auto-deploys from GitHub `main`)
- **Email**: Brevo (formerly Sendinblue) HTTP API — sender: noreply@finalserveivor.com
- **Data**: FlashScore scraper (Chrome MCP, free) — Goalserve fully removed from codebase 22 Apr 2026
- **Domain**: finalserveivor.com (also tennis-survivor.vercel.app)

## Key IDs
- Railway Project: `0ec066c7-c7e1-4abf-8897-3577208c64cd`
- Railway Service: `df618c7b-3678-4595-aaf7-3ff2f0e86d72`
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

## Deployment gotchas
- Every push to `main` auto-deploys to real users — treat every commit as production release
- mnt files can be stale if Mickey hasn't run `git pull` — always diff against GitHub HEAD before pushing from mnt
- React hooks violations have caused 3 white-screen incidents — always check no hooks after early returns
- Railway has no MCP — verify deploys by hitting `/api/health`
