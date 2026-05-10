# Final Serve-ivor — CTO Agent Context

> Last updated: 10 May 2026 (session 39 — daily brief execution: R64 Rinderknech walkover override + loserDisplayName field + walkover-pending baked into brief skill; leaderboard sort fix with sortLeaderboard() helper, alphabetical tiebreaker, regression test). See "Session-end protocol" at the bottom of this file — follow it at the end of every session.

---

## Tournament transition prompts

When transitioning from one tournament to the next, paste one of these
into the new Cowork task as the opening message:

- **Free tournament** (no entry fee): `docs/transition-prompt.md`
- **Paid tournament** (entry fee, e.g. Roland Garros 2026 onwards):
  `docs/paid-transition-prompt.md`

Both are standalone — Claude reads the file and follows the phases.
The paid version is a superset that adds Stripe/Revolut/processor
checks, payment endpoint smoke, real test purchase, and previous-
tournament settlement steps. Use whichever matches the new pool's
`isPaid` flag.

---

## What the product is

**Final Serve-ivor** is a tennis survivor fantasy game. Players join groups, pick one player per round, and are eliminated if their pick loses. Last survivor wins the prize pool. Built around major ATP draws. Monte Carlo 2026 is complete (Mark won, 11 entrants). Madrid 2026 is complete. **Rome 2026** is now active (started 6 May, free entry, R1 picks open).

---

## Live URLs

| Service | URL |
|---|---|
| Frontend (production) | https://finalserveivor.com |
| Frontend (Vercel alias) | https://tennis-survivor.vercel.app |
| Frontend (staging preview) | https://tennis-survivor-git-staging-mickeyislam96-sketchs-projects.vercel.app |
| Backend API (production) | https://tennis-survivor-production.up.railway.app |
| Backend API (staging) | https://tennis-survivor-staging.up.railway.app |
| Mobile app (iOS) | Expo / React Native — pre-App Store (TestFlight pending) |
| Sofascore proxy (inactive) | https://sofascore-proxy.finalservivor.workers.dev |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend (web) | React + Vite, deployed on Vercel (auto-deploys from GitHub `main` to prod, `staging` branch to preview URL) |
| Frontend (mobile) | React Native + Expo SDK 54 + TypeScript — `mickeyislam96-sketch/tennis-survivor-mobile` |
| Backend | Node.js / Express, deployed on Railway (auto-deploys from GitHub `main` to production env, `staging` branch to staging env) |
| Source control (web) | GitHub — `mickeyislam96-sketch/tennis-survivor` |
| Source control (mobile) | GitHub — `mickeyislam96-sketch/tennis-survivor-mobile` |
| Primary data | FlashScore scraper — Railway cron service (`/scraper/`), Playwright headless Chromium, hourly 10-21 UTC |
| Fallback data | API-Tennis (paid, unreliable) → Sofascore (free, 403-blocked on cloud) → mock |
| H2H intelligence | Matchstat Tennis API (paid) — player profiles, surface stats, recent form |
| Data adapter | `backend/src/services/dataAdapter.js` — unified interface, swappable providers |
| Storage | Railway PostgreSQL (persistent — picks, groups, members, scraped results) |

---

## Infrastructure reference

| Item | Value |
|---|---|
| Railway Project ID | `0ec066c7-c7e1-4abf-8897-3577208c64cd` (was named `successful-embrace`) |
| Railway Service ID (backend) | `df618c7b-3678-4595-aaf7-3ff2f0e86d72` |
| Railway Production Env ID | `148fec0e-b919-423b-93d7-1487cdaa82d4` |
| Railway Staging Env ID | `6e2a12c6-df61-45dc-89e0-d8e71ca0d14f` (NEW — added 7 May 2026) |
| Deploy region | europe-west4 (Netherlands) |
| Vercel Project ID | `prj_HBePdqF7BaXq1qzw7bxu9prRhtyf` |
| Vercel Team ID | `team_ekuiNPY7cIyY2ieq41oWMYvO` |

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

| Variable | Service | Purpose |
|---|---|---|
| `ADMIN_SECRET` | Backend | Auth secret for admin endpoints |
| `ACTIVE_TOURNAMENT` | Backend | Active tournament ID (e.g. `madrid-2026`) |
| `MATCHSTAT_API_KEY` | Backend | Matchstat Tennis API key (paid tier) |
| `TENNIS_API_KEY` | Backend | API-Tennis auth key (legacy fallback) |
| `NODE_ENV` | Backend | Runtime environment |
| `FRONTEND_URL` | Backend | Frontend origin for CORS |
| `BACKEND_URL` | Scraper | Backend API URL for POSTing results |
| `ADMIN_SECRET` | Scraper | Same secret as backend (for Bearer auth) |
| `DEFAULT_ROUND` | Scraper | Current active round (update per round: R1, R64, R32, etc.) |
| `FLASHSCORE_URL` | Scraper | FlashScore live page URL (defaults to Madrid in config.mjs) |
| `RESULTS_URL` | Scraper | FlashScore results page URL |
| `TIMEZONE_OFFSET` | Scraper | UTC offset for tournament city (2 for CEST, 1 for BST) |

**WARNING:** After changing Railway env vars, manually trigger a restart. The scraper service is a separate Railway service from the backend — both need their env vars set independently.

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

## R1 Per-Match Lock (NEW — 13 Apr 2026)

**Applies to:** All Masters 1000 and Grand Slam R1 rounds. Controlled by `TOURNAMENT.r1PerMatchLock` in `activeTournament.js`.

**How it works:**
- R1 has NO fixed closing deadline
- Players are removed from the available pick pool as their match starts (both players in the match)
- Users can pick/switch freely among remaining players whose matches haven't started
- A user's pick is locked the moment their selected player's match begins
- R1 window closes organically when the last R1 match starts (pool becomes empty)

**Withdrawal handling:**
- If a picked player withdraws BEFORE their match starts, user is notified (email + push) and can re-pick from remaining available players
- If withdrawal happens after match start (walkover/retirement mid-match), the result stands
- Admin can manually flag withdrawals via `POST /api/admin/withdrawal` (TODO: build this endpoint)
- Automatic detection: poll API every 5-10 min during R1 for withdrawal/walkover statuses

**Key files:**
- `backend/src/config/activeTournament.js` — tournament config with `r1PerMatchLock: true`
- `backend/src/services/dataAdapter.js` — `getR1MatchTimes()`, `hasMatchStarted()`, `isR1Closed()`, `getAvailableR1Players()`
- `backend/src/routes/picks.js` — R1 branch in `getAvailablePlayers()` and `POST /api/picks`
- `backend/src/services/tennisData.js` — `getDeadlines()` returns `perMatchLock: true` for R1
- `frontend/src/pages/GroupHome.jsx` — R1 hint banner ("Players removed as matches start")
- `frontend/src/pages/PickScreen.jsx` — TODO: update R1 view to show match start times, grey out started matches

