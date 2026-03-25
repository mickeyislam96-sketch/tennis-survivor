# Final Serve-ivor — CTO Agent Context

> Last updated: 25 March 2026 (session 2). Keep this file updated at the end of every session.

---

## What the product is

**Final Serve-ivor** is a tennis survivor fantasy game. Players join groups, pick one player per round, and are eliminated if their pick loses. Last survivor wins the prize pool. Built around major ATP draws. Miami Open 2026 was the practice tournament (completed). **Next: Rolex Monte-Carlo Masters 2026** — free launch targeting ~50 users, ~1 week away.

---

## Live URLs

| Service | URL |
|---|---|
| Frontend (production) | https://finalserveivor.com |
| Frontend (Vercel alias) | https://tennis-survivor.vercel.app |
| Backend API | https://tennis-survivor-production.up.railway.app |
| Sofascore proxy (inactive) | https://sofascore-proxy.finalservivor.workers.dev |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite, deployed on Vercel (auto-deploys from GitHub `main`) |
| Backend | Node.js / Express, deployed on Railway (auto-deploys from GitHub `main`) |
| Source control | GitHub — `mickeyislam96-sketch/tennis-survivor` |
| Primary data | API-Tennis (paid) — live fixtures and results |
| Secondary data | Sofascore (free) — currently 403-blocked on all cloud IPs |
| Proxy | Cloudflare Workers (deployed but inactive) |
| Storage | Railway volume (persistent — picks, groups, members) |

---

## Infrastructure reference

| Item | Value |
|---|---|
| Railway Project ID | `0ec066c7-c7e1-4abf-8897-3577208c64cd` |
| Railway Service ID | `df618c7b-3678-4595-aaf7-3ff2f0e86d72` |
| Railway Environment ID | `148fec0e-b919-423b-93d7-1487cdaa82d4` |
| Deploy region | europe-west4 (Netherlands) |
| Vercel Project ID | `prj_HBePdqF7BaXq1qzw7bxu9prRhtyf` |
| Vercel Team ID | `team_ekuiNPY7cIyY2ieq41oWMYvO` |

---

## Key environment variables (Railway)

| Variable | Purpose |
|---|---|
| `TENNIS_API_KEY` | API-Tennis auth key — **critical, never remove** |
| `ACTIVE_TOURNAMENT` | Which tournament is live — `'miami-2026'` or `'monte-carlo-2026'`. Defaults to `'monte-carlo-2026'` if not set. |
| `ADMIN_SECRET` | Auth token for `/api/admin/*` endpoints — set a strong secret, never commit it |
| `MIAMI_TOURNAMENT_KEY` | API-Tennis tournament identifier for Miami Open |
| `MONTE_CARLO_TOURNAMENT_KEY` | API-Tennis tournament identifier for Monte Carlo — set when Mickey obtains it |
| `SOFASCORE_BASE_URL` | Cloudflare proxy URL — `https://sofascore-proxy.finalservivor.workers.dev` |
| `NODE_ENV` | Runtime environment |

**WARNING:** If `TENNIS_API_KEY` is missing, the draw silently falls back to broken mock data with no visible error. After changing Railway env vars, you may need to manually trigger a restart via Railway dashboard or GraphQL API: `mutation deploymentRestart(id)` at `backboard.railway.app/graphql/v2`.

**Action needed for Monte Carlo launch:**
1. Set `ACTIVE_TOURNAMENT=monte-carlo-2026` in Railway
2. Set `ADMIN_SECRET=<new strong value>` (replaces hardcoded default)
3. Set `MONTE_CARLO_TOURNAMENT_KEY=<key from API-Tennis>` once obtained

---

## CRITICAL: Git workflow

The mnt path (`/sessions/*/mnt/tennis-survivor`) is a FUSE/virtiofs filesystem. Git stash and commit are blocked by a persistent `.git/index.lock` that cannot be deleted from within the VM.

**Preferred approach — clone to /tmp:**
```bash
cd /tmp && git clone https://github.com/mickeyislam96-sketch/tennis-survivor.git
cd /tmp/tennis-survivor
# make edits, then:
git add <files>
git commit -m "..."
git push origin main
```

**Alternative — git plumbing (no index needed):**
Use `git hash-object`, `git mktree`, `git commit-tree`, and `git push` directly. This bypasses the index lock entirely. See session 22 Mar 2026 for a worked example.

The mnt path is fine for reading files. The GitHub token is embedded in the remote URL and can be used for API calls or push auth.

**Mac-side:** The repo lives at `/Users/mikaeelislam/tennis-survivor`. The user can commit and push from their Mac terminal normally.

