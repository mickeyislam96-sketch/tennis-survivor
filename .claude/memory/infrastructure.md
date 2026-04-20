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
- PAT: issued 20 Apr 2026 (stored in Cowork auto-memory and session transcript)
- Push via /tmp clone (preferred) or GitHub Contents API

## API endpoints (notable)
- `POST /api/support` — contact form submissions. Rate limited (5/hr per IP). Sends email directly via Brevo to finalservivor@gmail.com (bypasses approval queue). Attaches user context (name, email, group memberships) if logged in.
- `POST /api/admin/withdrawal` — mark player withdrawal, unlock affected picks, send notification emails.
- `GET /api/admin/api-diag` — data provider diagnostic info.
- `GET /api/ops/summary?hours=24&Authorization: Bearer` — structured operations overview (tournament state, picks, emails, recent activity).
- `GET /api/ops/log?category=X&hours=48&Authorization: Bearer` — raw ops log with filters.
- `POST /api/ops/setup-tournament` — create tournament group with invite code, verify data provider.
- `GET /api/ops/health-deep?Authorization: Bearer` — deep health check (DB, ops_log table, data provider, email service, tournament config).

## Automation (deployed 19 Apr 2026)
- **15-min cron** in `index.js`: autoProcessResults → checkPickReminders → runOpsChecks → sendAdminDigest
- **runOpsChecks** runs: checkDrawRelease → checkWithdrawals → autoSetLockTimes
- **ops_log table**: persistent record of all automated actions (category, action, details JSONB, tournament_id)
- **Daily ops brief**: Cowork scheduled task `fsv-daily-ops-brief` at 8am — calls /api/ops/summary, checks /api/health, checks Vercel deploy status
- Key file: `backend/src/services/opsMonitor.js`

## Security (deployed 19 Apr 2026)
- **JWT authentication**: `backend/src/middleware/auth.js`. Tokens issued on login/register (7-day expiry). `requireAuth`/`optionalAuth` middleware. Dedicated `JWT_SECRET` env var.
- **CSRF protection**: double-submit cookie pattern. Backend sets `csrf` cookie, frontend sends `X-CSRF-Token` header. Middleware checks match on state-changing requests.
- **Helmet**: CSP, X-Frame-Options, HSTS, nosniff. Applied globally in `index.js`.
- **Vercel headers**: X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy in `vercel.json`.
- **Rate limiting**: auth (10 login/15min, 5 register/hr), admin/ops (20/min).
- **Admin auth**: `Authorization: Bearer <ADMIN_SECRET>` header (no more query params).
- **Frontend `authFetch()`**: in `AuthContext.jsx`, auto-attaches Authorization + X-CSRF-Token. All 9 pages use it.
- **Legacy fallback removed** (20 Apr): `x-user-id` header and `?userId` param no longer accepted. All auth via JWT only. Mobile app updated to send Bearer tokens (commit `83c71d1` in mobile repo).
- **Secrets**: `JWT_SECRET` and `ADMIN_SECRET` are separate env vars (both rotated 19 Apr). GitHub PAT rotated.

## Performance optimisations (20 Apr 2026)
- **Goalserve parallel fetch**: 3 endpoints (fixtures, draw, livescore) run via `Promise.allSettled`. Cold miss ~5s (was 10-17s sequential).
- **Promise deduplication**: `goalserveInflight` variable ensures concurrent callers share one fetch. Critical because page loads fire bracket + picks requests simultaneously.
- **5-min server-side cache**: `goalserveCache` in `dataAdapter.js`. Cached responses <1.2s.
- **CSS sprite sheet**: 169 player headshots in one 205KB WebP file (was 170 requests / 6.4MB). `playerManifest.json` checked in-memory — zero HTTP for missing players.
- **Vercel CDN**: All static assets (sprite, JS, CSS) served from edge. Frontend load is fast; backend API was the bottleneck.

## Deployment gotchas
- Every push to `main` auto-deploys to real users — treat every commit as production release
- mnt files can be stale if Mickey hasn't run `git pull` — always diff against GitHub HEAD before pushing from mnt
- React hooks violations have caused 3 white-screen incidents — always check no hooks after early returns
- Railway has no MCP — verify deploys by hitting `/api/health`
