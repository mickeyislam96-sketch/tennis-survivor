---
name: group_members.is_alive must sync from picks every cron tick
description: Once all picks for a round are resolved (NULL → boolean), autoProcessResults skips the round, leaving any latent group_members.is_alive desync stuck. Defence: sweep group_members from picks every cron tick.
type: feedback
---

**Rule:** `group_members.is_alive` and `picks.survived` must agree at all
times. The cron path that updates them must be idempotent and runs on
every cron tick — not gated by "did any pick get resolved this round".

**Why:** History — 2026-05-09 Rome morning brief flagged `/api/leaderboard`
returning Rafa with `isAlive: true, eliminatedRound: null` despite his
R64 pick (de Minaur) losing and `picks.survived = false` for that pick.
`/api/pools.aliveCount` reported 3 (correct); leaderboard reported 4
(stale). Frontend rendered Rafa as ELIMINATED via a derived path (looked
at the latest pick's survived flag), masking the contract violation. Any
external API consumer (UptimeRobot smoke, future mobile, integrations)
would have got the wrong answer.

**Root cause:** `processRoundResults(round)` updates picks.survived AND
group_members.is_alive in the same call, but `autoProcessResults()`
SKIPS rounds where `count(picks WHERE survived IS NULL) = 0`. Once every
member's current-round pick is resolved, the round is skipped — any
latent is_alive desync (e.g. from a manual `reset-member` admin call,
or a partial run) stays stuck. The 15-min cron does nothing useful for
that round again.

**How to apply:** Use `syncGroupMembersFromPicks()` (added session 38b).
It runs unconditionally on every `autoProcessResults` invocation. SQL is
a single UPDATE-FROM joining picks where `survived = false AND
gm.is_alive = true AND tournament_id = TOURNAMENT.id`. O(N) where N is
small. Idempotent.

When designing other "results processing" paths, the same lesson applies:
**don't gate state-reconciliation on a "did anything change" check**. If
the source of truth is one column and the derived state is another column,
the reconciler must run unconditionally — otherwise drift sticks. The
"nothing changed since last run" optimisation is fine for skipping
expensive work; it's not fine for skipping the consistency check itself.

**Regression coverage:** integration test category — would assert that
after a UPDATE picks SET survived=false from a SQL fixture, the next
syncGroupMembersFromPicks() run flips the corresponding gm row. Not yet
written but the pattern is straightforward.