---

## Deployment verification checklist (run after every push)

1. Check Vercel deployment state via MCP (`list_deployments`) — wait for `state: READY`
2. Check Railway is building — watch Railway dashboard (no MCP; use browser)
3. Hit a live API endpoint to confirm backend changes: `GET https://tennis-survivor-production.up.railway.app/api/health`
4. Navigate to live frontend to visually confirm changes: https://finalserveivor.com

---

## Tournament architecture (as of 25 Mar 2026)

Tournaments are defined in `backend/src/config/tournaments/`. The active tournament is selected via the `ACTIVE_TOURNAMENT` env var. All backend services read from `TOURNAMENT` (imported from `backend/src/config/tournament.js`) — no Miami-specific hardcoding anywhere.

Each tournament config object contains: `id`, `name`, `apiTournamentKey`, `drawSize`, `seedsWithByes`, `rounds`, `matchesPerRound`, `apiDateStart/Stop/Season`, `lockTimeOverrides`, `roundDates`, `roundDateFallback`, `roundNameOverrides`.

### Round structure — Miami Open 2026 (completed)

| App round | API-Tennis label | Description |
|---|---|---|
| R1 | ATP Miami - 1/64-finals | 32 matches between unseeded players |
| R64 | ATP Miami - 1/32-finals | 64 players — R1 winners + seeded players entering |
| R32 | ATP Miami - 1/16-finals | 32 players |
| R16 | ATP Miami - 1/8-finals | 16 players |
| QF | ATP Miami - Quarterfinals | 8 players |
| SF | ATP Miami - Semifinals | 4 players |
| F | ATP Miami - Final | 2 players |

### Round structure — Monte Carlo 2026 (upcoming)

| App round | API-Tennis label (estimated) | Description |
|---|---|---|
| R1 | ATP Monte-Carlo - 1/32-finals | 24 matches — non-seeded players (48 players fight for 24 R32 spots) |
| R32 | ATP Monte-Carlo - 1/16-finals | 32 players — 24 R1 winners + 8 seeded byes |
| R16 | ATP Monte-Carlo - 1/8-finals | 16 players |
| QF | ATP Monte-Carlo - 1/4-finals | 8 players |
| SF | ATP Monte-Carlo - 1/2-finals | 4 players |
| F | ATP Monte-Carlo - Final | 2 players |

**Key structural facts:**
- Monte Carlo has NO R64 layer. Top 8 seeds enter directly at R32.
- 56-player draw: 8 seeds (byes) + 48 non-seeds. R1 = 24 matches.
- `matchesPerRound = { R1: 24, R32: 16, R16: 8, QF: 4, SF: 2, F: 1 }`
- Round name overrides in `monte-carlo-2026.js` are estimates — **verify against `/api/draw/debug` once MONTE_CARLO_TOURNAMENT_KEY is set.**

---

## Pick window timing system

Defined per-tournament in each config file (`lockTimeOverrides`, `roundDates`, `roundDateFallback`).

**Override precedence (highest to lowest):**
1. `runtimeLockOverrides` — set at runtime via `POST /api/admin/set-lock-override` (survives until restart)
2. `TOURNAMENT.lockTimeOverrides` — hardcoded per-tournament in the config file
3. API first-match time minus 1 hour — derived from live fixture data
4. `TOURNAMENT.roundDateFallback` date minus 1 hour — used when API has fixtures but no times
5. `TOURNAMENT.roundDates` minus 1 hour — used when API has no data at all

**Important:** Always add a `lockTimeOverride` for each round set to 1 hour before the confirmed first match. Never rely on fallback tables alone — they may be wrong.

**Monte Carlo lock times (current estimates — update once schedule is confirmed):**
```js
R1:  '2026-04-06T09:00:00Z'  // ~1h before 10am local (UTC+2 in April)
R32: '2026-04-07T09:00:00Z'  // estimate — update once confirmed
// R16, QF, SF, F: add once schedule published (typically 1-2 days before tournament)
```

---

## Key source files

### Backend

