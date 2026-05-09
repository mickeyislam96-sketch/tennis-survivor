---
name: DECIDED_STATUSES pattern for match completion
description: Never check status === 'completed' alone. Always use DECIDED_STATUSES Set(['completed','retired','walkover']) when checking if a match has a winner.
type: feedback
---

## Always use DECIDED_STATUSES, never bare `=== 'completed'`

Tennis matches can end in three ways that produce a winner: completed (normal), retired (player quits mid-match), and walkover (player withdraws before match starts but after draw). All three have a `winnerId`.

**Why:** Session 30 found that `resultsProcessor.js`, `leaderboard.js` buildGrader, and `seedDrawOverlay.js` all filtered `status === 'completed'` only. Three Madrid R1/R64 matches with winners were silently ignored. Picks stayed `survived=NULL` forever, eliminations never triggered, emails never sent.

**How to apply:** Any code that checks whether a match is "done" or has a result must use:
```javascript
const DECIDED_STATUSES = new Set(['completed', 'retired', 'walkover']);
function isMatchDecided(m) {
  return DECIDED_STATUSES.has(m.status) && m.winnerId;
}
```

Files already fixed (24 Apr 2026): `resultsProcessor.js`, `leaderboard.js`, `seedDrawOverlay.js`, `admin.js`. If adding new code that reads match results, use this pattern.


## Caveat (session 38b — 9 May 2026): walkovers can have status without winnerId

The `DECIDED_STATUSES.has(m.status) && m.winnerId` pattern still holds for asking *"is this match decided AND do we know the winner?"*. But after session 38b, **walkover/retired matches can carry status='walkover' with `winnerId: null`** when the scraper refused to guess and no `manualResultOverrides` entry exists yet. Such matches are flagged `requiresAdminReview: true` by the overlay and do NOT propagate winners to the next round. They surface in `GET /api/admin/walkover-pending` for admin to resolve.

If you need *"is this match settled enough to act on"*, keep using `isMatchDecided(m)` (status ∈ DECIDED_STATUSES AND winnerId truthy). If you need *"is this match in a state that suggests no further play"*, check status alone but be prepared for null winnerId.
