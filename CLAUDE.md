# Final Serve-ivor — CTO Agent Context

> Last updated: 21 March 2026. Keep this file updated at the end of every session.

---

## What the product is

**Final Serve-ivor** is a tennis survivor fantasy game. Players join groups, pick one player per round, and are eliminated if their pick loses. Last survivor wins the prize pool. Built around major ATP draws. Current live tournament is **Miami Open 2026** (practice tournament — no competitive stakes yet, collecting feedback).

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
| `MIAMI_TOURNAMENT_KEY` | Tournament identifier for Miami Open |
| `SOFASCORE_BASE_URL` | Cloudflare proxy URL — `https://sofascore-proxy.finalservivor.workers.dev` |
| `NODE_ENV` | Runtime environment |

**WARNING:** If `TENNIS_API_KEY` is missing, the draw silently falls back to broken mock data with no visible error. After changing Railway env vars, you may need to manually trigger a restart via Railway dashboard or GraphQL API: `mutation deploymentRestart(id)` at `backboard.railway.app/graphql/v2`.

---

## CRITICAL: Git workflow

**NEVER use the mnt path for git operations.** The local workspace at `/sessions/exciting-determined-volta/mnt/tennis-survivor` has a stale `.git/index.lock` on a FUSE filesystem that cannot be deleted and blocks all git commands.

**ALWAYS clone fresh to `/tmp/tennis-survivor` and work from there:**

```bash
cd /tmp && git clone https://github.com/mickeyislam96-sketch/tennis-survivor.git
cd /tmp/tennis-survivor
# make edits, then:
git add <files>
git commit -m "..."
git push origin main
```

The mnt path can still be used for reading files, but all git operations must go through `/tmp/tennis-survivor`.

---

## Deployment verification checklist (run after every push)

1. Check Vercel deployment state via MCP (`list_deployments`) — wait for `state: READY`
2. Check Railway is building — watch Railway dashboard (no MCP; use browser)
3. Hit a live API endpoint to confirm backend changes: `GET https://tennis-survivor-production.up.railway.app/api/picks/available?userId=test&groupId=test&round=R32`
4. Navigate to live frontend to visually confirm changes: https://finalserveivor.com

---

## Round structure — Miami Open 2026

| App round | API-Tennis label | Description |
|---|---|---|
| R1 | ATP Miami - 1/64-finals | 32 matches between unseeded players (no seeds involved) |
| R64 | ATP Miami - 1/32-finals | 64 players — R1 winners + seeded players entering |
| R32 | ATP Miami - 1/16-finals | 32 players |
| R16 | ATP Miami - 1/8-finals | 16 players |
| QF | ATP Miami - Quarterfinals | 8 players |
| SF | ATP Miami - Semifinals | 4 players |
| F | ATP Miami - Final | 2 players |

**Key structural fact:** Seeded players (top 32) have R1 byes — they do not appear in any R1 fixtures. They first appear when their R64 match is scheduled. Some R64 matches have `round: null` in the API because the API hasn't assigned them yet — `normalizeRound()` returns null for these, so they may be missed.

---

## Pick window timing system

Defined in `backend/src/services/tennisData.js`:

**`LOCKTIME_OVERRIDES`** — hard overrides for lock time (takes precedence over everything):
```js
const LOCKTIME_OVERRIDES = {
  R1:  '2026-03-19T13:00:00Z',
  R32: '2026-03-22T18:00:00Z', // Sun 22 Mar, 2PM EDT / 18:00 UTC (1h before first match)
};
```

**`ROUND_DATES`** — no-API fallback (used when API-Tennis has no data):
```js
R32: '2026-03-22T19:00:00Z', // Sun 22 Mar, 3PM EDT / 19:00 UTC
```

**`ROUND_DATE_FALLBACK`** — API has data but no round times (use these):
```js
R32: '2026-03-22T19:00:00Z', // Sun 22 Mar, 3PM EDT / 19:00 UTC
```

**Important:** When adding future rounds (R16, QF, SF, F), get the actual first match time and add a `LOCKTIME_OVERRIDE` set to 1 hour before that. Do not rely on the fallback tables alone — they may be wrong.

---

## Key source files

### Backend

