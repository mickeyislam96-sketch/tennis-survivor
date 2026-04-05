# Final Serve-ivor — CTO Agent Context

> Last updated: 5 April 2026 (evening). Keep this file updated at the end of every session.

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
| `MONTE_CARLO_TOURNAMENT_KEY` | Tournament key for Monte Carlo (`1970`) |
| `MIAMI_TOURNAMENT_KEY` | Tournament identifier for Miami Open (inactive) |
| `SOFASCORE_BASE_URL` | Cloudflare proxy URL — `https://sofascore-proxy.finalservivor.workers.dev` |
| `ADMIN_SECRET` | Secret for admin endpoints (set in Railway) |
| `FRONTEND_URL` | `https://finalserveivor.com` |
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

## Round structure — Monte Carlo 2026

| App round | API-Tennis label | Description |
|---|---|---|
| R1 | 1/32-finals | 24 matches between 48 non-seeded players |
| R32 | 1/16-finals | 16 matches — 24 R1 winners + 8 seeded byes = 32 players |
| R16 | 1/8-finals | 8 matches |
| QF | 1/4-finals | 4 matches |
| SF | 1/2-finals | 2 matches |
| F | Final | 1 match |

**Key structural fact:** Monte Carlo is a 56-draw. Top 8 seeds get byes directly into R32 (they skip R1 entirely). API-Tennis labels rounds by how many players REMAIN after the round, not how many play in it. So `1/32-finals` = R1 (produces 32 remaining), `1/16-finals` = R32 (produces 16). Mapped via `fractionDenomMap` + `roundNameOverrides` in tournament config.

---

## Pick window timing system

Defined in `backend/src/config/tournaments/monte-carlo-2026.js` (tournament config) and `backend/src/services/tennisData.js` (logic).

**How it works:**
1. Each round has a **lock time** (picks close). Defined in `lockTimeOverrides` in tournament config.
2. Each round has an **open time** = previous round's lock time + `pickWindowBufferHours` (currently 4 hours).
3. R1 opens immediately (no previous round). All other rounds open 4 hours after the previous round locks.
4. `getDeadlines()` in `tennisData.js` computes `opensAt`, `lockAt`, `isLocked`, `isOpen` for each round.

**Current Monte Carlo lock times (UTC):**
```
R1:  2026-04-05T11:30:00Z  (Sun 5 Apr, 12:30 BST)
R32: 2026-04-07T08:00:00Z  (Tue 7 Apr, 09:00 BST)  — opens 15:30 UTC Sun 5 Apr
R16: 2026-04-08T08:00:00Z  (Wed 8 Apr, 09:00 BST)  — opens 12:00 UTC Tue 7 Apr
QF:  2026-04-10T08:00:00Z  (Fri 10 Apr, 09:00 BST) — opens 12:00 UTC Wed 8 Apr
SF:  2026-04-11T09:00:00Z  (Sat 11 Apr, 10:00 BST) — opens 12:00 UTC Fri 10 Apr
F:   2026-04-12T11:00:00Z  (Sun 12 Apr, 12:00 BST) — opens 13:00 UTC Sat 11 Apr
```

**`pickWindowBufferHours: 4`** — gives admins time to review results and fix any grading errors before players can submit picks for the next round. Configurable per tournament.

**Fallback chain for lock times:** `runtimeLockOverrides` (in-memory, set via admin) > `lockTimeOverrides` (config file) > API first match time - 1h > `roundDateFallback` > `roundDates`.

---

## Key source files

### Backend

