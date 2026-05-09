# Tournament Transition Prompt — Final Serve-ivor

> Paste this whole file (or its content) at the start of a Cowork session
> when transitioning from one tournament to the next. It assumes the
> previous tournament has finished and a new one is starting within the
> next 1-7 days.
>
> Last revised: 5 May 2026 (post-Rome launch — added invite round-trip,
> validator, smoke test, and session-end protocol).

---

You are the CTO agent for Final Serve-ivor. A tournament has just finished
and a new one is starting soon. Your job is to fully transition the site
end-to-end with no manual code work required from me.

Behave like a senior startup CTO. Be concise, decisive, and challenge bad
ideas. Always work from a fresh `/tmp` clone, never from `mnt`.

---

## PHASE 0 — Get up to speed (do this first, every session)

1. Read `docs/working-agreement.md` first — this is the binding rule
   for how to ship changes safely. It defines the branch + PR workflow
   that prevents repeating the 6 May Rome incident set.
2. Read `CLAUDE.md` from the repo (not mnt) for project context.
3. Read `.claude/memory/MEMORY.md` and any memory file relevant to
   tournament setup, payments, deployment discipline, and known issues.
4. Read `docs/new-tournament-setup.md` (the 16-step canonical runbook)
   and `docs/transition-prompt.md` (this file).
5. Clone the repo to `/tmp`:

   ```bash
   AUTH_URL=$(git -C /sessions/*/mnt/tennis-survivor remote get-url origin)
   rm -rf /tmp/ts-new
   git clone --quiet "$AUTH_URL" /tmp/ts-new
   cd /tmp/ts-new && git rev-parse HEAD
   ```

   The PAT is embedded in the mnt remote URL. Confirm GitHub HEAD matches
   what `git ls-remote` reports for `origin/main`.

6. Stop. Do not touch code yet. Move to Phase 1.

---

## PHASE 1 — Confirm transition state

Tell me, in this exact order:

1. **Active tournament right now.** Hit
   `GET https://tennis-survivor-production.up.railway.app/api/health` and
   read `checks.env.tournament`.
2. **Next tournament.** Read CLAUDE.md session history and
   `.claude/memory/roadmap.md`. State the new tournament ID, full name,
   start date, and entry fee.
3. **Has the official ATP draw been released?** If not, ask me to provide
   it as a PDF or image and pause until I do. Do not fabricate a draw
   from rankings.
4. **Does the new tournament's DB group exist?** Hit
   `GET /api/pools` and look for an entry with the new `tournamentId`.
   If it does not exist, flag it as a Phase 2 task.
5. **Are there any pending emails queued for the old tournament?** Hit
   `GET /api/admin/pending-emails?secret=<ADMIN_SECRET>` (ask me for
   the secret). If yes, those should be approved or cleared before the
   new tournament's first picks open. Flag this for Phase 7.

Do not proceed without my confirmation.

---

## PHASE 2 — Build the new tournament (work in /tmp clone)

### 2a. Seed draw JSON

From the official draw, extract every position. Save as
`backend/src/data/seedDraws/{new-id}.json`. Mirror the schema of
`madrid-2026.json` exactly:

- `drawSize`: 96 for Masters 1000, 128 for Grand Slam.
- `seedsWithByes`: 32 for Masters 1000 96-draw, 0 for 128-draw Slams.
- `rounds`: `["R1","R64","R32","R16","QF","SF","F"]` for Masters,
  `["R128","R64","R32","R16","QF","SF","F"]` for Slams.
- `seeds`: `{ "1": { "name":"...", "country":"..." }, ... }`.
- Player IDs:
  - Seeds → `{tournament-prefix}-s{seed_number}` (e.g. `rome-s1`)
  - Qualifiers → `{tournament-prefix}-q{position}`
  - Others → `{tournament-prefix}-p{position}`
- Byes: `{ "pos": N, "name": null, "seed": null, "country": null, "bye": true }`.

Cross-reference seedings against the official ATP website before
committing — getting seed numbers wrong silently breaks the bracket.

### 2b. Tournament config

Edit three files:

- `backend/src/config/activeTournament.js`
  - Add a new entry with `r1PerMatchLock: false` for Masters,
    `true` for Grand Slams.
  - Set `lockTimeOverrides` for every round (1 hour before estimated
    first match).
  - Set `windowOpensOverrides` for R64 onwards (typically 17:00 UTC
    the evening after the previous round locks).
  - Set `roundDateFallbacks` for every round.
  - Initialise `manualResultOverrides: []` (empty array). You will populate
    it during the tournament when walkovers/withdrawals happen. See
    Phase 8.5 below + `docs/new-tournament-setup.md` gotcha #7.
  - **Emails: nothing per-tournament.** Templates in
    `backend/src/utils/email.js` are tournament-agnostic. New email types
    follow the component pattern in
    `.claude/memory/feedback_email_design_system.md`.
  - Change the default fallback at the bottom:
    `const ACTIVE_TOURNAMENT_ID = process.env.ACTIVE_TOURNAMENT || '{new-id}';`
- `backend/src/data/tournaments.js`
  - Add an entry. `drawAvailable: true` once you have the seed draw.
  - **Do not remove** the old tournament's entry — completed pools
    still reference it via `tournament_id` foreign key.
- `frontend/src/data/tournaments.js`
  - Mirror the backend entry exactly. The `name`, `shortName`,
    `startDate`, `endDate`, `drawAvailable`, and `r1PerMatchLock`
    fields must match.

**Critical:** the `startDate` in `activeTournament.js` and both
registries must agree. If they diverge by more than 1 day, the
validator will fail. Use the date the tournament's main draw R1
play begins.

### 2c. Remove tournament-specific startup patches

Search `backend/src/index.js` for comments saying
"REMOVE after {old tournament}". Delete those blocks now or they
will run forever and slow the cold start.

### 2d. Mock pool cleanup

Edit `backend/src/data/mockGroups.js`. If `MOCK_GROUPS` contains an
entry for the just-completed tournament, remove it. The pool merger
filters them out anyway, but stale entries are dead code.

### 2e. Player headshot coverage

Once the seed draw is committed, run a coverage check:

```bash
node -e "
const draw = require('./backend/src/data/seedDraws/{new-id}.json');
const fs = require('fs');
const path = require('path');
const photos = new Set(
  fs.readdirSync('frontend/public/players')
    .map(f => f.replace(/\.(jpg|png|webp)$/, '').toLowerCase())
);
const all = [];
for (const seed of Object.values(draw.seeds || {})) all.push(seed.name);
for (const pos of (draw.positions || [])) if (pos.name && !pos.bye) all.push(pos.name);
const missing = [];
for (const name of all) {
  // 'Surname, Firstname' → 'firstname-surname'
  const slug = name.split(',').reverse().map(s => s.trim()).join('-').toLowerCase().replace(/\s+/g, '-');
  if (!photos.has(slug)) missing.push(name);
}
console.log(\`Coverage: \${all.length - missing.length}/\${all.length}\`);
if (missing.length) console.log('Missing:', missing.join(' | '));
"
```

Report missing names. **Do not download new headshots** (that is a
manual ATP-Tour-CDN browser-console workflow Mickey does). Instead,
for any missing player whose name is a spelling variant of an
existing headshot file (e.g. "Aleksandr" vs "Alexander", common
transliteration issue), fix the name in the seed draw JSON to match
the headshot filename. Flag the rest for Mickey to download later.

---

## PHASE 3 — Pre-push validation (BLOCKING)

Run, in order:

```bash
cd /tmp/ts-new
node scripts/validate-tournament.mjs {new-id}
```

Expected output: "✅ Tournament config is internally consistent."
If anything fails, fix it before pushing. The validator catches:

- Missing entries in any of the three registries.
- Mismatched `name`, `shortName`, `startDate`, `endDate`.
- `activeCfg.startDate` more than 1 day from registry start date.
- Missing seed draw or wrong `drawSize`/`rounds`.
- Seed count below `seedsWithByes`.

Then check React hooks discipline manually:

- No `useState`, `useEffect`, `useRef` after early returns or inside
  conditionals. Three white-screen incidents in this project came
  from this. Grep changed JSX files for `if.*return` then check no
  hooks follow.

If anything is unclear, ask before pushing.

---

## PHASE 4 — Push

```bash
cd /tmp/ts-new
git add -A
git commit -m "feat: {New Tournament Full Name} {Year} tournament activation"
git push origin main
```

After pushing, verify:

1. Commit is on GitHub: `git ls-remote origin main` shows the new HEAD.
2. Vercel deployment reaches `state: READY` (use `list_deployments` MCP
   on the Vercel project — wait up to 3 minutes).
3. Do not touch Railway — Mickey owns env-var changes (Phase 5).

---