| File | What it does |
|---|---|
| `backend/src/config/tournament.js` | Active tournament dispatcher — reads `ACTIVE_TOURNAMENT` env var, exports `TOURNAMENT`, `ROUNDS`, `MATCHES_PER_ROUND` |
| `backend/src/config/tournaments/miami-2026.js` | Miami Open 2026 config |
| `backend/src/config/tournaments/monte-carlo-2026.js` | Monte Carlo 2026 config — verify round name overrides once key is active |
| `backend/src/services/tennisData.js` | Core data logic — `fetchApiDraw()`, `getDraw()`, `getDeadlines()`, in-memory cache (2-min TTL), 3-attempt retry, stale fallback, `runtimeLockOverrides`, `invalidateCache()`, `getCacheStatus()` |
| `backend/src/routes/picks.js` | Pick submission + `getAvailablePlayers()` — builds the pool of eligible players for a round, tags `pendingPrevRound` flag |
| `backend/src/routes/leaderboard.js` | Leaderboard data — returns `currentRoundPick` (player name or null), visibility controlled by `roundIsLocked` |
| `backend/src/routes/draw.js` | `/bracket` and `/debug` route handlers |
| `backend/src/routes/admin.js` | Admin endpoints — process-results, set/clear lock override, invalidate-cache, eliminate-non-pickers, status, picks by group |
| `backend/src/routes/health.js` | Production health check — validates env vars, live API call, DB ping, cache status |
| `backend/src/services/sofascoreAdapter.js` | Sofascore fetch — reads `SOFASCORE_BASE_URL` env var |
| `backend/src/data/mockDraw.js` | Dispatcher — routes to correct tournament mock based on `TOURNAMENT.id` |
| `backend/src/data/miamiDraw.js` | Miami mock draw (corrected — seeds win R64, winners propagate correctly) |
| `backend/src/data/monteCarloMockDraw.js` | Monte Carlo mock draw — 8 seeds + 48 non-seeds, correct R1/R32/R16/QF/SF/F structure |
| `backend/src/data/mockGroups.js` | Mock pool entries for landing page — g1 (Indian Wells, demo), g2 (Miami, completed), g3 (Monte Carlo, upcoming "Coming soon" card) |
| `backend/src/services/resultsProcessor.js` | Results grading — `processRoundResults()` grades picks; `autoProcessResults()` calls `eliminateNonPickers()` only when window is confirmed locked |

### Frontend

| File | What it does |
|---|---|
| `frontend/src/pages/PickScreen.jsx` | Pick flow — round tabs, countdown, player list, current pick card, pending-round banner, `pendingPrevRound` badges |
| `frontend/src/pages/Leaderboard.jsx` | Leaderboard — stats bar, 4-column table (Player / Status / Progress / Current Pick), pick history modal |
| `frontend/src/pages/GroupHome.jsx` | Group dashboard — hero, pick CTA, nav cards, invite box |
| `frontend/src/pages/DrawViewer.jsx` | Draw viewer — fully dynamic bracket + list view (no hardcoded round/count structures) |
| `frontend/src/pages/PickHistory.jsx` | User's pick history |
| `frontend/src/components/Layout.jsx` | Nav header, auth modal |
| `frontend/src/index.css` | All styles — see mobile section below |
| `frontend/src/components/Layout.css` | Header/nav/footer styles |
| `frontend/src/data/tournaments.js` | Frontend tournament config — `drawAvailable` flag, status ('active'/'upcoming'/'completed') |
| `backend/src/data/tournaments.js` | Backend tournament list — same flags, used by group creation |

---

## Backend API endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/draw/bracket?round=F` | Full draw — rounds, players, match status |
| `GET /api/draw/rounds` | List of active rounds (e.g. `["R1","R32","R16",...]`) |
| `GET /api/draw/deadlines` | Lock times and open status for each round |
| `GET /api/draw/debug` | Raw fixture counts and field list — use to confirm API-Tennis is live and check round name labels |
| `GET /api/picks/available?userId=X&groupId=X&round=X` | Eligible players for a pick — includes `pendingPrevRound` flag |
| `POST /api/picks` | Submit a pick `{userId, groupId, round, playerId, playerName}` |
| `GET /api/picks/history?userId=X&groupId=X` | All picks for a user in a group |
| `GET /api/leaderboard/:groupId` | Full leaderboard with `currentRoundPick` and `roundIsLocked` |
| `GET /api/groups/:groupId` | Group details including members |
| `GET /api/health` | Health check — returns 500 if API key missing or API call fails |
| `POST /api/admin/process-results` | Manually trigger results processing for a round |
| `POST /api/admin/set-lock-override` | Override lock time for a round at runtime `{round, lockTime}` |
| `POST /api/admin/clear-lock-override` | Remove a runtime lock override `{round}` |
| `POST /api/admin/invalidate-cache` | Force-clear the API data cache |
| `POST /api/admin/eliminate-non-pickers` | Manually eliminate non-pickers for a round (use only after window is confirmed locked) |
| `GET /api/admin/status` | Admin status — cache info, runtime overrides, tournament config |
| `GET /api/admin/picks/:groupId` | All picks for a group (admin view, unredacted) |