| File | What it does |
|---|---|
| `backend/src/services/tennisData.js` | Core data logic — `getDraw()` (mock bracket + live overlay for frontend), `getLiveDraw()` (raw API data for results/picks/leaderboard), `fetchApiDraw()`, `getDeadlines()` (pick window open/close times with buffer), round normalisation, fallback chain |
| `backend/src/services/resultsProcessor.js` | Automated results grading (runs every 15 min via cron). `autoProcessResults()` grades picks, eliminates non-pickers, invalidates future picks. Handles dual IDs (mock `mc-*` + API keys) via reverse lookup maps. |
| `backend/src/routes/picks.js` | Pick submission + `getAvailablePlayers()` — builds eligible player pool, tags `pendingPrevRound`. Submit handler always resolves canonical names from mock draw. GET `/history` includes live grading overlay from API data. |
| `backend/src/routes/leaderboard.js` | Leaderboard data — returns `currentRound` (last locked), `openRound` (currently open), `currentRoundPick`, `roundIsLocked`. Grader handles dual IDs (mock + API) + name fallback. |
| `backend/src/routes/draw.js` | `/bracket`, `/deadlines`, `/rounds`, `/debug`, `/debug-picks`, `/live-completed`, `/fix-mock-ids`, `/fix-names` (diagnostic/fix endpoints — should be secured or removed) |
| `backend/src/routes/health.js` | Production health check — validates env vars, live API call, DB ping |
| `backend/src/data/monteCarloMockDraw.js` | Monte Carlo 56-player mock draw with 8 seed byes. Exports `API_KEY_MAP` (mock ID → API key), `MC_PLAYERS` (canonical player list with full names). |
| `backend/src/routes/matchup.js` | H2H matchup endpoint — fetches player profiles + H2H from API-Tennis, 1h cache |
| `backend/src/config/tournaments/monte-carlo-2026.js` | Monte Carlo tournament config — dates, rounds, apiSeason, lock times, `pickWindowBufferHours`, `fractionDenomMap`, `roundNameOverrides` |
| `backend/src/index.js` | Server startup — schema init, startup migrations (R32→R1 rename, mock ID→API key, name normalisation), cron schedule |

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
| `GET /api/draw/bracket?round=F` | Full draw — rounds, players, match status (mock + live overlay) |
| `GET /api/draw/rounds` | List of active rounds (e.g. `["R1","R32","R16",...]`) |
| `GET /api/draw/deadlines` | Lock times, open times, and open/locked status for each round |
| `GET /api/draw/debug` | Raw fixture counts and field list — use to confirm API-Tennis is live |
| `GET /api/draw/debug-picks?groupId=X` | **Diagnostic** — dumps all picks for a group with display names |
| `GET /api/draw/live-completed` | **Diagnostic** — shows what `getLiveDraw()` returns (completed matches) |
| `GET /api/draw/fix-mock-ids` | **One-shot fix** — replaces mock IDs with API keys (now a no-op) |
| `GET /api/draw/fix-names` | **One-shot fix** — normalises abbreviated player names to canonical form |
| `GET /api/picks/available?userId=X&groupId=X&round=X` | Eligible players for a pick — includes `pendingPrevRound` flag, `status` (confirmed/at_risk) |
| `POST /api/picks` | Submit a pick `{userId, groupId, round, playerId, playerName}` — name always resolved from mock draw |
| `GET /api/picks/history?userId=X&groupId=X` | All picks for a user in a group — includes live `survived` grading from API |
| `GET /api/leaderboard/:groupId` | Leaderboard with `currentRound`, `openRound`, `currentRoundPick`, `roundIsLocked`, `survivedRounds`, `eliminatedRound` |
| `GET /api/groups/:groupId` | Group details including members |
| `GET /api/matchup/:player1Key/:player2Key` | H2H data, player stats, and recent form for two players (1h cache) |
| `GET /api/health` | Health check — returns 500 if API key missing or API call fails |
| `GET /api/admin/status?secret=X` | System status — deadlines, cache, runtime overrides |

---

## pendingPrevRound feature

When the current round's pick window opens while the previous round is still in progress (e.g. R32 window opens while R64 matches are still being played):

**Backend (`picks.js`):** `getAvailablePlayers()` computes a `pendingFromPrevRound` set of player IDs whose previous-round match has no winner yet. These players are tagged `pendingPrevRound: true` in the response. This is computed **before** the `roundMatches` check so it applies in both the main path (R32 draw published) and the fallback path (R32 draw not yet published).

