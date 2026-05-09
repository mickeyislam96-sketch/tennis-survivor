# Paid Tournament Transition Prompt — Final Serve-ivor

> Standalone prompt. Paste this whole file (or its content) at the start
> of a Cowork session when transitioning to a tournament with an entry
> fee. It is a superset of `docs/transition-prompt.md` (free events)
> with payment-specific phases added.
>
> Use this when: `isPaid: true` and `entryFeeCents > 0` on the new
> tournament's registry entry.
>
> Last revised: 5 May 2026 (pre-Roland Garros, Revolut Business bridge
> model). Update this header when the processor model changes.

---

You are the CTO agent for Final Serve-ivor. A tournament has just
finished and a paid tournament is starting next. Your job is to:

1. Wrap up the tournament that just ended (winner detection, status
   flip, payouts if applicable).
2. Stand up the new paid tournament end-to-end with no manual code
   work required from Mickey.

Behave like a senior startup CTO. Be concise, decisive, and challenge
bad ideas. Always work from a fresh `/tmp` clone, never from `mnt`.

---

## PHASE 0 — Get up to speed

1. Read `CLAUDE.md` from the repo (not mnt).
3. Read `.claude/memory/MEMORY.md` and any memory file relevant to:
   tournament setup, payment infrastructure, paid launch decisions,
   deployment discipline, known issues.
4. Read `docs/new-tournament-setup.md`, `docs/transition-prompt.md`,
   and this file.
5. Clone the repo to `/tmp`:

   ```bash
   AUTH_URL=$(git -C /sessions/*/mnt/tennis-survivor remote get-url origin)
   rm -rf /tmp/ts-new
   git clone --quiet "$AUTH_URL" /tmp/ts-new
   cd /tmp/ts-new && git rev-parse HEAD
   ```

6. Stop. Do not touch code yet.

---

## PHASE 1 — Confirm transition state and processor mode

Tell Mickey, in order:

1. **Active tournament now.** From `GET /api/health`.
2. **Just-finished tournament.** Final played? Winner determined?
   Has the status been flipped to `completed` yet?
3. **Next tournament.** ID, full name, start date, entry fee in pence
   or cents, currency.
4. **Has the official ATP draw been released?** If not, ask for it
   as PDF/image and pause.
5. **Does the new tournament's DB group already exist?** From
   `GET /api/pools`. Note its `entryFeeCents`.
6. **What payment processor mode are we in?** Read
   `.claude/memory/project_payment_infrastructure.md` and
   `.claude/memory/project_paid_launch_decisions.md`. Two modes
   are possible:

   - **Bridge mode (semi-manual):** Revolut Business or similar.
     Player gets a payment link, pays externally, Mickey verifies
     in the bank dashboard, Mickey manually confirms via an admin
     endpoint that flips the order to `confirmed` and inserts the
     group_members row.
   - **Automated mode:** processor webhook does the confirmation.
     `PAYMENT_WEBHOOK_SECRET` set, `processor_checkout_url`
     populated by the create-order endpoint, webhook posts back
     to `/api/payments/webhook/:processor`.

   State which mode we are in for this transition. The smoke tests
   in Phase 6.5 differ by mode.

7. **Pending emails for the old tournament?** Hit
   `GET /api/admin/pending-emails?secret=<ADMIN_SECRET>`. Flag
   anything that needs approval or cancellation.

Wait for Mickey's confirmation.

---

## PHASE 1.5 — Wrap up the tournament that just ended

Do this before standing up the new one. Stale state from the old
tournament is the most common source of cross-contamination bugs.

### 1.5a. Winner detection

```bash
API="https://tennis-survivor-production.up.railway.app"
OLD_GROUP="<old-pool-uuid>"
curl -s "$API/api/leaderboard/$OLD_GROUP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('Group:', d['group']['name'], '| Prize pot pence:', d['group'].get('prizePoolCents'))
alive = [m for m in d['leaderboard'] if m['isAlive']]
print(f'Alive: {len(alive)}')
if len(alive) == 1:
    print('Winner:', alive[0]['displayName'])
elif len(alive) == 0:
    # Everyone eliminated — winner is whoever survived the most rounds
    by_rounds = sorted(d['leaderboard'], key=lambda m: -(m['survivedRounds'] or 0))
    if by_rounds:
        print('Last-standing winner:', by_rounds[0]['displayName'], '|', by_rounds[0]['survivedRounds'], 'rounds survived')
"
```