All `/api/admin/*` routes require `?secret=<ADMIN_SECRET>` as a query param (GET) or `{ secret: "..." }` in the request body (POST). **Not** a header — the code checks `req.body?.secret || req.query?.secret`.

---

## pendingPrevRound feature

When the current round's pick window opens while the previous round is still in progress:

**Backend (`picks.js`):** `getAvailablePlayers()` computes a `pendingFromPrevRound` set of player IDs whose previous-round match has no winner yet. These players are tagged `pendingPrevRound: true` in the response. Computed before the `roundMatches` check so it applies in both the main path and the fallback path.

**Frontend (`PickScreen.jsx`):**
- Player rows show an amber `⚠️ [prev round] result pending` badge next to the player name
- A banner at the top of the pick list warns the user: if they pick a pending player and that player loses their prev-round match, the pick is voided and they are eliminated
- If the user has already made a current-round pick but their prev-round result is pending, a softer "you're covered" variant of the banner shows

**Known gap:** Matches with `round: null` in the raw API won't be detected as pending. Root cause: API hasn't assigned the round name yet for those fixtures.

---

## Leaderboard pick column

The leaderboard has 4 columns: Player / Status / Progress / [Round] Pick.

Pick column behaviour:
- **During open window** (`roundIsLocked = false`): shows `🔒 Hidden` — picks are private
- **After lock** (`roundIsLocked = true`): shows the player's name (green if alive, red if eliminated, `—` if no pick made)

`roundIsLocked` is determined by `getDeadlines()` in the backend and passed in the leaderboard response.

---

## Mobile layout

The site is mobile-optimised for 390px+ (iPhone size). Key CSS notes:

- All mobile rules use `@media (max-width: 680px)` — multiple blocks in `frontend/src/index.css`, consolidated mostly at the bottom
- `lb-table-wrap` has `overflow-x: auto` so the 4-column leaderboard table scrolls horizontally on mobile
- The leaderboard pick column (4th column) is **visible** on mobile
- `lb-stats-bar` uses `display: grid; grid-template-columns: repeat(2, 1fr)` on mobile (2×2 layout)
- `.picked-card-hint` is hidden on mobile (overflows the flex row)
- Page headers stack vertically on mobile
- Invite URL truncates with ellipsis on mobile
- Pick history modal is full-width on mobile

---

## Known issues

### 1. ~~R64 picks pool — only 18 players showing~~ — FIXED (20 Mar)

### 2. ~~Bracket tab only shows R16 onwards~~ — FIXED (25 Mar)
DrawViewer.jsx is now fully dynamic — no hardcoded round structures. Builds bracket from API data for any tournament. Removed Sofascore iframe.

### 3. ~~Mock draw fallback bug~~ — FIXED (23 Mar)
`buildMiamiMatches()` now places seeds as `player1` in R64 (seeds win in mock) and propagates actual winners forward. New Monte Carlo mock (`monteCarloMockDraw.js`) built from scratch with correct structure.

### 4. ~~No health check for API key~~ — FIXED (20 Mar)

### 5. ~~False `pendingPrevRound` badge on confirmed players~~ — FIXED (22 Mar)

### 6. API `round: null` gap — OPEN
Matches with `round: null` in the raw API are not detected as pending. Root cause: API data lag. Low impact, cosmetic only.

### 7. ~~eliminateNonPickers fires during open window~~ — FIXED (25 Mar)
`eliminateNonPickers()` now only runs when `roundDeadline.isLocked === true`. Previously it fired as soon as any match completed.

### 8. ~~Leaderboard R1 pick visibility~~ — FIXED (25 Mar)
`opensAt` is null for R1 (always open from start). Old check `opensAt && now >= opensAt` always returned false, so R1 picks were exposed immediately. Fixed to use `d.isOpen && !d.isLocked`.

### 9. Monte Carlo round name overrides — VERIFY BEFORE LAUNCH
`roundNameOverrides` in `monte-carlo-2026.js` are estimates. Hit `/api/draw/debug` once `MONTE_CARLO_TOURNAMENT_KEY` is set and update accordingly.

### 10. Monte Carlo lock times for R16+ — ACTION NEEDED
`lockTimeOverrides` for R16, QF, SF, F are not yet set. Add once the official schedule is published (typically 1-2 days before tournament).

---

## Current tournament state (as of 25 March 2026)