**Frontend (`PickScreen.jsx`):**
- Player rows show an amber `⚠️ In R1` badge next to the player name
- A banner at the top of the pick list warns: if they pick a pending player and that player loses, the pick is voided and they are eliminated
- If the user has already made a current-round pick but their prev-round result is pending, a softer "you're covered" variant of the banner shows
- If the user's picked player gets eliminated, a red "was eliminated" banner tells them to switch before the window closes
- Bottom-of-list notice reinforces that at-risk picks are the user's responsibility to monitor

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

### 2. ~~Bracket tab only shows R16 onwards~~ — FIXED
Custom bracket built with DFS traversal, SVG connectors, round-by-round list view. Monte Carlo uses custom bracket (bracketWidget: null in FE config).

### 3. ~~Mock draw fallback bug~~ — FIXED (23 Mar 2026)
`buildMiamiMatches()` now places seeds as `player1` in R64 (so seeds win in mock) and propagates actual winners into `prevWinners` each round. R16/QF/SF/F now return the correct 16/8/4/2 player pools when the mock is used.

### 4. ~~No health check for API key~~ — FIXED
`backend/src/routes/health.js` added — validates env vars, makes live API call, pings DB.

### 5. ~~False `pendingPrevRound` badge on confirmed players~~ — FIXED (22 Mar)
Players already in the R32 draw (e.g. Jorda) were still showing the `⚠️ R64 result pending` badge because `pendingFromPrevRound` was built from all unresolved R64 matches before checking whether those players had already progressed. Fix: after building `playingThisRound` from current round fixtures, strip any confirmed player from `pendingFromPrevRound`.

### 6. ~~API `round: null` gap~~ — SUPERSEDED
Miami-era issue. Monte Carlo uses explicit `roundNameOverrides` + `fractionDenomMap` so round mapping no longer depends on API round labels being present.

### 7. ~~Future round dates not verified~~ — FIXED (3 Apr 2026)
Lock time overrides set for all rounds (R1 through F) in commit `69cddfd`.

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

### 15. ~~R32 pick pool showing only API players (no R1 players)~~ — FIXED (5 Apr session 2)
When R32 window opened, only 32 players from API R32 data were shown (all "confirmed", no warnings). Root cause: API had no R1 fixture data, so `getAvailablePlayers` couldn't identify R1 players as pending. Fix: `getAvailablePlayers` now merges mock draw (complete R1 structure) with live API data. All 48 R1 players show with `pendingPrevRound` badge, 8 seeds show as confirmed. Player IDs translated to API keys via `API_KEY_MAP` so picks match results processor. 7 qualifiers excluded (names unknown).

### 16. ~~Round name mapping wrong for MC 56-draw~~ — FIXED (5 Apr session 2)
API-Tennis `1/32-finals` = 32 players remaining = R32 (seeds enter). Old `FRACTION_MAP` auto-derivation incorrectly mapped 32→R1 for the 56-draw structure. Fix: added explicit `fractionDenomMap` to tournament config + `roundNameOverrides` corrected. `buildFractionMap` in `tennisData.js` now uses config map when provided.

### 17. ~~Leaderboard showing wrong round~~ — FIXED (5 Apr session 2)
Leaderboard showed "R32 Pick" with "🔒 Hidden" when R1 was already locked. Logic prioritised active open window (R32) over last locked round (R1). Fix: always show most recently locked round's picks (visible).

### 18. ~~Non-pickers not auto-eliminated on window lock~~ — FIXED (5 Apr session 2)
`autoProcessResults` only eliminated non-pickers inside the `completed.length > 0` block, meaning no elimination happened until matches finished. Fix: non-picker check now runs as soon as `windowLocked` is true, independent of match results.

### 19. ~~R32 window temporarily delayed~~ — RESOLVED (5 Apr evening)
`windowOpensOverrides` removed. Replaced by `pickWindowBufferHours: 4` in tournament config — each round's pick window now opens 4 hours after the previous round locks. This is permanent and applies to all rounds.