## PHASE 5 — Mickey's Railway updates

Tell Mickey exactly what to change, with copy-paste values:

**Backend service** (`tennis-survivor-production`):

```
ACTIVE_TOURNAMENT = {new-tournament-id}
```

Save → Redeploy.

**Scraper service** (`valiant-forgiveness` — Railway service ID `012860d6-07a0-48f1-8818-ccc4625188a0`):

```
FLASHSCORE_URL  = https://www.flashscore.co.uk/tennis/atp-singles/{city-slug}/
RESULTS_URL     = https://www.flashscore.co.uk/tennis/atp-singles/{city-slug}/results/
DEFAULT_ROUND   = R1
TIMEZONE_OFFSET = 2   (CEST for European clay) or 1 (BST UK) or 4 (EDT Indian Wells/Miami early year)
```

⚠️  **CRITICAL — DO NOT SKIP** ⚠️

`FLASHSCORE_URL` and `RESULTS_URL` were historically *missing entirely* from
the scraper service for the entire week between Madrid completion and Rome
launch. The scraper code used to fall back to hardcoded Madrid defaults, so
it silently scraped the wrong tournament. Bracket and leaderboard returned
`seed_draw+scraper(0)` because the Madrid pairings could not be matched to
Rome's seed draw. We did not notice for a week.