| File | What it does |
|---|---|
| `backend/src/services/tennisData.js` | Core data logic — `fetchApiDraw()`, `getDraw()`, `getDeadlines()`, `LOCKTIME_OVERRIDES`, `ROUND_DATES`, `ROUND_DATE_FALLBACK`, round normalisation, fallback chain |
| `backend/src/routes/picks.js` | Pick submission + `getAvailablePlayers()` — builds the pool of eligible players for a round, tags `pendingPrevRound` flag |
| `backend/src/routes/leaderboard.js` | Leaderboard data — returns `currentRoundPick` (player name or null), visibility controlled by `roundIsLocked` |
| `backend/src/routes/draw.js` | `/bracket` and `/debug` route handlers |
| `backend/src/routes/health.js` | Real production health check — validates env vars, live API call, DB ping |
| `backend/src/services/sofascoreAdapter.js` | Sofascore fetch — reads `SOFASCORE_BASE_URL` env var |
| `backend/src/data/miamiDraw.js` | Hardcoded mock draw — `buildMiamiMatches()` has a bug (see known issues) |

### Frontend

| File | What it does |
|---|---|
| `frontend/src/pages/PickScreen.jsx` | Pick flow — round tabs, countdown, player list, current pick card, pending-round banner, `pendingPrevRound` badges |
| `frontend/src/pages/Leaderboard.jsx` | Leaderboard — stats bar, 4-column table (Player / Status / Progress / Current Pick), pick history modal. Pick column shows "🔒 Hidden" during open window, player name after lock. |
| `frontend/src/pages/GroupHome.jsx` | Group dashboard — hero, pick CTA, nav cards, invite box |
| `frontend/src/pages/DrawViewer.jsx` | Draw viewer — bracket + list view |
| `frontend/src/pages/PickHistory.jsx` | User's pick history |
| `frontend/src/components/Layout.jsx` | Nav header, auth modal |
| `frontend/src/index.css` | All styles — see mobile section below |
| `frontend/src/components/Layout.css` | Header/nav/footer styles |
| `frontend/src/data/tournaments.js` | Tournament config (drawAvailable flag, entry dates, etc.) |

---

## Backend API endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/draw/bracket?round=F` | Full draw — rounds, players, match status |
| `GET /api/draw/rounds` | List of active rounds (e.g. `["R1","R64","R32",...]`) |
| `GET /api/draw/deadlines` | Lock times and open status for each round |
| `GET /api/draw/debug` | Raw fixture counts and field list — use to confirm API-Tennis is live |
| `GET /api/picks/available?userId=X&groupId=X&round=X` | Eligible players for a pick — includes `pendingPrevRound` flag |
| `POST /api/picks` | Submit a pick `{userId, groupId, round, playerId, playerName}` |
| `GET /api/picks/history?userId=X&groupId=X` | All picks for a user in a group |
| `GET /api/leaderboard/:groupId` | Full leaderboard with `currentRoundPick` and `roundIsLocked` |
| `GET /api/groups/:groupId` | Group details including members |
| `GET /api/health` | Health check — returns 500 if API key missing or API call fails |

---

## pendingPrevRound feature

When the current round's pick window opens while the previous round is still in progress (e.g. R32 window opens while R64 matches are still being played):

**Backend (`picks.js`):** `getAvailablePlayers()` computes a `pendingFromPrevRound` set of player IDs whose previous-round match has no winner yet. These players are tagged `pendingPrevRound: true` in the response. This is computed **before** the `roundMatches` check so it applies in both the main path (R32 draw published) and the fallback path (R32 draw not yet published).

**Frontend (`PickScreen.jsx`):**
- Player rows show an amber `⚠️ R64 result pending` badge next to the player name
- A banner at the top of the pick list warns the user: if they pick a pending player and that player loses their R64 match, the pick is voided and they are eliminated
- If the user has already made a current-round pick but their prev-round result is pending, a softer "you're covered" variant of the banner shows

**Known gap:** Some R64 matches have `round: null` in the raw API (about 6 matches as of 21 March). These players won't receive the `pendingPrevRound` badge. This is a known limitation of the API data — not yet fixed.

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

