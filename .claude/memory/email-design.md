# Email Design Decisions

## Architecture
All email templates in `backend/src/utils/email.js` (single file, ~990 lines). Shared helpers: `emailWrapper()`, `emailHeader()`, `emailCTA()`, `sectionEyebrow()`, `divider`.

## Key decisions (19 Apr 2026)
- **Three-font system matches site exactly:** Outfit (body), Fraunces (display titles, step headings), JetBrains Mono (eyebrow labels, badges)
- **CTA changed from green rect to gold pill** to match the site's "Join pool" button style
- **Footer uses split-font logo** matching site: "Final" in Outfit bold + "Serve-ivor" in Fraunces italic
- **Footer "Serve-ivor" colour is green (#0F4A23) not gold** — intentional. Email footer has light background (like the nav), so green provides better contrast. Site footer uses gold because it sits on a dark green background.
- **Tennis court header background** (`email-court-bg.png`) replicates the hero SVG pattern. Court lines at 18% opacity, dashed net line, gradient mask (left transparent to right opaque). Hosted in `frontend/public/`.
- **Tagline is just "A tennis survivor pool"** — Mickey requested removal of "A game of skill" from both site and emails (19 Apr)
- **Withdrawal alert border uses accent (#C1572E)** not orange (#FFA500)

## Templates (9 total)
1. Welcome (fires on account creation — sends directly, not queued)
2. Tournament join
3. Pick reminder
4. Round survival
5. Elimination
6. Winner announcement
7. Withdrawal alert
8. Draw released
9. Admin digest (functional/plain, not user-facing)

## Delivery flow (updated 21 Apr 2026)
- **Direct send mode** — all emails send immediately via Brevo. No queue, no admin approval.
- Welcome, tournament-join, password-reset, support: call `sendViaBrevo()` directly.
- Pick reminder, round result, withdrawal, draw released: call `sendWithDedup()` which sends via Brevo immediately, using `emails_sent` table only for dedup (UNIQUE constraint on `user_id, group_id, round, email_type` prevents duplicate sends).
- Admin digest: disabled (no-op function). Old approve-emails endpoints still exist but are unused.
- **Why removed:** ADMIN_SECRET changed during security breach, breaking approval links. Small Madrid pool is the right size to test direct send. Queue can be re-added for larger paid pools if needed.

## Domain authentication (verified 21 Apr 2026)
- Domain: `finalserveivor.com` — fully authenticated in Brevo
- DNS hosted on Namecheap, auto-configured via Brevo's Entri integration
- DKIM uses CNAME records (not TXT): `brevo1._domainkey` and `brevo2._domainkey`
- DMARC: `v=DMARC1; p=none` (reporting to Brevo)
- SPF: NOT required for Brevo (they handle envelope sender)
- Sender: `noreply@finalserveivor.com` (display name: "Final Serve-ivor")