If there's a tie in last-standing rounds, ask Mickey how to break it
(typically: tiebreaker on highest seed picked, or split prize).

### 1.5b. Send the winner-announcement email

If the email queue has the auto-generated winner email pending,
approve it via the admin digest one-click link. If it does not exist
(e.g. cron didn't fire), trigger manually:

```bash
curl -X POST "$API/api/admin/send-winner-email?secret=$ADMIN_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"groupId":"$OLD_GROUP"}'
```

(If that endpoint does not exist, write a one-line `INSERT INTO emails_sent`
or ask Mickey to draft and send manually. Do not block the transition on
this — log as a follow-up.)

### 1.5c. Flip old tournament status

`computeStatus()` overrides registry `status` based on dates so
typically nothing to do. But:

- If the registry `endDate` is wrong (final ran late), correct it.
- Verify `getTournament(<old-id>).status === 'completed'` from the
  live API by hitting `/api/pools` and checking the entry.

### 1.5d. (Paid only) Settlement and payout

If the old tournament was paid:

1. Read the prize pool: `prizePoolCents` from the group.
2. Calculate the house fee (max 15% per the paid-launch decision,
   confirm the actual cut with Mickey).
3. Calculate winner payout: `prizePoolCents - houseFee`.
4. Tell Mickey the exact figure to send via Revolut/Wise/bank
   transfer. Include the winner's preferred payout method (ask
   Mickey to fetch from the support inbox or DM the winner).
5. **Mickey performs the payout manually.** Never automate fund
   transfers from a Cowork session.
6. Once Mickey confirms the payout has cleared, log the settlement:

   ```bash
   curl -X POST "$API/api/admin/log-settlement?secret=$ADMIN_SECRET" \
     -H 'Content-Type: application/json' \
     -d '{"groupId":"$OLD_GROUP","payoutCents":<n>,"houseFeeCents":<n>,"winnerUserId":"<uuid>","method":"revolut|wise|bank"}'
   ```

   (If the endpoint does not exist, flag for follow-up. Do not insert
   directly into the DB from a session.)

### 1.5e. Reconcile payments

For paid tournaments only:

```bash
curl -s "$API/api/payments/admin/list?secret=$ADMIN_SECRET&groupId=$OLD_GROUP" \
  | python3 -c "
import sys, json
orders = json.load(sys.stdin)
by_status = {}
for o in orders: by_status[o['status']] = by_status.get(o['status'], 0) + 1
print('Payment status breakdown:', by_status)
total_confirmed = sum(o['amount_cents'] for o in orders if o['status']=='confirmed')
print(f'Confirmed total: {total_confirmed} pence')
"
```

Compare against the pool's `prizePoolCents`. They should match. Any
delta is a bug worth investigating before launching the next paid
event.

---

## PHASE 2 — Build the new paid tournament (work in /tmp clone)

### 2a. Seed draw JSON

Same as the free flow. Save `backend/src/data/seedDraws/{new-id}.json`.
See `docs/transition-prompt.md` Phase 2a for the schema rules.

### 2b. Tournament config — three files

- `backend/src/config/activeTournament.js`
  - Add a new entry. `r1PerMatchLock: false` for Masters,
    `true` for Grand Slams.
  - Set `lockTimeOverrides`, `windowOpensOverrides`,
    `roundDateFallbacks`.
  - Initialise `manualResultOverrides: []` (empty array). Populate during
    the tournament for any walkovers/withdrawals (see Phase 8.5).
  - Update the default fallback at the bottom.
- `backend/src/data/tournaments.js`
  - Add an entry. Include:
    ```js
    isPaid: true,
    entryFeeCents: 1000,   // £10 / $10 / €10 — confirm with Mickey
    currency: 'GBP',       // 'GBP' | 'USD' | 'EUR'
    ```
  - `drawAvailable: true` once seed draw is committed.
- `frontend/src/data/tournaments.js`
  - Mirror exactly. The `isPaid`, `entryFeeCents`, `currency`,
    `name`, `shortName`, `startDate`, `endDate` fields must match
    the backend.

### 2c. DB group entry fee

Verify the DB group has the right `entry_fee_cents`:

