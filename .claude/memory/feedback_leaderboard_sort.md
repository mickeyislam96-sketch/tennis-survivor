---
name: Leaderboard sort rule
description: Mickey's spec for leaderboard ordering — alive first by survivedRounds DESC, eliminated by elimination recency DESC, alphabetical tiebreaker for both. Implemented as exported `sortLeaderboard()` in routes/leaderboard.js + smoke test pinning all six cases.
type: feedback
---

# Leaderboard sort rule

Mickey's spec, given 2026-05-10 during the morning brief follow-up:

1. **Alive members rank above all eliminated members.**
2. **Within alive:** sort by `survivedRounds` DESC. More rounds survived = higher.
3. **Within eliminated:** sort by elimination recency DESC. R64 elim above R32 elim above R1 elim. (`ROUNDS.indexOf` of `eliminatedRound`, descending.)
4. **Tiebreaker for both sections:** alphabetical by `displayName`, case-insensitive (`localeCompare` with `sensitivity: 'base'`).

## How to apply

The sort is implemented as an exported helper, `sortLeaderboard(members)`,
in `backend/src/routes/leaderboard.js`. Both leaderboard branches (DB and
mock) call it. **Do not inline the sort** — the helper has a regression
test that pins the contract.

```js
export function sortLeaderboard(members) {
  const alive = members.filter(m => m.isAlive).sort((a, b) => {
    const d = b.survivedRounds - a.survivedRounds;
    return d !== 0 ? d : compareDisplayName(a, b);
  });
  const eliminated = members.filter(m => !m.isAlive).sort((a, b) => {
    const d = roundIndex(b.eliminatedRound) - roundIndex(a.eliminatedRound);
    return d !== 0 ? d : compareDisplayName(a, b);
  });
  return { alive, eliminated };
}
```

`roundIndex()` returns `-Infinity` for unknown / null rounds, NOT `0`.
This is deliberate — see "Why the bug" below.

## Why the bug

The pre-2026-05-10 sort was:

```js
.sort((a, b) => (ROUNDS.indexOf(b.eliminatedRound) || 0)
              - (ROUNDS.indexOf(a.eliminatedRound) || 0))
```

JS gotcha: `indexOf` returns `-1` for missing entries, and `-1 || 0`
evaluates to `-1` (because `-1` is truthy). So a member with a typo'd or
stale `eliminatedRound` would sort BELOW R1 elims (`indexOf=0`) rather
than at the bottom or in any sensible position. Worse: it aliased
`R1` (indexOf 0) and unknown (indexOf -1 → -1) to nearly-equal weights
even though they should be far apart.

The fix uses a `roundIndex()` helper that returns `-Infinity` for
unknown rounds, so they sort to the bottom of the eliminated section,
which is what you'd want.

## Regression test

`backend/tests/smoke/leaderboard-sort.test.js` — 7 cases:

- alive ranks above eliminated
- alive sorted by survivedRounds DESC
- alive ties broken alphabetically (case-insensitive)
- eliminated sorted by recency DESC (R64 above R1)
- eliminated ties broken alphabetically
- unknown eliminatedRound sorts to bottom (the `|| 0` regression)
- full Rome 2026 today scenario (3 alive tied, R64 elim, two R1 elims)

CI green at first run.

## What this won't do

- No timestamp-based tiebreaker for "who was eliminated more recently
  within the same round". Mickey said alphabetical was fine. If you
  ever want timestamp ordering, you'd need to capture the elimination
  time on the picks / group_members table — not currently stored.
- Doesn't reorder picks history or anything else. Strictly the
  leaderboard ordering returned by `GET /api/leaderboard/:groupId`.

## Reference

PR #22 (the leaderboard-sort PR). Commit message tags this file in its
body for traceability.
