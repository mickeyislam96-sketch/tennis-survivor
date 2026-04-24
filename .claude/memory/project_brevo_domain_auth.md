---
name: Brevo domain authentication and email deliverability
description: finalserveivor.com DNS fully verified (SPF+DKIM+DMARC). Email queue restored — sendWithDedup queues as pending, admin approves via digest email.
type: project
---
## Brevo Domain Auth — Fully Verified 24 Apr 2026

**Domain:** `finalserveivor.com` (DNS hosted on Namecheap)
**Status:** All records verified including SPF fix.

**Records:**
1. **Brevo code:** TXT @ `brevo-code:4bc0089ffff0d2c9f5e4d6a90c7ca533`
2. **DKIM 1:** CNAME `brevo1._domainkey` -> `b1.finalserveivor-com.dkim.brevo.com`
3. **DKIM 2:** CNAME `brevo2._domainkey` -> `b2.finalserveivor-com.dkim.brevo.com`
4. **DMARC:** TXT `_dmarc` -> `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com`
5. **SPF:** TXT @ `v=spf1 include:spf.sendinblue.com ~all` (fixed 24 Apr, was `v=spf1 ~all`)

## Email Queue System (Restored Session 28, Fixed Session 30)

**Current flow:**
1. Game emails (results, reminders, elimination, withdrawal) call `sendWithDedup()` which inserts into `emails_sent` with `status='pending'`
2. Every 15 min, cron calls `sendAdminDigest()` which emails Mickey a digest with per-email Send/Reject buttons and an "Approve All" gold button
3. Nothing sends until Mickey clicks approve (GET endpoint with secret in URL)
4. Welcome and tournament-join emails bypass the queue and send directly via `sendViaBrevo()`

**Session 30 fix:** `_lastDigestPendingCount` was never declared — ESM strict mode crashed every cron cycle. Digest never worked until `let _lastDigestPendingCount = 0` was added. Also `getPendingEmailsSummary()` now filters by `TOURNAMENT.id`.

**Key endpoints:**
- `GET /api/admin/approve-emails?secret=X` — preview pending
- `GET /api/admin/approve-emails?secret=X&confirm=true` — approve and send all
- `GET /api/admin/approve-emails?secret=X&approve=ID` — send one
- `GET /api/admin/approve-emails?secret=X&reject=ID` — reject one
- `POST /api/admin/force-digest` — manually trigger digest email
- `GET /api/admin/pending-emails` (Bearer auth) — list all pending

**Why queue not direct send:** Mickey wants to review emails before they reach users. Templates are stable but approval gives control.
