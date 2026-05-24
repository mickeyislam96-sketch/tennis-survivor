---
name: Email design system — tokens + components + dark-mode contract
description: How transactional emails work in FSV after the session 38c rewrite. LIGHT/DARK token pairs, component builders, mobile + dark-mode media queries, Outlook 365 [data-ogsc] selectors. Pattern for adding new templates.
type: feedback
---

**Rule:** All transactional email rendering in `backend/src/utils/email.js`
follows a single token-driven component model. To add a new template, write
a body function that calls the shared component builders and pass it to
`wrapper()`. To rebrand, edit the LIGHT/DARK token objects at the top of
`email.js` — the components inherit automatically.

**How to apply (adding a new template):**

```js
// 1. Build a body function that uses the shared components
export function buildMyNewHTML({ email, displayName, ...args }) {
  const body = `
    ${paragraph(`Hey <strong class="ink" style="color:${C.ink}">${displayName}</strong>, ...`)}
    ${sectionEyebrow('Section header')}
    ${card({ tone: 'success', label: 'Status', value: 'Headline', kicker: 'Subtext' })}
    ${cta(url, 'Action label', '→')}
  `;
  return wrapper({
    eyebrow: 'Eyebrow text',
    title: 'Email title.',
    subtitle: 'Optional subtitle',
    body,
    footerEmail: email,
  });
}

// 2. Build a send function (queue or direct depending on type)
export async function sendMyNew({ userId, groupId, ..., to, ... }) {
  const html = buildMyNewHTML({ ... });
  const subject = `My new email subject`;
  // Queue for admin approval (high-volume) OR send directly (welcome / password / support)
  return sendWithDedup({ userId, groupId, round, emailType: 'my_new', to, subject, html });
  // OR: await sendViaBrevo({ to, subject, html });
}
```

**Card tones available:** `success` (green), `danger` (red), `warn` (amber),
`gold` (default brand), `neutral` (grey).

**The dark-mode contract — every coloured element must use a CSS class so
the dark @media query overrides hit it.** Required classes per element type:

- Surfaces: `surface`, `surface-muted`, `canvas`
- Text: `ink`, `ink-muted`, `ink-soft`, `ink-ghost`
- Borders: `border`, `border-t`, `border-b`, `border-l`
- Branded: `header-bg`, `gold-pill`, `gold-text`, `eyebrow-pill`,
  `footer-bg`, `footer-brand-italic`
- Status: `success-card`, `success-text`, `danger-card`, `danger-text`,
  `warn-card`

Every inline `style="color:…"` must also have a matching `class="ink"`
(or whichever token applies). The class is what `@media (prefers-color-scheme: dark)`
hooks onto with `!important` to flip the colour. Without the class, the
inline style wins in dark mode and the colour stays the light-mode value
on a dark background.

**Outlook 365 dark mode** uses `[data-ogsc]` (text colour container) and
`[data-ogsb]` (background container) selectors — NOT prefers-color-scheme.
The wrapper includes both selector blocks; you don't have to do anything
special unless you introduce a new colour class, in which case add
the corresponding `[data-ogsc]`/`[data-ogsb]` rule alongside the @media
rule.

**Mobile** is handled by `@media screen and (max-width: 480px)` plus utility
classes: `.px` (horizontal padding), `.h1` (font-size), `.body-text`
(font-size), `.card-pad`, `.cta-pad`, `.header-pad`. Don't add new
inline padding values — use the helper functions which apply the classes
automatically.

**Why:** History — pre-session-38c, the emails had no dark-mode handling
and no mobile breakpoint. Apple Mail iOS dark mode was auto-inverting
white surfaces to muddy grey, gold pills lost contrast, the Fraunces
serif fell back to Georgia and looked dated. Mobile Outlook clipped at
600px. The new system fixes all of these via:

1. `meta name="color-scheme"` + `meta name="supported-color-schemes"` —
   tells Apple Mail "I've designed for both modes, don't auto-invert".
2. `@media (prefers-color-scheme: dark)` — explicit dark-mode overrides
   on every coloured surface and text element.
3. `[data-ogsc]` / `[data-ogsb]` — Outlook 365 dark-mode equivalents.
4. `@media screen and (max-width: 480px)` — mobile sizing.
5. Font-fallback chain extended: Fraunces → New York → Charter → Georgia
   (was Fraunces → Georgia, which looked dated on iOS where Apple Mail
   strips the Google Fonts `<link>`).
6. Court-bg PNG removed; replaced with a CSS-only `repeating-linear-gradient`
   pattern that survives dark mode and image-blocking.
7. Welcome trimmed from 3 numbered cards to 2 sections + CTA. One screen
   on mobile.

**Public API surface (DO NOT change signatures — many callers depend on them):**
`sendWelcomeEmail`, `sendTournamentJoinEmail`, `sendPasswordResetEmail`,
`sendPickReminderEmail`, `sendRoundResultEmail`, `sendWithdrawalEmail`,
`sendDrawReleasedEmail`, `sendSupportEmail`, `sendAdminDigest`,
`sendWithDedup`, `sendPendingEmails`, `sendPendingEmailById`,
`rejectPendingEmailById`, `getPendingEmailsSummary`. Pure renderers
(`buildWelcomeHTML`, etc.) are also exported so tests can render
without hitting Brevo.

**For paid tournaments needing new email types** (payment receipt, refund
notification, payout claim form): follow the same recipe. Use existing
component builders. The token system + dark-mode contract handles
correctness; you only need to write the body composition.

**Preview before push:** generate the rendered HTML locally with a mock-
data Node script, save to disk, open in Safari, send to yourself via
"File → Share → Mail" to see it in Apple Mail iOS for real. The folder
`CTO - TS/email-redesign/preview-final/` (workspace-only) keeps the most
recent rendered preview for reference.