**CRITICAL: The R1 per-match lock and the R2+ round-level lock are completely separate code paths.** Changing one must not affect the other. The branch point is `TOURNAMENT.r1PerMatchLock` checked at the start of each function.

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
| `backend/src/services/dataAdapter.js` | **NEW** — Unified data interface. Provider chain (Goalserve/API-Tennis/Sofascore). R1 per-match lock helpers. Internal fixture format. |
| `backend/src/config/activeTournament.js` | **NEW** — Active tournament config. `r1PerMatchLock`, lock time overrides, round date fallbacks, Goalserve tournament ID. |
| `backend/src/services/tennisData.js` | Core data logic — `fetchApiDraw()`, `getDraw()`, `getDeadlines()` (now returns `perMatchLock` flag for R1) |
| `backend/src/routes/picks.js` | Pick submission + `getAvailablePlayers()` — R1 branch uses per-match lock; R2+ uses round-level lock |
| `backend/src/routes/leaderboard.js` | Leaderboard data — returns `currentRoundPick` (player name or null), visibility controlled by `roundIsLocked` |
| `backend/src/routes/draw.js` | `/bracket` and `/debug` route handlers |
| `backend/src/routes/health.js` | Real production health check — validates env vars, live API call, DB ping |
| `backend/src/services/sofascoreAdapter.js` | Sofascore fetch — reads `SOFASCORE_BASE_URL` env var |
| `backend/src/config/tournament.js` | Round structure constants (ROUNDS, MATCHES_PER_ROUND) |
| `backend/src/data/tournaments.js` | Tournament registry — all events, statuses, `r1PerMatchLock` flag |
| `backend/src/data/mockDraw.js` | Mock draw dispatcher |
| `backend/src/data/miamiDraw.js` | Miami mock draw (legacy) |
| `backend/src/utils/email.js` | All 8 transactional email builders + admin digest. Token-driven design system (LIGHT/DARK pairs, six component builders). Cross-client correctness: `color-scheme` meta + `@media (prefers-color-scheme: dark)` + `[data-ogsc]`/`[data-ogsb]` for Outlook 365, mobile media query at 480px, system-font fallback chain (Fraunces → New York → Charter → Georgia). Three-font system (Outfit/Fraunces/JetBrains Mono), gold pill CTAs, CSS-only header line pattern. Dedup/approval queue via `emails_sent` table. Pattern doc: `.claude/memory/feedback_email_design_system.md`. |

### Frontend

| File | What it does |
|---|---|
| `frontend/src/pages/PickScreen.jsx` | Pick flow — round tabs, countdown, player list, current pick card, pending-round banner, `pendingPrevRound` badges |
| `frontend/src/pages/Leaderboard.jsx` | Leaderboard — stats bar, 4-column table (Player / Status / Progress / Current Pick), pick history modal. Pick column shows "🔒 Hidden" during open window, player name after lock. |
| `frontend/src/pages/GroupHome.jsx` | Group dashboard — hero, pick CTA, nav cards, invite box |
| `frontend/src/pages/DrawViewer.jsx` | Draw viewer — bracket + list view |
| `frontend/src/pages/PickHistory.jsx` | User's pick history |
| `frontend/src/components/Layout.jsx` | Nav header, auth modal |
| `frontend/src/styles/tokens.css` | Design tokens — three font stacks (--ds-font-sans: Outfit, --ds-font-display: Fraunces, --ds-font-mono: JetBrains Mono), colour palette, spacing, motion |
| `frontend/src/styles/micro-interactions.css` | 8 micro-interaction improvements — button press, card entrance, pick pulse, skeleton shimmer, tab crossfade, gold CTA shimmer, arrow nudge, modal exit |
| `frontend/src/index.css` | All styles — see mobile section below |
| `frontend/public/email-court-bg.png` | (Legacy — no longer referenced by emails as of session 38c.) Tennis court background image; replaced in emails by a CSS-only repeating-linear-gradient pattern that survives dark mode and image-blocking. File kept in `public/` in case it's wanted for OG/social later. |
| `frontend/src/components/Layout.css` | Header/nav/footer styles |
| `frontend/src/data/tournaments.js` | Tournament config (drawAvailable flag, entry dates, etc.) |
| `frontend/src/data/roundLabels.js` | Shared round label constants (ROUND_SHORT for tabs, ROUND_FULL for prose) |
| `frontend/src/hooks/useFocusTrap.js` | Focus trap hook for modals (Tab cycling, auto-focus, Escape passthrough) |
| `frontend/src/components/ErrorBoundary.jsx` | React error boundary wrapping entire app (crash recovery) |
| `frontend/src/components/Skeleton.jsx` | Skeleton loading components for Leaderboard and GroupHome |
| `frontend/src/utils/playerImage.js` | Shared avatar helpers: `avatarColour()`, `initials()`, `nameSlug()`, `isMockId()`, `getPlayerImageUrls()` — fallback chain (ATP CDN → initials) |
| `frontend/src/ui/PlayerAvatar.jsx` | Circular headshot component with fallback chain (photo → initials circle), responsive sizing |
| `frontend/src/ui/PlayerAvatar.css` | Context-specific avatar sizing: 32px rows (PickScreen), 40px picked card, 20px bracket, 24px list, 56px matchup modal, mobile scale-down |

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

### 16. ~~React hooks violation in GroupHome (white screen)~~ — FIXED (17 Apr 2026)
`useState(lbData)` and `useEffect` for leaderboard fetch were placed inside a conditional block (`if (groupId && group)`). When `group` was null on first render, React saw fewer hooks. When `group` loaded, the extra hook call violated Rules of Hooks, causing error #310 (infinite re-render / white screen). Fix: moved both hooks to the component's top level. **Third hooks violation in this project** (after DrawViewer 6 Apr and this). Must check hooks ordering before every push.

### 17. ~~Railway build failure — dead imports in draw.js~~ — FIXED (17 Apr 2026)
`draw.js` imported `getApiKeyMap` and `getLiveDraw` from `tennisData.js`, but these were removed during the 13 Apr data adapter refactor. Node.js throws on missing named exports, preventing the backend from starting. Railway kept running the previous successful deploy, so the site appeared "live" but none of the new backend code (payment routes, R1 per-match lock, data adapter) was actually deployed. Fix: removed dead imports and three MC-only admin endpoints (`/fix-mock-ids`, `/fix-names`, `/live-completed`). **Lesson:** when refactoring a module's exports, grep for all consumers of the removed exports.

### 19. ~~Invite-link case-sensitivity bug~~ — FIXED (5 May 2026, session 34)
`POST /api/groups` generated invite codes as `<NAME>-<base36 suffix>`, where `Date.now().toString(36)` returns lowercase characters. The lookup endpoint `GET /api/groups/invite/:code` then uppercased the URL parameter and ran a case-sensitive `WHERE invite_code = $1`. Mismatch — silent 404 on roughly half of all generated codes (whichever ones happened to contain `a-z` in the suffix). Rome 2026 was affected (`ROME-2026-POOL-bxxhnp`); Madrid worked because its code was regenerated via the admin endpoint which uppercases its `Math.random()` suffix. Fix (commit `fc0bad8`): generation now uppercases the suffix; lookup uses `WHERE UPPER(invite_code) = $1` (defence in depth, heals all historical mixed-case codes — no DB migration needed). Verified live: invite endpoint returns 200 for the Rome pool. Lesson: when the same field is touched by two code paths (generation and lookup), force-pin them to the same casing or build a case-insensitive comparison from day one.

### 18. Stale mnt path causing reverted commits — SYSTEMIC RISK
The mnt FUSE mount reflects Mickey's Mac filesystem. If Mickey doesn't `git pull` after other Cowork sessions push commits, the mnt files are older versions. Pushing from mnt overwrites newer changes on GitHub. This happened on 17 Apr: the big push (`0636b2c`) reverted winner detection commits (`ba5a47a`, `33008d7`) that had been pushed by earlier Cowork sessions. **Mitigation:** before pushing from mnt, always diff against GitHub HEAD — don't trust mnt's git status alone. Prefer `/tmp` clone which always has latest.

---

## Current tournament state (as of 5 May 2026)

