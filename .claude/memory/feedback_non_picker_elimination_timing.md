---
name: Non-picker elimination must fire on round-lock, not match-completion
description: 6 May 2026 — a user (Mark) didn't pick before R1 lock and stayed 'alive' on the leaderboard for 35+ minutes because eliminateNonPickers was a sub-step of processRoundResults, which only runs once at least one match completes. Fixed via a new sweepLockedRoundNonPickers() called from the 15-min cron.
type: feedback
---

When a round locks, every member who hasn't picked is eliminated.
That elimination must happen as soon as possible after lock — not
"eventually, when the first match completes".

**6 May 2026 incident (PR #3, commit `3f9f7fc`):** Mark didn't pick
before R1 lock at 09:00 UTC. Leaderboard still showed him alive at
09:35 UTC because the existing `eliminateNonPickers()` was only a
sub-step of `processRoundResults()`, which only fires when match
results arrive. For the first round of any tournament, this opens a
1-2 hour window where non-pickers look alive on the leaderboard.

**Fix:** Added `sweepLockedRoundNonPickers()` in
`backend/src/services/resultsProcessor.js` that walks every round in
`/api/draw/deadlines`, finds the locked ones, and calls
`eliminateNonPickers` on each. Wired into the 15-min ops cron in
`backend/src/index.js` as step 1b, immediately after
`autoProcessResults`.

`eliminateNonPickers` itself is unchanged — it already guards against
running on an open round, so the sweep is safe to call repeatedly.

**How to apply:**

When adding any future "this happens after the round locks" logic:

1. Don't piggy-back on `processRoundResults` — that requires match
   completion to trigger.
2. Either add it to `runOpsChecks` in `opsMonitor.js`, or add a
   dedicated step in the 15-min cron in `index.js`.
3. Always include a guard inside the function itself that checks the
   round-lock state via `getDeadlines()`. Multiple callers + safety.

**Cron architecture cheat-sheet:**

- `cron.schedule('*/15 * * * *', ...)` in `index.js` — every 15 min.
  Steps:
    1. `autoProcessResults()` — grade picks for completed matches
    1b. `sweepLockedRoundNonPickers()` — eliminate non-pickers
    2. `checkPickReminders()` — pre-lock email reminders
    3. `runOpsChecks()` — withdrawals, draw release, lock-time auto-set
    4. `sendAdminDigest()` — no-op, kept for back-compat
- FlashScore scraper Railway service (id `012860d6-07a0-48f1-8818-ccc4625188a0`)
  — separate service, hourly 10:00–21:00 UTC. Posts results back to
  backend; backend's 15-min cron picks them up.