```bash
curl -s "$API/api/pools" | python3 -c "
import sys, json
for p in json.load(sys.stdin):
  if p['tournamentId'] == '{new-id}':
    print(p['name'], '| fee_cents:', p['entryFeeCents'], '| invite:', p['inviteCode'])
"
```

If the fee is wrong, tell Mickey to update via the admin endpoint:

```bash
curl -X POST "$API/api/admin/update-pool?secret=$ADMIN_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"groupId":"<uuid>","entryFeeCents":1000,"prizePoolCents":0}'
```

(If that endpoint does not exist, flag for follow-up — do NOT
hand-roll SQL from a session.)

If the DB group does not exist at all, create it via
`POST /api/groups` with the admin secret. See
`docs/new-tournament-setup.md` Phase 1 step 4.

### 2d. Remove tournament-specific startup patches

Search `backend/src/index.js` for "REMOVE after {old tournament}"
comments. Delete them.

### 2e. Mock pool cleanup

Edit `backend/src/data/mockGroups.js`. If `MOCK_GROUPS` contains an
entry for the just-completed tournament, remove it.

### 2f. Player headshot coverage

Run the coverage check from `docs/transition-prompt.md` Phase 2e.
For paid tournaments, missing headshots on top seeds is a more
visible polish issue — flag forcefully.

---

## PHASE 3 — Pre-push validation (BLOCKING)

```bash
cd /tmp/ts-new
node scripts/validate-tournament.mjs {new-id}
```

Must report "✅ Tournament config is internally consistent."

Manual hooks-discipline check on changed JSX files. Three white-screen
incidents in this project came from hooks rules violations.

---

## PHASE 4 — Push code changes

```bash
cd /tmp/ts-new
git add -A
git commit -m "feat: {New Tournament Full Name} {Year} paid tournament activation"
git push origin main
```

Verify:

1. Commit on GitHub via `git ls-remote origin main`.
2. Vercel deployment reaches `state: READY` (3 min typical).

---

## PHASE 5 — Mickey's Railway updates

Tell Mickey what to set, with copy-paste values.

**Backend service** (`tennis-survivor-production`):

```
ACTIVE_TOURNAMENT      = {new-tournament-id}
PAYMENT_WEBHOOK_SECRET = <random 32+ char string, distinct from ADMIN_SECRET>
PROCESSOR_MODE         = bridge | automated
```

For bridge mode (Revolut Business semi-manual), additionally:

```
REVOLUT_PAYMENT_LINK_<NEW-ID> = https://revolut.me/...
                               # the public payment link for this pool
```

For automated mode (when We Tranxact or similar is wired), per-processor
secrets — confirm with Mickey based on the active processor at the time.

**Scraper service** (`valiant-forgiveness` — Railway service ID `012860d6-07a0-48f1-8818-ccc4625188a0`):

```
FLASHSCORE_URL  = https://www.flashscore.co.uk/tennis/atp-singles/{city-slug}/
RESULTS_URL     = https://www.flashscore.co.uk/tennis/atp-singles/{city-slug}/results/
DEFAULT_ROUND   = R1
TIMEZONE_OFFSET = 2   (CEST clay) | 1 (BST UK) | 4 (EDT US early year)
```

⚠️  **CRITICAL — DO NOT SKIP** ⚠️

`FLASHSCORE_URL` and `RESULTS_URL` were historically *missing entirely* from
the scraper service for the entire week between Madrid completion and Rome
launch. The scraper code used to fall back to hardcoded Madrid defaults, so
it silently scraped the wrong tournament. Bracket and leaderboard returned
`seed_draw+scraper(0)` because the Madrid pairings could not be matched to
Rome's seed draw. We did not notice for a week.

After PR #4 merged, the scraper crashes loudly on missing env vars — but
verify explicitly. After save → redeploy, click the scraper service →
"Cron Runs" → "Run now" and wait for green. Then run:

```bash
API="https://tennis-survivor-production.up.railway.app"
SECRET="<your ADMIN_SECRET>"
curl -s "$API/api/admin/scraper-fixtures?secret=$SECRET&round=R1"   | python3 -c "import sys,json; print('R1 fixtures:', json.load(sys.stdin).get('total'))"
curl -s "$API/api/draw/bracket?round=R1"   | python3 -c "import sys,json; print('dataSource:', json.load(sys.stdin).get('dataSource'))"
```

