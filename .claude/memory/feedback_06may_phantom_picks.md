---
name: 6 May Rome launch — phantom membership + frontend deadline buffer bugs
description: Two production bugs that hit real users on Rome R1. Phantom picks accepted from non-members. Frontend hid Join button 1h before backend closed entries.
type: feedback
---

On 6 May 2026 we launched Rome 2026 with a smoke test that passed but
real users still couldn't join. Three real friends ended up in
inconsistent states. Root causes:

**Bug 1 — frontend deadline buffer.** GroupHome.jsx computed
`entryDeadline = r1LockAt - 1 hour` to give late joiners time to pick.
With R1 lock at 08:00 UTC, the join button hid at 07:00 UTC even
though the backend was still accepting joins. Users saw "Entry period
is over" when entries were technically open.

**Fix:** GroupHome.jsx now uses `entryDeadline = r1LockAt` directly.

**Bug 2 — picks endpoint accepted non-members.** picks.js' membership
check only rejected if the (user, group) row existed AND is_alive=false.
If the user wasn't a member at all, the pick was inserted anyway. So
when a join silently failed, the user still saw "Current R1 Pick" on
screen — but they weren't in the leaderboard.

**Fix:** picks.js now requires a group_members row before accepting a
pick. Returns 403 with an actionable error.

**How to apply going forward:**

1. Smoke test now includes orphan-pick check (count must be 0) and a
   non-member-pick rejection regression test. Both run on every push
   via `.github/workflows/tests.yml`.

2. Transition prompts (`docs/transition-prompt.md` and
   `docs/paid-transition-prompt.md`) now mandate:
   - Multi-account incognito testing (3+ fresh sessions, not 1)
   - API verification after every "successful" UI action — never trust
     the UI success state alone
   - Orphan-pick count check before announcing the pool
   - Frontend-vs-backend deadline alignment (no buffer subtraction)

3. Admin tooling for incident response:
   - `GET /api/admin/orphan-picks` — find users with picks but no membership
   - `GET /api/admin/recent-users` — list users + their pool memberships
   - `GET /api/admin/picks-by-player?name=X` — search picks by player name
   - `POST /api/admin/bulk-add-members` — batch-add to a pool to recover
   - `POST /api/admin/remove-user` — destructive cleanup

**Lesson (general):** the frontend can have its own logic that
diverges from the backend (the 1h buffer was nowhere on the server).
Server-side integration tests don't catch frontend-only bugs. Always
test the user-facing flow end-to-end with API verification at each
step.
