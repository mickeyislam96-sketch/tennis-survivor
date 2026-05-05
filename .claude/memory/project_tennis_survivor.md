---
name: Final Serve-ivor project context
description: Full technical context for the Final Serve-ivor tennis survivor game — stack, repo, infrastructure IDs, key files, design system
type: project
originSessionId: b7e848b7-b642-43e4-a5e5-5e49e2c370e9
---
**Product:** Final Serve-ivor — tennis survivor fantasy game. Players pick one ATP player per round, eliminated if their pick loses. Live at https://finalserveivor.com. Monte Carlo 2026 complete (Mark won). Madrid Open 2026 complete (finished ~4 May). Rome 2026 ACTIVE (started 5 May, free, R1 open, DB group `de81ed56-6c30-483a-9d38-3c48201ab42e`, invite code `ROME-2026-POOL-bxxhnp`).

**Stack:**
- Frontend: React + Vite → Vercel (auto-deploys from GitHub main)
- Backend: Node.js / Express → Railway (auto-deploys from GitHub main)
- GitHub repo: `mickeyislam96-sketch/tennis-survivor`
- Primary data: FlashScore scraper (Railway cron service, Playwright headless Chromium, hourly 10-21 UTC). Goalserve fully removed 22 Apr.
- Fallback data: API-Tennis (automatic fallback in dataAdapter provider chain)
- Database: PostgreSQL on Railway volume (picks, groups, members)
- Email: Brevo transactional (custom HTML templates in email.js, direct send with dedup via `emails_sent` table)
- Email domain: `finalserveivor.com` fully authenticated in Brevo (DKIM 1+2 CNAME, DMARC, Brevo code). DNS on Namecheap.

**Live URLs:**
- Production frontend: https://finalserveivor.com
- Vercel alias: https://tennis-survivor.vercel.app
- Backend API: https://tennis-survivor-production.up.railway.app

**Infrastructure IDs:**
- Railway Project: `0ec066c7-c7e1-4abf-8897-3577208c64cd`
- Railway Service: `df618c7b-3678-4595-aaf7-3ff2f0e86d72`
- Railway Environment: `148fec0e-b919-423b-93d7-1487cdaa82d4`
- Vercel Project: `prj_HBePdqF7BaXq1qzw7bxu9prRhtyf`
- Vercel Team: `team_ekuiNPY7cIyY2ieq41oWMYvO`

**Design system:** Direction A "Clean Court" — Outfit + Fraunces + JetBrains Mono, semantic colour tokens, 640px mobile breakpoint. Reference file: `CTO - TS/fsv-final-mockups.html`. Player avatars: 169-player CSS sprite sheet (205KB WebP), fallback to coloured initials circle.

**Seed draw system (20 Apr 2026):** Reusable two-phase architecture. Phase 1: static JSON from ATP draw PDF (seedDrawLoader.js). Phase 2: scraper live overlay via `overlayFixtures()` in seedDrawOverlay.js. New tournament = add one JSON file. Template: `CTO - TS/New Tournament Setup Template.md`.

**Matchup modal (20 Apr 2026):** Bracket cards are clickable, opens modal with player cards (name, seed, country flag), tournament form (W/L badges, scores). Uses seed draw + scraper fixture cache only — no external API calls, 139ms response. CSS in `MatchupModal.css` with mobile bottom-sheet.

**Key env vars (Railway):** `ACTIVE_TOURNAMENT=rome-2026`, `ADMIN_SECRET`, `JWT_SECRET`, `BREVO_API_KEY`, `MATCHSTAT_API_KEY`, `TENNIS_API_KEY` (legacy fallback only). Note: `GOALSERVE_API_KEY` can be deleted from Railway — Goalserve fully removed from codebase 22 Apr.

**Performance (20 Apr 2026):** Draw/bracket endpoints ~130ms (was 10-20s). Draw-level cache keyed on scraper data timestamp, scraper cache always serves stale data (match results don't un-happen). Sprite sheet: 97% image payload reduction (6.4MB → 205KB, 170 requests → 1).

**Automation (Phase 1 — deployed 19 Apr):** 15-min cron handles result settlement, withdrawal detection, draw release detection, lock time auto-setting. All ops logged to `ops_log` table.

**Mac repo path:** `/Users/mikaeelislam/tennis-survivor`

**Why:** Full context in CLAUDE.md at repo root. Read this at the start of every session.
