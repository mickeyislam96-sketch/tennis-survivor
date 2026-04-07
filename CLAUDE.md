# Final Serve-ivor — CTO Agent Context

> Last updated: 7 April 2026. Keep this file updated at the end of every session.

---

## What the product is

**Final Serve-ivor** is a tennis survivor fantasy game. Players join groups, pick one player per round, and are eliminated if their pick loses. Last survivor wins the prize pool. Built around major ATP draws. Current live tournament is **Monte Carlo 2026** (first competitive tournament — free entry, real users invited 3 Apr).

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
| `backend/src/routes/picks.js` | Pick submission + `getAvailablePlayers()` — builds the pool of eligible players for a round, tags `pendingPrevRound` flag. Also contains `buildOpponentMap()` and `findPossibleOpponents()` for opponent enrichment. |
| `backend/src/routes/leaderboard.js` | Leaderboard data — returns `currentRoundPick` (player name or null), visibility controlled by `roundIsLocked` |
| `backend/src/routes/draw.js` | `/bracket` and `/debug` route handlers |
| `backend/src/routes/health.js` | Real production health check — validates env vars, live API call, DB ping |
| `backend/src/services/sofascoreAdapter.js` | Sofascore fetch — reads `SOFASCORE_BASE_URL` env var |
| `backend/src/config/tournament.js` | Active tournament selector — reads `ACTIVE_TOURNAMENT` env var, defaults to `monte-carlo-2026` |
| `backend/src/config/tournaments/monte-carlo-2026.js` | MC config — API params, round structure, lock time overrides, round date fallbacks, round name overrides |
| `backend/src/data/monteCarloMockDraw.js` | Monte Carlo draw with real player names (56 players, 8 seeds with byes, 24 R1 matches) |
| `backend/src/data/mockDraw.js` | Mock draw dispatcher — routes to correct tournament mock based on `ACTIVE_TOURNAMENT` |
| `backend/src/data/miamiDraw.js` | Miami mock draw (legacy) |

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

## Pick pool architecture (REFACTORED 7 Apr 2026)

**`getAvailablePlayers()` in `picks.js` now uses a simplified model:**

- **R1:** Only players in R1 non-bye matches (excludes seeds who have byes)
- **R32+:** ALL non-eliminated, non-qualifier players from the mock draw's player list

This replaced a complex system that built `eligibleMockIds` from round-specific bracket match slots. The old approach broke every time bracket propagation changed (multiple incidents during MC R1/R32).

**CRITICAL: The pick pool has NO dependency on bracket slot data.** If bracket propagation or display logic changes, the pick pool is unaffected. Do not re-introduce coupling.

**Filtering chain (for each player in mockDraw.players):**
1. `isQualifierPlaceholder(p)` — skip placeholder names ("Qualifier", "TBD")
2. `r1PlayerIds` restriction — R1 only: must be in an R1 match
3. `eliminatedFromPrevRound` — live API shows they lost prev round
4. `p.roundEliminated` — mock draw re-derivation marked them as eliminated

## pendingPrevRound feature

When the current round's pick window opens while the previous round is still in progress:

**Backend (`picks.js`):** `getAvailablePlayers()` computes `pendingFromPrevRound`, `confirmedFromPrevRound`, and `eliminatedFromPrevRound` sets by cross-referencing live API data with mock draw prev-round matches. Players with unresolved prev-round matches are tagged `pendingPrevRound: true` in the response. This is enrichment only (for badges), not used for eligibility filtering.

**Frontend (`PickScreen.jsx`):**
- Player rows show an amber `⚠️ [prev round] result pending` badge
- A banner warns the user about the risk of picking pending players
- If the user already has a pick but their prev-round result is pending, a softer "you're covered" variant shows

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
- Touch targets enforced at 44px min-height (Apple HIG) on `.btn-sm`, `.round-tab`, `.player-row` (added 3 Apr)
- `.player-opponent` font-size reduced to 0.72rem on mobile
- `.search-input` has `width: 100%; box-sizing: border-box` to prevent overflow