### Monte Carlo 2026 (COMPLETE)
- Result: Mark won from 12 entrants (lasted longest — eliminated in Final)
- Real DB group: `2d0d1477-0761-49c8-aaf7-d54ad466062f`

### Madrid 2026 (COMPLETE)
- Tournament: Mutua Madrid Open 2026
- Result: Rafa won (6 members, all eliminated)
- Real DB group: `a76829c9-b27c-4f6a-80c9-ae0437767c0a`
- Entry: Free. R1 model: standard fixed deadline.

### Rome 2026 (ACTIVE — R1 pick window open)
- Tournament: Internazionali BNL d'Italia 2026
- Status: `active` — R1 starts 6 May, pick window open until 09:00 UTC 6 May
- Entry: Free (third free tournament before Roland Garros paid launch)
- R1 model: Standard fixed deadline (`r1PerMatchLock: false`)
- Real DB group: `de81ed56-6c30-483a-9d38-3c48201ab42e`
- Invite code: `ROME-2026-POOL-bxxhnp`
- Data source: FlashScore scraper (Railway cron service, hourly). Scraper env vars updated for Rome.
- Active tournament config: `backend/src/config/activeTournament.js` (`ACTIVE_TOURNAMENT=rome-2026`)
- Scraper service: Railway service ID `012860d6-07a0-48f1-8818-ccc4625188a0`
- Seed draw: `backend/src/data/seedDraws/rome-2026.json` (128 positions, official ATP draw 05/05/2026)
- Player headshots: 49/52 R1 players have photos; Cadenasso + Cina too low-ranked (show initials)

### Email design system (rewritten 9 May 2026 — session 38c)
All 8 transactional email templates + admin digest + support email in `backend/src/utils/email.js`. Full pattern doc: `.claude/memory/feedback_email_design_system.md`.
- **Three-font system:** Outfit (body) + Fraunces (display) + JetBrains Mono (eyebrows). Loaded via Google Fonts `<link>`. Apple Mail iOS strips this — fallback chain extended: Fraunces → New York → Charter → Georgia.
- **CSS-only header pattern:** `repeating-linear-gradient` line texture replaces the previous court-bg PNG. Survives dark mode + image-blocking.
- **Gold pill CTAs (bulletproof):** VML for Outlook + HTML+CSS for everyone else. `mso-padding-alt` so the touch target is the full button.
- **Footer brand:** Same split-font ("Final " Outfit bold + italic Fraunces "Serve-ivor"); footer brand colour swaps to lighter green in dark mode.
- **LIGHT and DARK token pairs:** every coloured surface, text, border has both modes defined. To rebrand, edit the two token objects.
- **Dark mode handling:** `<meta name="color-scheme" content="light dark">` + `@media (prefers-color-scheme: dark)` (Apple Mail, Gmail web) + `[data-ogsc]`/`[data-ogsb]` (Outlook 365). Every dark override uses `!important`.
- **Mobile media query at 480px:** padding 40→24, H1 28→24, body 16→15. Container goes edge-to-edge, no rounded corners on mobile.
- **Component builders:** `wrapper`, `header`, `footer`, `cta`, `card`, `paragraph`, `divider`, `sectionEyebrow`. Adding a template = write a body function, call `wrapper()`. Public `send*` and `build*` API signatures preserved.
- **Dedup/approval flow:** unchanged. Emails queue as `pending` in `emails_sent` table. Admin approves via `POST /api/admin/approve-emails`. Cron never sends directly. Welcome / password-reset / support send directly.
- **Templates (in order in file):** welcome, tournament-join, password-reset, pick-reminder, round-result (handles both survival and elimination via `survived` flag), withdrawal-alert, draw-released, support, admin-digest.

### What deployed on 18 Apr (backend + frontend)
Full-stack polish across 7 commits. **Key changes:**
1. Backend audit: rate limiting, leaderboard sort fix, runtime lock overrides, 4 critical bug fixes
2. Frontend audit: design tokens, breakpoints, copy, ErrorBoundary, Skeleton loaders, shared roundLabels.js
3. Hero background fix (ink → primary on PickScreen + Leaderboard)
4. Email reskin: all templates aligned to Direction A design system
5. Pre-Madrid polish: admin withdrawal endpoint (`POST /api/admin/withdrawal`), withdrawal + draw-released email templates, PickScreen R1 enhancements (opponent search, match time sort, start-soon badges), AbortController on fetches, copy pass, OG image
6. Accessibility: useFocusTrap hook, modal focus traps, keyboard-navigable leaderboard rows

