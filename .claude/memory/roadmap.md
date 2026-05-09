# Final Serve-ivor — Roadmap & Launch Strategy

## Critical fixes (kicked off 5 May 2026 — all 5 closed in code by 9 May 2026)

After Rome launch settled, audited bigger-picture gaps. Five rated
critical, queued in priority order. See
`.claude/memory/project_critical_gaps.md` for the full audit.

1. ~~Alerting on `/api/health` (UptimeRobot)~~ DONE 7 May (session 36).
   Prod + staging on 5-min interval, email alerts confirmed firing.
2. ~~Backend integration test suite~~ DONE 5 May (session 35). Smoke +
   integration jobs in CI on every push and PR.
3. ~~Staging environment via Railway branch deploy~~ DONE 7 May
   (session 36). `tennis-survivor-staging.up.railway.app`, isolated
   Postgres, Vercel preview URL.
4. **Stage 2 admin-token rollout — code DONE 8 May (session 38 PR #16)**;
   Mickey-side: set `ADMIN_TOKEN_FINANCIAL` on Railway. Master
   `ADMIN_SECRET` is auto-blocked from financial endpoints once that
   env var exists. No code redeploy.
5. ~~DB-restore verification~~ Code DONE 8 May (session 38 PR #17).
   Quarterly cron + `scripts/test-db-restore.sh`. Manual smoke run
   pending (≤30min) so we don't wait until July to discover a bug.

**Mickey-side queue before RG R1 (18 May):** set
`ADMIN_TOKEN_FINANCIAL` on Railway, run a manual DB-restore smoke
test, run the daily walkover-pending check throughout Rome (Phase 8.5
in transition prompts).

## Email redesign (session 38c — 9 May 2026)

`backend/src/utils/email.js` rewritten as Direction A: same brand
(emerald + gold + Outfit/Fraunces/JetBrains Mono), but cross-client
correct. Dark-mode safe (Apple Mail iOS auto-inversion no longer
mangles the white card or gold pill). Mobile breakpoint at 480px.
System-font fallback chain extended for Apple Mail iOS where Google
Fonts get stripped. Court-bg PNG removed; CSS-only line pattern in
its place. Welcome trimmed to 2 sections + CTA. Admin digest
collapsed to 3-column table.

Pattern doc: `.claude/memory/feedback_email_design_system.md`.

**For paid tournaments needing new email types** (payment receipt,
refund notification, payout claim): follow the same recipe —
component builders + LIGHT/DARK tokens + the dark-mode CSS-class
contract. The system handles correctness automatically; only the
body composition needs to be written.

## Three-phase approach
1. **Madrid Open** (22 Apr - ~4 May 2026): Free entry, COMPLETE. Stability trial.
2. **Rome Masters** (5-17 May): Free, ACTIVE (R1 in progress as of 5 May). Target: mobile app launch.
3. **Roland Garros** (18 May - 7 Jun): FIRST PAID tournament. Entry fee £10.

## Payment processing
- **Stripe is prohibited** for skill-based prize games (ToS explicitly bans it, accounts have been frozen)
- **Revolut Business**: bridge solution for RG. Mickey needs UK Ltd registration + Revolut Business account before 18 May.
- **PayPal**: not recommended (similar restrictions, less aggressive enforcement but risk of mid-tournament freeze)
- **We Tranxact**: long-term automated payment processor

## Payout system (designed, not yet built)
- Wise Business API for automated payouts
- Flow: tournament ends -> winner notified -> winner enters bank details on /claim-payout -> admin approves -> Wise sends funds
- `payouts` table with status lifecycle: pending_claim -> claimed -> approved -> processing -> completed -> failed
- Bank details stored encrypted. House fee tracked for audit trail.

## Mobile app (built, pre-App Store)
- React Native + Expo SDK 54, separate repo (`tennis-survivor-mobile`)
- Same Railway API backend
- Feature parity with web achieved (auth, pools, pick screen, leaderboard, draw, profile, deep links)
- EAS Project ID not set — required before TestFlight / App Store submission

## AI agent operations model (decided 19 Apr 2026)
Mickey plans to scale FSV using AI agents as his entire team. Three-phase rollout:
1. **Phase 1 — Tournament Ops (COMPLETE):** 15-min cron handles results, withdrawals, draw detection, lock times. Daily ops brief at 8am. Playbook: `CTO - TS/FSV_AI_Agent_Operations_Playbook.docx`.
2. **Phase 2 — Marketing Pipeline (post-Madrid):** weekly content batch, tournament announcements, social drafts.
3. **Phase 3 — Full Network (post-RG):** customer support triage, multi-tournament orchestration, health monitoring alerts, payout prep.

## Monte Carlo / Madrid post-mortem issues (to prevent in Rome/RG)
- Premature elimination bug (results processor during open windows)
- Pick visibility leak in leaderboard modal
- Round detection defaulting to R1 before deadlines loaded
- API-Tennis fixture gaps (round: null, missing qualifiers) — now mitigated by FlashScore scraper
- Manual result overrides needed for players with no API key
- Bracket connector crash (hooks after early return — caused 3 white-screen incidents)
- Stale group_members.is_alive from previous tournament persists into new tournament (Rome session: Rafa showed eliminated — fixed via admin reset-member endpoint)
