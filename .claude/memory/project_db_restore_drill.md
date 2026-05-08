---
name: DB-restore drill — closes critical-gap #5
description: Quarterly automated GitHub Actions workflow + manual local script. Both restore the latest pg_dump artifact into ephemeral Postgres and assert plausibility.
type: project
---

**Built 8 May 2026 (PR #17).** Closes critical-gap #5 from
`.claude/memory/project_critical_gaps.md` — backups had been running
daily since session 35 but no one had ever proved they were usable.

## What runs automatically

`.github/workflows/db-restore-verify.yml`

- Schedule: 04:00 UTC on the 1st of January, April, July, October.
- Also runnable manually via GitHub UI → Actions → Quarterly DB Restore
  Verification → Run workflow. Optional `run_id` input to test a
  specific historical backup.
- Steps: find latest successful Daily Database Backup run, download its
  artifact, spin up Postgres 17 service container, restore the dump,
  assert (a) required tables exist, (b) users + groups have ≥1 row,
  (c) no orphan picks (no missing user references).
- On failure: opens a GitHub issue tagged `critical, infra` so it
  doesn't get missed.

## What Mickey can run on demand

`scripts/test-db-restore.sh <path/to/backup.sql.gz>`

- Downloads from GitHub Actions UI manually, then run the script.
- Same assertions as the workflow.
- Spins up postgres:17-alpine in Docker locally on port 55433.
- Tears down on exit.

## Why this matters before RG (18 May)

Roland Garros is the first paid tournament. If the DB ever breaks
during the event and the backup turns out to have been silently
corrupting for weeks, the financial liability is real. This drill
makes "we can restore" a verified property, not a hope.

## How to apply

If quarterly cadence isn't aggressive enough as paid volumes grow,
flip the cron to monthly or weekly. The workflow takes ~3 minutes per
run on the standard runner — the cost is trivial.
