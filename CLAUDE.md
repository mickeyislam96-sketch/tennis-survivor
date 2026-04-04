# Final Serve-ivor — CTO Agent Context

> Last updated: 4 April 2026. Keep this file updated at the end of every session.

---

## What the product is

**Final Serve-ivor** is a tennis survivor fantasy game. Players join groups, pick one player per round, and are eliminated if their pick loses. Last survivor wins the prize pool. Built around major ATP draws. Current live tournament is **Monte Carlo 2026** (first competitive tournament — R1 starts Sun 5 April).

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

The mnt path (`/sessions/*/mnt/tennis-survivor`) is a FUSE/virtiofs filesystem. Git stash and commit are blocked by a persistent `.git/index.lock` that cannot be deleted from within the VM.

**Preferred approach — git plumbing (no index needed):**
Use `git hash-object`, `git mktree`, `git commit-tree`, and `git push` directly. This bypasses the index lock entirely and pushes straight to GitHub. See session 22 Mar 2026 for a worked example.

**Alternative — clone to /tmp:**
```bash
cd /tmp && git clone https://github.com/mickeyislam96-sketch/tennis-survivor.git
cd /tmp/tennis-survivor
# make edits, then:
git add <files>
git commit -m "..."
git push origin main
```

The mnt path is fine for reading files. The GitHub token is embedded in the remote URL and can be used for API calls or push auth.

**Mac-side:** The repo lives at `/Users/mikaeelislam/tennis-survivor`. The user can commit and push from their Mac terminal normally.

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
| `backend/src/data/monteCarloMockDraw.js` | Monte Carlo 56-player mock draw with 8 seed byes. Contains `API_KEY_MAP` mapping mock `mc-*` IDs to real API-Tennis player keys for H2H lookups. |
| `backend/src/routes/matchup.js` | H2H matchup endpoint — fetches player profiles + H2H from API-Tennis, 1h cache |
| `backend/src/config/tournaments/monte-carlo-2026.js` | Monte Carlo tournament config — dates, rounds, apiSeason, lock times |

### Frontend

| File | What it does |
|---|---|
| `frontend/src/pages/PickScreen.jsx` | Pick flow — round tabs, countdown, player list, current pick card, pending-round banner, `pendingPrevRound` badges |
| `frontend/src/pages/Leaderboard.jsx` | Leaderboard — stats bar, 4-column table (Player / Status / Progress / Current Pick), pick history modal. Pick column shows "🔒 Hidden" during open window, player name after lock. |
| `frontend/src/pages/GroupHome.jsx` | Group dashboard — hero, pick CTA, nav cards, invite box |
| `frontend/src/pages/DrawViewer.jsx` | Draw viewer — bracket + list view, matchup modal integration |
| `frontend/src/components/MatchupModal.jsx` | H2H modal — shows player stats, clay/overall record, previous meetings, recent form |
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
| `GET /api/matchup/:player1Key/:player2Key` | H2H data, player stats, and recent form for two players (1h cache) |
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

### 3. ~~Mock draw fallback bug~~ — FIXED (23 Mar 2026)
`buildMiamiMatches()` now places seeds as `player1` in R64 (so seeds win in mock) and propagates actual winners into `prevWinners` each round. R16/QF/SF/F now return the correct 16/8/4/2 player pools when the mock is used.

### 4. ~~No health check for API key~~ — FIXED
`backend/src/routes/health.js` added — validates env vars, makes live API call, pings DB.

### 5. ~~False `pendingPrevRound` badge on confirmed players~~ — FIXED (22 Mar)
Players already in the R32 draw (e.g. Jorda) were still showing the `⚠️ R64 result pending` badge because `pendingFromPrevRound` was built from all unresolved R64 matches before checking whether those players had already progressed. Fix: after building `playingThisRound` from current round fixtures, strip any confirmed player from `pendingFromPrevRound`.

