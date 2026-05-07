---
name: Staging environment shipped 7 May 2026
description: Railway + Vercel staging set up end-to-end. `staging` branch is the source. Isolated Postgres. Smoke-verified. Outstanding cleanups documented.
type: project
---

**Shipped 7 May 2026 (session 36).** Closes critical-gap #3.

## URLs and IDs

- Backend (staging): `https://tennis-survivor-staging.up.railway.app`
- Frontend preview (staging): `https://tennis-survivor-git-staging-mickeyislam96-sketchs-projects.vercel.app`
- Railway staging environment ID: `6e2a12c6-df61-45dc-89e0-d8e71ca0d14f`
- Source branch: `staging` (created from main SHA `9ee8853`)

## Workflow contract

- New work branches off `main`.
- Open a PR targeting `staging` first. Auto-deploys to staging URLs above.
- Test on staging.
- When green, merge `staging` into `main` to release to production.

## Important properties

- Staging Postgres is **separate** from prod. Empty by default. Reference variable `${{Postgres.DATABASE_URL}}` in the backend service auto-resolves per environment.
- Staging scraper service is duplicated from prod and deploys from `staging` branch. It will scrape FlashScore and post to staging backend.
- The 48-hour-grace-period orphan project `pleasing-appreciation` was deleted today — that was the source of daily build-failure emails.

## Outstanding cleanups (do these before relying on staging)

1. **FRONTEND_URL on Railway staging is still prod URL.** Change to the Vercel staging preview URL or CORS will reject staging-frontend → staging-backend calls.
2. **`.github/workflows/tests.yml` only triggers on `main`.** Add `staging` to the branches list so PRs targeting staging run CI.
3. **Consider pausing the staging scraper** to save Railway compute. Staging is for code testing, not scraper testing. Disable cron or set deploy paused on the `valiant-forgiveness` service in the staging environment.

## Why the cost is acceptable

Staging adds roughly £4–8/month to Railway: a small Postgres + a backend service running 24/7 + the scraper (which is currently still running in staging). Trade-off accepted to unlock proper code testing before RG.
