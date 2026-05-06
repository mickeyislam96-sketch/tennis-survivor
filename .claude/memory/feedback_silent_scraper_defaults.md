---
name: Silent Madrid scraper defaults
description: Scraper silently scraped previous tournament for a week because FLASHSCORE_URL/RESULTS_URL env vars were missing on Railway and the code had Madrid URLs hardcoded as defaults — verify env vars after every transition.
type: feedback
---

# Silent Madrid scraper defaults

The Railway scraper service `valiant-forgiveness` (ID `012860d6-07a0-48f1-8818-ccc4625188a0`) needs `FLASHSCORE_URL` and `RESULTS_URL` env vars per tournament. They were missing for the entire week between Madrid completion and Rome launch. `scraper/src/config.mjs` had Madrid URLs hardcoded as defaults, so the scraper silently pulled Madrid for a week. Bracket returned `seed_draw+scraper(0)` because Madrid pairings could not be matched onto Rome's seed draw, but no error fired — just stale data with synthetic timestamps that looked plausible at a glance.

**Why:** before PR #4 the scraper config used `process.env.X || 'https://...madrid/'`. With env vars unset, defaults kick in silently. CLAUDE.md previously claimed "Scraper env vars updated for Rome" — that claim was unverified and false. The Railway dashboard showed only 3 vars (ADMIN_SECRET, BACKEND_URL, DEFAULT_ROUND).

**How to apply:**
- After PR #4 merges the scraper crashes loudly on missing env vars — but still verify explicitly during every transition.
- After redeploy, click "Cron Runs" → "Run now" on the scraper service, wait for green.
- Then run two checks:
  - `curl "$API/api/admin/scraper-fixtures?secret=$SECRET&round=R1"` — expect `total > 0`.
  - `curl "$API/api/draw/bracket?round=R1"` — expect `dataSource: seed_draw+scraper(N)` with N > 0 (post-launch). `scraper(0)` means scraping the wrong tournament.
- `scripts/smoke.sh` now has a step 1b that flags `scraper(0)` as a failure.
- `docs/transition-prompt.md` and `docs/paid-transition-prompt.md` Phase 5 now include a BLOCKING verification block — cannot proceed to Phase 6 without proof.
- A claim in CLAUDE.md that "X was updated" with no commit, screenshot, or log proving it is unverified. Same failure mode as the 17 Apr stale-mnt incident. When updating context, save evidence (screenshot of Railway vars, commit hash, log line), not just the assertion.

**Tournament URL pattern:** `https://www.flashscore.co.uk/tennis/atp-singles/{city-slug}/` (NOT `.com` — the `.co.uk` domain is what production uses).