---

## Known issues

### 1. ~~R64 picks pool — only 18 players showing~~ — FIXED
Resolved in session 20 Mar: `getAvailablePlayers()` now includes R1 winners and seeded players who have R64 matches.

### 2. ~~Bracket tab only shows R16 onwards~~ — FIXED
Custom bracket built. Sofascore widget only used for older tournaments (Miami, IW). Monte Carlo uses custom bracket with SVG connectors, DFS traversal, and round-by-round list view.

### 3. ~~Mock draw fallback bug~~ — FIXED (23 Mar 2026)
`buildMiamiMatches()` now places seeds as `player1` in R64 (so seeds win in mock) and propagates actual winners into `prevWinners` each round. R16/QF/SF/F now return the correct 16/8/4/2 player pools when the mock is used.

### 4. ~~No health check for API key~~ — FIXED
`backend/src/routes/health.js` added — validates env vars, makes live API call, pings DB.

### 5. ~~False `pendingPrevRound` badge on confirmed players~~ — FIXED (22 Mar)
Players already in the R32 draw (e.g. Jorda) were still showing the `⚠️ R64 result pending` badge because `pendingFromPrevRound` was built from all unresolved R64 matches before checking whether those players had already progressed. Fix: after building `playingThisRound` from current round fixtures, strip any confirmed player from `pendingFromPrevRound`.

### 6. API `round: null` gap — OPEN
~6 R64 matches in the API currently have `round: null`. `normalizeRound()` returns null so they are not detected as pending R64 matches — affected players don't get the `⚠️ R64 result pending` badge. Root cause: API hasn't assigned the round name yet for these fixtures.

### 7. ~~Future round dates not verified~~ — FIXED (3 Apr 2026)
Lock time overrides set for all rounds (R1 through F) in commit `69cddfd`.

### 9. ~~API-Tennis returning no fixture data~~ — FIXED (6 Apr 2026)
Root cause: `tournament_season=2026` parameter. API-Tennis returns empty `{success: 1}` when this is included for Monte Carlo (tournament key 1970). Fix: set `apiSeason: null` in MC config and made the URL parameter conditional in `tennisData.js`, `health.js`, and `admin.js`. API now returns 50+ live fixtures correctly.

### 10. ~~Transactional emails not deployed~~ — PARTIALLY FIXED (6 Apr 2026)
Email approval system now deployed with `emails_sent` table, UNIQUE dedup constraint, admin digest, and one-click approve flow. Pick reminder and result emails queue as `pending` and require admin approval before sending. Cross-pool bug fixed: queries now filter by `TOURNAMENT.id` (was emailing Miami practice pool users). One-time migration clears incorrectly queued pre-fix emails.

### 11. Cross-pool email scoping — FIXED (6 Apr 2026)
`sendResultEmails()` and `sendRemindersForRound()` queries were not filtered by tournament. Emails were being queued for Miami practice pool alongside Monte Carlo. Fixed by joining `groups` table and filtering by `g.tournament_id = TOURNAMENT.id`.

### 12. Email validation missing — FIXED (6 Apr 2026)
Registration accepted invalid email formats (e.g. `@gmailcom` without dot). Added `isValidEmail()` to backend `auth.js` (register + PATCH /me) and frontend `Layout.jsx` auth modal. Checks: single @, non-empty local, domain has dot, no spaces, no double dots, no leading/trailing dots/hyphens.

### 8. ~~Mock group joins not persisting~~ — FIXED (25 Mar 2026)
Mock group joins (e.g. g3 for Monte Carlo) used `MOCK_MEMBERS.push()` — in-memory only, wiped on every Railway deploy. Fix: created a real PostgreSQL group via `POST /api/groups` API. The pools endpoint's `dbTournamentIds` filter automatically hides mock g3 when a real DB group exists for `monte-carlo-2026`. All future joins persist in PostgreSQL. Real group ID: `2d0d1477-0761-49c8-aaf7-d54ad466062f`.

