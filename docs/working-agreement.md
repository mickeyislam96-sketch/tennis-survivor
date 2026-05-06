# Working Agreement — Final Serve-ivor

> **Read this at the start of every Cowork session before touching any code.**
>
> This document defines how Claude ships changes to a live, user-facing
> product. It exists because on 6 May 2026 we shipped 4 separate
> user-facing bugs to production while real users were trying to play
> a tournament. The pattern was: change pushed to `main`, smoke green,
> real users still hit broken paths the smoke didn't cover.
>
> Last updated: 6 May 2026

---

## The rule

**No direct pushes to `main` for any change that touches user-facing
behaviour.** Every such change goes through a feature branch and a
preview URL.

User-facing means: anything that runs in the user's browser, anything
the API exposes to non-admin callers, anything that mutates DB state
on a user's behalf, or anything that changes how a tournament behaves
during a live window.

Changes to docs, memory files, CI workflows, internal scripts, and
admin-only endpoints CAN go to `main` directly because they don't
affect what users see — but bring them in via PR anyway when bundled
with user-facing work.

---

## The workflow

### 1. Open a feature branch

Branch from the latest `main`:

```bash
cd /tmp/ts-new          # always /tmp clone, never mnt
git fetch --quiet origin main
git checkout -B claude/<topic-slug> origin/main
```

Branch naming: `claude/<topic>` (e.g. `claude/fix-entry-buffer`,
`claude/add-payment-webhook`).

### 2. Make the change AND a test for it

For every behaviour change, add or update a test that would have
failed before the fix. If the test infrastructure doesn't reach that
code path yet, add a manual verification step to the PR description
plus a TODO to backfill the test before the next tournament.

The 6 May incident set: each bug fixed had no regression test until
after the user reported it. That is the failure mode this rule
prevents.

### 3. Push the branch

```bash
git push origin claude/<topic-slug>
```

Vercel auto-deploys a preview URL for the branch. Find it via:

```bash
# From Cowork: use the Vercel MCP list_deployments and filter by ref
# From CLI:  curl GitHub deployments API
curl -s "https://api.github.com/repos/mickeyislam96-sketch/tennis-survivor/deployments?ref=<branch>"
```

### 4. Run smoke against the preview

```bash
SMOKE_API=<preview-backend-or-prod-fallback> EXPECTED_TOURNAMENT=<id> bash scripts/smoke.sh
```

Until a Railway staging service exists, the preview's backend will be
production. The point of the preview is to validate the **frontend**
change end-to-end. Once staging exists, smoke can run against it
freely with mutations.

### 5. Open a PR

Title: short, imperative. Description must include:

- What user-facing behaviour changes
- Preview URL to click
- Smoke output (paste the bash result)
- Tests added — or "TODO: add test" with reason

### 6. Wait for CI to pass

The `Backend tests` workflow runs on every push, including PR pushes.
Both jobs (smoke + integration) must be green before merging.

### 7. Mickey approves

Mickey clicks the preview URL and verifies the change works. For
backend-only changes with no UI surface, he acknowledges in chat
("ship it" or similar).

For changes during a live tournament window, this approval is
mandatory and explicit. Implicit "go ahead" doesn't count.

### 8. Merge to main

```bash
git checkout main
git pull --quiet origin main
git merge --no-ff claude/<topic-slug>
git push origin main
```

Or merge via GitHub UI. Either is fine.

### 9. Verify in production

`bash scripts/smoke.sh` against prod. Confirm Vercel deployed the
merge, Railway redeployed if backend changed, and the specific feature
works.

---

## Exceptions

### Production-down emergencies

If the prod site is broken right now and users are affected, direct
push to `main` is acceptable IF:

1. Mickey explicitly says "yes push direct" in chat for THIS specific
   fix. Implicit "we have a problem" doesn't count.
2. The push includes the fix only — no bundled work.
3. Within 24 hours, a follow-up commit adds the regression test that
   would have caught it.
4. The incident is logged in `.claude/memory/feedback_*.md` so the
   pattern is captured for future sessions.

The 6 May incident set were all examples of this exception — and 3 of
the 4 fixes shipped without the regression test backfilled, which is
the part that needs to stop.

### Memory + docs only

Pure changes to `.claude/memory/`, `docs/`, `CLAUDE.md`, or this file
can go direct to `main`. They don't affect runtime behaviour.

### Admin-endpoint additions

New `/api/admin/*` endpoints can go direct to `main`. They're scoped
to the admin secret and don't expose anything to users. Existing
endpoint changes still go through the workflow.

### CI workflow changes

`.github/workflows/*.yml` can go direct to `main`. They affect
tooling, not users.

---

## Pre-tournament fire drill

Before announcing any new tournament pool to real users, run this on
the staging environment (or, until staging exists, a dry-run on prod
with throwaway accounts you'll clean up after):

1. Three fresh incognito sessions, three throwaway accounts.
2. Each one: register → click invite → join → make a pick.
3. After each "successful UI action", verify against the live API:
   - Did the user appear in `/api/leaderboard/<group>`?
   - Did the pick appear in `/api/admin/picks/<group>`?
4. Check `/api/admin/orphan-picks` — count must be 0.
5. Check the gold pool pill updates correctly after join.
6. Check the entry deadline shown on screen matches
   `/api/draw/deadlines` R1 lockAt exactly (no frontend buffer
   subtraction).
7. Run `node scripts/validate-tournament.mjs <id>` — must pass.
8. Run `bash scripts/smoke.sh` with `ADMIN_SECRET` set — all 6 steps
   green.

If any step fails, the tournament does not get announced.

---

## Hard rules to internalise

- Never trust UI success states without API verification.
- Frontend-only logic that diverges from backend (e.g. timing buffers)
  is a bug-shaped hole. Either remove the divergence or add an
  end-to-end test that exercises both.
- Every push to `main` should leave the system in a state where
  `bash scripts/smoke.sh` passes. If it doesn't, the push was wrong.
- Data integrity assertions (orphan picks, member counts, payment
  reconciliation) belong in smoke tests, not just runbooks.
- "I rushed because the user was waiting" is the most expensive
  excuse in this codebase. Discipline matters most under pressure.
- **Never transcribe precise strings (tokens, hashes, secrets, invite
  codes, verification values) from a screenshot.** They get visually
  truncated and you don't notice. Pull from the DOM via JavaScript,
  use a copy-paste action, or query the source. See
  `.claude/memory/feedback_screenshot_truncation.md` for the 6 May
  GSC token incident.

---

## Where this file lives in the workflow

- `CLAUDE.md` references this file at the top.
- Both transition prompts (`docs/transition-prompt.md` and
  `docs/paid-transition-prompt.md`) reference it as Phase 0 reading.
- The session-end protocol checks that this file is the most recent
  reference for any user-facing change.

If this file conflicts with a more specific instruction elsewhere,
this file wins.