Expected: R1 fixtures > 0 AND dataSource is `seed_draw+scraper(N)` with
N > 0. `seed_draw+scraper(0)` means scraping the wrong tournament — fix
FLASHSCORE_URL before continuing.

**Vercel** (frontend):

If a payment processor is wired automatically, the publishable/public
key needs to be in Vercel env. Confirm with Mickey based on processor.

Save → Redeploy each service. Wait for Mickey to confirm both
services are live before Phase 6.

---

## PHASE 6 — Post-deploy verification (BLOCKING)

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

All 4 checks must pass. Then probe round-specific endpoints:

```bash
GROUP="<new-pool-uuid>"
curl -s "$API/api/picks/available?userId=<test-uuid>&groupId=$GROUP&round=R1" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('R1 players:', len(d) if isinstance(d,list) else '?')"
curl -s "$API/api/draw/deadlines" | python3 -m json.tool | head -10
curl -s "$API/api/draw/bracket?round=R1" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'players: {len(d.get(\"players\",[]))}, matches: {len(d.get(\"matches\",[]))}')
"
```

Expected: ~52 R1 players (Masters), R1 `isOpen: true`, 96 players
and 95 matches in the bracket.

---

## PHASE 6.5 — Payment endpoint smoke (BLOCKING — paid only)

This is the phase the free transition does not cover. It catches
bridge-mode misconfigurations and webhook regressions before any
real player tries to pay.

### 6.5a. Create-order endpoint

Pretend to be a new user joining the new pool:

```bash
TEST_USER="<a-real-uuid-not-a-member>"
curl -s -X POST "$API/api/payments/create-order" \
  -H 'Content-Type: application/json' \
  -H "x-user-id: $TEST_USER" \
  -d "{\"groupId\":\"$GROUP\",\"userId\":\"$TEST_USER\"}" \
  | python3 -m json.tool
```

Expected response:

```json
{
  "orderId": "<uuid>",
  "status": "awaiting_payment",
  "checkoutUrl": "<bridge link OR null>",
  "amountCents": 1000,
  "currency": "GBP",
  "groupName": "Roland Garros 2026 Pool"
}
```

Bridge mode: `checkoutUrl` should be the Revolut payment link.
Automated mode: `checkoutUrl` should be a processor-hosted URL.
Either way, `amountCents` and `currency` must match the registry.

### 6.5b. Already-a-member rejection

Repeat the above with a userId that IS a member of the group.
Expect `400 Already a member of this group`.

### 6.5c. Free-group rejection

Same call against the previous (free) tournament's pool. Expect
`400 This group is free. Use the join endpoint directly.`

### 6.5d. Webhook signature verification (automated mode only)

```bash
# Send a payload with no signature — must be rejected
curl -s -o /dev/null -w "no-sig: %{http_code}\n" -X POST \
  "$API/api/payments/webhook/test" \
  -H 'Content-Type: application/json' \
  -d '{"webhook_id":"test-1","status":"confirmed"}'

# Send a payload with bad signature — must be rejected
curl -s -o /dev/null -w "bad-sig: %{http_code}\n" -X POST \
  "$API/api/payments/webhook/test" \
  -H 'Content-Type: application/json' \
  -H 'x-webhook-signature: invalid' \
  -d '{"webhook_id":"test-2","status":"confirmed"}'
```

Both must return non-200 (typically 401 or 400). If either returns
200, `PAYMENT_WEBHOOK_SECRET` is unset on Railway and the webhook
is wide open. STOP and tell Mickey.

### 6.5e. Order idempotency

Call create-order twice with the same userId+groupId. Both responses
must reference the same `orderId` — the system is idempotent.

### 6.5f. Join endpoint payment gate

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "$API/api/groups/$GROUP/join" \
  -H 'Content-Type: application/json' \
  -d "{\"userId\":\"$TEST_USER\",\"displayName\":\"Test\"}"