### 20. ~~Leaderboard 4-column overflow on mobile~~ — FIXED (5 Apr session 2)
Status + Progress columns merged into one "Status" column. 3-column layout (Player / Status / Pick) fits on 390px without horizontal scroll. Status shows: "Active" (green, pre-results), "Survived X rounds" (green, post-results), "Eliminated [round]" (red).

### 21. ~~Humbert win not grading picks~~ — FIXED (5 Apr evening)
Two layers: (a) Picks stored as `round='R32'` but API tags matches as `round='R1'` — fixed by startup migration renaming R32→R1 for early picks. (b) Picks stored with mock IDs (`mc-p56`) but results processor matches against API keys (`1105`) — fixed by adding dual-ID matching to `resultsProcessor.js` and `leaderboard.js`. Both now check `player_id` against API key, mock ID, and player name.

### 22. ~~Pick history modal showing empty~~ — FIXED (5 Apr evening)
Modal filtered `p.round !== currentRound` where `currentRound = 'R1'` (last locked round), removing all R1 picks. Fix: backend now returns `openRound` (the currently open round), frontend passes that to modal instead. Also added live grading to `/api/picks/history` so `survived` status is derived from live API data, not just the database column.

### 23. ~~Inconsistent player names (API-abbreviated vs full)~~ — FIXED (5 Apr evening)
Some picks stored "A. Rublev" / "C. Norrie" (API format) instead of "Andrey Rublev" / "Cameron Norrie" (mock draw format). Root cause: submit handler preferred frontend-supplied name over canonical name. Fix: submit handler now always resolves name from mock draw's canonical list. Startup migration + `/fix-names` endpoint normalises existing records.

### 24. ~~Diagnostic endpoints publicly accessible~~ — FIXED (5 Apr evening)
`/api/draw/debug`, `/api/draw/debug-picks`, `/api/draw/live-completed`, `/api/draw/fix-mock-ids`, `/api/draw/fix-names` all now require `?secret=ADMIN_SECRET`.

### 25. 7 qualifier R1 fixtures not yet in API — MONITORING
Muller, Shevchenko, Blockx, Comesana, J Cerundolo, Garin, Nava. These qualified but haven't appeared as main draw R1 fixtures in API-Tennis yet. If still missing before R32 locks (09:00 BST Tuesday 7 April), may need manual result injection.
Status + Progress columns merged into one "Status" column. 3-column layout (Player / Status / Pick) fits on 390px without horizontal scroll. Status shows: "Active" (green, pre-results), "Survived X rounds" (green, post-results), "Eliminated [round]" (red).

---

## Current tournament state (as of 5 April 2026, 10PM BST)

### Monte Carlo 2026 (LIVE — first competitive tournament)
- Tournament: Rolex Monte-Carlo Masters 2026
- Status: `active` — R1 locked, R32 window open (opened 16:30 BST, locks 09:00 BST Tue 7 Apr)
- Real DB group: `2d0d1477-0761-49c8-aaf7-d54ad466062f` (PostgreSQL — persistent)
- Invite code: `MONTECAR-406R3X`
- Entry: Free
- Members: 11. Lebron eliminated (no R1 pick). 3 survived R1 (Humbert x2, Norrie x1). 7 picks pending (matches not yet played).
- R1 picks visible on leaderboard (`roundIsLocked=true`, `currentRound=R1`)
- R32 pick window: opens 4h after R1 lock (via `pickWindowBufferHours: 4`). No manual overrides needed.
- API-Tennis: live and healthy. `apiSeason = '2026'`. Qualifying filtered via `event_qualification` field.
- Results processor: runs every 15 min via cron. Handles dual IDs (mock + API key) automatically.
- **Architecture:** `getDraw()` overlays live API results onto mock bracket for frontend display. `getLiveDraw()` returns raw API data for results processing, pick pool, and leaderboard grading. Pick pool merges mock draw (R1 structure) + live API (results) via `API_KEY_MAP` ID translation.
- **Dual ID system:** Picks can be stored with mock IDs (`mc-p56`) or API keys (`1105`). Results processor, leaderboard grader, and pick history all check both formats. New picks always use API keys (submit handler resolves from mock draw).
- **Name normalisation:** Submit handler always uses canonical full names from mock draw. Startup migration corrects any abbreviated names. `/fix-names` endpoint available for manual correction.
- Matchup modal: H2H on draw page via `/api/matchup/:key1/:key2` with 1h cache.