### 13. ~~Fake R1 completions in bracket~~ — FIXED (7 Apr 2026)
Mock marks all past-round matches as completed (player1 wins). 5 unplayed R1 matches showed checkmarks. Fix: overlay now always applies live status when no winner (`mm.status = lm.status || 'scheduled'`). Non-overlaid completed matches are reset to scheduled by cleanup loop.

### 14. ~~Pick pool coupled to bracket propagation~~ — FIXED (7 Apr 2026)
`getAvailablePlayers()` built eligibleMockIds from bracket match slot data. Every bracket propagation change broke the pool (R32 pool dropped from 39 to 26, R16 from 32 to 25). Root cause: bracket display needs (TBD for unresolved feeders) conflicted with pool needs (keep player IDs). Fix: completely decoupled. Pool now uses simple filter on all non-eliminated players. See "Pick pool architecture" section above.

### 15. Mensik withdrawal — HANDLED (7 Apr 2026)
Jakub Mensik withdrew from Monte Carlo. Replaced by Damir Dzumhur (LL) in mock draw. mc-p23 now maps to Dzumhur with API key null (dynamic discovery). T&Cs updated with post-lock withdrawal policy (Section 7).

---

## Current tournament state (as of 7 April 2026)

### Miami Open 2026 (practice — complete)
- Tournament: ATP Miami Open 2026
- Stage: Complete — practice tournament finished
- Participants: 8 users in test group `6da0f300-ff14-43cb-bcef-ad4ba6709208`
- Mode: Practice tournament — no prize money

### Monte Carlo 2026 (LIVE — first competitive tournament)
- Tournament: Rolex Monte-Carlo Masters 2026
- Status: `active` — R1 mostly complete (17/24 done), R32 in progress (Tue 7 Apr)
- Real DB group: `2d0d1477-0761-49c8-aaf7-d54ad466062f` (PostgreSQL — persistent)
- Invite code: `MONTECAR-406R3X`
- Entry: Free
- R1 lock: LOCKED (Sun 5 Apr 12:30 BST)
- R32 lock: LOCKED (Tue 7 Apr 11:00 BST)
- R16 window: Opens Tue 7 Apr 5pm BST (16:00 UTC), locks Wed 8 Apr 11:00 BST
- R16 lock time override: `2026-04-08T10:00:00Z` — **may need adjustment** once Wednesday order of play is announced. Set to 1h before first R16 match.
- R16 window open override: `windowOpensOverrides.R16 = '2026-04-07T16:00:00Z'` — delayed to let R32 results settle
- Data source: Live API-Tennis (58 cached fixtures)
- Withdrawals: Mensik withdrew, replaced by Dzumhur (mc-p23)
- Manual results: Berrettini d. Bautista Agut R1 (qualifier with no API key)

### Outstanding actions
1. **R16 lock time** — adjust once Wednesday order of play is announced (1h before first R16 match)
2. **SPF/DKIM for Brevo** — set up domain auth for `finalserveivor.com` before paid tournaments
3. **Post-tournament refactor** — separate bracket display from data model entirely (mock draw should be structural reference only, not live state)