### 6. API `round: null` gap — OPEN
~6 R64 matches in the API currently have `round: null`. `normalizeRound()` returns null so they are not detected as pending R64 matches — affected players don't get the `⚠️ R64 result pending` badge. Root cause: API hasn't assigned the round name yet for these fixtures.

### 7. Future round dates not verified — ACTION NEEDED
`ROUND_DATES` and `ROUND_DATE_FALLBACK` fallback dates for R16, QF, SF, F are estimates. Once confirmed, add a `LOCKTIME_OVERRIDE` for each round set to 1 hour before the first match.

### 8. ~~Mock group joins not persisting~~ — FIXED (25 Mar 2026)
Mock group joins (e.g. g3 for Monte Carlo) used `MOCK_MEMBERS.push()` — in-memory only, wiped on every Railway deploy. Fix: created a real PostgreSQL group via `POST /api/groups` API. The pools endpoint's `dbTournamentIds` filter automatically hides mock g3 when a real DB group exists for `monte-carlo-2026`. All future joins persist in PostgreSQL. Real group ID: `2d0d1477-0761-49c8-aaf7-d54ad466062f`.

### 9. ~~Non-members can submit picks~~ — FIXED (26 Mar 2026)
No group membership check on `POST /api/picks`. Anyone could submit picks to any group without joining. Fix: added `SELECT id FROM group_members` check before accepting picks. Returns 403 if not a member.

### 10. ~~Join endpoint returning 400 for already-joined users~~ — FIXED (26 Mar 2026)
`POST /api/groups/:id/join` returned `400 Already a member` which caused auto-join flows to show error messages. Fix: now returns `200` with existing member data.

### 11. ~~Invite box overflows on mobile~~ — FIXED (26 Mar 2026)
The invite URL + "Copy link" button were in a horizontal flex row. On mobile, the button was pushed off-screen forcing horizontal scroll. Fix: stacked vertically on mobile with full-width copy button.

### 12. No authentication on API endpoints — OPEN (pre-paid tournaments)
`userId` comes from request body with no server-side JWT/session verification. Any user can impersonate another by changing the userId param. Acceptable risk for 50-person free beta, must fix before paid tournaments.

### 13. Results processing has no transaction wrapping — OPEN (pre-paid tournaments)
If server crashes mid-processing, some players get marked survived and others don't. Needs `BEGIN/COMMIT` transaction. Low risk at beta scale.

### 14. No "draw is live" notification email — OPEN
When the draw drops and picks open, users who already joined have no way of knowing unless they check the site. Need to build a notification endpoint or scheduled task.

---

## Current tournament state (as of 4 April 2026)

### Miami Open 2026 (practice — ended)
- Tournament: ATP Miami Open 2026
- Stage: Complete — practice tournament finished
- Participants: 8 users in test group `6da0f300-ff14-43cb-bcef-ad4ba6709208`
- Mode: Practice tournament — no prize money
- Indian Wells test data removed from codebase (26 Mar)

### Monte Carlo 2026 (LIVE — first competitive tournament)
- Tournament: Rolex Monte-Carlo Masters 2026
- Status: `active` — draw published, R1 pick window open
- Real DB group: `2d0d1477-0761-49c8-aaf7-d54ad466062f` (PostgreSQL — persistent)
- Invite code: `MONTECAR-406R3X`
- Entry: Free
- R1 starts: Sun 5 Apr (lock time ~08:00 UTC)
- Members: 9+
- API-Tennis: `apiSeason` fixed from `'2025'` to `'2026'` (confirmed season 2026 returns MC fixtures, 2025 returns empty). Live draw auto-engages once R32+ matches appear in API. Mock draw has correct 56-draw structure with 8 seed byes and `API_KEY_MAP` for H2H lookups.
- Matchup modal: H2H modal on draw page — click any match to see player stats, head-to-head, recent form. Backend endpoint at `/api/matchup/:key1/:key2` with 1h cache.