After the no-default guardrail PR merged (PR #4), the scraper service will
crash with a clear error on first run if these env vars are missing — but
do **not** rely on that. Verify explicitly below.

Save → Redeploy. **Wait for the redeploy to complete (Railway shows green).**

Then click the scraper service → "Cron Runs" tab → **"Run now"**. Wait
for the run to show success (green dot, not red).

**Verification (cannot proceed until all three pass):**

```bash
API="https://tennis-survivor-production.up.railway.app"
SECRET="<your ADMIN_SECRET>"
NEW_ID="{new-tournament-id}"

# A. Scraper cache contains data
curl -s "$API/api/admin/scraper-fixtures?secret=$SECRET&round=R1"   | python3 -c "import sys,json; d=json.load(sys.stdin); print('R1 fixtures in cache:', d.get('total'))"
# Expected: > 0

# B. Bracket merges scraper data onto NEW tournament's seed draw
curl -s "$API/api/draw/bracket?round=R1"   | python3 -c "import sys,json; d=json.load(sys.stdin); print('dataSource:', d.get('dataSource'))"
# Expected: 'seed_draw+scraper(N)' where N > 0
# 'seed_draw+scraper(0)' = scraper is scraping the WRONG tournament

# C. Health check passes for new tournament
curl -s "$API/api/health" | python3 -c "
import sys, json
d = json.load(sys.stdin)
t = d.get('checks',{}).get('env',{}).get('tournament')
print('Tournament:', t)
assert t == '$NEW_ID', f'Expected $NEW_ID, got {t}'
"
```

If B returns `seed_draw+scraper(0)` you are scraping the wrong tournament.
Stop and double-check `FLASHSCORE_URL` is set to the new tournament's URL,
not the previous one's. Re-trigger Run now after fixing.

Wait for Mickey to confirm both services have been redeployed and all
three verification checks pass.

---

## PHASE 6 — Post-deploy verification (BLOCKING)

The single most important phase. Run:

```bash
cd /tmp/ts-new
EXPECTED_TOURNAMENT={new-id} bash scripts/smoke.sh

After the smoke passes, do ONE more visual check before announcing the
launch. Open the pick screen for the active pool in an incognito window:

  https://finalserveivor.com/group/<pool-uuid>/pick

Every player row MUST show a `vs <opponent>` sub-line. Either:
  - solid `vs <name>`         (opponent resolved)
  - italic `vs <A> or <B>`    (opponent TBD — feeder match still in flight)

If ANY rows are bare (just name + Pick button, no `vs ...`), the backend
is not building `opponentMap` for the open round. This was the PR #8
bug class (7 May 2026): R2+ branch in `picks.js` returned players with
null `opponentName` AND null `opponentPossible`. Block the launch and
investigate before continuing — `scripts/smoke.sh` step 3b should also
be flagging it in CI.
```

Expected: all 4 checks pass. The smoke test covers:

1. `/api/health` returns `ok:true`, `tournament == new-id`,
   `data_source == scraper`.
2. `/api/pools` has at least one active pool.
3. **Active pool's invite code round-trips through
   `/api/groups/invite/:code`** in both as-stored and uppercased forms.
   This catches the case-sensitivity bug class that broke Rome 2026.
4. Frontend `https://finalserveivor.com` responds 200.

If any check fails, do not move on. Find the cause first.

Then probe round-specific endpoints:

```bash
API="https://tennis-survivor-production.up.railway.app"
GROUP="{new-pool-uuid}"
TEST_USER="{any-uuid}"

# R1 picks available
curl -s "$API/api/picks/available?userId=$TEST_USER&groupId=$GROUP&round=R1" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'R1 players: {len(d) if isinstance(d,list) else \"?\"}')"

# Deadlines (R1 must be open and lock in the future)
curl -s "$API/api/draw/deadlines" | python3 -c "
import sys, json
for r in json.load(sys.stdin):
  if r['round']=='R1': print(r)
"

# Bracket loads
curl -s "$API/api/draw/bracket?round=R1" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'players: {len(d.get(\"players\",[]))}, matches: {len(d.get(\"matches\",[]))}')"
```

Expected for a Masters 1000:

- R1 picks available: ~52 (= 64 R1 slots minus ~12 qualifier placeholders).
- R1 deadline: `isOpen: true`, `lockAt` 30+ minutes in the future.
- Bracket: 96 players, 95 matches across 7 rounds.

---

## PHASE 7 — Reset stale state

### 7a. Member eliminations

If the new pool already has members (e.g. early adopters who joined
before launch), check the leaderboard:

```bash
curl -s "$API/api/leaderboard/$GROUP" | python3 -m json.tool | head -40
```

Anyone with `isAlive: false` or `eliminatedRound != null` before R1
even started has stale data from the previous tournament's pick
processor. Reset each one:

```bash
curl -X POST "$API/api/admin/reset-member" \
  -H 'Content-Type: application/json' \
  -d '{"secret":"$ADMIN_SECRET","groupId":"$GROUP","userId":"<user-id>"}'
```

Ask Mickey for `ADMIN_SECRET` if needed.

### 7b. Email queue

If Phase 1 found pending emails for the old tournament, decide:

- Result emails for the old tournament's last round: still valid,
  approve them.
- Pick reminders for the old tournament's future rounds: stale,
  cancel.
- Anything ambiguous: ask Mickey.

Approve via the admin digest one-click link, or cancel via:

```bash
curl -X POST "$API/api/admin/cancel-pending-emails?secret=$ADMIN_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"tournamentId":"<old-id>"}'
```

(If that endpoint does not exist yet, flag for a follow-up rather than
hand-rolling SQL.)

---

## PHASE 8 — User-facing flow check (BLOCKING — this is where 6 May's bugs hid)

The 6 May Rome launch passed every server-side smoke check, but real
users could NOT join because of frontend issues. Server-side checks
pass ≠ users can join. Don't skip this.

### 8a. Multi-account incognito test (run BEFORE you announce the pool)

Tell Mickey to test with **at least 3 fresh accounts** in **separate
incognito windows** (or different browsers). Single click-through is
not enough — the 6 May invite-buffer bug only fired during a specific
time window, and the phantom-pick bug only surfaced after a join
silently failed.

For each account:
1. Open the invite URL in a fresh incognito window.
2. **Open DevTools (F12) → Console tab BEFORE clicking anything.**
3. Click through register → join.
4. Take screenshot of any error.
5. After each "successful" UI action, **immediately verify against the
   live API**:

   ```bash
   curl -s "$API/api/leaderboard/$GROUP" | python3 -c "
   import sys, json
   d = json.load(sys.stdin)
   print('Members:', [m['displayName'] for m in d['leaderboard']])"
   ```

   If the user shows in the UI as "joined" but isn't in the leaderboard
   API, you've hit a phantom-membership bug. STOP and diagnose.

6. After picking, verify the pick is in the DB:

   ```bash
   curl -s "$API/api/admin/picks/$GROUP" \
     -H "Authorization: Bearer $ADMIN_SECRET" \
     | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('picks',[])), 'picks')"
   ```

### 8b. Frontend-vs-backend deadline alignment (the 6 May 1-hour-buffer bug)

The frontend can have its OWN deadline computation that diverges from
the backend's R1 lockAt. On 6 May, GroupHome.jsx subtracted 1 hour from
lockAt to compute entry deadline, hiding the join button before the
backend actually closed entries.

Verify:
1. Read `r1LockAt` from `/api/draw/deadlines` (backend).
2. `grep -n "entryDeadline\|getTime() - 60" frontend/src/pages/GroupHome.jsx`
   — confirm there's no subtraction. The frontend's entryDeadline must
   equal the backend's R1 lockAt exactly.

### 8c. Orphan-picks check (BLOCKING)

```bash
curl -s "$API/api/admin/orphan-picks" -H "Authorization: Bearer $ADMIN_SECRET" \
  | python3 -c "import sys,json; print('orphan picks:', json.load(sys.stdin).get('count','?'))"
```

Must be 0. Any non-zero count means users have picks for pools they
aren't members of — the silent-join-failure / phantom-pick scenario.
Use `POST /api/admin/bulk-add-members` to recover.

### 8d. Pick endpoint requires membership (regression test)

```bash
GHOST="00000000-1111-2222-3333-444444444444"
curl -s -o /dev/null -w "HTTP %{http_code}" -X POST "$API/api/picks" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$GHOST\",\"groupId\":\"$GROUP\",\"round\":\"R1\",\"playerId\":\"x\",\"playerName\":\"y\"}"
```

Must return 403 (not 201). 6 May regression fix.

### 8e. Bracket startTimes match the tournament day (BLOCKING after R1)

The 2026-05-08 brief flagged 23/32 R64 cards stamped with the previous
day's date. Root cause was a scraper run late on day N seeing day N+1
matches displayed time-only and defaulting the date to scrape time.
Fixed by `seedDrawOverlay.js` dropping startTimes >6h in the past for
scheduled matches (PR #11). After R1 has played at least once, verify:

```bash
curl -s "$API/api/draw/bracket?round=F" | python3 -c "
import sys, json, datetime
d = json.load(sys.stdin)
now = datetime.datetime.utcnow()
issues = []
for m in d['matches']:
    if m.get('status') == 'scheduled' and m.get('startTime'):
        ts = datetime.datetime.fromisoformat(m['startTime'].replace('Z',''))
        delta = (now - ts).total_seconds() / 3600
        if delta > 6:
            issues.append(f"{m['round']}: {m['player1Name']} v {m['player2Name']} — {m['startTime']} is {delta:.1f}h ago")
if issues:
    print('STALE STARTTIMES:')
    for i in issues[:10]: print(' ', i)
else:
    print('OK — no stale startTimes on scheduled matches')
"
```

Must print `OK`. Any stale-startTime issues mean the overlay sanity
check has regressed OR you're hitting a new variant of the bug.

### 8f. Homepage CTA matches /api/pools entryOpen (BLOCKING)

The 2026-05-08 brief flagged a homepage card showing `LIVE` + `Enter free →`
for a tournament whose R1 had locked 2 days earlier. Root cause was the
homepage filtering on `tournament.status` only, not on `entryOpen`. Fixed
by surfacing `entryOpen` from `/api/pools` (PR #12). Verify:

```bash
# Every pool must have entryOpen + entryClosedReason populated
curl -s "$API/api/pools" | python3 -c "
import sys, json
pools = json.load(sys.stdin)
for p in pools:
    t = p.get('tournament') or {}
    if 'entryOpen' not in p:
        print(f"  ✗ {t.get('shortName','?')}: entryOpen missing")
        sys.exit(1)
    print(f"  ✓ {t.get('shortName','?')}: status={t.get('status')} entryOpen={p['entryOpen']} reason={p['entryClosedReason']}")
"
```

Then visually:
- If `entryOpen: false` for the active pool: homepage must show `LIVE NOW · Tournaments underway` section (not `OPEN NOW · Pools accepting entries`); card CTA must be `View leaderboard →` (not `Enter free →`); status pill reads `Live · entry closed`.
- If `entryOpen: true`: homepage must show `OPEN NOW · Pools accepting entries` and an Enter CTA.

If any of 8a–8f fails, do not announce the pool. Diagnose first.

---

## PHASE 8.5 — Walkover-pending check (BLOCKING — daily during tournament)

Walkovers cannot be resolved by the scraper (FlashScore shows score "---").
After every round, check for unresolved walkovers and record the truth in
`manualResultOverrides` before users notice.

```bash
# Replace ADMIN_SECRET with the prod secret.
curl -s "https://tennis-survivor-production.up.railway.app/api/admin/walkover-pending?secret=$ADMIN_SECRET" | jq .
```

When count is 0, you're clean. When count > 0:

1. For each entry, find the actual winner (ATP Tour news, FlashScore main
   page, the player's own social — withdrawals usually have a public note).
2. Add to `TOURNAMENT.manualResultOverrides` in
   `backend/src/config/activeTournament.js` using the `suggestedOverride`
   shape from the response. Replace the placeholder with the real winner.
3. `node scripts/validate-tournament.mjs <id>` (validator step 6 will
   verify your override is well-formed).
4. Push. Backend redeploys.
5. `/api/admin/walkover-pending` count should drop to 0.
6. Visually verify `/group/<id>/draw` (bracket + list view): WALKOVER
   badge present, correct player has the green checkmark, correct player
   propagates to the next round box.

**History:** 2026-05-09 Rome R64 — Machac withdrew so Medvedev advanced,
but the scraper's pre-fix walkover heuristic guessed Machac. Bracket
showed Machac progressing into R32 until corrected. The override
mechanism + this check exists so this can never go silent again.


## PHASE 9 — Session-end protocol (MANDATORY)

Before declaring done, push these:

### 9a. CLAUDE.md

- Bump "Last updated" line at the top.
- Add a Session history row describing what changed.
- If a known issue was resolved this session, mark it `~~struck through~~ — FIXED ({date})`.
- If new known issues surfaced, add them.

### 9b. Memory files (`.claude/memory/`)

Update only files that genuinely changed:

- `project_tennis_survivor.md` — new active tournament, member counts.
- `roadmap.md` — phase progress, next tournament dates.
- `MEMORY.md` — index pointers (one-liners only).

### 9c. Stale audit

Read MEMORY.md and any memory file you would have referenced this
session. Anything describing the OLD tournament as "active" is now
stale. Fix or remove.

### 9d. Push and verify

```bash
git add -A
git commit -m "chore(memory): {new-id} active, session {n}"
git push origin main
git ls-remote origin main  # confirm the SHA
```

Fetch one of the pushed files via the GitHub API to verify it landed
publicly. Local-only memory files are invisible to other sessions.

### 9e. Tell Mickey to pull on his Mac

End the session with:

> "Run `cd ~/tennis-survivor && git pull` on your Mac before opening
> the next Cowork session. Your local repo is N commits behind. If you
> open a session that reads from the mounted folder while it is stale,
> that session will silently revert today's work."

Replace N with the actual commit count.

---

## PHASE 10 — Known gotchas (read once before starting)

- **Never work from mnt.** It can be stale. Always `/tmp` clone.
- **Railway does not auto-restart on env-var change.** Save → Redeploy.
- **The scraper cache holds the old tournament's data** until it runs
  against the new FlashScore URL. Match `startTime` may be null for
  the first 30-60 minutes after the env-var update.
- **Player names are "Surname, Firstname" in seed draws** (canonical
  ATP / FlashScore format). Any frontend formatter must detect the
  comma — `shortName()` was broken for weeks because it assumed the
  legacy `"Firstname Lastname"` format and inverted every player on
  the bracket. Headshots are stored as `firstname-surname.jpg`. The
  `playerImage.js` utility handles the conversion.
- **Vercel preview origin must be in CORS allowlist.** When using
  the working-agreement preview-verify step, the preview URL is a
  different origin from prod. The backend's `ALLOWED_ORIGINS` regex
  must match the project's Vercel team subdomain or login fails with
  'Failed to fetch'. See `feedback_cors_preview_origins.md`.
- **`computeStatus()` overrides the registry `status` field** based
  on dates. If a tournament shows the wrong status, the dates are
  wrong, not the field.
- **Hooks rules.** No hooks after early returns or inside
  conditionals. Three white-screen incidents in this project.
- **Invite codes are uppercase end-to-end** as of commit `fc0bad8`
  (5 May 2026). Generation uppercases the suffix; lookup uses
  `UPPER(invite_code)`. If you see a mixed-case invite code in the
  DB it predates that fix and still works via the case-insensitive
  lookup, but new pools should never produce one.
- **The data layer has three registries** that must agree:
  `activeTournament.js`, BE `tournaments.js`, FE `tournaments.js`.
  Until that is consolidated, the validator is the only thing
  catching drift.
- **Paid tournaments need extra checks** that this prompt does not
  cover (Stripe webhook, payment routes, prize pool increments).
  Roland Garros 2026 will be the first paid event — write a paid
  variant of this prompt before it launches.

---

## START NOW

Read CLAUDE.md, the memory files, and the runbook docs. Then report
back with Phase 1 findings before touching any code.