### Opponent matchup feature (NEW — 3 Apr)
Pick screen now shows opponent info below each player name. Three states:
- **Known:** "vs Stan Wawrinka"
- **Qualifier/unknown:** "vs Qualifier"
- **TBD (previous round pending):** "vs Player A or Player B" (italic)
Backend: `buildOpponentMap()` in `picks.js` enriches available players response.
Frontend: `.player-name-col` wrapper in `PickScreen.jsx` with `.player-opponent` sub-line.

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
| 3 Apr 2026 (session 1) | **Monte Carlo activation.** Commit `69cddfd`: flipped Monte Carlo to `active`/`drawAvailable: true` in FE+BE tournament configs; set lock time overrides for all rounds (R1-F); fixed BRACKET_ROUNDS bug in DrawViewer; added Rolex prefix round name overrides for API-Tennis. Confirmed R1 pick window open, countdown running. |
| 3 Apr 2026 (session 2) | **Email build + rollback + opponent feature.** Built 4 transactional email templates (pick reminder, survival, elimination, winner) and wired to cron — then immediately rolled back (commit `028b443`) because no `emails_sent` dedup table existed. Mickey flagged this as unacceptable risk. Templates preserved in git history (commit `c7a16d1`). Confirmed Railway billing already on Hobby plan. Mobile audit: fixed touch targets (44px min-height on buttons, player rows, round tabs), search input overflow, auth button padding. **New feature:** opponent matchups in pick screen (commit `f48945f`) — `buildOpponentMap()` in picks.js cross-references draw data; PickScreen.jsx shows "vs [opponent]" below each player name; handles known, qualifier, and TBD states. Verified live on finalserveivor.com — 41 R1 players with correct opponent names. API-Tennis still returning no data (mock fallback active). Invites sent after session. |
| 6 Apr 2026 | **Critical fixes + bracket connector incident.** (1) Fixed cross-pool email bug — `sendResultEmails()` and `sendRemindersForRound()` were querying ALL groups across ALL tournaments; added `JOIN groups` + `WHERE g.tournament_id = TOURNAMENT.id`. (2) Fixed email cleanup migration — was deleting ALL pending emails on every restart; added timestamp guard `< 2026-04-06T09:00:00Z`. (3) **Fixed API-Tennis empty response** — root cause: `tournament_season=2026` parameter silently breaks MC queries; set `apiSeason: null` in MC config, made param conditional in all URL builders. API now returns 50+ live fixtures. (4) Fixed Raj's typo'd email via new `POST /api/admin/fix-email` endpoint. (5) Added `isValidEmail()` to backend auth + frontend modal. (6) Added `GET /api/admin/api-diag` diagnostic endpoint. (7) Bracket connector refactor — replaced fixed-maths `ConnectorSVG` with DOM-measured `DomConnector` using `getBoundingClientRect` + `ResizeObserver`. **Incident:** initial commit placed `useRef` after early returns in DrawViewer, violating React hooks rules and crashing the entire site (white screen). Hotfixed by moving hook before early returns. **Lesson:** every push must be verified before moving on; risky refactors should not be shipped during live tournament windows. |
| 7 Apr 2026 | **Bracket data integrity + pick pool refactor.** (1) Manual result override for Berrettini d. Bautista Agut R1 (qualifier with no API key). (2) Fixed propagation to always overwrite from feeder winners. (3) Cleared `roundEliminated` before re-deriving from live results — mock Step 3 marked upset winners as eliminated. (4) Fixed fake R1 completions in bracket — overlay now always applies live status when no winner; non-overlaid completed matches reset to scheduled. (5) Fixed bracket showing unresolved R1 feeders as progressed — propagation clears names to null (shows TBD) but keeps player IDs. (6) **Major refactor: simplified pick pool** — removed `eligibleMockIds` entirely. R1: restrict to R1 match participants. R32+: all non-eliminated non-qualifier players. No dependency on bracket slot data. Eliminates entire class of bracket-vs-pool bugs. (7) Delayed R16 window to 5pm BST via `windowOpensOverrides`. (8) Mensik withdrawal: replaced with Dzumhur (LL) in mock draw. (9) Added post-lock withdrawal policy to T&Cs (Section 7). 8 commits total. |

---

## Deployment discipline

**Every push to `main` auto-deploys to real users.** Treat every commit as a production release.

### Before pushing
1. Trace all execution/render paths through changed code
2. Check for React rules of hooks violations (no hooks after early returns or conditionals)
3. Check for missing imports, undefined references, typos
4. Consider all component states: loading, error, empty data, full data
5. If the change is a significant refactor of a working component, flag the risk and discuss timing

### After pushing
1. Wait for Vercel deploy to reach `READY` state
2. Hit the live site to confirm it loads
3. Check the specific changed feature works
4. Only then move on to the next task

### Risk assessment
Before starting feature work, ask: "If this breaks, what's the blast radius?" If the answer is "the whole site goes down" and users are active, defer or implement with extreme caution.
