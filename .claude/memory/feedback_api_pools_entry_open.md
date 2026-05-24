---
name: /api/pools must surface entryOpen for the homepage to filter on
description: GroupHome computed entryOpen from r1LockAt; Homepage didn't, so closed pools showed Enter CTAs. Fixed in PR #12 by enriching backend response.
type: feedback
---

**Symptom (8 May 2026):** Rome's R1 had locked 2 days earlier but the
homepage still showed an `Enter free →` CTA on the Rome card. Group
page correctly said "Entry period is over". Two surfaces telling
different stories.

**Root cause:** two competing definitions of "entries closed."

- `frontend/src/pages/GroupHome.jsx` derived it from `r1LockAt` via
  `/api/draw/deadlines` — that's why it was correct.
- `frontend/src/pages/Homepage.jsx` only looked at
  `tournament.status in [active, upcoming]` — no awareness of round
  locks.

**Fix (PR #12, commit `1ded4d75`):** backend `/api/pools` now enriches
every pool with `entryOpen: boolean` and
`entryClosedReason: 'completed' | 'r1-locked' | null`. Single source of
truth. Frontend filters on it.

```js
// backend/src/routes/pools.js
function deriveEntryStatus(tournament, activeR1LockAt) {
  if (tournament?.status === 'completed') {
    return { entryOpen: false, entryClosedReason: 'completed' };
  }
  if (tournament?.status !== 'active') {
    return { entryOpen: true, entryClosedReason: null };
  }
  if (tournament?.id === ACTIVE_TOURNAMENT?.id && activeR1LockAt) {
    const cutoff = new Date(activeR1LockAt.getTime() - 60 * 60 * 1000);
    if (new Date() >= cutoff) {
      return { entryOpen: false, entryClosedReason: 'r1-locked' };
    }
  }
  return { entryOpen: true, entryClosedReason: null };
}
```

## Why this matters before RG (18 May, paid £10)

Without this fix, a paid user could have paid £10 then bounced because
R1 locked. The CTA-visibility gate must be wired to the backend's
authoritative entry-close rule, not just to status badges.

## How to apply

When two FE surfaces compute the same boolean differently, **lift it
into the API response** rather than duplicating the rule. Keeps the
contract in one place, lets backend tests cover it, and prevents
"two surfaces lying to users" drift.

The cron logic in `eliminateNonPickers` and the email scheduler also
depend on R1 lock times — there's an opportunity to share a `getEntryStatus()`
util across all three call sites if drift recurs.