### Outstanding actions (priority order)
1. ~~Activate Goalserve trial~~ DONE 19 Apr — replaced by FlashScore scraper 22 Apr
2. ~~Implement Goalserve adapter~~ DONE 19 Apr — Goalserve removed from codebase 22 Apr
3. ~~Test data against live data~~ DONE — FlashScore scraper running on Railway
4. ~~Pre-Madrid: SPF/DKIM for Brevo~~ DONE 24 Apr — SPF record fixed, all DNS verified
5. **Update lock time overrides per round (Rome)** — update `activeTournament.js` R64 through F lock times once each round's order of play is announced (current values are estimates)
6. **Update DEFAULT_ROUND env var per round (Rome)** — Railway scraper service, change R1 → R64 → R32 etc. as tournament progresses
7. ~~Verify scraper is posting Rome data~~ DONE 7-9 May — scraper running, R64 propagating; R1 dates were misstamped today's date until fixed in session 38b (DD.MM. parsing + dateStr+decided→null)
8. **Payment infrastructure for Roland Garros** — Revolut Business bridge plan. Mickey needs to register UK Ltd, open Revolut Business account before RG launch (18 May)
9. ~~Modal exit animation JS trigger~~ DONE 8 May (PR #18) — `useModalExit` hook + applied to AuthModal, PickHistoryModal, GroupHome inline modal
10. **Mobile app sync** — Rome activation not yet reflected in React Native app
11. **EAS Project ID + App Store submission** — set before TestFlight/App Store
12. ~~Staging environment on Railway + Vercel~~ DONE 7 May 2026 — `staging` branch deploys to `tennis-survivor-staging.up.railway.app` (Railway) and Vercel preview URL. Each has isolated Postgres.
13. ~~Wire UptimeRobot to /api/health~~ DONE 7 May (session 36) — prod + staging on 5-min interval, email alerts mickeyislam96@gmail.com. Confirmed firing during morning redeploy.
14. **Stage 2 admin token rollout — code DONE (session 38, PR #16)**, Mickey-side: set `ADMIN_TOKEN_FINANCIAL` on Railway. Once that env var exists, master `ADMIN_SECRET` is auto-blocked from financial endpoints. No code redeploy needed.
15. ~~Verify pg_dump restore~~ Code DONE 8 May (PR #17) — `.github/workflows/db-restore-verify.yml` quarterly cron + manual `scripts/test-db-restore.sh`. Auto-files GitHub issue on failure. First quarterly fire: 1 Jul 2026.
16. **Update FRONTEND_URL on Railway staging service** — currently still pointing to prod URL; CORS will reject staging-frontend → staging-backend calls until updated.
17. ~~Add `staging` branch trigger to GitHub Actions tests.yml~~ DONE 8 May (PR #15) — `tests.yml` push + PR triggers now include `staging`.
18. **Daily walkover-pending check (during tournament)** — every morning while a tournament is live, hit `GET /api/admin/walkover-pending?secret=$ADMIN_SECRET`. Count > 0 means a match needs an entry in `manualResultOverrides`. See `docs/transition-prompt.md` Phase 8.5 for the full procedure.
19. **Email queue still has pre-redesign emails in `emails_sent`.** Pending emails queued before session 38c contain the OLD HTML in `metadata.html`. They will send with the old design unless rejected and re-queued. Decision: let them send (mostly low-impact transactional like pick reminders for completed rounds). New emails from now use the new design. To force-flush the old queue: hit `POST /api/admin/approve-emails?confirm=true&secret=…` (sends them) or query the table to bulk-reject if any were timing-sensitive.

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
| 24 Apr 2026 (session 30) | **Full-stack audit + critical fixes.** Continuation from session 29. (1) Fixed DECIDED_STATUSES pattern in `resultsProcessor.js` — retired/walkover matches were not processed as completed; now uses `Set(['completed','retired','walkover'])` everywhere. (2) Fixed eliminating pick display on leaderboard — knocked-out users now show which player eliminated them. (3) Fixed admin digest crash — `_lastDigestPendingCount` was never declared, ESM strict mode threw ReferenceError every 15-min cron cycle, silently swallowed by catch block. Added `let _lastDigestPendingCount = 0;`. (4) Fixed `getPendingEmailsSummary()` missing tournament filter — was querying all tournaments. (5) Confirmed SPF record fixed for Brevo email deliverability. (6) Created reusable end-of-task prompt for context updates. |
| 24 Apr 2026 (session 31) | **Context integrity overhaul.** (1) Updated session-end protocol in CLAUDE.md from 4 steps to 6 — added mandatory stale content audit (step 3) and push verification (step 6). (2) Added "Verification rule (CRITICAL)" section — never trust memory files as source of truth; always verify against actual codebase. (3) Fixed 4 memory files with wrong scraper info (claimed Cowork scheduled task on Mickey's Mac; actually Railway cron service with Playwright). (4) Aggressive memory trim: deleted 10 code-describing files, reduced from 35 to 23 entries. Only decisions, gotchas, preferences, and external references remain. (5) Updated GitHub PAT (old one expired). |
| 5 May 2026 (session 35) | **Critical fixes — alerting, tests, audit log, integration foundation.** Post-Rome continuation. Twelve commits. (1) `ecf83c1`: tournament validator script (`scripts/validate-tournament.mjs`) + mock pool cleanup. (2) `279fa8b`: wired validator + smoke into `docs/new-tournament-setup.md`. (3) `167438d`: `docs/transition-prompt.md` — airtight free-tournament prompt. (4) `48a915d`: `docs/paid-transition-prompt.md` — superset for paid events with payment smoke / settlement / payout phases. (5) `4708e5b`: resolved 12 Rome qualifier names from ATP Tour archive — picks 52→64. (6) `91cd800`: session-35 memory + `project_critical_gaps.md` + `feedback_invite_case_bug.md`. (7) `da3caf8`: stale-scraper guard on `/api/health` — returns 503 if `cacheAge > 4h` during 10–21 UTC active window. (8) `d66c7ad`: Vitest backend test suite scaffold — 11 smoke tests passing locally and on push (health, invite round-trip, picks-and-deadlines). (9) `5f24a09`: central admin-auth module (`backend/src/auth/adminAuth.js`) + `admin_audit_log` Postgres table — every admin call audited; `ADMIN_TOKEN_<SCOPE>` env vars supported but unused (Stage 2). 24 admin routes + draw + payments rewired, backwards compatible. (10) `e9b852c`: DB-backed integration test foundation — `tests/integration/` with `setupTestDb()`, `testApp.js` (no-side-effects router mount), one example mutation test for invite round-trip. Tests skip cleanly without `TEST_DATABASE_URL`. (11) `273455b`: GitHub Actions CI workflow live — `Backend tests` job runs on every push, two parallel jobs (smoke + integration with Postgres 17 service container), both green on first run (~30s). Required adding `Workflows: Read and write` repo permission to the fine-grained PAT. Outstanding for Mickey: UptimeRobot setup, optional staging Railway service. Stage 2 admin-token rollout queued for the 4-day Rome→RG window. |
| 5 May 2026 (session 34) | **Audit + invite-link emergency fix.** Mickey reported invite link broken and "Madrid" tab still showing after Rome launch. Audit found: (1) mnt was 22 commits behind GitHub — session 33 had pushed Rome correctly. (2) Real bug: `groups.js` invite-code lookup was case-sensitive and `Date.now().toString(36)` produces lowercase suffixes, breaking ~50% of all invite links — Rome's `ROME-2026-POOL-bxxhnp` was affected. Pushed `fc0bad8`: uppercase suffix on generation + `UPPER(invite_code) = $1` on lookup. Verified live: invite endpoint returns 200. "Madrid tab" is the gold pill nav showing the user's only-pool — auto-resolves once Mickey joins Rome. Aligned `activeTournament.js` Rome `startDate` to 2026-05-05 (matching both registries). Added `scripts/smoke.sh` post-launch test (4 checks against live API). Updated CLAUDE.md with smoke-test reference and known-issue entry. |
| 24 Apr 2026 (session 32) | **Email approval fix.** `checkSecret()` in `admin.js` had been hardened to reject query-param secrets ("leaked in logs/history"), but the admin digest email sends one-click approval links as `GET /approve-emails?secret=X`. Result: every approval link returned 401. Fix: re-added `req.query.secret` as fallback option 3 in `checkSecret()`. Deployed commit `bc94ce9`. Verified working — returns HTML preview page with pending emails. |

| 5 May 2026 (session 33) | **Rome 2026 activation + site audit.** (1) Full site audit to ensure Rome is prioritised over Madrid across all user-facing surfaces. (2) Fixed My Pools golden nav pill showing Madrid (completed) instead of Rome (active) — updated `Layout.jsx` to prefer active tournament, then upcoming, then any. (3) Fixed player headshots not loading for Rome players — two root causes: `isMockId()` regex didn't match `rome-p3` style IDs (fixed to `/^([a-z]+-)?[ps]\d+$/i`); seed draw stores "Surname, Firstname" but headshots stored as `firstname-lastname.jpg` (fixed `nameSlug()` and `initials()` to handle comma format). Both fixes in commit `37ef883`. (4) Fixed Shevchenko name mismatch in `rome-2026.json` ("Aleksandr" → "Alexander" to match headshot file) — commit `76f0c41449`. (5) Fixed stale Madrid elimination data on Rafa's account in Rome group — `group_members.is_alive = false, eliminated_round = R64` from Madrid was persisting because 0-picks fallback reads DB column; added `POST /api/admin/reset-member` endpoint and called it to restore Rafa, commit `d175b24`. (6) Verified Rome fully activated: health endpoint confirms `tournament: rome-2026`, 52 R1 players with correct opponent pairings, pick window open, group ID `de81ed56-6c30-483a-9d38-3c48201ab42e`. (7) Created reusable tournament transition prompt (9-step checklist for deprioritising old tournament and activating new one). |
| 10 May 2026 (session 39) | **Daily brief execution loop — closed first set of brief-driven prod fixes.** Scheduled fsv-daily-brief skill ran at 12:04 BST. Phase 1b found one 🔴 critical: R64 van de Zandschulp/Rinderknech stuck — Khachanov's R32 reading TBD. Phase 1c visually confirmed on bracket + list views. Mickey approved T1 + T2; opened PR #21. **What shipped (squashed `e5d3f15` then leaderboard PR squashed):** (1) `manualResultOverrides` entry for Rome 2026 R64 — winner van de Zandschulp, status completed, with new optional `loserDisplayName: 'Kovacevic, Aleksandar (LL)'` so the bracket card displays the actual on-court loser (LL) rather than the seed-draw slot name (Rinderknech). (2) `seedDrawOverlay.js` Step 1.5 extended to apply `loserDisplayName` when present, preserving original on `target.player[12]OrigName`. Auto-replacement loop (R1-only) untouched — additive change, contained to overrides that opt in. (3) `.claude/skills/fsv-daily-brief/SKILL.md` Phase 1a step 7 — daily `/api/admin/walkover-pending` check, treats non-empty result as 🔴 critical, falls back to a "Mickey hit this manually" reminder when ADMIN_SECRET not provided. (4) `backend/src/routes/leaderboard.js` — extracted `sortLeaderboard()` helper used by both DB and mock branches. Alive members by `survivedRounds` DESC; eliminated by `roundIndex` of `eliminatedRound` DESC; alphabetical tiebreaker on `displayName` for both. Replaces the `(ROUNDS.indexOf(x) || 0)` JS footgun (`-1 || 0` returned `-1` not `0`, so unknown rounds aliased to R1 instead of bottom). (5) `backend/tests/smoke/leaderboard-sort.test.js` — 7 cases pinning the contract (alive vs eliminated split, survivedRounds DESC, recency DESC, alphabetical ties, unknown rounds at bottom, full Rome 2026 today scenario). (6) `docs/transition-prompt.md` + `docs/paid-transition-prompt.md` Phase 8.5 — added Rinderknech/Kovacevic incident to history and a "Lucky Loser at R64+ recipe" code block showing the loserDisplayName usage. (7) Memory: extended `feedback_seeded_withdrawal_with_bye.md` with the reactive `loserDisplayName` option (vs pre-emptive seed-draw JSON edit); extended `feedback_walkover_admin_override.md` with loserDisplayName + Rinderknech case; new `feedback_leaderboard_sort.md` pinning Mickey's sort rule; MEMORY.md index updated. **Side benefit from PR #21 deploy:** Khachanov vs van de Zandschulp R32 fixture (already played and won by Khachanov at 11:10 UTC) was sitting unmatched in the scraper cache because the slot had no opponent name; once the override unblocked propagation it auto-resolved. dataSource went `+overrides(1)` → `+overrides(2)`, fixtures_total 76 → 78, R32 advanced 4→5 completed. **Verification:** smoke suite 35/35 green (28 prior + 7 new sort tests); CI green on both PRs; live bracket cross-checked post-deploy (R64 winner correct, R32 propagation correct, leaderboard order matches Mickey's rule on Rome's 6-member pool); no member impact on either fix. **Tomorrow's brief should:** include the walkover-pending check from skill update; treat any new sort-related field misuse as a regression (test file is the contract). |
| 9 May 2026 (session 38c) | **Email redesign — Direction A shipped.** Mickey reported emails looked bad on Apple Mail mobile vs Gmail / web. After audit, ~80% of the issue was rendering bugs (no dark-mode handling, no mobile media query, Fraunces falling back to Georgia on iOS, court-bg PNG breaking in dark mode), not bad design. Built three iteration directions ("Polished current", "Editorial", "Quiet utilitarian") in a comparison mockup at `CTO - TS/email-redesign/`. Mickey approved Direction A. Full rewrite of `backend/src/utils/email.js` (PR #20, squash `a54702ed`) preserving every public API signature. Key changes: (1) LIGHT and DARK colour token pairs at top — single source of truth for rebranding. (2) Six component builders (`header`/`footer`/`cta`/`card`/`paragraph`/`divider`/`sectionEyebrow`) used by every template. (3) `<meta name="color-scheme">` + `<meta name="supported-color-schemes">` tells Apple Mail "designed for both modes, don't auto-invert". (4) `@media (prefers-color-scheme: dark)` overrides every coloured surface, text, and border with `!important` so the inline style doesn't win. (5) `[data-ogsc]` and `[data-ogsb]` selectors for Outlook 365 (which doesn't honour prefers-color-scheme — uses its own attribute markers). (6) `@media screen and (max-width: 480px)` mobile breakpoint: padding 40→24, H1 28→24, body 16→15, container edge-to-edge. (7) Font-fallback chain: Fraunces → New York → Charter → Georgia (was Fraunces → Georgia, which looked dated on Apple Mail iOS). (8) Court-bg PNG removed; replaced with CSS-only `repeating-linear-gradient` pattern. (9) Bulletproof CTA button (VML for Outlook + HTML+CSS for rest, `mso-padding-alt` for full touch target). (10) Welcome trimmed from 3 numbered cards to 2 sections + CTA — mobile drops from ~2.5 screens to 1. (11) Admin digest collapsed to 3-column type/round/recipient table + single approve-all CTA. **Verification:** all 9 templates × light/dark/mobile/desktop = 72 permutations smoke-tested locally; CI green for both smoke + integration on the feature branch; backend healthy after Railway redeploy; admin endpoints registered; `/api/draw/bracket` still 200. **Workspace folder:** `CTO - TS/email-redesign/` keeps the comparison mockups + final preview HTML for posterity. **Pattern doc:** new memory file `feedback_email_design_system.md` documents how to add a new template, the dark-mode contract (every coloured element MUST use a CSS class so the @media override can hit it), and the public API surface to preserve. **Note for paid tournaments:** when RG (or future paid events) need new email types like payment receipts or refund notifications, they must follow the same component pattern. The system handles correctness automatically. |
| 9 May 2026 (session 38b) | **Machac/Medvedev walkover incident — scraper picked wrong winner; full systemic fix.** Mickey flagged at 17:30 UTC: bracket showed Machac advancing into R32 from his R64 walkover, but Machac was the one who withdrew so Medvedev should have advanced. **Root cause:** `scraper/src/scrape.mjs` walkover branch — when score is `'---'` (no digits), the existing logic counted 0 sets each and `p1Sets >= p2Sets` defaulted player1 as winner. Pure guess based on player ordering. Wrong half the time. **Fix layers shipped (10 commits):** (1) `33163a3f` — added `manualResultOverrides` array to `activeTournament.js` per-tournament; Rome 2026 entry records Medvedev as the actual R64 winner over Machac. (2) `47cca7a2` — `seedDrawOverlay.js` Step 1.5 applies overrides AFTER scraper data, BEFORE bracket propagation; Step 1.6 flags any `walkover|retired` match without `winnerId` as `requiresAdminReview: true`; new guard in Step 1's winner-matching block refuses to apply scraper-claimed winner when scraper sends `walkover` with no `winnerId`. `dataSource` now annotates `+overrides(N)` and `+REVIEW(N)`. (3) `319000b9` — scraper no longer guesses walkover winners; returns `winnerId: null` and lets admin record truth via overrides. Retired matches keep score-leader heuristic but only on strict majority (tie → null). (4) `a44bcaac` — frontend `DrawViewer.jsx` ListCard renders `Walkover · pending` (amber pill) when status is walkover/retired with no winnerId; existing `done` flag now requires winnerId for walkover/retired. (5) `f4d9e066` — `parseStartTime(timeStr, dateStr, status)` returns null when status is decided + no dateStr (T2 from morning brief). (6) `d610df40` — `resultsProcessor.syncGroupMembersFromPicks()` runs every cron tick; closes the Rafa-still-alive desync (T1 from morning brief). The previous codepath only flipped `is_alive` inside `processRoundResults`, which `autoProcessResults` skipped once all picks for a round were resolved — leaving any latent desync stuck. New defence-in-depth sweep is idempotent. (7) `f78ebc7b` — `scripts/validate-tournament.mjs` step 6 validates `manualResultOverrides` shape (round in tournament rounds, matchPlayers length 2, winner in matchPlayers, status valid, no duplicates). (8) `fc48a3b1` — new `GET /api/admin/walkover-pending` endpoint lists every walkover/retired match without confirmed winnerId; returns a `suggestedOverride` template for each. (9) `1a5db19b` + `1b3d2bc8` — vitest regression test `tests/smoke/walkover-override.test.js` (CI green): override flips winner correctly + propagates to next round; unconfirmed walkover does NOT propagate. (10) `64662930` — follow-up: `parseStartTime` regex now handles `DD.MM.` (FlashScore's typical format with no year). Cross-year inference uses 6-month window. Decided + unparseable dateStr returns null instead of today. **Docs hardening:** `docs/new-tournament-setup.md` gotcha #7 added; `docs/transition-prompt.md` + `docs/paid-transition-prompt.md` Phase 8.5 (BLOCKING daily walkover-pending check) added; both 2b sections now require `manualResultOverrides: []` in setup. **Verification:** prod bracket shows `dataSource: seed_draw+scraper(74)+overrides(1)`, R64 winner=Medvedev with `isManualOverride: true`, R32 propagation correct (Llamas Ruiz vs Medvedev), 0 unconfirmed walkovers, Rafa now `isAlive: false eliminatedRound: R64 eliminatingPick: de Minaur, Alex` (T1 sync ran), `/api/pools.aliveCount` matches `/api/leaderboard` (3). CI green for both smoke + integration jobs on the regression test. **No member impact:** nobody had picked Medvedev or Machac for R64 in the Rome pool, so the bug was purely bracket-display + R32-pool integrity. At RG paid scale, same bug class would directly affect picks. **Why this matters for the future:** walkover winners cannot be inferred from FlashScore output alone. Every tournament needs the daily check. The four prevention layers (scraper refuses to guess + overlay flags pending + admin endpoint surfaces + validator gates overrides) plus the regression test plus the BLOCKING transition-prompt phase mean this specific class of bug cannot ship silently again. |
| 8 May 2026 (session 38, Phase C) | **Polish + transition hardening.** Two PRs to close out the day. **(1) PR #18** (`fix/modal-exit-animation`, commit `3186b3fb`) — wires the JS trigger for the `ds-modal--closing` exit animation that has been in CSS since session 29 (19 Apr). New `frontend/src/hooks/useModalExit.js` exposes `requestClose` + `isClosing`; AuthModal (Layout.jsx), PickHistoryModal (Leaderboard.jsx) and the inline AuthModal in GroupHome.jsx now apply `ds-modal--closing` to the backdrop while the close animation runs, then call the parent's onClose after 200ms. Verified live via JS probe — `.ds-modal--closing` was present mid-animation on the homepage Sign-in modal. **(2) PR #19** (`fix/transition-hardening`, commit `86e7bb0c`) — locks today's two bug classes out of the future. New smoke steps `3c` (asserts every pool returned by `/api/pools` has `entryOpen` populated and that completed pools aren't `entryOpen: true`) and `3d` (asserts no `status: scheduled` match has a `startTime` >6h in the past). New transition-prompt subsections `8e`/`8f` (free) and `8g`/`8h` (paid) with explicit BLOCKING checks for both bug classes. Brief skill `.claude/skills/fsv-daily-brief/SKILL.md` Phase 1b extended to checks `6` (startTime sanity) and `7` (entryOpen consistency); Phase 1c step 1 + step 4 extended for visual verification. Both smoke steps pass against live prod. **(3) Memory.** New file `feedback_transition_hardening_2026_05_08.md` documents the four-layer regression-prevention pattern (code → smoke → prompt → brief). MEMORY.md indexed. **(4) End-of-day status.** All five critical gaps from `project_critical_gaps.md` closed in code; today's two morning-brief bug classes covered by code + tests + smoke + prompts + brief. Mickey-side action remaining for RG: rotate `ADMIN_TOKEN_FINANCIAL` on Railway (runbook in `feedback_admin_scope_rollout.md`) — no code redeploy needed. |
| 8 May 2026 (session 38, Phase B) | **Pre-RG critical-gap closures: PRs #15, #16, #17.** **(1) PR #15** (`fix/ci-staging-pr-trigger`, commit `82891e30`) — `.github/workflows/tests.yml` PR trigger now includes `staging` (was main-only). PRs targeting staging no longer bypass CI. Closes outstanding action #17. **(2) PR #16** (`fix/admin-scope-financial`, commit `3e93ad74`) — Stage 2 of critical-gap #4. `backend/src/auth/adminAuth.js` master-fallback now blocked when scope has its own scoped token configured (`SCOPE_TOKENS[scope]` truthy → master returns 403 with `master_blocked_by_scoped_token`). Three financial endpoints (`POST /api/payments/admin/refund`, `GET /api/payments/admin/list`, `GET /api/payments/admin/revenue`) switched to `requireAdmin(req, res, 'financial')`. New smoke test `tests/smoke/admin-scope-tokens.test.js` — 6 cases. Mickey rotates env vars when ready: set `ADMIN_TOKEN_FINANCIAL` on Railway → those three endpoints stop accepting `ADMIN_SECRET`. No code redeploy needed for the rotation. **(3) PR #17** (`fix/db-restore-drill`, commit `6341b747`) — closes critical-gap #5. New `.github/workflows/db-restore-verify.yml` runs quarterly (1st of Jan/Apr/Jul/Oct, 04:00 UTC, plus `workflow_dispatch`): finds latest successful Daily Database Backup run, downloads its artifact, restores into ephemeral Postgres 17 service container, asserts schema + row counts + referential integrity. On failure auto-opens a GitHub issue tagged `critical, infra`. Manual local drill: `scripts/test-db-restore.sh <path/to/backup.sql.gz>`. **(4) Memory.** New: `feedback_admin_scope_rollout.md` (Stage 2 contract + Mickey's Railway rollout steps for financial scope), `project_db_restore_drill.md` (workflow + manual script docs). MEMORY.md indexed both. `project_critical_gaps.md` updated: gap #5 now Done. **(5) Critical-gaps queue.** All five now closed in code: #1 alerting (s36), #2 tests (s35), #3 staging (s36), #4 stage 1 (s35) + stage 2 code (today), #5 backups + restore drill (today). Mickey-side action remaining: rotate env vars to enable strict mode on financial scope. **(6) PR #16 + #17 had a MEMORY.md merge conflict** (both touched the same anchor); resolved by rebasing #17 against main and keeping both lines. |
| 8 May 2026 (session 38, Phase A) | **Morning-brief executor mode: 4 PRs shipped, all live and verified.** Brief skill ran scheduled at 08:58 UTC → flagged two 🔴 (stale R64 startTimes, homepage Enter CTA on closed pool) plus three smaller items. After diagnosis Mickey authorised autonomous fix-and-ship cadence. Same-session result: PRs #11, #12, #13, #14 all merged to main, deployed by Railway + Vercel, verified live via Chrome MCP. **(1) PR #11** (`fix/scraper-starttime-defaults`, commit `1f7d6e1d`) — initial scraper change made `parseStartTime` return null when no dateStr, plus added a defence-in-depth check in `seedDrawOverlay.js` that drops startTime values >6h in the past for `scheduled` matches. New smoke test `tests/smoke/overlay-starttime-sanity.test.js` (5 cases). **(2) PR #14** (`fix/scraper-keep-today-default`, commit `2da25289`) — follow-up reverting the parseStartTime null-on-missing-date behaviour because it threw away signal for the common case (today's matches displayed time-only by FlashScore are 'today' from the page's perspective and stamping with scrape-time is correct). The wrong-data class is fully covered by the overlay sanity check alone, which is the right architectural location for the contract. **(3) PR #12** (`fix/homepage-entry-open`, commit `1ded4d75`) — backend `/api/pools` now returns `entryOpen: boolean` and `entryClosedReason: 'completed' | 'r1-locked' | null` per pool. Computation rule mirrors `GroupHome.jsx` — entry closed once `now >= R1 lockAt - 1h`. Frontend `Homepage.jsx` filters `OPEN NOW` on `entryOpen === true`, adds new `LIVE NOW` section above showing active+closed pools with `View leaderboard` CTAs, hero eyebrow flips to `LIVE NOW` when featured tournament is active, status pill reads `Live · entry closed`. **(4) PR #13** (`fix/copy-and-health`, commit `4409a92c`) — MatchupModal empty-state copy from `No match results yet. Form will appear here as matches are played` (read as broken on completed matches) to `No prior match history available for these players`. `/api/health` `STALE_THRESHOLD_S` from 4h to 90min during 10–21 UTC active hours so a single missed scrape pages within UptimeRobot's 5-min cadence (was 14:00 UTC for a 10:00 UTC failure; now ~11:30 UTC). **(5) Verification.** Visited live homepage and group draw — `LIVE NOW Tournaments underway` section renders with `Live · entry closed` pill and `View leaderboard` CTA, `OPEN NOW` shows `No pools open right now` because Rome's R1 has locked. MatchupModal on Sinner v Ofner R1 now reads `No prior match history available for these players`. `/api/pools` returns `entryOpen: false, entryClosedReason: r1-locked` for Rome and `r1-locked|completed` for Madrid. **(6) Workflow note.** Used `/tmp` clone for all edits; mnt was 22 commits behind (uncommitted Mac-side changes blocking pull). Each PR branched off main, CI green before merge, squash-merged via GitHub API. Preserved branch-and-PR working agreement throughout. **(7) Pushed back on no-pick reminder email** despite Mickey's initial 'do everything' instruction — email logic in this codebase has burned twice already (cross-pool query, dedup queue) and warrants a dedicated session. Mickey acknowledged after re-reading the rationale. **(8) Brief skill takeaways for next iteration.** Phase 1b's mandatory cross-checks caught both criticals correctly today; Phase 1c's empty-state observation on the matchup modal would have been missed without the visual pass. Skill is paying for itself. |
| 7 May 2026 (session 37)  **(3) R64+ opponent display.** Mickey screenshotted the R64 pick screen — every row was just `<name>` + Pick button, no `vs <opponent>` sub-line. Verified via API: `opponentName` and `opponentPossible` were null for all 71 R64 candidates returned by `/api/picks/available`. Root cause: `backend/src/routes/picks.js > getAvailablePlayers()` had explicit opponent enrichment for R1 (per-match-lock and round-lock paths) but the R2+ branch silently returned the player pool without ever building an `opponentMap`. Frontend `PickScreen.jsx` rendered `vs <opponentName>` only — even if backend had populated `opponentPossible`, frontend ignored it. So R1 worked, R64+ silently broke since 13 Apr 2026 when per-match-lock landed; nobody saw it because R2+ rounds don't open until R1 closes. PR #8 (`a80cd584`): backend now builds `opponentMap` for R2+ via candidate-walking — slot has player ID → use it; slot empty + feeder has winner → use winner; slot empty + feeder unresolved → both feeder players are candidates → `opponentPossible: [A, B]`. Frontend renders `vs <name>` (solid) → `vs A or B` (italic, `--possible` CSS variant) → nothing. Verified live: 70/70 R64 candidates have opponent info on prod. PR #9 follow-up adds regression guards: backend smoke test asserts ≥95% of open-round picks have opponent info; `scripts/smoke.sh` step 3b enforces same in CI + post-launch; both transition prompts (Phase 6) now require an incognito pick-screen visual check; new memory `feedback_picks_opponent_enrichment.md`. Same regression-prevention pattern as the smoke step 1b for the silent-Madrid-scraper bug.| **Silent Madrid scraper diagnosed + fixed (yesterday's PR #4); Vacherot withdrawal handled (today's PR #7); R64+ opponent display fixed and regression-guarded (today's PR #8 + #9).** Two distinct issues, both now closed. **(1) Silent Madrid scraper.** Mickey reported R1 results not settling. Diagnosis: bracket returned `seed_draw+scraper(0)` — every fixture rejected by overlay. Trace: scraper cache had a *completed Final* (Sinner d. Zverev 6-1, 6-2 — Madrid result, impossible for Rome which started today) plus completed SF/QF/R16/R32/R64 with synthetic 06 May timestamps. Root cause: Railway scraper service `valiant-forgiveness` (id `012860d6-07a0-48f1-8818-ccc4625188a0`) had only 3 env vars set (ADMIN_SECRET, BACKEND_URL, DEFAULT_ROUND). `FLASHSCORE_URL` and `RESULTS_URL` were *missing entirely*. `scraper/src/config.mjs` had Madrid URLs hardcoded as defaults, so the scraper silently pulled Madrid for the entire week between Madrid completion (29 Apr) and Rome launch (06 May). Fix sequence: (a) Took computer control, navigated to Railway scraper service → Variables → Raw Editor, added FLASHSCORE_URL=`https://www.flashscore.co.uk/tennis/atp-singles/rome/`, RESULTS_URL=`.../rome/results/`, TIMEZONE_OFFSET=2. (b) Triggered Run now. First fresh Rome scrape at 17:14 UTC: 32 R1 fixtures (13 completed). Bracket immediately recovered: `seed_draw+scraper(0)` → `seed_draw+scraper(31)`. Confirmed Brooksby vs Baez → Baez S. won (Mickey was right; my earlier "Gaubas won" claim was Madrid data leaking through). (c) PR #4 (`fix/scraper-no-madrid-defaults`) merged at `9ee8853`: `requireEnv()` helper in `scraper/src/config.mjs` throws on missing/blank `FLASHSCORE_URL`/`RESULTS_URL` instead of falling back to Madrid. Next missed env var triggers a loud Railway crash. (d) Doc hardening commit `0bbaad9`: transition prompts now have a CRITICAL block on the scraper env var section with explicit verification commands; URLs corrected from `.com` to `.co.uk`. `scripts/smoke.sh` step 1b flags `seed_draw+scraper(0)` post-launch as a regression. `scripts/validate-tournament.mjs` ends with a Railway env-var reminder. New memory `feedback_silent_scraper_defaults.md`. **Lesson:** when CLAUDE.md says "X was updated" with no commit/screenshot/log proving it, treat as unverified. Same class as 17 Apr stale-mnt incident — claims of completed work that weren't actually completed. **(2) Vacherot withdrawal.** Vacherot (seed #14, MON, draw pos 48 with R64 bye) withdrew from Rome 2026; lucky loser Landaluce, Martin (ESP) replaces. seedDrawOverlay's auto-replacement only handles R1 (cancelled-fixture detection runs against R1 only), so seeds-with-byes need a manual `seedDraws/<id>.json` update. PR #7 (`774f2a01`): drawPositions[pos=48] re-pointed to Landaluce with `seed: null` and `isLuckyLoser: true`; seeds["14"] annotated with `withdrawn: true`. Player ID flipped from `rome-s14` (seed-based) to `rome-p48` (position-based) — correct per ATP rules (LL inherits slot, not seed). `/api/admin/withdrawal` called with old ID for audit log; returned "No active picks found" (R64 picks not open yet). Bracket post-merge: `Cilic, Marin (rome-p46) vs Landaluce, Martin (rome-p48) | scheduled` in R64. When FlashScore creates the R64 fixture ("Landaluce M. vs ..."), surname overlay auto-merges via subset match. New memory `feedback_seeded_withdrawal_with_bye.md` documents the pattern for future reference. |
| 7 May 2026 (session 36) | **Staging + AI ops loop end-to-end + critical-gap closures.** Long, productive session covering infra, the daily-brief loop, three live fixes plus one revert, and UptimeRobot. **(1) Staging environment shipped.** `staging` branch from main SHA `9ee8853`. Railway env duplicated in the existing project — env ID `6e2a12c6-df61-45dc-89e0-d8e71ca0d14f`, isolated Postgres, backend at `tennis-survivor-staging.up.railway.app` deploying from `staging` branch, separate scraper service. Replaced literal copied `DATABASE_URL` with `${{Postgres.DATABASE_URL}}` reference. **(2) Vercel staging preview** at `tennis-survivor-git-staging-mickeyislam96-sketchs-projects.vercel.app` — added Preview/staging-scoped `VITE_API_URL` env var pointing at staging Railway URL. **(3) Deleted orphan `pleasing-appreciation` Railway project** (id `129e23d9...`) — duplicate GitHub-repo connection that had been failing builds for 12+ hours and emailing 10/day. **(4) Built `fsv-daily-brief` skill** at `.claude/skills/fsv-daily-brief/SKILL.md`. Three-phase: state survey → ranked Tech/Design/CX suggestions → save to `briefs/YYYY-MM-DD.md`. Hard rule: suggestions only, never edits code. **(5) Expanded skill** with two mandatory phases after first run: Phase 1b (data-integrity check tracing scraper → bracket → leaderboard, cross-checking each member's alive/eliminated state against bracket data) and Phase 1c (Chrome visual check of homepage, group page, leaderboard, draw bracket, draw list, matchup modal). **(6) Scheduled task** `fsv-daily-brief` runs daily at 12:04 BST (cron `0 12 * * *` local time). **(7) Generated three briefs today** — manual first pass, then expanded format manual, then 08:58 UTC scheduled run. Scheduled run caught three real critical findings I missed in manual pass, including the cacheAge bug (#2 below). **(8) Three fixes shipped to prod** via PR #5 squash-merge (commit `bb1c2e3`): T1 cacheAge math derives from scrapedAt not in-memory fetchedAt (fixes the silent freshness lie that made UptimeRobot useless); T3 closing-soon banner only shows after pick window opens (was contradicting "PICK WINDOW OPENS …" copy); T4 survivometer denominator changed to total members. **(9) T4 reverted** via direct-to-main commit `8195eb5` — Mickey corrected: (n-1) is the right survivor-pool semantic (N enter, N-1 will be eliminated; 100% means a winner has emerged). My fix and the brief's diagnosis were both wrong. Reset staging branch to main HEAD afterwards for clean future PRs. **(10) UptimeRobot live** for prod and staging — 5-min interval, email alerts to mickeyislam96@gmail.com on both. Confirmed working — Mickey already received an alert during the morning's prod redeploy. Critical-gap #1 closed. **(11) Critical-gaps queue**: #1 alerting ✅ (today), #2 tests ✅ (session 35), #3 staging ✅ (today), #4 admin auth stage 1 ✅ (session 35), stage 2 (scoped tokens) still open before RG, #5 DB-restore verification still open. **(12) Lessons baked in for next session's skill update**: the brief misread "score 0-0,5-3,0-0" as a retirement when it was actually a rain-suspended match (resumes later, no winner declared). Same skill needs to learn (n-1) survivor-pool semantic to stop flagging correctly-implemented maths as bugs. **Deferred**: T2 (suspended/retired/walkover status fix) needs proper FlashScore-status reading and integration test — own session. Executor skills (cx-build/design-build/tech-build), Stage 2 admin tokens, DB-restore verification, FRONTEND_URL on Railway staging, `staging` branch trigger in CI workflow. |
---

## Verification rule (CRITICAL)

**Never trust memory files or CLAUDE.md as the source of truth for how code works.** The codebase is the truth. Memory files are pointers to where to look, not authoritative descriptions.

Before making any claim about system behaviour (to Mickey or in reasoning):
1. Read the actual code in the repo — not memory files, not CLAUDE.md tables
2. If the code has changed since the memory was written, the memory is wrong
3. When in doubt, `grep` the codebase rather than quoting from memory

This rule exists because stale memory files have repeatedly caused wrong advice (e.g. claiming the scraper runs on Mickey's Mac when it actually runs on Railway). Memory files describing code architecture, file structures, or system behaviour will drift. The code will not.

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
7. **For tournament transitions:** run `node scripts/validate-tournament.mjs <id>` (e.g. `rome-2026`) before pushing. It validates registry alignment across the three config files, seed draw shape, lock-time presence, and FE/BE drawAvailable agreement. Catches the silent inconsistencies that previously took a live tournament window to surface.

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

**Trigger:** Mickey will paste a standard prompt at the end of every session (or say "update context"). When triggered, execute ALL 6 steps below. Do not skip any.

### 1. Update CLAUDE.md (this file)
- Update "Last updated" date at the top
- Add a row to the **Session history** table summarising what was built, fixed, or decided
- Update **Outstanding actions** — strike through completed items, add new ones
- If any new files, endpoints, or config were added, update the relevant tables above
- If any known issues were fixed, mark them as FIXED with the date
- Push the updated CLAUDE.md to GitHub

### 2. Update memory files in `.claude/memory/`
These files live in the repo AND in the Cowork workspace. They capture lasting decisions and context that outlive individual sessions.

| File | What to update |
|---|---|
| `MEMORY.md` | Index — add entries for any new topic files, correct stale descriptions |
| `final-serve-ivor.md` | Product state — tournament status, member counts, active features |
| `design-system.md` | Any new fonts, colours, tokens, or component patterns |
| `infrastructure.md` | New services, env vars, deployment changes |
| `email-design.md` | Template changes, new templates, delivery flow changes |
| `roadmap.md` | Phase progress, payment processor status, launch dates |
| `design-audits.md` | New audit findings, items actioned |
| `mickey.md` | New preferences or working patterns observed |

Only update files where something actually changed. Don't touch files for the sake of it.

### 3. Stale content audit
Read through MEMORY.md and spot-check every memory file that might be outdated by this session's work. Fix or remove anything stale. Common sources of staleness:
- Data provider references (e.g. Goalserve refs after it was removed)
- Tournament status (upcoming/active/completed)
- Feature flags described as active when they've been disabled
- MEMORY.md index descriptions that no longer match the file content

We cannot carry forward wrong information. If in doubt, read the file and verify.

### 4. Clean up workspace docs
If task-specific docs were created in the workspace folder (`CTO - TS/`):
- Delete any that are fully completed and whose insights are captured in memory files
- Keep active handoff docs and reference docs for unbuilt features

### 5. Push to GitHub
All changed files (CLAUDE.md, memory files, any code) must be pushed to GitHub. Memory files go under `.claude/memory/` in the repo. Use the GitHub Contents API or `/tmp` clone.

### 6. Verify pushes landed
After pushing, confirm the changes are actually on GitHub. Fetch at least one pushed file via the GitHub API to verify. Local-only changes are invisible to other session types and will be lost.

### What NOT to do
- Don't just append to session history and call it done — that's how context gets lost
- Don't create new one-off docs for decisions that belong in the memory files
- Don't skip the push — local-only files are invisible to other session types
- Don't skip the stale audit — this is how wrong information propagates across sessions
