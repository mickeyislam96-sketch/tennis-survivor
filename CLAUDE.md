# Final Serve-ivor — CTO Agent Context

> Last updated: 21 April 2026 (session 11). See "Session-end protocol" at the bottom of this file — follow it at the end of every session.

---

## What the product is

**Final Serve-ivor** is a tennis survivor fantasy game. Players join groups, pick one player per round, and are eliminated if their pick loses. Last survivor wins the prize pool. Built around major ATP draws. Monte Carlo 2026 is complete (Mark won, 11 entrants). Next tournament: **Madrid 2026** (starts 22 Apr, free entry, draw 19 Apr).

---

## Live URLs

| Service | URL |
|---|---|
| Frontend (production) | https://finalserveivor.com |
| Frontend (Vercel alias) | https://tennis-survivor.vercel.app |
| Backend API | https://tennis-survivor-production.up.railway.app |
| Mobile app (iOS) | Expo / React Native — pre-App Store (TestFlight pending) |
| Sofascore proxy (inactive) | https://sofascore-proxy.finalservivor.workers.dev |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend (web) | React + Vite, deployed on Vercel (auto-deploys from GitHub `main`) |
| Frontend (mobile) | React Native + Expo SDK 54 + TypeScript — `mickeyislam96-sketch/tennis-survivor-mobile` |
| Backend | Node.js / Express, deployed on Railway (auto-deploys from GitHub `main`) |
| Source control (web) | GitHub — `mickeyislam96-sketch/tennis-survivor` |
| Source control (mobile) | GitHub — `mickeyislam96-sketch/tennis-survivor-mobile` |
| Primary data | Goalserve (planned, $100/mo) — replacing API-Tennis for Madrid 2026+ |
| Legacy data | API-Tennis (paid) — unreliable, kept as fallback only |
| Intelligence data | Matchstat Tennis API (RapidAPI) — H2H, player profiles, surface stats, recent form. Free tier (11 players). |
| Secondary data | Sofascore (free) — 403-blocked on cloud IPs |
| Data adapter | `backend/src/services/dataAdapter.js` — unified interface, swappable providers |
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
| DB backup | GitHub Actions daily cron (03:00 UTC), 30-day artifact retention |
| Branch protection | `main` — force pushes and branch deletion blocked |

### Mobile app reference

| Item | Value |
|---|---|
| Bundle ID (iOS) | `com.finalserveivor.app` |
| Package name (Android) | `com.finalserveivor.app` |
| Expo slug | `final-serveivor` |
| App scheme (deep links) | `finalserveivor://` |
| EAS Project ID | **NOT SET** — required before EAS Build/Submit |
| Associated domains | `applinks:finalserveivor.com`, `applinks:tennis-survivor.vercel.app` |

**Deep linking routes:** `join/:code`, `group/:groupId` (nested under Pools stack). Password reset deep link not yet configured.

---

## Key environment variables (Railway)

| Variable | Purpose |
|---|---|
| `GOALSERVE_API_KEY` | Goalserve API key — **set on 17 Apr when trial activates** |
| `TENNIS_DATA_PROVIDER` | Active data provider: `goalserve`, `api-tennis`, `sofascore`, or `mock` |
| `ACTIVE_TOURNAMENT` | Active tournament ID (e.g. `madrid-2026`) — used by `activeTournament.js` |
| `JWT_SECRET` | JWT signing key for user authentication (set 19 Apr) |
| `ADMIN_SECRET` | Admin endpoint auth + JWT fallback (rotated 19 Apr) |
| `TENNIS_API_KEY` | API-Tennis auth key — **legacy fallback, keep for now** |
| `MIAMI_TOURNAMENT_KEY` | Tournament identifier for Miami Open (legacy) |
| `MATCHSTAT_API_KEY` | RapidAPI key for Matchstat Tennis API — H2H, profiles, surface stats. **Set 21 Apr.** |
| `SOFASCORE_BASE_URL` | Cloudflare proxy URL — `https://sofascore-proxy.finalservivor.workers.dev` |
| `NODE_ENV` | Runtime environment |

**WARNING:** If no data provider is configured, the draw silently falls back to mock data. After changing Railway env vars, manually trigger a restart via Railway dashboard or GraphQL API: `mutation deploymentRestart(id)` at `backboard.railway.app/graphql/v2`.

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

## Round structure — Masters 1000 (96-draw)

| App round | Description |
|---|---|
| R1 | 32 matches between unseeded players (no seeds involved) |
| R64 | 64 players — R1 winners + seeded players entering |
| R32 | 32 players |
| R16 | 16 players |
| QF | 8 players |
| SF | 4 players |
| F | 2 players |

**Key structural fact:** Seeded players (top 32) have R1 byes — they do not appear in any R1 fixtures. They first appear when their R64 match is scheduled.

---

## R1 Lock Mode (updated 19 Apr 2026)

**Current mode:** Standard fixed deadline (`r1PerMatchLock: false` in `activeTournament.js`). R1 uses the same deadline system as all other rounds: 1 hour before the first R1 match.

**Per-match lock code is retained but inactive.** Set `r1PerMatchLock: true` to re-enable. Intended for future use when the mobile app has push notifications and Grand Slam R1 spans multiple days.

**Withdrawal handling (all rounds):**
- **Before deadline, time to re-pick:** User's pick is deleted, they re-pick from available players. Automated detection via `opsMonitor.js` or manual via `POST /api/admin/withdrawal`.
- **After deadline or no time:** Auto-assign the replacement player (lucky loser/alternate). If no replacement, user gets a bye for that round.
- **Mid-match retirement/walkover:** Result stands as recorded.

**Key files:**
- `backend/src/config/activeTournament.js` — `r1PerMatchLock` flag (currently `false`)
- `backend/src/routes/picks.js` — R1 per-match branch exists but inactive when flag is false
- `backend/src/services/tennisData.js` — `getDeadlines()` returns standard deadline for R1
- `backend/src/services/opsMonitor.js` — automated withdrawal detection
- `frontend/src/pages/TermsAndConditions.jsx` — sections 5a and 6 cover R1 deadline and withdrawal policy

---

## Data adapter layer (NEW — 13 Apr 2026)

**File:** `backend/src/services/dataAdapter.js`

Unified interface for tennis data. All providers output the same internal fixture format. Provider chain: Goalserve (preferred) → API-Tennis (legacy) → Sofascore (free) → mock.