- All mobile rules use `@media (max-width: 680px)` — there are multiple blocks in `frontend/src/index.css`, consolidated mostly at the bottom
- `lb-table-wrap` has `overflow-x: auto` so the 4-column leaderboard table scrolls horizontally on mobile
- The leaderboard pick column (4th column) is **visible** on mobile — an older `display: none` rule was removed in the 21 March 2026 session
- `lb-stats-bar` uses `display: grid; grid-template-columns: repeat(2, 1fr)` on mobile (2×2 layout)
- `.picked-card-hint` is hidden on mobile (overflows the flex row)
- Page headers stack vertically on mobile
- Invite URL truncates with ellipsis on mobile
- Pick history modal is full-width on mobile

---

## Known issues

### 1. ~~R64 picks pool — only 18 players showing~~ — FIXED
Resolved in session 20 Mar: `getAvailablePlayers()` now includes R1 winners and seeded players who have R64 matches.

### 2. Bracket tab only shows R16 onwards — OPEN
Sofascore embed widget limitation. Fix: build custom bracket from API-Tennis data.

### 3. Mock draw fallback bug — LOW PRIORITY
`backend/src/data/miamiDraw.js` → `buildMiamiMatches()` uses `prevWinners.slice(0, count * 2)` which doesn't propagate winners — R32 through Final repeat the same pairings. Fix before next major tournament.

### 4. ~~No health check for API key~~ — FIXED
`backend/src/routes/health.js` added — validates env vars, makes live API call, pings DB.

### 5. API `round: null` gap — OPEN
~6 R64 matches in the API currently have `round: null`. `normalizeRound()` returns null so they are not detected as pending R64 matches — affected players don't get the `⚠️ R64 result pending` badge. Root cause: API hasn't assigned the round name yet for these fixtures.

### 6. Future round dates not verified — ACTION NEEDED
`ROUND_DATES` and `ROUND_DATE_FALLBACK` fallback dates for R16, QF, SF, F are estimates. Once confirmed, add a `LOCKTIME_OVERRIDE` for each round set to 1 hour before the first match.

---

## Current tournament state (as of 21 March 2026)

- Tournament: ATP Miami Open 2026
- Stage: R64 in progress, R32 window now open
- R32 first match: Sunday 22 March, 3PM EDT / 19:00 UTC
- R32 pick lock: Sunday 22 March, 2PM EDT / 18:00 UTC (hardcoded LOCKTIME_OVERRIDE)
- Pick window closes in: ~1d 7h from time of writing
- Participants: 8 users in test group `6da0f300-ff14-43cb-bcef-ad4ba6709208`
- Mode: Practice tournament — testing features, no prize money

---

## Session history

| Date | Summary |
|---|---|
| Prior sessions | Deployed Cloudflare Worker sofascore-proxy; accidentally removed TENNIS_API_KEY; restored key; confirmed 88–94 live fixtures returning; identified R64 picks pool bug; created CLAUDE.md. |
| 20 Mar 2026 | Fixed R64 picks pool — `getAvailablePlayers()` now builds pool from R1 winners + seeded players in R64. Added real health check endpoint (`health.js`). Extended bracket viewer to start at R64. Fixed `Countdown` ReferenceError crashing the app. Added leaderboard pick column (Hidden/player name) and pick history modal. Added urgency banner when pick window closes within 24h. Added survivor progress meter to GroupHome. Added leaderboard reveals picks after lock. |
| 21 Mar 2026 (session 1) | Fixed R32 pick window timing — corrected ROUND_DATES and ROUND_DATE_FALLBACK to Sun 22 Mar 19:00 UTC; added LOCKTIME_OVERRIDE for R32 at 18:00 UTC. Added `pendingPrevRound` feature — backend tags players with unresolved prev-round matches; frontend shows amber `⚠️ R64 result pending` badge on those players; added banner prompting user to make speculative pick. Fixed bug where `pendingPrevRound` was only computed in the main path — moved set computation before the `roundMatches` conditional so it works in the fallback path (when R32 draw not yet published). Generalised pending-round banner text to work for any round transition. |
| 21 Mar 2026 (session 2) | Comprehensive mobile layout improvements: removed `display:none` on leaderboard 4th column (Pick was invisible on mobile); fixed `lb-stats-bar` 2×2 grid (was setting `grid-template-columns` on a flex container — no effect; added `display:grid`); hid `.picked-card-hint` on mobile; stacked page headers vertically; fixed invite URL overflow; truncated long display names; made pick history modal full-width; tightened pending badges and button tap targets. |
