# Final Serve-ivor — Roadmap & Launch Strategy

## Three-phase approach
1. **Madrid Open** (20 Apr - 4 May 2026): Free entry, bug-fix + stability. 96-draw, 7 rounds. 4 members so far.
2. **Rome Masters** (6-17 May): Free, public. Target: mobile app launch.
3. **Roland Garros** (18 May - 7 Jun): FIRST PAID tournament. Entry fee planned.

## Payment processing
- **Stripe is prohibited** for skill-based prize games (ToS explicitly bans it, accounts have been frozen)
- **Madrid plan**: manual bank transfers (manageable at 20-40 people)
- **Rome/Roland Garros plan**: specialist UK processor (Cashflows, Nochex, or We Tranxact). Application should start now.
- **PayPal**: not recommended (similar restrictions, less aggressive enforcement but risk of mid-tournament freeze)

## Payout system (designed, not yet built)
- Wise Business API for automated payouts
- Flow: tournament ends -> winner notified -> winner enters bank details on /claim-payout -> admin approves -> Wise sends funds
- `payouts` table with status lifecycle: pending_claim -> claimed -> approved -> processing -> completed -> failed
- Bank details stored encrypted. House fee tracked for audit trail.

## Mobile app (planned, not yet started)
- React Native + Expo, separate repo (`tennis-survivor-mobile`)
- Same Railway API backend, no backend changes needed
- `expo-secure-store` replaces `localStorage` for auth
- Target: feature parity with web (auth, lobby, pick screen, leaderboard, push notifications)
- Estimated 2 weeks for competent React Native dev

## AI agent operations model (decided 19 Apr 2026)
Mickey plans to scale FSV using AI agents as his entire team. Three-phase rollout:
1. **Phase 1 — Tournament Ops (COMPLETE):** 15-min cron handles results, withdrawals, draw detection, lock times. Daily ops brief at 8am. Playbook: `CTO - TS/FSV_AI_Agent_Operations_Playbook.docx`.
2. **Phase 2 — Marketing Pipeline (post-Madrid):** weekly content batch, tournament announcements, social drafts.
3. **Phase 3 — Full Network (post-RG):** customer support triage, multi-tournament orchestration, health monitoring alerts, payout prep.

## Monte Carlo post-mortem issues (to prevent in Madrid)
- Premature elimination bug (results processor during open windows)
- Pick visibility leak in leaderboard modal
- Round detection defaulting to R1 before deadlines loaded
- API-Tennis fixture gaps (round: null, missing qualifiers) — now mitigated by Goalserve switch
- Manual result overrides needed for players with no API key
- Bracket connector crash (hooks after early return — caused 3 white-screen incidents)