**Internal fixture format:**
```js
{
  matchId, round, player1Id, player1Name, player2Id, player2Name,
  winnerId, winnerName, status, startTime, score,
  isWithdrawal, withdrawnPlayerId
}
```

**Status values:** `scheduled`, `live`, `completed`, `walkover`, `retired`, `cancelled`

**Provider selection:** Set `TENNIS_DATA_PROVIDER` env var, or leave blank for auto-fallback chain.

**Goalserve integration (TODO — 17 Apr):**
1. Activate Goalserve 30-day free trial
2. Set `GOALSERVE_API_KEY` env var
3. Find Madrid tournament ID in their system
4. Implement `fetchGoalserve()` in dataAdapter.js
5. Verify withdrawal/walkover status detection
6. Set `TENNIS_DATA_PROVIDER=goalserve` in Railway

---

## Pick window timing system

**R1:** Per-match lock (see above). No `LOCKTIME_OVERRIDES` for R1.

**R2+ (R64, R32, R16, QF, SF, F):** Round-level lock defined in `tennisData.js`:

Lock time overrides set in `activeTournament.js` `lockTimeOverrides` object. Update 1h before first match of each round once order of play is announced.

Fallback dates in `activeTournament.js` `roundDateFallbacks` object used when API has no start times.

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
| `backend/src/middleware/auth.js` | **NEW** — JWT authentication middleware. `issueToken()`, `requireAuth`, `optionalAuth`, `csrfProtection`, `generateCsrfToken()`. Legacy userId fallback for migration. |
| `backend/src/services/dataAdapter.js` | **NEW** — Unified data interface. Provider chain (Goalserve/API-Tennis/Sofascore). R1 per-match lock helpers. Internal fixture format. |
| `backend/src/config/activeTournament.js` | **NEW** — Active tournament config. `r1PerMatchLock`, lock time overrides, round date fallbacks, Goalserve tournament ID. |
| `backend/src/services/tennisData.js` | Core data logic — `fetchApiDraw()`, `getDraw()`, `getDeadlines()` (now returns `perMatchLock` flag for R1) |
| `backend/src/routes/picks.js` | Pick submission + `getAvailablePlayers()` — R1 branch uses per-match lock; R2+ uses round-level lock |
| `backend/src/routes/leaderboard.js` | Leaderboard data — returns `currentRoundPick` (player name or null), visibility controlled by `roundIsLocked` |
| `backend/src/routes/draw.js` | `/bracket` and `/debug` route handlers |
| `backend/src/routes/health.js` | Real production health check — validates env vars, live API call, DB ping |
| `.github/workflows/db-backup.yml` | Daily automated PostgreSQL backup — pg_dump at 03:00 UTC, gzipped artifacts, 30-day retention, manual trigger |
| `backend/src/services/opsMonitor.js` | **NEW** — Tournament ops automation brain. Withdrawal detection, draw release detection, lock time auto-setting, ops logging, tournament setup. Called every 15 min by cron. |
| `backend/src/routes/ops.js` | **NEW** — Operations API endpoints (summary, log, setup-tournament, health-deep). All behind ADMIN_SECRET auth. |
| `backend/src/services/matchstatAdapter.js` | **NEW** — Matchstat Tennis API integration. H2H, profiles, surface stats, recent form. Name→ID cache from rankings. `getMatchupIntelligence()` fires 8 parallel requests. |
| `backend/src/routes/matchup.js` | Matchup route — combines seed draw, Goalserve fixtures, and Matchstat intelligence. 5-min cache. |
| `backend/src/services/sofascoreAdapter.js` | Sofascore fetch — reads `SOFASCORE_BASE_URL` env var |
| `backend/src/config/tournament.js` | Round structure constants (ROUNDS, MATCHES_PER_ROUND) |
| `backend/src/data/tournaments.js` | Tournament registry — all events, statuses, `r1PerMatchLock` flag |
| `backend/src/data/mockDraw.js` | Mock draw dispatcher |
| `backend/src/data/miamiDraw.js` | Miami mock draw (legacy) |
| `backend/src/utils/email.js` | All 7 transactional email builders + admin digest. Three-font system (Outfit/Fraunces/JetBrains Mono), gold pill CTAs, tennis court header background, dedup/approval queue via `emails_sent` table. |

### Frontend

| File | What it does |
|---|---|
| `frontend/src/pages/PickScreen.jsx` | Pick flow — round tabs, countdown, player list, current pick card, pending-round banner, `pendingPrevRound` badges |
| `frontend/src/pages/Leaderboard.jsx` | Leaderboard — stats bar, 4-column table (Player / Status / Progress / Current Pick), pick history modal. Pick column shows "🔒 Hidden" during open window, player name after lock. |
| `frontend/src/pages/GroupHome.jsx` | Group dashboard — hero, pick CTA, nav cards, invite box |
| `frontend/src/pages/DrawViewer.jsx` | Draw viewer — bracket + list view |
| `frontend/src/pages/PickHistory.jsx` | User's pick history |
| `frontend/src/context/AuthContext.jsx` | **UPDATED** — Auth context with JWT token storage, `authFetch()` helper (auto-attaches Authorization + X-CSRF-Token headers), CSRF cookie reader. |
| `frontend/src/components/Layout.jsx` | Nav header, auth modal |
| `frontend/src/styles/tokens.css` | Design tokens — three font stacks (--ds-font-sans: Outfit, --ds-font-display: Fraunces, --ds-font-mono: JetBrains Mono), colour palette, spacing, motion |
| `frontend/src/styles/micro-interactions.css` | 8 micro-interaction improvements — button press, card entrance, pick pulse, skeleton shimmer, tab crossfade, gold CTA shimmer, arrow nudge, modal exit |
| `frontend/src/index.css` | All styles — see mobile section below |
| `frontend/public/email-court-bg.png` | Tennis court background image for email headers (white lines at 18% opacity, dashed net, gradient mask) |
| `frontend/src/components/Layout.css` | Header/nav/footer styles |
| `frontend/src/data/tournaments.js` | Tournament config (drawAvailable flag, entry dates, etc.) |
| `frontend/src/data/roundLabels.js` | Shared round label constants (ROUND_SHORT for tabs, ROUND_FULL for prose) |
| `frontend/src/components/MatchupModal.jsx` | Matchup modal — tabbed UI (Form / H2H / Profile). Combines Goalserve tournament form, Matchstat H2H + profiles + surface stats. |
| `frontend/src/components/MatchupModal.css` | Matchup modal styles — tabs, H2H bars, profile card, rank badges, mobile bottom-sheet |
| `frontend/src/hooks/useFocusTrap.js` | Focus trap hook for modals (Tab cycling, auto-focus, Escape passthrough) |
| `frontend/src/components/ErrorBoundary.jsx` | React error boundary wrapping entire app (crash recovery) |
| `frontend/src/components/Skeleton.jsx` | Skeleton loading components for Leaderboard and GroupHome |
| `frontend/src/utils/playerImage.js` | Shared avatar helpers: `avatarColour()`, `initials()`, `nameSlug()`, `isMockId()`, `getPlayerImageUrls()` — fallback chain (ATP CDN → initials) |
| `frontend/src/ui/PlayerAvatar.jsx` | CSS sprite-based headshot component. Checks `playerManifest.json` in-memory (zero HTTP for misses), renders via `background-position` on sprite sheet. Falls back to coloured initials circle. |
| `frontend/src/ui/PlayerAvatar.css` | Context-specific avatar sizing: 32px rows (PickScreen), 40px picked card, 20px bracket, 24px list, 56px matchup modal, mobile scale-down |
| `frontend/src/data/playerManifest.json` | Sprite map — 169 player slugs → `{x, y, i}` positions in the 1280×880 WebP sprite sheet |
| `frontend/public/player-sprite.webp` | Single 205KB sprite sheet replacing 170 individual headshot requests (6.4MB). 16×11 grid of 80px cells |

