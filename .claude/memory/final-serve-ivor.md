# Final Serve-ivor — Product Context

## What it is
Tennis survivor fantasy game. Players join groups, pick one match winner per round, eliminated if pick loses. Last survivor wins the prize pot. Built around major ATP draws.

## History
- Monte Carlo 2026: complete (Mark won, 11 entrants, free entry)
- Madrid 2026: starts 22 Apr, free entry, draw released 19 Apr, members joining. Goalserve adapter deployed and optimised (parallel fetch, promise dedup, 5-min cache). Seed draw loaded from PDF.
- Rome 2026: planned free + mobile app launch
- Roland Garros 2026: planned first paid tournament

## Key architectural patterns
- R1 uses standard fixed deadline (1h before first match), same as all other rounds. Per-match lock code retained but disabled (`r1PerMatchLock: false`). Withdrawal policy: re-pick if time allows, auto-assign replacement if not, mid-match results stand.
- Data adapter layer in `dataAdapter.js` — unified interface for Goalserve (primary), API-Tennis (fallback), Sofascore (defunct)
- Email dedup/approval: all emails queue as `pending`, admin approves via API endpoint. Cron never sends directly. Exception: support emails send immediately.
- Auto-deploys: every push to `main` deploys to Vercel (frontend) and Railway (backend) immediately

## Active tournament config
`backend/src/config/activeTournament.js` controls everything: tournament ID, Goalserve ID, lock time overrides, r1PerMatchLock flag (currently `false` for all tournaments).

## Repositories
- Web: `mickeyislam96-sketch/tennis-survivor` (GitHub)
- Mobile: `mickeyislam96-sketch/tennis-survivor-mobile` (GitHub)

## Key features built (as of 19 Apr 2026)
- **Support contact form** (`/support`): category dropdown, subject, message, user context auto-attached. Backend: `POST /api/support` with rate limiting. Emails sent directly to finalservivor@gmail.com via Brevo.
- **Gold pill "My Pool" nav link**: fetches user's pool membership, links directly to their group page. Shows pool name (single pool) or "My Pools" (multiple). Only visible when logged in.
- **How to Play page** (`/how-to-play`): 5-step guide + 3 strategy tips. Copy simplified 19 Apr — no mention of free/paid, retirements, or prize splitting.
- **Email system**: 9 templates (pick reminder, survival, elimination, winner, draw released, withdrawal alert, admin digest, welcome, support). All aligned to brand design system.
- **Micro-interactions**: button press, card entrance, pick pulse, skeleton shimmer, tab crossfade, gold CTA shimmer, arrow nudge, modal exit.
- **Tournament ops automation (Phase 1)**: 15-min cron handles result settlement, withdrawal detection, draw release detection, lock time auto-setting. All logged to `ops_log` table. Daily ops brief via Cowork scheduled task at 8am. Key files: `opsMonitor.js`, `routes/ops.js`. Playbook: `CTO - TS/FSV_AI_Agent_Operations_Playbook.docx`.
- **Ops API endpoints**: `GET /api/ops/summary` (structured overview), `GET /api/ops/log` (raw log with filters), `POST /api/ops/setup-tournament` (create groups), `GET /api/ops/health-deep` (component health). All behind ADMIN_SECRET auth.
- **Player headshot sprite** (20 Apr): 169 headshots in one 205KB WebP sprite. Replaces 170 individual requests (6.4MB). PlayerAvatar component checks in-memory manifest, uses CSS background-position.
- **Goalserve parallel fetch** (20 Apr): 3 API endpoints fetched simultaneously via Promise.allSettled. Promise deduplication for concurrent callers. Cold miss ~5s (was 10-17s), cached <1.2s.
- **Seed draw system** (20 Apr): Static JSON draw files (extracted from ATP PDF) loaded via `seedDrawLoader.js`, overlaid with live Goalserve data via `seedDrawOverlay.js` (2-pass name matching: exact + Levenshtein fuzzy). Reusable for future tournaments.
