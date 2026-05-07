# Memory Index

- [Final Serve-ivor project context](project_tennis_survivor.md) — infra IDs, live URLs, env vars, repo paths. Rome active, Madrid complete.
- [Mickey — user profile](mickey.md) — non-technical founder, Mac user, AI agent team model, tennis-domain expert
- [Paid launch decisions](project_paid_launch_decisions.md) — Rome free (active), RG first paid £10. Revolut Business bridge. Stripe rejected.
- [Tournament setup template](project_tournament_setup.md) — 16-step checklist for launching new tournaments
- [Roadmap](roadmap.md) — phase progress, payment processor status, mobile app status, AI ops model
- [DECIDED_STATUSES pattern](feedback_decided_statuses.md) — never check status==='completed' alone; use Set(['completed','retired','walkover'])
- [Draw cache + deadline bugs](feedback_draw_cache_and_deadlines.md) — cache must use stable timestamp; windowOpensOverrides must be read
- [Critical-gaps audit](project_critical_gaps.md) — gaps #1, #2, #3 closed; gap #4 stage 2 + gap #5 still open before RG.
- [Invite-link case bug](feedback_invite_case_bug.md) — generation/lookup must agree on casing; use WHERE UPPER(col) = UPPER($1) defensively
- [Tournament transition prompts](../../docs/transition-prompt.md) — paste at start of any free-tournament transition session
- [Paid transition prompt](../../docs/paid-transition-prompt.md) — superset for paid events (Stripe/Revolut bridge, payment smoke, settlement)
- [Admin auth pattern](feedback_admin_auth_pattern.md) — always use requireAdmin from adminAuth.js; never hand-roll ADMIN_SECRET checks
- [Staging environment](project_staging_environment.md) — staging URLs, workflow contract, outstanding cleanups (FRONTEND_URL, CI trigger, scraper). Shipped 7 May 2026.
- [fsv-daily-brief skill](reference_daily_brief_skill.md) — morning brief skill, what it does, when it triggers, hard rules, approval flow.
- [Brief skill domain caveats](feedback_brief_domain_caveats.md) — suspended ≠ retired in tennis; (n-1) is correct survivor-pool denominator. Two landmines Mickey caught session 36.