### Mobile app (separate repo: `tennis-survivor-mobile`)

| File | What it does |
|---|---|
| `src/screens/PickScreen.tsx` | Pick flow — round tabs, countdown, player list, 60s auto-refresh, opponent search, pending badges |
| `src/screens/LeaderboardScreen.tsx` | Leaderboard + member pick history modal (tap row to see picks) |
| `src/screens/GroupScreen.tsx` | Group dashboard — stats, deadline, current pick, share invite |
| `src/screens/DrawScreen.tsx` | Draw list view + matchup modal (H2H, stats, recent form from `/api/matchup`) |
| `src/screens/PoolsScreen.tsx` | Landing — pool cards, hero CTA, invite code input |
| `src/screens/ProfileScreen.tsx` | Profile editing + pool history table + logout |
| `src/screens/RegisterScreen.tsx` | Registration with T&Cs acceptance checkbox |
| `src/screens/MyPicksScreen.tsx` | Cross-pool pick history (bottom tab) |
| `src/components/PlayerRow.tsx` | Player row — name, seed, opponent/TBD, pending badge, pick button |
| `src/api/client.ts` | API client — auto-injects userId from SecureStore, error handling |
| `src/api/picks.ts` | Pick API — Player interface (opponentName, opponentPossible, status), pick CRUD |
| `src/api/draw.ts` | Draw + matchup API — getMatchup() for H2H data |
| `src/api/groups.ts` | Pool/group API — Group/Pool interfaces with tournament sub-object |
| `src/context/AuthContext.tsx` | Auth state — login, register, logout, refreshUser, persisted to device storage |
| `src/navigation/index.tsx` | Deep linking config, auth gate (AuthStack vs MainTabs) |
| `src/hooks/usePollData.ts` | Generic polling hook (pauses on background, resumes on foreground) |
| `src/hooks/useCountdown.ts` | Countdown timer hook (HH:MM:SS, isExpired, isUrgent) |
| `app.json` | Expo config — bundle ID, scheme, associated domains, EAS config |

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
| `GET /api/matchup/:p1Key/:p2Key?name1=X&name2=X` | Player matchup — seed draw info, tournament form, Matchstat H2H/profiles/surface stats. 5-min cache. |
| `GET /api/health` | Health check — returns 500 if API key missing or API call fails |
| `GET /api/admin/approve-emails?secret=X` | One-click email approval — preview (HTML page) or send (`&confirm=true`) |
| `POST /api/admin/approve-emails` | Programmatic email approval — `{secret, confirm}` |

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

### 16. ~~React hooks violation in GroupHome (white screen)~~ — FIXED (17 Apr 2026)
`useState(lbData)` and `useEffect` for leaderboard fetch were placed inside a conditional block (`if (groupId && group)`). When `group` was null on first render, React saw fewer hooks. When `group` loaded, the extra hook call violated Rules of Hooks, causing error #310 (infinite re-render / white screen). Fix: moved both hooks to the component's top level. **Third hooks violation in this project** (after DrawViewer 6 Apr and this). Must check hooks ordering before every push.

### 17. ~~Railway build failure — dead imports in draw.js~~ — FIXED (17 Apr 2026)
`draw.js` imported `getApiKeyMap` and `getLiveDraw` from `tennisData.js`, but these were removed during the 13 Apr data adapter refactor. Node.js throws on missing named exports, preventing the backend from starting. Railway kept running the previous successful deploy, so the site appeared "live" but none of the new backend code (payment routes, R1 per-match lock, data adapter) was actually deployed. Fix: removed dead imports and three MC-only admin endpoints (`/fix-mock-ids`, `/fix-names`, `/live-completed`). **Lesson:** when refactoring a module's exports, grep for all consumers of the removed exports.

### 18. Stale mnt path causing reverted commits — SYSTEMIC RISK
The mnt FUSE mount reflects Mickey's Mac filesystem. If Mickey doesn't `git pull` after other Cowork sessions push commits, the mnt files are older versions. Pushing from mnt overwrites newer changes on GitHub. This happened on 17 Apr: the big push (`0636b2c`) reverted winner detection commits (`ba5a47a`, `33008d7`) that had been pushed by earlier Cowork sessions. **Mitigation:** before pushing from mnt, always diff against GitHub HEAD — don't trust mnt's git status alone. Prefer `/tmp` clone which always has latest.

---

## Current tournament state (as of 19 April 2026)

### Monte Carlo 2026 (COMPLETE)
- Result: Mark won from 12 entrants (lasted longest — eliminated in Final)
- Real DB group: `2d0d1477-0761-49c8-aaf7-d54ad466062f`
- Winner detection: backend `leaderboard.js` sets `isWinner` on longest-surviving member(s), even if all eliminated
- GroupHome completed view: fetches leaderboard API for `isWinner` flag, shows winner banner
- Leaderboard: winner row has gold highlight, trophy emoji, "Winner" status (not greyed out)
- Lessons: see memory `project_monte_carlo_activation.md`

