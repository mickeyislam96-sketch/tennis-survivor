---
name: Paid tournament launch decisions
description: Madrid/Rome free and complete. Roland Garros 2026 is FREE too (Mickey reversed the paid plan 22 May 2026). Paid launch deferred to a later event. Revolut Business bridge still intended when paid.
type: project
originSessionId: bd42fd4c-21d9-46f8-ad10-aca3317a9571
---
**Free/paid history:**

- **Madrid** (22 Apr - ~3 May) — free, COMPLETE (Rafa won).
- **Rome** (5-17 May) — free, COMPLETE (pool winner "Casper The Freindly Ruud"; Sinner won the event). DB group `de81ed56-6c30-483a-9d38-3c48201ab42e`.
- **Roland Garros** (24 May - 7 Jun) — **FREE** (paid plan reversed 22 May 2026). DB group `20440c2f-e1e1-4e4c-82fe-6efb9b525c8c`, invite `ROLAND-GARROS-2026-P-H294FQ`.

**Why:** On 22 May 2026 Mickey decided Roland Garros will NOT be paid — it launches free like the previous three. The "RG = first paid £10" plan is shelved (not cancelled); the first paid event will be a later tournament. Ship the flagship Slam fast and free rather than block launch on payment rails.

**When paid does happen (still the plan):**
- Processor: **Revolut Business** bridge (payment links + admin verification). Stripe rejected (gambling flag); QuadraPay rejected. We Tranxact for long-term automation.
- Pricing intent: ~£10 entry, single pool, max 15% house fee. Revolut free plan ~£1,000/mo incoming (~100 players at £10).
- Code: `isPaid`/`entryFeeCents` exist per-tournament in both registries (currently 0/false for RG). Payment routes + Stage-2 financial admin tokens (`ADMIN_TOKEN_FINANCIAL`) must be wired/rolled out before the first paid pool opens.

**Do NOT suggest Stripe** — rejected for gambling classification.