### Outstanding actions
1. **Railway billing** — trial expires ~7 Apr. Upgrade to Hobby plan ($5/month) ASAP or backend dies mid-tournament
2. ~~**`MONTE_CARLO_TOURNAMENT_KEY`**~~ — set in Railway env vars (confirmed 3 Apr).
3. ~~**Lock time overrides**~~ — DONE (3 Apr). All rounds have `LOCKTIME_OVERRIDES` set.
4. ~~**Draw release deployment**~~ — DONE (3 Apr). `drawAvailable: true` + `status: 'active'` set.
5. ~~**OG image**~~ — DONE (25 Mar session 3).
6. ~~**Custom bracket viewer**~~ — DONE (3 Apr). Built from static mock draw with correct 56-draw structure, 8 seed byes, matchOrder sorting.
7. ~~**apiSeason fix**~~ — DONE (4 Apr). Changed from `'2025'` to `'2026'`.
8. ~~**Matchup H2H modal**~~ — DONE (4 Apr). Backend endpoint + React component + CSS + draw page integration.
9. **SPF/DKIM for Brevo** — set up domain authentication for `finalserveivor.com` in Brevo before paid tournaments.
10. **Transactional emails (pick reminder, survival, elimination, winner)** — HTML templates designed and approved but REVERTED from production (3 Apr). Need: `emails_sent` tracking table for deduplication, dry-run testing mode, proper integration testing before re-deploying. Code saved in git history (commit `c7a16d1`).

---

## Session history

