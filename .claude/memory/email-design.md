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

## Delivery flow
- All user-facing emails go through `sendWithDedup()` which queues as `pending` in `emails_sent` table
- Welcome email is the only one that sends directly via Brevo (not queued)
- Admin approves via `POST /api/admin/approve-emails` with `confirm: true`
- Cron sends admin digest when new emails are queued, but never sends user emails