### Madrid 2026 (NEXT — almost ready)
- Tournament: Mutua Madrid Open 2026
- Status: `upcoming` — draw expected 19-20 Apr, tournament starts 22 Apr
- Entry: Free (second free tournament before Roland Garros paid launch)
- R1 model: **Standard fixed deadline** (`r1PerMatchLock: false`). Per-match lock code retained for future mobile app use.
- Real DB group: `a76829c9-b27c-4f6a-80c9-ae0437767c0a` (4 entries as of 19 Apr)
- Data source: Goalserve (`GOALSERVE_API_KEY` set in Railway, adapter implemented) with API-Tennis fallback
- Active tournament config: `backend/src/config/activeTournament.js` (set `ACTIVE_TOURNAMENT=madrid-2026`)
- Pre-launch member view: leaderboard-style page with stats bar, member table, invite box (deployed 17 Apr)
- Goalserve adapter: implemented in `dataAdapter.js` with 5-min cache, status mapping, round mapping, withdrawal detection. **Needs testing once draw drops.**

### Email design system (aligned 19 Apr)
All 7 transactional email templates + admin digest in `backend/src/utils/email.js`. Fully aligned to live site design:
- **Three-font system:** Outfit (body), Fraunces (display headings), JetBrains Mono (eyebrow labels). Loaded via Google Fonts `<link>`.
- **Tennis court header:** `email-court-bg.png` background image (white court lines at 18% opacity, dashed net line, gradient mask). VML fallback for Outlook.
- **Gold pill CTAs:** `background: #FFC933; color: #2B1F00; border-radius: 999px` — matches "Join pool" button on site.
- **Footer brand:** Split-font treatment: "Final" in Outfit bold + "Serve-ivor" in Fraunces italic green. Tagline "A tennis survivor pool" in JetBrains Mono.
- **Colour tokens:** Mirror `frontend/src/styles/tokens.css` — canvas #FAFAF7, primary #0F4A23, gold #FFC933, etc.
- **Dedup/approval flow:** Emails queue as `pending` in `emails_sent` table. Admin approves via one-click button in digest email (hits `GET /api/admin/approve-emails?secret=X&confirm=true`). Cron never sends directly.
- **Templates:** welcome, tournament-join, pick-reminder, round-survival, elimination, winner-announcement, withdrawal-alert, draw-released, admin-digest.

### What deployed on 18 Apr (backend + frontend)
Full-stack polish across 7 commits. **Key changes:**
1. Backend audit: rate limiting, leaderboard sort fix, runtime lock overrides, 4 critical bug fixes
2. Frontend audit: design tokens, breakpoints, copy, ErrorBoundary, Skeleton loaders, shared roundLabels.js
3. Hero background fix (ink → primary on PickScreen + Leaderboard)
4. Email reskin: all templates aligned to Direction A design system
5. Pre-Madrid polish: admin withdrawal endpoint (`POST /api/admin/withdrawal`), withdrawal + draw-released email templates, PickScreen R1 enhancements (opponent search, match time sort, start-soon badges), AbortController on fetches, copy pass, OG image
6. Accessibility: useFocusTrap hook, modal focus traps, keyboard-navigable leaderboard rows

### Outstanding actions (priority order)
1. ~~Activate Goalserve trial~~ DONE 19 Apr
2. ~~Implement Goalserve adapter~~ DONE 19 Apr
3. ~~Test Goalserve against live data~~ DONE 20 Apr — API calls working, parallel fetch deployed, empty result caching fixed
4. **Set lock time overrides for R1+** — once order of play is announced, update `activeTournament.js` with actual first match times minus 1 hour (now also auto-set by `autoSetLockTimes()` in opsMonitor.js)
5. **Verify micro-interactions on live site** — 8 CSS improvements deployed, need visual check
6. **Modal exit animation JS trigger** — CSS deployed in `micro-interactions.css` but needs JS change in `Layout.jsx` to add `.ds-modal--closing` class before removing modal from DOM
7. ~~Pre-Madrid: SPF/DKIM for Brevo~~ VERIFIED 21 Apr — all 4 DNS records (Brevo code, DKIM 1 CNAME, DKIM 2 CNAME, DMARC) confirmed authenticated in Brevo dashboard. Domain hosted on Namecheap.
8. ~~Pre-Madrid: Mobile app sync~~ DONE 20 Apr
9. **Set MATCHSTAT_API_KEY in Railway** — `be1dd031f9mshb908f5a101ba8e7p1717c2jsna963ec13b8ee`. Without this, matchup modal shows seed draw + Goalserve data only (no H2H/profiles).
10. **Matchstat Pro tier decision** — free tier caps rankings to 11 players (name→ID cache). Pro is $10/mo, removes limit. Mickey wants to trial before committing.
11. **Post-Madrid: EAS Project ID** — set before App Store submission
12. **Post-Madrid: App Store submission** — TestFlight, screenshots, metadata
11. ~~Add `DATABASE_URL` GitHub secret~~ DONE 19 Apr
12. ~~Build Phase 1 automation~~ DONE 19 Apr
13. **Validate Phase 1 during Madrid** — confirm results processing, withdrawal detection, draw release emails, lock time auto-setting all work against live data
14. **Run daily ops brief first time** — click "Run now" on `fsv-daily-ops-brief` scheduled task to pre-approve tool permissions
15. **Build Phase 2 (Marketing)** — post-Madrid: brand voice doc, content calendar, weekly content scheduled task
16. **Clean up old headshot files** — `frontend/public/players/*.jpg` (173 individual files, 6.4MB) superseded by `player-sprite.webp` (205KB). Low priority.
17. **Add H2H data source** — Goalserve has no H2H endpoint. Matchup modal shows tournament form only. Investigate Goalserve player profiles or alternative H2H data source post-Madrid.

### Opponent matchup feature (3 Apr, mobile parity 9 Apr)
Pick screen now shows opponent info below each player name. Three states:
- **Known:** "vs Stan Wawrinka"
- **Qualifier/unknown:** "vs Qualifier"
- **TBD (previous round pending):** "vs Player A or Player B" (italic)
Backend: `buildOpponentMap()` in `picks.js` enriches available players response.
Web: `.player-name-col` wrapper in `PickScreen.jsx` with `.player-opponent` sub-line.
Mobile: `PlayerRow.tsx` reads `opponentName` and `opponentPossible` from Player interface.