### Outstanding actions
1. **Monitor qualifier R1 fixtures** — 7 qualifiers not yet in API. If still missing before R32 locks (09:00 BST Tue 7 Apr), may need manual result injection.
2. **SPF/DKIM for Brevo** — set up domain authentication for `finalserveivor.com` before paid tournaments.
3. **Transactional emails** — templates designed but REVERTED (3 Apr). Need `emails_sent` dedup table + dry-run before re-deploying. Code in git history (commit `c7a16d1`).

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
| 5 Apr 2026 | **Draw page design + data pipeline + CSS audit.** Confirmed API-Tennis now returning live data (37 fixtures, 16 main draw R1 matches). Round normalisation working (`roundNameOverrides` maps "ATP Monte Carlo - 1/32-finals" to "R1"). Qualifying matches filtered via `event_qualification` field. **Critical architecture fix:** split `getDraw()` into two functions — `getDraw()` (mock bracket for frontend display, all rounds, no fake statuses) and `getLiveDraw()` (real API data for results processing, pick pool, leaderboard). Updated `resultsProcessor.js`, `picks.js`, `leaderboard.js` to use `getLiveDraw()` with mock fallback. Without this, results processor would never find completed matches. Added bracket hint to draw page ("Tap a matchup to compare players before you pick"). **Design overhaul:** explored 3 bracket design options (Court Green, Clean Light, Dark Court). Chose Option B (Clean Light) with A-style round headers — white card container with border/shadow, green underline headers, grey TBD cards, light green bye cards. Matches existing site aesthetic. **CSS audit + token cleanup:** consolidated duplicate `.dvt-btn` definitions (hardcoded hex → CSS variables), replaced hardcoded `white` on `.bc-card` and `.lc` with `var(--surface)`, replaced hardcoded borders with `var(--border)`. Removed redundant override blocks. Verified all pages visually consistent via Chrome (bracket, list view, pick screen, leaderboard, group home). 11 members in Monte Carlo group, all R1 picks showing correctly. |
| 5 Apr 2026 (session 2) | **Critical bug fixes + mobile leaderboard.** Fixed 4 bugs reported by users: (1) R32 pick pool only showing 32 API players instead of all 56 — rewrote `getAvailablePlayers` to merge mock draw (R1 structure) + live API (results) via `API_KEY_MAP` ID translation; 49 players now show (8 seeds confirmed, 41 R1 at-risk, 7 qualifiers excluded). (2) Round name mapping wrong for MC 56-draw — `FRACTION_MAP` auto-derivation mapped 32→R1 instead of R32; added explicit `fractionDenomMap` to tournament config. (3) Leaderboard showing R32/Hidden instead of R1/visible — changed logic to always show most recently locked round's picks. (4) Non-pickers not auto-eliminated on window lock — moved check outside `completed.length > 0` guard. Also: merged Status + Progress columns into single "Status" column (3-col layout fits 390px mobile without scroll); added `windowOpensOverrides` feature to tournament config + `getDeadlines`; R32 window delayed to 4PM BST pending qualifier entry. Exported `API_KEY_MAP` from `monteCarloMockDraw.js`. 6 commits pushed. |
| 5 Apr 2026 (session 3) | **Automated grading + pick history modal + pick window buffer + name normalisation.** (1) Humbert win not grading: two-layer fix — startup migration renamed R32→R1 for early picks + `/fix-mock-ids` endpoint replaced mock IDs with API keys. Made permanent by adding dual-ID matching (mock + API key + name fallback) to `resultsProcessor.js` and `leaderboard.js`. (2) Pick history modal empty: was filtering out R1 picks because `currentRound` = locked round (R1). Fix: backend returns `openRound` (R32), frontend passes that to modal. Added live grading overlay to `/api/picks/history` so `survived` status shows immediately from API data. (3) Pick window buffer: added `pickWindowBufferHours: 4` to tournament config — next round opens 4h after previous round locks, giving admins time to review. Replaced `windowOpensOverrides`. (4) Inconsistent player names: "A. Rublev" vs "Andrey Rublev" — submit handler now always resolves canonical name from mock draw. Added startup migration + `/fix-names` endpoint to correct existing records. 6 commits pushed. |
| 4 Apr 2026 (session 2) | **Matchup modal fix + API key verification.** Root cause of modal showing no data: mock draw uses `mc-*` fake IDs which API-Tennis doesn't recognise. Fix: added `API_KEY_MAP` to `monteCarloMockDraw.js` mapping all 50+ mock IDs to verified real API-Tennis player keys. Injected `player1ApiKey`/`player2ApiKey` into every match object via post-processing in `buildMonteCarloMatches()`. Updated `DrawViewer.jsx` to pass `player1ApiKey \|\| player1Id` to the modal (live data path already uses real keys as player1Id). Verified all 8 seed keys + 6 corrected non-seed keys via `get_players` API: Alcaraz=2382, Sinner=2072, Zverev=1980, Musetti=2849, de Minaur=1106, FAA=2073, Medvedev=1093, Bublik=1895, Lehecka=2959, Berrettini=2844, Cobolli=372, Cilic=2167, Moutet=2674, Mpetshi Perricard=9222. **Critical fix:** `apiSeason` in `monte-carlo-2026.js` changed from `'2025'` to `'2026'` — season 2025 returns 0 fixtures for MC 2026 dates. Updated CLAUDE.md. |
| 4 Apr 2026 (session 1) | **Matchup modal backend + frontend build.** Built H2H matchup endpoint (`/api/matchup/:key1/:key2`) with 1h cache, player profile stats, recent form. Built `MatchupModal.jsx` React component with score formatting (API decimal tiebreak notation), loading/error states, escape/backdrop close. Integrated into `DrawViewer.jsx` with clickable match cards. Added ~200 lines of `.mu-*` CSS with mobile bottom-sheet. Fixed TypeError crash (safe defaults for missing stats). Pushed to GitHub — auto-deployed to Vercel + Railway. Updated matchup modal prototype HTML with real live data. |
| 26 Mar 2026 | **Comprehensive backend audit + hardening.** Full code audit of all backend routes found 20 issues. Commits pushed: (1) `eb24252` auto-join fix — users registering via header auth modal now auto-join pre-launch groups; (2) `e64307c` hardening — group membership check on picks (was missing), double-submit guard on pick button, join endpoint returns 200 for already-joined users, `betaFree` flag exposed on group endpoints; (3) `adf796e` Indian Wells test data cleanup; (4) `38820f2` email copy fix — "Group" → "Pool" in tournament join email, context-aware CTA button ("See who's joined" pre-launch / "Make your first pick" when draw live); (5) `ca011be` mobile invite box fix — stacked URL + copy button vertically (was overflowing off-screen); (6) `28bc9fe` homepage copy overhaul — hero eyebrow generalised from "ATP Masters 1000 · Survivor fantasy" to "Tennis Survivor"; How It Works step 2 now explains no-reuse rule and strategy; step 3 clearer elimination language; footer tagline changed to "Outsmart. Outlast. Win."; all meta tags (title, OG, Twitter, manifest) updated to remove ATP-specific references. Email mockups generated for all 3 templates (welcome, tournament join, password reset). Identified future issues: no auth on API (issue #12), no transaction wrapping on results (issue #13), no "draw is live" notification email (issue #14). |
