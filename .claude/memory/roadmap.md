# Final Serve-ivor — Roadmap & Launch Strategy

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
