# Final Serve-ivor — CTO Agent Context

> Last updated: 5 May 2026 (session 35). See "Session-end protocol" at the bottom of this file — follow it at the end of every session.

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
| Primary data | FlashScore scraper — Railway cron service (`/scraper/`), Playwright headless Chromium, hourly 10-21 UTC |
| Fallback data | API-Tennis (paid, unreliable) → Sofascore (free, 403-blocked on cloud) → mock |
| H2H intelligence | Matchstat Tennis API (paid) — player profiles, surface stats, recent form |
| Data adapter | `backend/src/services/dataAdapter.js` — unified interface, swappable providers |
| Storage | Railway PostgreSQL (persistent — picks, groups, members, scraped results) |

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
| `backend/src/utils/email.js` | All 7 transactional email builders + admin digest. Three-font system (Outfit/Fraunces/JetBrains Mono), gold pill CTAs, tennis court header background, dedup/approval queue via `emails_sent` table. |

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
| `frontend/public/email-court-bg.png` | Tennis court background image for email headers (white lines at 18% opacity, dashed net, gradient mask) |
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

### Email design system (aligned 19 Apr)
All 7 transactional email templates + admin digest in `backend/src/utils/email.js`. Fully aligned to live site design:
- **Three-font system:** Outfit (body), Fraunces (display headings), JetBrains Mono (eyebrow labels). Loaded via Google Fonts `<link>`.
- **Tennis court header:** `email-court-bg.png` background image (white court lines at 18% opacity, dashed net line, gradient mask). VML fallback for Outlook.
- **Gold pill CTAs:** `background: #FFC933; color: #2B1F00; border-radius: 999px` — matches "Join pool" button on site.
- **Footer brand:** Split-font treatment: "Final" in Outfit bold + "Serve-ivor" in Fraunces italic green. Tagline "A tennis survivor pool" in JetBrains Mono.
- **Colour tokens:** Mirror `frontend/src/styles/tokens.css` — canvas #FAFAF7, primary #0F4A23, gold #FFC933, etc.
- **Dedup/approval flow:** Emails queue as `pending` in `emails_sent` table. Admin approves via `POST /api/admin/approve-emails`. Cron never sends directly.
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
1. ~~Activate Goalserve trial~~ DONE 19 Apr — replaced by FlashScore scraper 22 Apr
2. ~~Implement Goalserve adapter~~ DONE 19 Apr — Goalserve removed from codebase 22 Apr
3. ~~Test data against live data~~ DONE — FlashScore scraper running on Railway
4. ~~Pre-Madrid: SPF/DKIM for Brevo~~ DONE 24 Apr — SPF record fixed, all DNS verified
5. **Update lock time overrides per round (Rome)** — update `activeTournament.js` R64 through F lock times once each round's order of play is announced (current values are estimates)
6. **Update DEFAULT_ROUND env var per round (Rome)** — Railway scraper service, change R1 → R64 → R32 etc. as tournament progresses
7. **Verify scraper is posting Rome data** — match start times currently null; will populate once scraper cron runs against Rome FlashScore URL
8. **Payment infrastructure for Roland Garros** — Revolut Business bridge plan. Mickey needs to register UK Ltd, open Revolut Business account before RG launch (18 May)
9. **Modal exit animation JS trigger** — CSS deployed in `micro-interactions.css` but needs JS change in `Layout.jsx` to add `.ds-modal--closing` class before removing modal from DOM
10. **Mobile app sync** — Rome activation not yet reflected in React Native app
11. **EAS Project ID + App Store submission** — set before TestFlight/App Store

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
| 5 May 2026 (session 35) | **Hardening, prompts, qualifier resolution, gaps audit.** Continued from session 34. (1) Added `scripts/validate-tournament.mjs` (cross-checks the three registries + seed draw) and removed dead Madrid mock pool (`ecf83c1`). (2) Wired validator + smoke into `docs/new-tournament-setup.md` (`279fa8b`). (3) Wrote `docs/transition-prompt.md` — airtight free-tournament transition prompt (`167438d`). (4) Wrote `docs/paid-transition-prompt.md` and CLAUDE.md signpost — covers Stripe/Revolut bridge mode, payment endpoint smoke, real test purchase, settlement, payouts (`48a915d`). (5) Resolved 12 Rome 2026 qualifier names from ATP Tour main draw — picks-available 52→64, all 11 qualifier matchups now show real names. R1 lock is 6 May 08:00 UTC (`4708e5b`). (6) Audited bigger-picture gaps. Critical: no observability/alerting, no automated tests, no staging environment, single shared `ADMIN_SECRET`, unverified DB backups. Mickey opted to focus on critical fixes next. |
| 5 May 2026 (session 34) | **Audit + invite-link emergency fix.** Mickey reported invite link broken and "Madrid" tab still showing after Rome launch. Audit found: (1) mnt was 22 commits behind GitHub — session 33 had pushed Rome correctly. (2) Real bug: `groups.js` invite-code lookup was case-sensitive and `Date.now().toString(36)` produces lowercase suffixes, breaking ~50% of all invite links — Rome's `ROME-2026-POOL-bxxhnp` was affected. Pushed `fc0bad8`: uppercase suffix on generation + `UPPER(invite_code) = $1` on lookup. Verified live: invite endpoint returns 200. "Madrid tab" is the gold pill nav showing the user's only-pool — auto-resolves once Mickey joins Rome. Aligned `activeTournament.js` Rome `startDate` to 2026-05-05 (matching both registries). Added `scripts/smoke.sh` post-launch test (4 checks against live API). Updated CLAUDE.md with smoke-test reference and known-issue entry. |
| 24 Apr 2026 (session 32) | **Email approval fix.** `checkSecret()` in `admin.js` had been hardened to reject query-param secrets ("leaked in logs/history"), but the admin digest email sends one-click approval links as `GET /approve-emails?secret=X`. Result: every approval link returned 401. Fix: re-added `req.query.secret` as fallback option 3 in `checkSecret()`. Deployed commit `bc94ce9`. Verified working — returns HTML preview page with pending emails. |

| 5 May 2026 (session 33) | **Rome 2026 activation + site audit.** (1) Full site audit to ensure Rome is prioritised over Madrid across all user-facing surfaces. (2) Fixed My Pools golden nav pill showing Madrid (completed) instead of Rome (active) — updated `Layout.jsx` to prefer active tournament, then upcoming, then any. (3) Fixed player headshots not loading for Rome players — two root causes: `isMockId()` regex didn't match `rome-p3` style IDs (fixed to `/^([a-z]+-)?[ps]\d+$/i`); seed draw stores "Surname, Firstname" but headshots stored as `firstname-lastname.jpg` (fixed `nameSlug()` and `initials()` to handle comma format). Both fixes in commit `37ef883`. (4) Fixed Shevchenko name mismatch in `rome-2026.json` ("Aleksandr" → "Alexander" to match headshot file) — commit `76f0c41449`. (5) Fixed stale Madrid elimination data on Rafa's account in Rome group — `group_members.is_alive = false, eliminated_round = R64` from Madrid was persisting because 0-picks fallback reads DB column; added `POST /api/admin/reset-member` endpoint and called it to restore Rafa, commit `d175b24`. (6) Verified Rome fully activated: health endpoint confirms `tournament: rome-2026`, 52 R1 players with correct opponent pairings, pick window open, group ID `de81ed56-6c30-483a-9d38-3c48201ab42e`. (7) Created reusable tournament transition prompt (9-step checklist for deprioritising old tournament and activating new one). |
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