### Mobile app feature parity (9 Apr)
Full cross-platform audit completed. Mobile now matches web on all critical flows:
- Pick submission, search (player + opponent name), 60s auto-refresh
- Leaderboard with pick history modal (tap any row)
- Draw with matchup modal (H2H, stats, recent form)
- Profile with pool history table
- Registration with mandatory T&Cs acceptance
- Deep links for invite codes and group pages
**Remaining gaps (acceptable):** no bracket view (list only), no password reset deep link, EAS Project ID not set.

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
| 9 Apr 2026 (session 1) | **Mobile bug fixes.** Fixed MyPicksScreen empty (backend returns `groupId`/`groupName`, code read `pool.id`/`pool.name`). Fixed DrawScreen matchup modal — was opening Google search; rewrote to fetch from `/api/matchup` endpoint and display H2H, stats, recent form in-app (matching web MatchupModal). |
| 9 Apr 2026 (session 2) | **Mobile feature parity audit + full debug pass.** Ran 3 parallel audit agents mapping every feature across web (11 routes), mobile (13 screens), and backend API. Cross-referenced to find 9 gaps. **Fixes (commit `12dd81f`):** (1) Added T&Cs acceptance checkbox to RegisterScreen (legal requirement). (2) Added pool history table to ProfileScreen (web has it). (3) Fixed PickScreen search to filter on opponent name + opponentPossible (web does this). (4) Fixed PlayerRow to use `opponentName`/`opponentPossible` fields (was checking `opponent` which doesn't exist). (5) Added 60s auto-refresh polling to PickScreen (matches web). (6) Added mounted guards to PickScreen interval and LeaderboardScreen modal to prevent memory leaks. (7) Fixed pre-existing TypeScript errors (`entryOpen` type in groups.ts, Pick type guard in MyPicksScreen). Zero TypeScript errors after all fixes. **Noted but not fixed:** bracket view (list only on mobile — acceptable), EAS Project ID (set at submit time), password reset deep link (low priority — users can reset via web). Updated CLAUDE.md with full mobile app reference. |
| 13 Apr 2026 | **R1 per-match lock + API replacement prep.** (1) Designed and built R1 per-match lock system: no fixed R1 deadline, players removed as match starts, withdrawal re-pick flow. (2) Created `dataAdapter.js` — unified data interface with provider chain (Goalserve stub/API-Tennis bridge/Sofascore). Internal fixture format with `isWithdrawal` and `startTime` fields. (3) Created `activeTournament.js` — centralised tournament config with `r1PerMatchLock` flag. (4) Updated `picks.js` — R1 branch in `getAvailablePlayers()` uses per-match filtering; R1 branch in `POST /api/picks` checks player's match start time. (5) Updated `getDeadlines()` — returns `perMatchLock: true` for R1, no `lockAt`. (6) Rewrote T&Cs: Section 5 split into 5a (R1 per-match), 5b (R2+), 5c (overlapping rounds); new Section 6 (withdrawals); new Section 11 (notifications). (7) Added R1 hint banner + CTA to GroupHome. (8) Updated FE+BE tournament configs: MC → completed, Madrid → upcoming with `r1PerMatchLock: true`. (9) Wrote handoff doc for 17 Apr session. No code pushed — all changes in mnt, ready for /tmp clone + push on 17 Apr. |
| 17 Apr 2026 | **Big push + 3 hotfixes.** Pushed all 13 Apr session code (24 files) plus 3 same-day fixes. (1) `0636b2c`: R1 per-match lock, data adapter, payment infra, pre-launch member leaderboard view, T&Cs rewrite, Madrid dates corrected. (2) `254f0ee`: Winner detection fix — GroupHome fetches leaderboard API for `isWinner` flag (handles "lasted longest" winners); Leaderboard shows gold winner row instead of greyed out; PoolCard uses `winnerName`. (3) `0db1f0c`: **Hotfix** — React hooks violation. `useState(lbData)` was inside conditional block, crashing entire site with white screen (error #310). Moved to top level. (4) `ce8c497`: **Hotfix** — Railway build failure. `draw.js` imported `getApiKeyMap`/`getLiveDraw` which were removed in the 13 Apr refactor. Removed dead imports and 3 MC-only admin endpoints. **Stale mnt incident:** first push from mnt reverted winner detection commits (`ba5a47a`, `33008d7`) because Mickey's Mac hadn't pulled. Re-implemented in commit 2. **Lesson:** always diff against GitHub HEAD before pushing from mnt; prefer `/tmp` clone. |
| 18 Apr 2026 | **Full-stack polish + pre-Madrid hardening.** 7 commits across 2 sessions. **Session 1 (design system + audit):** (1) Backend audit — rate limiting on auth (login 10/15min, register 5/hr, forgot-password 5/15min), leaderboard round sort fix, runtime lock override admin endpoints. (2) Frontend audit — design tokens (--ds-font-display, --ds-gold-hover, --ds-danger-hover), standardised breakpoints to 640px, viewport-fit for iPhone notch, ErrorBoundary, Skeleton loading states, hardcoded colours → tokens, 44px touch targets, shared roundLabels.js, copy improvements, OG meta tags, fixed apostrophe build failures. (3) Hero background fix — PickScreen and Leaderboard had tone="ink" (black) instead of "primary" (emerald). (4) 4 critical backend bugs — non-picker elimination typo, hardcoded Miami dates, webhook HMAC verification, admin router not mounted. **Session 2 (emails + features):** (5) Email reskin — all 5 templates + admin digest aligned to Direction A design system (emerald/gold/warm-stone, Outfit font, shared helpers). (6) Pre-Madrid polish — admin withdrawal endpoint (`POST /api/admin/withdrawal`) with pick unlocking and email notification; sendWithdrawalEmail and sendDrawReleasedEmail templates; wired send-draw-released admin endpoint; PickScreen R1 enhancements (opponent search, match time sort, "Starts soon"/"Today" badges, cleaner info card); AbortController on all 5 fetch calls; copy pass ("prize pool" → "prize pot" across 4 files); OG image created (1200x630 emerald+gold). (7) Accessibility — useFocusTrap hook, focus traps on AuthModal and PickHistoryModal, keyboard-navigable leaderboard rows (tabIndex, role=button, Enter/Space). All verified via Vite build + both deploys + backend smoke test. |
| 19 Apr 2026 | **Goalserve integration + micro-interactions + email brand alignment.** Across 2 sessions. **Session 1 (Goalserve + UI polish):** (1) Verified `GOALSERVE_API_KEY` set in Railway. (2) Researched Goalserve API format via docs — tennis endpoint is `/tennis/fixtures.json`, returns events with `participants` array, `time.status` for match state. (3) Implemented `fetchGoalserve()` in `dataAdapter.js` with 5-min cache, status mapping (Not Started/Finished/Cancelled/etc.), round name mapping, withdrawal detection, ISO 8601 time conversion. (4) Set `goalserveTournamentId` in `activeTournament.js` (Madrid 2026). (5) Rewrote Goalserve adapter after discovering API uses flat fixture structure, not nested rounds. (6) Built and pushed `frontend/src/styles/micro-interactions.css` — 8 improvements: button press feedback, card entrance animations, pick confirmation pulse, skeleton shimmer, tab switch crossfade, gold CTA shimmer, arrow nudge, modal exit animation. Added import in `main.jsx`. Both deployed via GitHub Contents API. **Session 2 (email brand alignment):** (7) Generated HTML mockup gallery of all 9 email templates with sample data. (8) Thorough side-by-side audit of email vs live site styles using Chrome DevTools. Discovered emails were missing Fraunces display font for headings, using wrong CTA colour/shape, and had incorrect footer logo treatment. Fixed in 3 commits: added `FONT_DISPLAY` (Fraunces) and `FONT_MONO` (JetBrains Mono) constants, updated all heading/title/step elements to use Fraunces, changed CTA from green rect to gold pill (matching site's "Join pool" button), fixed footer brand to use split-font treatment (Outfit "Final" + Fraunces italic "Serve-ivor"), updated withdrawal alert border to use design system accent token. (9) Removed "A game of skill" from site footer tagline in `Layout.jsx` (Mickey's request). (10) Created `email-court-bg.png` — tennis court background image for email headers matching the hero section pattern (white lines at 18% opacity on primary green, with left-to-right gradient mask and dashed net line). Pushed to `frontend/public/`. Updated `emailHeader()` to use `background-image` with VML fallback for Outlook. **Pending:** Modal exit animation needs JS trigger in Layout.jsx (CSS deployed but `.ds-modal--closing` class not yet added). Goalserve integration needs testing against live API once Madrid draw drops. Micro-interactions need visual verification on live site. |

| 19 Apr 2026 (session 3) | **Support system + nav + copy polish + context consolidation.** (1) Built full customer support contact form: `POST /api/support` endpoint with rate limiting (5/hr per IP), validation, user context auto-attachment; `sendSupportEmail()` in email.js sends directly via Brevo to finalservivor@gmail.com (bypasses approval queue); frontend `/support` page with category dropdown, subject, message, character counter, "Sending as" badge, success state. Route added in App.jsx, footer link added in Layout.jsx. (2) Added gold pill "My Pool" nav link — fetches user's pool membership via `/api/pools?userId=X`, shows pool name for single membership or "My Pools" for multiple. CSS class `.ds-nav-pool-pill` in Layout.css. Only visible when logged in. (3) Updated How to Play step card copy (4 changes): removed free/paid mention from step 1, removed strategy tip from step 2, removed retirement/withdrawal from step 4, removed prize-splitting from step 5. (4) Context consolidation: audited 17 workspace markdown files, consolidated into `.claude/memory/` files (roadmap.md, design-audits.md), added session-end protocol to CLAUDE.md, pushed all memory files to GitHub repo. |
| 19 Apr 2026 (session 4) | **Player avatar headshots.** (1) Built PlayerAvatar component with fallback chain: Goalserve ID → name slug → initials circle. Integrated into PickScreen (32px rows, 40px picked card), DrawViewer (20px bracket, 24px list), MatchupModal (56px). Shared utility in `frontend/src/utils/playerImage.js`, component in `frontend/src/ui/PlayerAvatar.jsx` with responsive `.css`. (2) Sourced headshots from ATP Tour CDN (`atptour.com/-/media/alias/player-headshot/{4-char-id}`). Both Sofascore and ATP Tour block server-side requests (403), so used browser console script approach — paste JavaScript into Chrome DevTools on atptour.com to fetch same-origin. (3) First batch: 110 headshots downloaded and deployed (commit `c705be5`). (4) Cross-referenced against April 2026 ATP rankings (top 150), found 67 missing players. (5) Researched ATP Tour 4-char IDs for all 67 missing players via web search. (6) Created updated console download script with JSZip swapped for individual file downloads (no external library restrictions). (7) Mickey downloaded 63 of 67 missing headshots (4 not available on ATP CDN). (8) Committed and deployed (commit `5580f91`), Vercel deployment READY. Final coverage: 173 player headshots covering virtually all ATP top 150. |
| 19 Apr 2026 (session 5) | **Backup verification + R1 standard deadline switch.** (1) Verified GitHub Actions backup run #3 success (pg_dump v17, 48s, artifact uploaded). Updated infrastructure memory files. (2) **R1 CTA bug fix** — Madrid group page showed "R1 is open" pick CTA before draw was released; gated on `drawAvailable` flag (commit `5d6971b`). (3) **R1 lock mode decision** — after discussion, switched from per-match lock to standard fixed deadline for all tournaments. Rationale: web-only product has no push notifications, casual users need a single clear deadline. Per-match lock code retained for future mobile app use. Changed `r1PerMatchLock: false` in `activeTournament.js`, `tournaments.js` (FE+BE), updated `picks.js` comments (commit `5cadb13`). (4) **Withdrawal policy** — three-tier approach: before deadline (re-pick), after deadline/no time (auto-assign replacement player), mid-match (result stands). (5) **Frontend copy cleanup** — removed all per-match lock text from GroupHome (R1-specific hint branch eliminated), PickScreen (per-match lock info card removed, single countdown for all rounds), and TermsAndConditions (Section 5a rewritten for fixed deadline, Section 6 rewritten with 6a/6b/6c withdrawal tiers) (commit `78e2d07`). Vercel deploy confirmed READY. Updated CLAUDE.md R1 section, auto-memory, and project memory files. |
| 19 Apr 2026 (session 5-prior) | **Project safety: backups + branch protection.** (1) Created `.github/workflows/db-backup.yml` — daily automated PostgreSQL backup via GitHub Actions. Runs `pg_dump` at 03:00 UTC, gzipped, stored as GitHub Actions artifacts (30-day retention, auto-cleanup keeps latest 30). Initial commit `5bc4201`. (2) Enabled branch protection on `main` — force pushes and deletion blocked via GitHub API. (3) Added `DATABASE_URL` GitHub secret (public Railway connection string). (4) Fixed pg_dump version mismatch — Ubuntu default was v16, Railway runs PG 17. Installed `postgresql-client-17` and added PG 17 bin to `GITHUB_PATH` (commits `b415f45`, `533d46b`). (5) Verified workflow end-to-end — run #3 completed successfully (48s, artifact uploaded). (6) Deleted 3 completed workspace files. |
| 20 Apr 2026 (session 7) | **Security audit completion: legacy auth removal.** Continued from session 5 (JWT/CSRF). (1) Mobile app JWT migration — updated 4 files in `tennis-survivor-mobile`: `storage.ts` (added `getStoredToken`/`setStoredToken` with SecureStore), `client.ts` (replaced `X-User-Id` header + `?userId` param with `Authorization: Bearer` token), `auth.ts` (added `token`/`csrf` to `AuthResponse` interface), `AuthContext.tsx` (login/register now persist JWT from server response). Commit `83c71d1`. (2) **Removed legacy auth fallback** from backend — stripped `x-user-id` header and `?userId` query param from `middleware/auth.js` (`requireAuth` + `optionalAuth`) and 3 route files (`groups.js`, `pools.js`, `picks.js`). Commit `5d5872f`. (3) Verified both deploys: Vercel READY, Railway confirmed — `X-User-Id: fake-id` now returns 401 `NO_TOKEN` (previously accepted). **This closes the userId spoofing vulnerability.** All auth now goes through cryptographically signed JWTs. Existing users will need to re-login (one-time friction). |
| 20 Apr 2026 (session 9) | **Performance fix (10-20s → 130ms) + matchup modal rewrite + tournament template.** (1) **Root cause of 10-20s page loads** — Goalserve cache never populated when tournament had 0 fixtures. Every request re-triggered 3 fresh HTTP calls. Three-layer fix: draw-level cache keyed on Goalserve timestamp (commit `222e5cf`), Goalserve-only fetch for seed draw tournaments (commit `93e946a`), cache empty Goalserve results (commit `2c42268` — THE root cause fix). Response times: 130ms consistently. (2) **Matchup modal rewrite** — removed all API-Tennis code. Backend now uses seed draw JSON (name, seed, country) + Goalserve fixture cache (tournament form). Zero external API calls, 139ms. Frontend updated for new data shape: player cards with country flags and seed badges, tournament form with W/L indicators, H2H placeholder. Added `MatchupModal.css` with full design system styling and mobile bottom-sheet layout (commit `b8cbe8a`). (3) **Tournament setup template** — 16-step checklist covering 4 phases (before draw, draw released, tournament starts, tournament complete). Saved to `docs/new-tournament-setup.md` in repo and `CTO - TS/` folder. Covers exact files to change, commands to run, and 6 common gotchas. |
| 21 Apr 2026 (session 11) | **Matchstat Tennis API integration.** (1) Signed up for Matchstat Tennis API on RapidAPI (free tier). Tested endpoints: rankings (top 11 on free tier), H2H info/matches, player profiles, past matches, surface summary. Discovered player ID mapping problem — Matchstat uses its own numeric IDs. (2) **Created `matchstatAdapter.js`** — full service with name→ID cache from rankings (24hr TTL), fuzzy surname matching fallback, 30-min data cache, 8 parallel API calls via `getMatchupIntelligence()`. Functions: `getH2H`, `getH2HMatches`, `getPlayerProfile`, `getPlayerForm`, `getPlayerSurfaceStats`. (3) **Wired into matchup route** — `matchup.js` now imports `getMatchupIntelligence`, enriches each player with `profile`, `recentForm`, `surfaceStats`, and populates `h2h` with `bySurface` and `meetings`. Graceful degradation when `MATCHSTAT_API_KEY` not set. (4) **Rewrote MatchupModal frontend** — tabbed UI (Form / H2H / Profile). Form tab shows tournament form or falls back to Matchstat recent form. H2H tab has surface breakdown bars (green/gold) and recent meetings. Profile tab shows bio details and current-year surface splits. H2H score replaces "vs" when available. Rank badges below player meta. (5) **Added ~180 lines of CSS** in `MatchupModal.css` — tabs, rank badge, H2H bars, profile card, mobile responsive. Commit `703404a`. Both deploys confirmed. **Known limitation:** free tier returns max 11 players in rankings, so name→ID cache only covers top 11. Mickey exploring trial of Pro tier ($10/mo) to remove cap. `MATCHSTAT_API_KEY` needs setting in Railway env vars. |
| 21 Apr 2026 (session 10) | **Email approval fix + Brevo domain verification.** (1) **Diagnosed email approval failure** — admin digest email only showed a raw `curl` command, unusable for non-technical admin. Root cause: no clickable button, no GET endpoint. (2) **Built one-click email approval** — added `GET /api/admin/approve-emails` endpoint that returns HTML pages (preview table or send confirmation). Updated `sendAdminDigest()` in `email.js` to include gold "Approve & Send" pill button and "Preview without sending" link, with admin secret embedded in URLs. Commit `6452fbe`. (3) **Verified Brevo SPF/DKIM** — all 4 DNS records confirmed authenticated: Brevo code (TXT), DKIM 1 (`brevo1._domainkey` CNAME → `b1.finalserveivor-com.dkim.brevo.com`), DKIM 2 (`brevo2._domainkey` CNAME → `b2.finalserveivor-com.dkim.brevo.com`), DMARC (TXT `p=none`). Domain hosted on Namecheap, auto-configured via Brevo's Entri integration. Initial DNS check missed DKIM because Brevo uses CNAME records, not TXT. (4) **GitHub token refresh** — old PAT expired, new one provided and used for push. Both Vercel (READY) and Railway (200 health) confirmed. |
| 20 Apr 2026 (session 8) | **Bracket fix + image optimisation + API performance.** Three performance/display fixes. (1) **Bracket spacing drift fix** — `.bc-col-body` used `justify-content: space-around` which drifted when bye cards had different height from match cards. Replaced with `flex: 1` on `.bc-slot` so every slot gets equal fraction regardless of content (commit `56a1c17`). (2) **CSS sprite sheet for player headshots** — replaced 170 individual JPG HTTP requests (6.4 MB) with a single 205 KB WebP sprite (1280x880, 16×11 grid of 80px cells). `PlayerAvatar.jsx` rewritten to use `background-position`. New files: `frontend/src/data/playerManifest.json` (slug→x,y map, 8KB), `frontend/public/player-sprite.webp` (205KB). Zero HTTP overhead for missing players (manifest check is in-memory). Commit `a5ae16ea`. (3) **Parallelised Goalserve API calls** — the three Goalserve endpoints (fixtures, draw, livescore) were fetched sequentially (each 2-6s, total 6-18s). Now use `Promise.allSettled` to run in parallel (total = max single call ≈ 3-5s). Added promise-level deduplication so concurrent callers share one in-flight fetch. Result: cold miss 5s (was 10-17s), cached <1.2s. Commit `ec7bb58`. |
| 19 Apr 2026 (session 6) | **AI agent operations playbook + Phase 1 automation.** (1) Strategic discussion: Mickey confirmed long-term plan to run FSV with AI agents as entire team, himself as CEO (2-3 hrs/day oversight). (2) Created `FSV_AI_Agent_Operations_Playbook.docx` — comprehensive guide covering 4 agent clusters (Tournament Ops, Tech Lead, Marketing, Support), 3 build phases, daily workflow, costs, technical setup guides, glossary. (3) Built Phase 1 Tournament Operations automation: `opsMonitor.js` with withdrawal auto-detection (`checkWithdrawals`), draw release detection (`checkDrawRelease`), lock time auto-setting (`autoSetLockTimes`), persistent ops logging to `ops_log` DB table, tournament setup template. (4) Built `routes/ops.js` with 4 admin endpoints: `GET /api/ops/summary`, `GET /api/ops/log`, `POST /api/ops/setup-tournament`, `GET /api/ops/health-deep`. (5) Enhanced `resultsProcessor.js` with ops logging. (6) Enhanced 15-min cron in `index.js` to run `runOpsChecks` + slow cycle detection. (7) Added `ops_log` table + indexes to `schema.sql`. (8) Created Cowork scheduled task `fsv-daily-ops-brief` running daily at 8am — fetches ops summary, health check, Vercel status, generates plain-language brief. (9) Verified Railway deployment (new endpoints returning 401 not 404, confirming code is live). (10) Updated playbook Phase 1 table with completion status (Steps 1-4 DONE, Step 5 ACTIVE, Step 6 PENDING). Commit `5220fe4`. |

---

## Deployment discipline

**Every push to `main` auto-deploys to real users.** Treat every commit as a production release.

### Before pushing
1. Trace all execution/render paths through changed code
2. **Check for React rules of hooks violations** — no hooks after early returns, conditionals, or inside `if` blocks. This has caused 3 white-screen incidents (6 Apr DrawViewer, 17 Apr GroupHome). Run `node -e "import('./src/routes/...')"` for backend files to catch missing exports.
3. Check for missing imports, undefined references, typos
4. When refactoring a module's exports, **grep all consumers** for removed exports (17 Apr `draw.js` imported deleted functions from `tennisData.js` — broke Railway build silently)
5. Consider all component states: loading, error, empty data, full data
6. If the change is a significant refactor of a working component, flag the risk and discuss timing

### After pushing
1. Wait for **both** Vercel AND Railway deploys to succeed. Vercel via MCP `list_deployments`; Railway has no MCP — hit `/api/health` to confirm new code is running, or test an endpoint that only exists in the new code.
2. Hit the live site to confirm it loads without white screen
3. Check the specific feature changed actually works
4. Only then move on to the next task

### Stale mnt files — CRITICAL
The mnt path reflects Mickey's Mac filesystem. If other Cowork sessions pushed commits and Mickey didn't `git pull`, the mnt files are **older** than GitHub HEAD. Pushing from mnt will overwrite newer commits.

**Before pushing from mnt:** compare against GitHub HEAD, not mnt's local git status. Preferred: clone to `/tmp` which always gets latest. If using mnt files, diff each changed file against the `/tmp` clone.

### Risk assessment
Before starting feature work, ask: "If this breaks, what's the blast radius?" If the answer is "the whole site goes down" and users are active, defer or implement with extreme caution.


---

## Session-end protocol (MANDATORY)

When Mickey says "update context" or the session is ending, do ALL of the following:

### 1. Update CLAUDE.md (this file)
- Add a row to the **Session history** table summarising what was built, fixed, or decided
- Update **Outstanding actions** — strike through completed items, add new ones
- If any new files, endpoints, or config were added, update the relevant tables above
- Push the updated CLAUDE.md to GitHub

### 2. Update memory files in `.claude/memory/`
These files live in the repo AND in the Cowork workspace. They capture lasting decisions and context that outlive individual sessions.

| File | What to update |
|---|---|
| `MEMORY.md` | Index — add entries for any new topic files |
| `final-serve-ivor.md` | Product state — tournament status, member counts, active features |
| `design-system.md` | Any new fonts, colours, tokens, or component patterns |
| `infrastructure.md` | New services, env vars, deployment changes |
| `email-design.md` | Template changes, new templates, delivery flow changes |
| `roadmap.md` | Phase progress, payment processor status, launch dates |
| `design-audits.md` | New audit findings, items actioned |
| `mickey.md` | New preferences or working patterns observed |

Only update files where something actually changed. Don't touch files for the sake of it.

### 3. Clean up workspace docs
If task-specific docs were created in the workspace folder (`CTO - TS/`):
- Delete any that are fully completed and whose insights are captured in memory files
- Keep active handoff docs and reference docs for unbuilt features

### 4. Push memory files to repo
Memory files must be pushed to GitHub (under `.claude/memory/`) so non-Cowork sessions can access them too. Use the GitHub Contents API.

### What NOT to do
- Don't just append to session history and call it done — that's how context gets lost
- Don't create new one-off docs for decisions that belong in the memory files
- Don't skip the push — local-only files are invisible to other session types