```

Must return `402 Payment Required` because there is no confirmed
order. If it returns 201, the payment gate is broken and free
joining of paid pools is possible. STOP.

---

## PHASE 7 — Reset stale state

### 7a. Member eliminations

If the new pool has any pre-existing members (early adopters), check
the leaderboard for stale `eliminatedRound`. Reset via
`POST /api/admin/reset-member` with `ADMIN_SECRET`.

### 7b. Email queue

Approve old-tournament result emails. Cancel old-tournament reminders
that no longer make sense.

---

## PHASE 8 — End-to-end purchase test (BLOCKING — paid only)

The phase the free flow does not have. Server-side green is not
enough for paid pools.

### 8a. Bridge-mode flow (Revolut)

1. Mickey opens the Revolut payment link from a non-admin device.
2. Pays £10 (or test amount Mickey is willing to refund himself
   from his own account).
3. Mickey verifies the payment landed in Revolut Business dashboard.
4. Mickey calls the admin confirm endpoint to flip the order:

   ```bash
   curl -X POST "$API/api/admin/confirm-payment?secret=$ADMIN_SECRET" \
     -H 'Content-Type: application/json' \
     -d '{"orderId":"<uuid>","processorReference":"<revolut-tx-id>"}'
   ```

5. Confirm:
   - The order's status flipped to `confirmed`.
   - A new `group_members` row was created.
   - The pool's `prizePoolCents` increased by `entryFeeCents`.
   - Confirmation email queued (or sent, depending on cron).
6. Mickey self-refunds the test purchase from Revolut and the admin
   reverses it via:

   ```bash
   curl -X POST "$API/api/payments/admin/refund?secret=$ADMIN_SECRET" \
     -H 'Content-Type: application/json' \
     -d '{"orderId":"<uuid>"}'
   ```

7. Confirm: member removed, prize pool decremented.

### 8b. Automated flow

1. Use processor's test mode (e.g. test card 4242 4242 4242 4242
   for Stripe; processor-equivalent for whichever is current).
2. Complete a full checkout from a non-admin device.
3. Confirm the webhook fires, order flips to `confirmed`, member
   added, prize pool incremented.
4. Refund via processor dashboard, confirm reversal flows back.

### 8c. Click-through

Open the new pool's invite URL in a private window. Confirm the join
modal shows the entry fee. Click "Pay & Join" (do not actually pay).
Confirm the payment page renders.

### 8d. Multi-account incognito test (BLOCKING — 6 May lesson)

3+ fresh incognito sessions. After each "successful" UI action, verify
against the live API. If UI shows joined but leaderboard API doesn't
list them, you've hit a phantom-membership bug — STOP and diagnose.
The 6 May Rome launch passed all server-side smoke but real users still
got broken state because of frontend deadline-buffer + missing-membership
checks. Don't trust UI success states without API verification.

### 8e. Data integrity (BLOCKING)

```bash
# Orphan picks must be 0
curl -s "$API/api/admin/orphan-picks" -H "Authorization: Bearer $ADMIN_SECRET" \
  | python3 -c "import sys,json; print('orphan picks:', json.load(sys.stdin).get('count','?'))"

# Pick endpoint must reject non-members with 403 (regression test)
GHOST="00000000-1111-2222-3333-444444444444"
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST "$API/api/picks" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$GHOST\",\"groupId\":\"$GROUP\",\"round\":\"R1\",\"playerId\":\"x\",\"playerName\":\"y\"}"
```

Both required: orphan count = 0, pick rejection = 403. Do not announce
the pool until both pass.

### 8f. Frontend deadline matches backend lockAt

The frontend's GroupHome.jsx computes its own entryDeadline. On 6 May
it subtracted 1h from lockAt, hiding the join button before the backend
actually closed entries. Verify no buffer subtraction:

```bash
grep -n "entryDeadline" frontend/src/pages/GroupHome.jsx
```

Should NOT see `getTime() - 60 * 60 * 1000` or any other subtraction.
Frontend entry deadline must equal backend R1 lockAt exactly.

### 8g. Bracket startTimes match the tournament day (BLOCKING after R1)

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

Must print `OK`. Stale startTimes mean the overlay sanity check has
regressed OR you're hitting a new variant. Critical on a paid event
because confused match times = picks made on the wrong assumption.

### 8h. Homepage CTA matches /api/pools entryOpen (BLOCKING)

The 2026-05-08 brief flagged a homepage card showing `LIVE` + `Enter free →`
for a tournament whose R1 had locked 2 days earlier. Root cause: the
homepage filtered on `tournament.status` only, not on `entryOpen`. Fixed
by surfacing `entryOpen` from `/api/pools` (PR #12). Verify:

```bash
curl -s "$API/api/pools" | python3 -c "
import sys, json
pools = json.load(sys.stdin)
for p in pools:
    t = p.get('tournament') or {}
    if 'entryOpen' not in p:
        print(f"  ✗ {t.get('shortName','?')}: entryOpen MISSING")
        sys.exit(1)
    print(f"  ✓ {t.get('shortName','?')}: status={t.get('status')} entryOpen={p['entryOpen']} reason={p['entryClosedReason']}")
