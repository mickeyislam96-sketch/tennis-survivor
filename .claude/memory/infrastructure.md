# Final Serve-ivor — Infrastructure

## Services
- **Frontend**: React + Vite on Vercel (auto-deploys from GitHub `main`)
- **Backend**: Node.js / Express on Railway (auto-deploys from GitHub `main`)
- **Email**: Brevo (formerly Sendinblue) HTTP API — sender: noreply@finalserveivor.com
- **Data**: Goalserve tennis API ($100/mo, trial started 18 Apr 2026)
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
- `GET /api/admin/api-diag` — data provider diagnostic info.

## Backups & branch safety (added 19 Apr, verified working)
- **Daily DB backup**: `.github/workflows/db-backup.yml` — pg_dump v17 at 03:00 UTC, gzipped, stored as GitHub Actions artifacts (30-day retention, auto-cleanup keeps latest 30). Manual trigger via Actions tab. `DATABASE_URL` GitHub secret set (public Railway connection string via `shortline.proxy.rlwy.net`). Verified end-to-end: run #3 succeeded (48s, artifact uploaded).
- **Branch protection**: `main` branch has force push and branch deletion blocked via GitHub API. Normal pushes still work.

## Deployment gotchas
- Every push to `main` auto-deploys to real users — treat every commit as production release
- mnt files can be stale if Mickey hasn't run `git pull` — always diff against GitHub HEAD before pushing from mnt
- React hooks violations have caused 3 white-screen incidents — always check no hooks after early returns
- Railway has no MCP — verify deploys by hitting `/api/health`
