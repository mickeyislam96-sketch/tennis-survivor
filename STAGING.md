# Staging Environment

This branch is the **staging** branch. Pushing here deploys to:

- **Backend (Railway):** https://tennis-survivor-staging.up.railway.app
- **Frontend (Vercel):** https://tennis-survivor-git-staging-mickeyislam96-sketchs-projects.vercel.app

## Workflow

1. Branch off `main` for new work.
2. Open a PR targeting `staging` first. Auto-deploys to staging URLs above.
3. Smoke test on staging.
4. Merge `staging` to `main` to release to production.

## Important

- Staging has its own Postgres — empty by default. Seed if needed.
- The scraper service runs in staging too; data isolated from prod.
- Never share staging URLs with users. Production is finalserveivor.com.

Created 2026-05-07 (session 36).