| Date | Summary |
|---|---|
| Prior sessions | Deployed Cloudflare Worker sofascore-proxy; accidentally removed TENNIS_API_KEY; restored key; confirmed 88–94 live fixtures returning; identified R64 picks pool bug; created CLAUDE.md. |
| 20 Mar 2026 | Fixed R64 picks pool — `getAvailablePlayers()` now builds pool from R1 winners + seeded players in R64. Added real health check endpoint (`health.js`). Extended bracket viewer to start at R64. Fixed `Countdown` ReferenceError crashing the app. Added leaderboard pick column (Hidden/player name) and pick history modal. Added urgency banner when pick window closes within 24h. Added survivor progress meter to GroupHome. Added leaderboard reveals picks after lock. |
| 21 Mar 2026 (session 1) | Fixed R32 pick window timing — corrected ROUND_DATES and ROUND_DATE_FALLBACK to Sun 22 Mar 19:00 UTC; added LOCKTIME_OVERRIDE for R32 at 18:00 UTC. Added `pendingPrevRound` feature — backend tags players with unresolved prev-round matches; frontend shows amber `⚠️ R64 result pending` badge on those players; added banner prompting user to make speculative pick. Fixed bug where `pendingPrevRound` was only computed in the main path — moved set computation before the `roundMatches` conditional so it works in the fallback path (when R32 draw not yet published). Generalised pending-round banner text to work for any round transition. |
| 21 Mar 2026 (session 2) | Comprehensive mobile layout improvements: removed `display:none` on leaderboard 4th column (Pick was invisible on mobile); fixed `lb-stats-bar` 2×2 grid (was setting `grid-template-columns` on a flex container — no effect; added `display:grid`); hid `.picked-card-hint` on mobile; stacked page headers vertically; fixed invite URL overflow; truncated long display names; made pick history modal full-width; tightened pending badges and button tap targets. |
| 22 Mar 2026 | Fixed R32 ghost player bug — 33 players showing instead of 32. Root cause: `getAvailablePlayers()` in `picks.js` speculatively added both players from pending R64 matches, but Musetti (withdrew) and Jorda's R64 opponent were added despite the match being effectively settled. Fix: skip speculative addition when one player is already confirmed in the current round's match data. Second fix: Jorda was still showing `⚠️ R64 result pending` badge — `pendingFromPrevRound` was built from all unresolved R64 matches before confirming progression; fix strips confirmed-in-current-round players from the pending set. Both deployed via git plumbing (index.lock workaround). Mac repo resynced — was 31 commits behind, stale lock files removed. Mac repo path: `/Users/mikaeelislam/tennis-survivor`. |
| 23 Mar 2026 | Fixed R16 (and QF/SF/F) pick pool returning 0 players. Root cause: live API (API-Tennis) is returning 0 fixtures for the March 16–30 range (health check shows `TOURNAMENT_KEY` present but only 1 fixture for narrow range — likely wrong key or rate limit), so mock fallback is used. Mock had a bug: R1 qualifiers were `player1` in R64 matches, so all 32 seeds were marked `roundEliminated: 'R64'`. R16 mock matches referenced those seeds, leaving zero eligible players. Fix 1: swapped R64 player order so seeds are `player1` (and win). Fix 2: `prevWinners` now propagates actual match winners forward rather than slicing the original list. Fix 3: added safety net in `getAvailablePlayers` — if main path yields 0 players, falls through to the non-round-filtered fallback. **Action needed: verify `MIAMI_TOURNAMENT_KEY` is correctly set in Railway env vars** — the live API returning only 1 fixture for a narrow test range suggests the tournament key may be wrong or the account is rate-limited. |
| 25 Mar 2026 (session 1) | Added Monte Carlo "Coming Soon" card to landing page (mock g3 in mockGroups.js). Verified admin endpoints work (auth uses `?secret=` query param, not header). Updated CLAUDE.md admin auth docs. |
| 25 Mar 2026 (session 2) | Landing page design improvements: added OG meta tags + Twitter card to `frontend/index.html`; created `frontend/public/favicon.svg` (green tennis ball); added hero CTA button "Enter Monte Carlo free →" for non-members in GroupHome.jsx; added social proof "X already registered" badge on upcoming pool cards; updated hero copy. **Critical bug fix:** mock group joins (g3) were stored in-memory only (`MOCK_MEMBERS.push()`), wiped on every Railway deploy. Fix: created real PostgreSQL group `2d0d1477-0761-49c8-aaf7-d54ad466062f` for Monte Carlo via API call. Pools endpoint auto-filters mock g3 via `dbTournamentIds` Set. All joins now persist in PostgreSQL. Verified hero CTA links to real DB group and group page loads correctly. **Still needed:** `og-image.png` (1200×630) for social sharing previews; invite code cosmetic fix ("POO" truncation). |
| 25 Mar 2026 (session 3) | **Pre-launch audit + fixes.** Three commits pushed: (1) `8b95785` critical security fixes — CORS restricted to specific origins, password reset URL fixed, admin hardcoded secret removed, `eliminateNonPickers` safety guard added; (2) `2824af0` comprehensive fixes — leaderboard mock fallback ternary fix, auto-join after registration, OG image created, invite code generator fixed, rate limiting on auth endpoints; (3) `274cd59` emergency CORS fix — added `www.finalserveivor.com` to allowed origins (site was broken because domain redirects to www). Verified site fully working. Set `ADMIN_SECRET` and `FRONTEND_URL` env vars in Railway. Regenerated Monte Carlo invite code to `MONTECAR-406R3X`. Verified Brevo email delivery working (2-3 min delay, acceptable). Created `FSV_Service_Infrastructure_Map.xlsx` with full service audit, scaling limits, cost projections. Agreed plan: replace Sofascore bracket widget with custom bracket seeded from static draw for Monte Carlo (~4 Apr session). |
| 3 Apr 2026 | **Go-live session for Monte Carlo.** Activated tournament (status, schedule, lock times for all rounds). Built custom 56-draw bracket with 8 seed byes and matchOrder sorting. Fixed R1 start date (Sun 5 Apr, not Mon 6 Apr). Fixed bracket showing checkmarks on TBD matches (null===null bug). Fixed mock draw projecting results into future rounds. Removed Qualifier placeholders from pick pool (41 real players). Fixed hero CTA for existing members. Fixed leaderboard colSpan for empty state. Updated join page copy (removed beta language). Fixed email.js syntax error crashing Railway. Fixed Railway healthcheck timeout (server now starts before DB init). Fixed R32 bracket pairings with explicit seed mapping. Added tournament key fallback '1970'. **Email system:** designed 4 transactional emails (pick reminder, survival with growing pick history, elimination, winner), got approval, built and deployed — then REVERTED because code had no deduplication/email tracking (would send duplicates every cron cycle). Rolled back to safe state: only welcome, password reset, and tournament join emails active. **Mobile:** improved touch targets (44px min-height on buttons, player rows, round tabs), fixed search input overflow. Verified all pages load correctly via Chrome. 11 commits pushed. |
| 4 Apr 2026 (session 2) | **Matchup modal fix + API key verification.** Root cause of modal showing no data: mock draw uses `mc-*` fake IDs which API-Tennis doesn't recognise. Fix: added `API_KEY_MAP` to `monteCarloMockDraw.js` mapping all 50+ mock IDs to verified real API-Tennis player keys. Injected `player1ApiKey`/`player2ApiKey` into every match object via post-processing in `buildMonteCarloMatches()`. Updated `DrawViewer.jsx` to pass `player1ApiKey \|\| player1Id` to the modal (live data path already uses real keys as player1Id). Verified all 8 seed keys + 6 corrected non-seed keys via `get_players` API: Alcaraz=2382, Sinner=2072, Zverev=1980, Musetti=2849, de Minaur=1106, FAA=2073, Medvedev=1093, Bublik=1895, Lehecka=2959, Berrettini=2844, Cobolli=372, Cilic=2167, Moutet=2674, Mpetshi Perricard=9222. **Critical fix:** `apiSeason` in `monte-carlo-2026.js` changed from `'2025'` to `'2026'` — season 2025 returns 0 fixtures for MC 2026 dates. Updated CLAUDE.md. |
| 4 Apr 2026 (session 1) | **Matchup modal backend + frontend build.** Built H2H matchup endpoint (`/api/matchup/:key1/:key2`) with 1h cache, player profile stats, recent form. Built `MatchupModal.jsx` React component with score formatting (API decimal tiebreak notation), loading/error states, escape/backdrop close. Integrated into `DrawViewer.jsx` with clickable match cards. Added ~200 lines of `.mu-*` CSS with mobile bottom-sheet. Fixed TypeError crash (safe defaults for missing stats). Pushed to GitHub — auto-deployed to Vercel + Railway. Updated matchup modal prototype HTML with real live data. |
| 26 Mar 2026 | **Comprehensive backend audit + hardening.** Full code audit of all backend routes found 20 issues. Commits pushed: (1) `eb24252` auto-join fix — users registering via header auth modal now auto-join pre-launch groups; (2) `e64307c` hardening — group membership check on picks (was missing), double-submit guard on pick button, join endpoint returns 200 for already-joined users, `betaFree` flag exposed on group endpoints; (3) `adf796e` Indian Wells test data cleanup; (4) `38820f2` email copy fix — "Group" → "Pool" in tournament join email, context-aware CTA button ("See who's joined" pre-launch / "Make your first pick" when draw live); (5) `ca011be` mobile invite box fix — stacked URL + copy button vertically (was overflowing off-screen); (6) `28bc9fe` homepage copy overhaul — hero eyebrow generalised from "ATP Masters 1000 · Survivor fantasy" to "Tennis Survivor"; How It Works step 2 now explains no-reuse rule and strategy; step 3 clearer elimination language; footer tagline changed to "Outsmart. Outlast. Win."; all meta tags (title, OG, Twitter, manifest) updated to remove ATP-specific references. Email mockups generated for all 3 templates (welcome, tournament join, password reset). Identified future issues: no auth on API (issue #12), no transaction wrapping on results (issue #13), no "draw is live" notification email (issue #14). |