"
```

Then visually:
- If `entryOpen: false` for the active pool: homepage shows `LIVE NOW · Tournaments underway` (not `OPEN NOW`); card CTA is `View leaderboard →` (not `Enter →`/`Enter free →`); status pill reads `Live · entry closed`.
- If `entryOpen: true`: `OPEN NOW · Pools accepting entries` shows with the Enter CTA.

For a paid pool: an Enter CTA on a closed pool means a user could pay
£10 and bounce off the R1 lock at join. Treat as critical.

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

### 9a. CLAUDE.md

- Bump "Last updated" line.
- Add a Session history row covering both the old-tournament wrap-up
  and the new-tournament launch.
- Mark old known issues as `~~struck through~~ — FIXED` if relevant.
- Add new known issues if any surfaced.

### 9b. Memory files

Update only what genuinely changed:

- `project_tennis_survivor.md` — new active tournament, member counts.
- `project_paid_launch_decisions.md` — phase progress, processor
  status, settlement data from previous tournament.
- `project_payment_infrastructure.md` — any processor changes.
- `roadmap.md` — phase progress, next tournament dates.
- `MEMORY.md` — index pointers (one-liners only).

### 9c. Stale audit

Anything in memory describing the old tournament as "active" is now
stale. Fix or remove.

### 9d. Push and verify

```bash
git add -A
git commit -m "chore(memory): {new-id} active, {old-id} settled, session {n}"
git push origin main
git ls-remote origin main
```

Verify by fetching one pushed file via the GitHub API.

### 9e. Mickey-pulls-on-Mac reminder

End the session with the literal sentence:

> "Run `cd ~/tennis-survivor && git pull` on your Mac before opening
> the next Cowork session. Your local repo is N commits behind."

---

## PHASE 10 — Known gotchas (read once)

- **Never work from mnt.** Always `/tmp` clone.
- **Railway does not auto-restart on env-var change.** Save → Redeploy.
- **Scraper cache lag.** Match `startTime` may be null for 30-60
  minutes after the FlashScore URL switches.
- **Player names are "Surname, Firstname"** in seed draws (canonical
  ATP / FlashScore format). Any frontend formatter must detect the
  comma — `shortName()` was broken for weeks because it assumed the
  legacy `"Firstname Lastname"` format and inverted every player.
  Headshots are stored as `firstname-surname.jpg`.
- **`computeStatus()` overrides registry `status`** based on dates.
- **Hooks rules.** No hooks after early returns or inside conditionals.
- **Invite codes are uppercase end-to-end** as of commit `fc0bad8`.
- **Three registries must agree.** Validator catches drift.
- **Bridge-mode payments are MANUAL.** Never automate fund movement
  from a Cowork session. Only automate the bookkeeping (DB rows
  flipping after Mickey confirms the bank-side movement).
- **Webhook signatures must be enforced.** Phase 6.5d catches the
  case where `PAYMENT_WEBHOOK_SECRET` is unset and webhooks are wide
  open. A wide-open webhook can be used to fake confirmed payments
  and join free.
- **Vercel preview origin must be in CORS allowlist.** When using
  the working-agreement preview-verify step, the preview URL is a
  different origin from prod. The backend's `ALLOWED_ORIGINS` regex
  must match the project's Vercel team subdomain or login fails with
  'Failed to fetch'. See `feedback_cors_preview_origins.md`.
- **Idempotency.** Payment orders, webhook handlers, and confirm
  endpoints must be idempotent. The same Stripe charge or Revolut
  reference should never double-credit a pool.
- **Currency must be explicit.** Never assume GBP. Display the
  currency symbol on the join screen and in confirmation emails.
- **Refund flow must be tested.** Most payment bugs surface only
  on edge cases (refund, partial pay, currency mismatch).
- **Payouts to winners are MANUAL.** Phase 1.5d.

---

## START NOW

Read CLAUDE.md, the memory files, and the runbook docs. Then report
back with Phase 1 findings before touching any code.