- Miami Open 2026: **COMPLETED** — practice tournament, all users eliminated
- Next tournament: **Rolex Monte-Carlo Masters 2026** (6–13 April 2026)
- Draw release: ~4 April 2026
- Target launch date: ~2 April 2026 (4+ days before play begins)
- `ACTIVE_TOURNAMENT=monte-carlo-2026` — **confirmed set in Railway**
- `ADMIN_SECRET=fsv-mc26-9d4e7f2a1b8c3065` — **confirmed set in Railway** (use `?secret=` query param)
- `MONTE_CARLO_TOURNAMENT_KEY` — **NOT YET SET** — obtain from API-Tennis ~4 April
- `drawAvailable: false` for Monte Carlo in both `tournaments.js` files — users will see "Draw TBC" until the draw drops
- DB state: 8 users, 1 group, 13 picks (all from Miami practice), 0 alive
- Landing page: "Coming soon" Monte Carlo card live and confirmed ✓

**Remaining actions before launch (~2 April):**
1. Upgrade Railway plan to Hobby ($5/month) before 6 April — trial expires mid-tournament otherwise ⚠️ PAYMENT REQUIRED BY MICKEY
2. Share link with test users (can join Monte Carlo pool now via "Enter free →" on landing page)
3. Add `MONTE_CARLO_TOURNAMENT_KEY` to Railway once obtained from API-Tennis (~4 April)
4. Verify API round names via `/api/draw/debug` once key is set — update `roundNameOverrides` in `monte-carlo-2026.js` if needed
5. Update `lockTimeOverrides` for R16, QF, SF, F once the official schedule is published (typically 1-2 days before tournament)
6. Set `drawAvailable: true` + `status: 'active'` in both `frontend/src/data/tournaments.js` and `backend/src/data/tournaments.js` when draw releases (~4 April), then push and deploy

---

## Session history

| Date | Summary |
|---|---|
| Prior sessions | Deployed Cloudflare Worker sofascore-proxy; accidentally removed TENNIS_API_KEY; restored key; confirmed 88–94 live fixtures returning; identified R64 picks pool bug; created CLAUDE.md. |
| 20 Mar 2026 | Fixed R64 picks pool. Added real health check. Extended bracket viewer to R64. Fixed Countdown ReferenceError. Added leaderboard pick column (Hidden/player name) and pick history modal. Added urgency banner. Added survivor progress meter to GroupHome. |
| 21 Mar 2026 (session 1) | Fixed R32 pick window timing. Added `pendingPrevRound` feature — backend tags players with unresolved prev-round matches; frontend shows amber badge. Fixed pendingPrevRound fallback path. Generalised pending-round banner. |
| 21 Mar 2026 (session 2) | Comprehensive mobile layout improvements: leaderboard 4th column now visible; lb-stats-bar 2×2 grid fixed; page headers stack vertically; invite URL overflow fixed; pick history modal full-width. |
| 22 Mar 2026 | Fixed R32 ghost player bug (33 instead of 32). Fixed false pendingPrevRound badge on confirmed players. Both fixes deployed via git plumbing. Mac repo resynced (was 31 commits behind). |
| 23 Mar 2026 | Fixed R16 (and QF/SF/F) pick pool returning 0 players. Root cause: mock draw had seeds losing in R64. Fixed seed order in miamiDraw.js, added winner propagation. Added safety net in picks.js. |
| 25 Mar 2026 (session 1) | **Major production overhaul for Monte Carlo launch.** Tournament-agnostic architecture: `ACTIVE_TOURNAMENT` env var, per-tournament config objects (miami-2026, monte-carlo-2026), mockDraw.js dispatcher, monteCarloMockDraw.js. Full rewrite of tennisData.js: 2-min cache with thundering herd protection, 3-attempt retry, stale fallback, runtime lock overrides, tournament-agnostic deadlines. Admin router (admin.js) with 7 endpoints for manual control. Fixed critical `eliminateNonPickers` bug (was firing during open window). Fixed leaderboard R1 pick visibility. DrawViewer.jsx fully dynamic (no hardcoded round structures, Sofascore iframe removed). Both tournaments.js files updated. Deployed via /tmp clone. Vercel confirmed READY. Railway env vars set: `ACTIVE_TOURNAMENT=monte-carlo-2026`, `ADMIN_SECRET=fsv-mc26-9d4e7f2a1b8c3065`. |
| 25 Mar 2026 (session 2) | Added Monte Carlo "Coming soon" pool card to landing page — `mockGroups.js` g3 entry with `tournamentId: 'monte-carlo-2026'`. Deployed, confirmed live. Group page (`/group/g3`) renders correctly: "Registration open", draw date Apr 4, "Tournament begins Mon 6 Apr", "Join free →". Fixed CLAUDE.md admin auth docs (uses `?secret=` query param, not Authorization header). Confirmed admin endpoint working with correct secret. |
