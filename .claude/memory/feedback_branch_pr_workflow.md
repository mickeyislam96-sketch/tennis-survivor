---
name: Branch + PR workflow — never push direct to main for user-facing changes
description: 6 May 2026 we shipped 4 user-facing bugs to prod in one session by pushing directly to main. Working agreement now mandates branch + PR + Vercel preview + smoke + Mickey approval before merge.
type: feedback
---

User-facing changes go through a feature branch, Vercel preview URL,
smoke against the preview, a PR, CI green, Mickey's explicit approval,
then merge. Direct pushes to `main` are reserved for memory/docs/CI/
admin-only changes, and prod-down emergencies with explicit sign-off.

**Why:** 6 May 2026 Rome R1 launch. We shipped:
- Frontend entry-buffer bug that hid the Join button 1h before lock
- picks.js silently accepting non-member picks (data corruption)
- Pool-pill stale state after join
- Frontend deadline computation diverging from backend lockAt

All four hit real users. None had regression tests until after the
user reported the bug. Smoke passed each time. The smoke didn't cover
the user-facing flow well enough.

The branch + PR workflow forces:
- Vercel preview URL exists for every change → manual click-through
  catches frontend-only bugs that smoke can't see
- CI runs on the PR → required pass before merge
- Mickey reviews the preview before approving → his eyes catch what
  smoke misses

**How to apply:**

Always:
- `git checkout -B claude/<topic-slug> origin/main` from a `/tmp` clone
- Add or update a regression test for any behaviour change
- `git push origin claude/<topic-slug>`
- Get Vercel preview URL, run smoke against it
- Open PR with: change description, preview URL, smoke output, tests
- Wait for CI green
- Mickey clicks the preview, says "ship it"
- Merge to main

Exceptions documented in `docs/working-agreement.md`:
1. Prod-down with explicit sign-off (regression test within 24h)
2. Memory / docs / CI / admin-only changes can go direct

When unclear: branch + PR. The cost is ~3 minutes per change. The
cost of a user-facing bug is much more than that.
