// backend/src/utils/email.js
// =============================================================================
// FSV transactional email — Direction A (polished current).
//
// Same brand as the live site (emerald + gold, Outfit + Fraunces + JetBrains Mono).
// Rewritten for cross-client correctness:
//   • Apple Mail iOS dark mode handled explicitly (color-scheme meta + @media +
//     class-based overrides with !important). No more auto-inversion mangling.
//   • Outlook 365 dark mode handled via [data-ogsc] / [data-ogsb] selectors.
//   • Mobile breakpoint at 480px — padding drops 40→24, H1 28→24.
//   • System-font fallback chain (Fraunces → New York → Charter → Georgia)
//     looks acceptable everywhere even if Google Fonts gets stripped.
//   • Header pattern is CSS-only (was a court-bg PNG that broke in dark mode and
//     for image-blocked clients).
//   • Single primary CTA per email; Welcome trimmed from 4 sections to 2.
//
// Architecture:
//   • Tokens (LIGHT / DARK) — central source of truth. To rebrand, edit tokens.
//   • Components (header, footer, card, cta, eyebrow, divider, paragraph) —
//     reused across every template. To add a new template, write a body
//     function that calls these components and pass to wrapper().
//   • Wrapper — single HTML doc shell with all media queries + meta tags.
//   • Templates — one function per email. Public signatures preserved from
//     the previous email.js so callers don't need updating.
//
// Public API (preserved from previous email.js — DO NOT change signatures):
//   sendWithDedup, sendPendingEmails, sendPendingEmailById, rejectPendingEmailById,
//   getPendingEmailsSummary, sendAdminDigest,
//   sendWelcomeEmail, sendTournamentJoinEmail, sendPasswordResetEmail,
//   sendPickReminderEmail, sendRoundResultEmail, sendWithdrawalEmail,
//   sendDrawReleasedEmail, sendSupportEmail.
//
// Pure-rendering helpers are also exported (buildWelcomeHTML, etc.) so tests
// can render templates without hitting Brevo.
// =============================================================================

import { pool } from '../db/pool.js';
import { TOURNAMENT } from '../config/tournament.js';

// ── Startup check ────────────────────────────────────────────────────────────
const EMAIL_CONFIGURED = !!process.env.BREVO_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'mickeyislam96@gmail.com';
const APP_URL = process.env.FRONTEND_URL || 'https://finalserveivor.com';

// Track pending count across cron cycles so we only re-send digest when new
// emails are queued (not on every cron pass once the queue is non-zero).
let _lastDigestPendingCount = 0;

if (!EMAIL_CONFIGURED) {
  console.warn('⚠️  EMAIL NOT CONFIGURED: BREVO_API_KEY env var is missing.');
} else {
  console.log('✅ Email configured — Brevo HTTP API (approval mode: user-facing emails queue as pending)');
}

// ─────────────────────────────────────────────────────────────────────────────
// Brevo HTTP send
// ─────────────────────────────────────────────────────────────────────────────
async function sendViaBrevo({ to, subject, html }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: 'Final Serve-ivor', email: 'noreply@finalserveivor.com' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo ${res.status}: ${body}`);
  }
  return res.json();
}

// ═════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// Single source of truth for colours. To rebrand, edit here.
// LIGHT and DARK pair up — every coloured surface has both modes defined.
// ═════════════════════════════════════════════════════════════════════════════

const LIGHT = {
  // Page + surfaces
  canvas:       '#FAFAF7',
  surface:      '#FFFFFF',
  surfaceMuted: '#F4F2ED',
  // Ink
  ink:          '#141414',
  inkMuted:     '#4A4A46',
  inkSoft:      '#8A8780',
  inkGhost:     '#BEBAB0',
  border:       '#E3E0D7',
  // Brand
  primary:      '#0F4A23',  // deep emerald
  primaryInk:   '#FFFFFF',
  // Accents
  gold:         '#FFC933',
  goldInk:      '#2B1F00',
  goldSoft:     '#FFF3C4',
  // Status
  success:      '#1E7A3E',
  successSoft:  '#E1F1E7',
  danger:       '#B03B2A',
  dangerSoft:   '#F7DFD9',
  // Card-soft surfaces (status cards in light mode)
  successCard:  '#EFF7F2',
  dangerCard:   '#FCEFEC',
  warnCard:     '#FFF8E1',
};

const DARK = {
  canvas:       '#0a0a0a',
  surface:      '#161616',
  surfaceMuted: '#1f1f1d',
  ink:          '#f5f3ee',
  inkMuted:     '#c0bdb2',
  inkSoft:      '#8a8780',
  inkGhost:     '#5a574f',
  border:       '#2c2c2a',
  primary:      '#1a6633',  // brighter emerald (better contrast on dark)
  primaryInk:   '#FFFFFF',
  gold:         '#FFD24D',  // slightly desaturated
  goldInk:      '#2B1F00',
  goldSoft:     '#3a3320',
  success:      '#3da169',
  successSoft:  '#1c2f23',
  danger:       '#dc6b59',
  dangerSoft:   '#3a201d',
  successCard:  '#16221b',
  dangerCard:   '#28181a',
  warnCard:     '#2a2419',
};

// Aliases used in template code — `C.x` is the LIGHT default, dark-mode swaps in
// via CSS classes + @media query.
const C = LIGHT;

// ═════════════════════════════════════════════════════════════════════════════
// FONT STACKS
// Order matters. Each tier gracefully degrades:
//   1. The web font (loaded if client honours <link>)
//   2. The best system-installed alternative
//   3. The historical safe-bet (always works)
// Apple Mail iOS strips <link rel="stylesheet"> so the fallbacks are what most
// iOS users will actually see.
// ═════════════════════════════════════════════════════════════════════════════

const FONT_SANS    = "'Outfit', -apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const FONT_DISPLAY = "'Fraunces', 'New York', Charter, Georgia, Cambria, 'Times New Roman', Times, serif";
const FONT_MONO    = "'JetBrains Mono', 'SF Mono', SFMono-Regular, Menlo, Consolas, 'Courier New', monospace";

// Web font loading. Two layers:
//   1. <link> in <head> — works on Gmail web, not Apple Mail iOS
//   2. <style>@import — works on more clients but Gmail strips it
// Both are cheap. Both have safe fallbacks.
const FONT_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin /><link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,700;1,400;1,700&family=JetBrains+Mono:wght@500;700&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet" />`;

// ═════════════════════════════════════════════════════════════════════════════
// LAYOUT CONSTANTS
// ═════════════════════════════════════════════════════════════════════════════

const CONTAINER_WIDTH = 600;          // industry standard, < Outlook 700px clip
const PAD_X_DESKTOP = 40;
const PAD_X_MOBILE = 24;
const RADIUS = 12;

// ═════════════════════════════════════════════════════════════════════════════
// DEDUPLICATION + APPROVAL QUEUE
// User-facing emails INSERT into emails_sent as 'pending'. Admin approves via
// /api/admin/approve-emails; cron re-sends nothing until then.
//
// EXEMPT (sent directly): welcome, password-reset, support — these need
// immediate delivery and don't loop in cron.
// ═════════════════════════════════════════════════════════════════════════════

export async function sendWithDedup({ userId, groupId, round, emailType, to, subject, html }) {
  const { rowCount } = await pool.query(
    `INSERT INTO emails_sent (user_id, group_id, round, email_type, status, subject, recipient_email, recipient_name, metadata, tournament_id)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9)
     ON CONFLICT (user_id, group_id, round, email_type) DO NOTHING`,
    [userId, groupId, round, emailType, subject, to, null, JSON.stringify({ html }), TOURNAMENT.id]
  );

  if (rowCount === 0) {
    return { queued: false, reason: 'already_exists' };
  }

  console.log(`[email-queue] Queued "${emailType}" for ${to} | round=${round}`);
  return { queued: true };
}

export async function sendPendingEmails() {
  if (!EMAIL_CONFIGURED) {
    return { error: 'BREVO_API_KEY not configured', sent: 0, failed: 0 };
  }

  const { rows } = await pool.query(
    `SELECT e.id, e.user_id, e.group_id, e.round, e.email_type, e.subject, e.recipient_email, e.metadata
       FROM emails_sent e
       JOIN groups g ON g.id = e.group_id
      WHERE e.status = 'pending'
        AND g.tournament_id = $1
   ORDER BY e.created_at`,
    [TOURNAMENT.id]
  );

  let sent = 0, failed = 0;
  for (const row of rows) {
    const html = row.metadata?.html;
    if (!html) {
      console.warn(`[email-queue] Pending email ${row.id} has no html, marking as failed`);
      await pool.query(`UPDATE emails_sent SET status='failed' WHERE id = $1`, [row.id]);
      failed++;
      continue;
    }
    try {
      await sendViaBrevo({ to: row.recipient_email, subject: row.subject, html });
      await pool.query(`UPDATE emails_sent SET status='sent', sent_at=NOW() WHERE id = $1`, [row.id]);
      sent++;
      console.log(`[email-queue] Sent "${row.email_type}" to ${row.recipient_email}`);
    } catch (err) {
      console.error(`[email-queue] Failed to send ${row.id}: ${err.message}`);
      await pool.query(`UPDATE emails_sent SET status='failed', error=$1 WHERE id = $2`, [err.message, row.id]);
      failed++;
    }
  }

  _lastDigestPendingCount = 0; // reset since queue drained
  return { sent, failed };
}

export async function sendPendingEmailById(emailId) {
  if (!EMAIL_CONFIGURED) {
    return { error: 'BREVO_API_KEY not configured' };
  }
  const { rows } = await pool.query(
    `SELECT id, user_id, group_id, round, email_type, status, subject, recipient_email, metadata
       FROM emails_sent WHERE id = $1`,
    [emailId]
  );
  if (rows.length === 0) return { error: 'not_found' };
  const row = rows[0];
  if (row.status !== 'pending') return { error: 'not_pending', status: row.status };
  const html = row.metadata?.html;
  if (!html) {
    await pool.query(`UPDATE emails_sent SET status='failed' WHERE id = $1`, [emailId]);
    return { error: 'no_html_stored' };
  }
  try {
    await sendViaBrevo({ to: row.recipient_email, subject: row.subject, html });
    await pool.query(`UPDATE emails_sent SET status='sent', sent_at=NOW() WHERE id = $1`, [emailId]);
    return { ok: true, recipient: row.recipient_email };
  } catch (err) {
    await pool.query(`UPDATE emails_sent SET status='failed', error=$1 WHERE id = $2`, [err.message, emailId]);
    return { error: err.message };
  }
}

export async function rejectPendingEmailById(emailId) {
  const { rowCount } = await pool.query(
    `UPDATE emails_sent SET status='rejected' WHERE id = $1 AND status='pending'`,
    [emailId]
  );
  return { ok: rowCount > 0 };
}

export async function getPendingEmailsSummary() {
  const { rows } = await pool.query(
    `SELECT e.id, e.user_id, e.email_type, e.round, e.subject, e.recipient_email, e.recipient_name, e.created_at
       FROM emails_sent e
       JOIN groups g ON g.id = e.group_id
      WHERE e.status = 'pending'
        AND g.tournament_id = $1
   ORDER BY e.created_at`,
    [TOURNAMENT.id]
  );
  return rows;
}

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN DIGEST — internal email to mickeyislam96@gmail.com
// Bypasses the approval queue (we never want this gated by itself).
// ═════════════════════════════════════════════════════════════════════════════

export async function sendAdminDigest() {
  if (!EMAIL_CONFIGURED) return;

  const pending = await getPendingEmailsSummary();
  if (pending.length === 0) { _lastDigestPendingCount = 0; return; }
  if (pending.length <= _lastDigestPendingCount) return;
  _lastDigestPendingCount = pending.length;

  const adminSecret = process.env.ADMIN_SECRET || '';
  const baseUrl = 'https://tennis-survivor-production.up.railway.app/api/admin/approve-emails';
  const previewUrl = `${baseUrl}?secret=${encodeURIComponent(adminSecret)}`;
  const approveAllUrl = `${baseUrl}?secret=${encodeURIComponent(adminSecret)}&confirm=true`;

  // Build a tight 3-column table — type / round / recipient — instead of the
  // previous 4-column with per-row buttons. Row-level approval still works via
  // /api/admin/approve-emails?approve=<id> if Mickey wants per-row control.
  const rowsHtml = pending.map(e => `
    <tr>
      <td class="border-b" style="padding:11px 14px;border-bottom:1px solid ${C.border};font-family:${FONT_SANS};font-size:13px;color:${C.ink};">${e.email_type}</td>
      <td class="border-b ink-soft" style="padding:11px 14px;border-bottom:1px solid ${C.border};font-family:${FONT_MONO};font-size:12px;color:${C.inkSoft};">${e.round || '—'}</td>
      <td class="border-b ink-muted" style="padding:11px 14px;border-bottom:1px solid ${C.border};font-family:${FONT_SANS};font-size:13px;color:${C.inkMuted};">${e.recipient_name || e.recipient_email}</td>
    </tr>
  `).join('');

  const body = `
    ${paragraph(`<strong class="ink" style="color:${C.ink}">${pending.length} email${pending.length === 1 ? '' : 's'}</strong> queued for approval. They will not send until approved.`, 28)}

    <tr><td class="px" style="padding:8px ${PAD_X_DESKTOP}px 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="border" style="border:1px solid ${C.border};border-radius:${RADIUS}px;overflow:hidden;">
        <thead>
          <tr class="surface-muted" style="background:${C.surfaceMuted};">
            <th align="left" class="ink-soft" style="padding:11px 14px;font-family:${FONT_MONO};font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${C.inkSoft};">Type</th>
            <th align="left" class="ink-soft" style="padding:11px 14px;font-family:${FONT_MONO};font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${C.inkSoft};">Round</th>
            <th align="left" class="ink-soft" style="padding:11px 14px;font-family:${FONT_MONO};font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${C.inkSoft};">Recipient</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </td></tr>

    ${cta(approveAllUrl, `Approve &amp; send all ${pending.length}`, '✅')}

    <tr><td class="px" style="padding:0 ${PAD_X_DESKTOP}px 12px;text-align:center;">
      <p style="margin:0;font-family:${FONT_SANS};font-size:12px;color:${C.inkSoft};"><a href="${previewUrl}" style="color:${C.inkMuted};text-decoration:underline;">Preview without sending</a></p>
    </td></tr>
  `;

  const html = wrapper({
    eyebrow: 'Admin',
    title: `${pending.length} email${pending.length === 1 ? '' : 's'} awaiting approval`,
    subtitle: 'These will not send until you approve.',
    body,
    footerEmail: ADMIN_EMAIL,
  });

  try {
    await sendViaBrevo({
      to: ADMIN_EMAIL,
      subject: `[FSV Admin] ${pending.length} email${pending.length === 1 ? '' : 's'} awaiting approval`,
      html,
    });
    console.log(`[admin-digest] Sent digest to ${ADMIN_EMAIL} (${pending.length} pending)`);
  } catch (err) {
    console.error(`[admin-digest] Failed to send digest: ${err.message}`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENT BUILDERS
// Every visible element goes through one of these. To restyle the brand,
// edit the tokens above; the components inherit automatically.
// ═════════════════════════════════════════════════════════════════════════════

// ── Wrapper — the outer HTML doc ─────────────────────────────────────────────
//
// Includes:
//   - charset + viewport meta
//   - color-scheme + supported-color-schemes meta (Apple Mail dark-mode hint)
//   - x-apple-disable-message-reformatting (stops Apple Mail mangling layout)
//   - Google Fonts <link> (loaded where supported, otherwise gracefully ignored)
//   - <style> block with media queries for mobile + dark mode
//
// Body wraps everything in a 600px container with rounded corners + soft border.

function wrapper({ eyebrow, title, subtitle, body, footerEmail, hideFooter }) {
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Final Serve-ivor</title>
  ${FONT_LINK}
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    /* Base resets */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse !important; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; min-width: 100% !important; }
    a { text-decoration: none; }
    /* Fix Outlook list spacing */
    p { margin: 0; }

    /* ═════════════ MOBILE @ <= 480px ═════════════ */
    @media screen and (max-width: 480px) {
      .container { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; }
      .px { padding-left: ${PAD_X_MOBILE}px !important; padding-right: ${PAD_X_MOBILE}px !important; }
      .header-pad { padding: 28px ${PAD_X_MOBILE}px 24px !important; }
      .h1 { font-size: 24px !important; line-height: 1.22 !important; }
      .h-sub { font-size: 14px !important; }
      .body-text { font-size: 15px !important; line-height: 1.65 !important; }
      .card-pad { padding: 16px 18px !important; }
      .card-title { font-size: 16px !important; }
      .footer-pad { padding: 18px ${PAD_X_MOBILE}px !important; }
      .cta-pad { padding: 22px ${PAD_X_MOBILE}px 28px !important; }
    }

    /* ═════════════ DARK MODE — Apple Mail, Gmail (web) ═════════════
       Active when the user's system is in dark mode AND the client honours
       prefers-color-scheme. Apple Mail iOS does. Gmail iOS app does not (it
       force-inverts; the meta tag at top reduces but doesn't eliminate that).
       Outlook 365 web uses [data-ogsc] selectors below as a separate path.    */
    @media (prefers-color-scheme: dark) {
      .canvas { background: ${DARK.canvas} !important; }
      .surface { background: ${DARK.surface} !important; }
      .surface-muted { background: ${DARK.surfaceMuted} !important; }
      .container { box-shadow: 0 1px 3px rgba(0,0,0,0.4) !important; border-color: ${DARK.border} !important; }
      .ink { color: ${DARK.ink} !important; }
      .ink-muted { color: ${DARK.inkMuted} !important; }
      .ink-soft { color: ${DARK.inkSoft} !important; }
      .ink-ghost { color: ${DARK.inkGhost} !important; }
      .border, .border-b, .border-t, .border-l { border-color: ${DARK.border} !important; }
      .header-bg { background: ${DARK.primary} !important; }
      .header-pattern { background-image: repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 64px) !important; }
      .gold-pill { background: ${DARK.gold} !important; color: ${DARK.goldInk} !important; }
      .gold-text { color: ${DARK.gold} !important; }
      .success-card { background: ${DARK.successCard} !important; border-color: ${DARK.success} !important; }
      .success-text { color: ${DARK.success} !important; }
      .danger-card { background: ${DARK.dangerCard} !important; border-color: ${DARK.danger} !important; }
      .danger-text { color: ${DARK.danger} !important; }
      .warn-card { background: ${DARK.warnCard} !important; border-color: ${DARK.gold} !important; }
      .footer-bg { background: ${DARK.surfaceMuted} !important; border-top-color: ${DARK.border} !important; }
      .footer-brand-italic { color: ${DARK.success} !important; }
      .eyebrow-pill { background: rgba(255,201,51,0.18) !important; }
    }

    /* ═════════════ OUTLOOK 365 dark mode (web + mobile) ═════════════
       Uses [data-ogsc] (text colour) and [data-ogsb] (bg colour). Same
       overrides as @media but scoped to Outlook 365 dark mode containers.   */
    [data-ogsc] .canvas { background: ${DARK.canvas} !important; }
    [data-ogsb] .surface { background: ${DARK.surface} !important; }
    [data-ogsb] .surface-muted { background: ${DARK.surfaceMuted} !important; }
    [data-ogsc] .ink { color: ${DARK.ink} !important; }
    [data-ogsc] .ink-muted { color: ${DARK.inkMuted} !important; }
    [data-ogsc] .ink-soft { color: ${DARK.inkSoft} !important; }
    [data-ogsb] .header-bg { background: ${DARK.primary} !important; }
    [data-ogsb] .gold-pill { background: ${DARK.gold} !important; }
    [data-ogsc] .gold-pill { color: ${DARK.goldInk} !important; }
    [data-ogsb] .success-card { background: ${DARK.successCard} !important; }
    [data-ogsb] .danger-card { background: ${DARK.dangerCard} !important; }
    [data-ogsb] .footer-bg { background: ${DARK.surfaceMuted} !important; }
  </style>
</head>
<body class="canvas" style="margin:0;padding:0;background:${C.canvas};font-family:${FONT_SANS};-webkit-font-smoothing:antialiased;color:${C.ink};">
  <!-- Outlook does not honour <body> background; wrap in a 100% table -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="canvas" style="background:${C.canvas};">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="${CONTAINER_WIDTH}" cellpadding="0" cellspacing="0" border="0" class="container surface border" style="max-width:${CONTAINER_WIDTH}px;width:100%;background:${C.surface};border-radius:${RADIUS}px;border:1px solid ${C.border};box-shadow:0 1px 3px rgba(15,15,15,0.06), 0 8px 24px rgba(15,15,15,0.04);overflow:hidden;">
        ${header({ eyebrow, title, subtitle })}
        ${body}
        ${hideFooter ? '' : footer(footerEmail)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Header — emerald with CSS-only line pattern + eyebrow + title ──────────
function header({ eyebrow, title, subtitle }) {
  return `
    <tr>
      <td class="header-bg header-pattern header-pad" style="background-color:${C.primary};background-image:repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 64px);padding:36px ${PAD_X_DESKTOP}px 28px;text-align:center;">
        ${eyebrow ? `<p class="eyebrow-pill gold-text" style="margin:0 0 14px;display:inline-block;padding:5px 14px;background:rgba(255,201,51,0.16);border-radius:99px;font-family:${FONT_MONO};font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${C.gold};mso-padding-alt:5px 14px;">${eyebrow}</p>` : ''}
        <h1 class="h1" style="margin:0;font-family:${FONT_DISPLAY};font-size:28px;font-weight:700;color:${C.primaryInk};line-height:1.2;letter-spacing:-0.3px;">${title}</h1>
        ${subtitle ? `<p class="h-sub" style="margin:10px 0 0;font-family:${FONT_SANS};font-size:14px;font-weight:400;color:rgba(255,255,255,0.7);line-height:1.5;">${subtitle}</p>` : ''}
      </td>
    </tr>
  `;
}

// ── Footer — brand mark + recipient address ────────────────────────────────
function footer(emailAddr) {
  return `
    <tr>
      <td class="footer-bg footer-pad surface-muted border-t" style="background:${C.surfaceMuted};border-top:1px solid ${C.border};padding:22px ${PAD_X_DESKTOP}px;text-align:center;">
        <p style="margin:0 0 4px;font-size:13px;color:${C.inkSoft};">
          <span class="ink" style="font-family:${FONT_SANS};font-weight:700;color:${C.ink};">Final </span><span class="footer-brand-italic" style="font-family:${FONT_DISPLAY};font-style:italic;font-weight:400;color:${C.primary};">Serve-ivor</span>
        </p>
        <p class="ink-soft" style="margin:0 0 8px;font-family:${FONT_MONO};font-size:10px;color:${C.inkSoft};letter-spacing:1.5px;text-transform:uppercase;">A tennis survivor pool</p>
        <p class="ink-ghost" style="margin:0;font-family:${FONT_SANS};font-size:11px;color:${C.inkGhost};">This email was sent to ${emailAddr || 'you'}</p>
      </td>
    </tr>
  `;
}

// ── CTA — bulletproof gold pill ──────────────────────────────────────────────
//
// Uses table-cell + bgcolor + inline styles. Outlook ignores border-radius but
// the button remains usable as a square. iOS / Android / Gmail render the pill
// shape correctly. Optional emoji prefix appears outside the colored pill —
// this avoids Outlook stretching the button's width to fit the emoji.
function cta(href, label, emoji) {
  return `
    <tr>
      <td class="cta-pad" style="padding:24px ${PAD_X_DESKTOP}px 32px;text-align:center;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:300px;" arcsize="100%" stroke="f" fillcolor="${C.gold}">
          <w:anchorlock/>
          <center style="color:${C.goldInk};font-family:${FONT_SANS};font-size:14px;font-weight:600;">${emoji ? emoji + ' ' : ''}${label}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-->
        <a href="${href}" class="gold-pill" style="display:inline-block;padding:14px 36px;background:${C.gold};color:${C.goldInk};font-family:${FONT_SANS};font-size:14px;font-weight:600;text-decoration:none;border-radius:999px;letter-spacing:0.2px;mso-padding-alt:14px 36px;line-height:1.2;">${emoji ? emoji + '&nbsp;' : ''}${label}</a>
        <!--<![endif]-->
      </td>
    </tr>
  `;
}

// ── Section eyebrow — small mono caps for "What's next" / "Your entry" / etc.
function sectionEyebrow(text) {
  return `
    <tr>
      <td class="px" style="padding:24px ${PAD_X_DESKTOP}px 12px;">
        <p class="ink-soft" style="margin:0;font-family:${FONT_MONO};font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${C.inkSoft};">${text}</p>
      </td>
    </tr>
  `;
}

// ── Card — coloured side-bar info card. Three tones: success, danger, warn,
// or any custom colour passed as `tone`.
function card({ tone = 'gold', label, value, kicker }) {
  const toneToBg = {
    success: { bg: C.successCard, border: C.success, kickerColour: C.success, cls: 'success-card success-text' },
    danger:  { bg: C.dangerCard,  border: C.danger,  kickerColour: C.danger,  cls: 'danger-card danger-text' },
    warn:    { bg: C.warnCard,    border: C.gold,    kickerColour: C.goldInk, cls: 'warn-card' },
    gold:    { bg: C.surfaceMuted,border: C.gold,    kickerColour: C.inkSoft, cls: 'surface-muted' },
    neutral: { bg: C.surfaceMuted,border: C.border,  kickerColour: C.inkSoft, cls: 'surface-muted' },
  };
  const t = toneToBg[tone] || toneToBg.gold;
  return `
    <tr>
      <td class="px" style="padding:0 ${PAD_X_DESKTOP}px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="${t.cls} border" style="background:${t.bg};border:1px solid ${C.border};border-left:4px solid ${t.border};border-radius:${RADIUS}px;overflow:hidden;">
          <tr>
            <td class="card-pad" style="padding:18px 22px;">
              ${label ? `<p class="ink-soft" style="margin:0 0 6px;font-family:${FONT_MONO};font-size:10px;color:${C.inkSoft};font-weight:700;letter-spacing:2px;text-transform:uppercase;">${label}</p>` : ''}
              <p class="ink card-title" style="margin:0 0 ${kicker ? '8' : '0'}px;font-family:${FONT_DISPLAY};font-size:18px;font-weight:700;color:${C.ink};line-height:1.3;">${value}</p>
              ${kicker ? `<p class="${tone === 'success' ? 'success-text' : tone === 'danger' ? 'danger-text' : 'ink-muted'}" style="margin:0;font-family:${FONT_SANS};font-size:13px;font-weight:600;color:${t.kickerColour};line-height:1.5;">${kicker}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

// ── Paragraph — body text with consistent spacing ────────────────────────────
function paragraph(text, padTop = 28, padBottom = 0) {
  return `
    <tr>
      <td class="px" style="padding:${padTop}px ${PAD_X_DESKTOP}px ${padBottom}px;">
        <p class="body-text ink-muted" style="margin:0;font-family:${FONT_SANS};font-size:16px;color:${C.inkMuted};line-height:1.7;">${text}</p>
      </td>
    </tr>
  `;
}

// ── Divider — thin horizontal rule with margin ───────────────────────────────
function divider(padTop = 24, padBottom = 0) {
  return `
    <tr>
      <td class="px" style="padding:${padTop}px ${PAD_X_DESKTOP}px ${padBottom}px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td class="border-t" style="border-top:1px solid ${C.border};font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
      </td>
    </tr>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmtGBP = (cents) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(cents / 100);

// ═════════════════════════════════════════════════════════════════════════════
// 1. WELCOME — sent on account creation
// Sends directly (NOT queued).
// ═════════════════════════════════════════════════════════════════════════════

export const sendWelcomeEmail = async ({ email, displayName }) => {
  if (!EMAIL_CONFIGURED) {
    console.warn(`[email] Skipping welcome email to ${email} — email not configured.`);
    return;
  }
  const html = buildWelcomeHTML({ email, displayName });
  const subject = `Welcome to Final Serve-ivor, ${displayName} 🎾`;
  try {
    await sendViaBrevo({ to: email, subject, html });
    console.log(`✅ Welcome email sent to ${email}`);
  } catch (err) {
    console.error(`❌ Failed to send welcome email to ${email}:`, err.message);
  }
};

export const buildWelcomeHTML = ({ email, displayName }) => {
  // 2 sections + CTA. The previous version had 3 numbered cards which made the
  // mobile view ~2.5 screens tall. The whole point of the email is "you're in,
  // here's the gist, go play" — long onboarding belongs on the website.
  const body = `
    ${paragraph(`Good to have you. Final Serve-ivor is a last-man-standing pool played across ATP tournaments. Each round, every player picks one match winner. Get it right, you survive. Get it wrong, you're out.`, 32)}

    ${sectionEyebrow('Two things to know')}

    ${card({ tone: 'gold', label: '01 — Pick a winner each round', value: 'One pick per round.', kicker: 'You can only use each player once across the whole tournament. Don\'t burn the big names too early.' })}

    ${card({ tone: 'success', label: '02 — Last one standing wins', value: 'Outlast your pool.', kicker: 'The prize pot goes to whoever survives the longest. Tie-break: lasted-furthest first, then earliest pick submission.' })}

    ${cta(APP_URL, 'Open Final Serve-ivor', '→')}
  `;

  return wrapper({
    eyebrow: 'Welcome',
    title: `Welcome aboard,&nbsp;${displayName}.`,
    subtitle: 'Your account is set up and ready to go.',
    body,
    footerEmail: email,
  });
};

// ═════════════════════════════════════════════════════════════════════════════
// 2. TOURNAMENT JOIN — sent when user joins a pool
// Sends directly (NOT queued).
// ═════════════════════════════════════════════════════════════════════════════

export const sendTournamentJoinEmail = async ({
  email, displayName, groupId, groupName,
  tournamentName, tourLevel, location,
  drawDate, startDate, drawAvailable, prizePoolCents,
}) => {
  if (!EMAIL_CONFIGURED) {
    console.warn(`[email] Skipping tournament join email to ${email} — email not configured.`);
    return;
  }
  const html = buildTournamentJoinHTML({
    email, displayName, groupId, groupName,
    tournamentName, tourLevel, location,
    drawDate, startDate, drawAvailable, prizePoolCents,
  });
  const subject = `You're in — ${tournamentName} · Final Serve-ivor`;
  try {
    await sendViaBrevo({ to: email, subject, html });
    console.log(`✅ Tournament join email sent to ${email} for ${tournamentName}`);
  } catch (err) {
    console.error(`❌ Failed to send tournament join email to ${email}:`, err.message);
  }
};

export const buildTournamentJoinHTML = ({
  email, displayName, groupId, groupName,
  tournamentName, tourLevel, location,
  drawDate, startDate, drawAvailable, prizePoolCents,
}) => {
  const groupUrl = `${APP_URL}/group/${groupId}`;
  const prizeKicker = prizePoolCents > 0
    ? `Prize pot: <strong>${fmtGBP(prizePoolCents)}</strong> · Free entry`
    : `Free entry · Prize pot grows with members`;
  const nextStep = drawAvailable
    ? 'The draw is live. Make your Round 1 pick now.'
    : `The draw drops on <strong>${drawDate}</strong>. We'll email you the moment R1 picks open.`;

  const body = `
    ${paragraph(`Hey <strong class="ink" style="color:${C.ink}">${displayName}</strong>, you're in. Entry confirmed for <strong class="ink" style="color:${C.ink}">${tournamentName}</strong>.`, 32)}

    ${sectionEyebrow('Your entry')}

    ${card({ tone: 'gold', label: 'Pool', value: groupName, kicker: `${tourLevel} · ${location} · ${prizeKicker}` })}

    ${paragraph(nextStep, 16)}

    ${cta(groupUrl, drawAvailable ? 'Make your R1 pick' : 'View your pool', '→')}
  `;

  return wrapper({
    eyebrow: 'Pool entered',
    title: 'You\'re in.',
    subtitle: `${tournamentName} · ${tourLevel}`,
    body,
    footerEmail: email,
  });
};

// ═════════════════════════════════════════════════════════════════════════════
// 3. PASSWORD RESET — security email
// Sends directly (NOT queued).
// ═════════════════════════════════════════════════════════════════════════════

export const sendPasswordResetEmail = async ({ email, displayName, resetUrl }) => {
  if (!EMAIL_CONFIGURED) {
    const msg = 'Email service not configured — BREVO_API_KEY must be set on Railway.';
    console.warn(`[email] ${msg}`);
    throw new Error(msg);
  }
  const html = buildPasswordResetHTML({ email, displayName, resetUrl });
  const subject = `Reset your password — Final Serve-ivor`;
  try {
    await sendViaBrevo({ to: email, subject, html });
    console.log(`✅ Password reset email sent to ${email}`);
  } catch (err) {
    console.error(`❌ Failed to send password reset email to ${email}:`, err.message);
    throw err;
  }
};

export const buildPasswordResetHTML = ({ email, displayName, resetUrl }) => {
  const body = `
    ${paragraph(`Hey <strong class="ink" style="color:${C.ink}">${displayName}</strong>, we received a request to reset your password. The link below is valid for <strong>1 hour</strong>.`, 32)}

    ${cta(resetUrl, 'Reset my password', '→')}

    ${card({ tone: 'warn', label: 'Heads up', value: 'Didn\'t request this?', kicker: 'You can safely ignore this email. Your password won\'t change unless you follow the link above.' })}

    <tr>
      <td class="px" style="padding:8px ${PAD_X_DESKTOP}px 24px;">
        <p class="ink-ghost" style="margin:0;font-family:${FONT_SANS};font-size:11px;color:${C.inkGhost};line-height:1.6;">
          Button not working? Copy and paste this link into your browser:<br/>
          <a href="${resetUrl}" class="ink-muted" style="color:${C.inkMuted};word-break:break-all;text-decoration:underline;">${resetUrl}</a>
        </p>
      </td>
    </tr>
  `;

  return wrapper({
    eyebrow: 'Security',
    title: 'Reset your password.',
    body,
    footerEmail: email,
  });
};

// ═════════════════════════════════════════════════════════════════════════════
// 4. PICK REMINDER — 24h before lock when user has no pick
// Queued for admin approval (high volume during tournaments).
// ═════════════════════════════════════════════════════════════════════════════

export async function sendPickReminderEmail({ userId, groupId, round, email, displayName, groupName, lockAt }) {
  const lockDate = new Date(lockAt);
  const lockStr = lockDate.toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  });
  const groupUrl = `${APP_URL}/group/${groupId}`;
  const subject = `Pick reminder: ${round} locks soon — Final Serve-ivor`;
  const html = buildPickReminderHTML({ email, displayName, round, groupName, lockStr, groupUrl });
  return sendWithDedup({ userId, groupId, round, emailType: 'pick_reminder', to: email, subject, html });
}

export function buildPickReminderHTML({ email, displayName, round, groupName, lockStr, groupUrl }) {
  const body = `
    ${paragraph(`Hey <strong class="ink" style="color:${C.ink}">${displayName}</strong>, the pick window for <strong class="ink" style="color:${C.ink}">${round}</strong> in <strong class="ink" style="color:${C.ink}">${groupName}</strong> closes <strong class="ink" style="color:${C.ink}">${lockStr}</strong>.`, 32)}

    ${paragraph(`If you don't pick before then, you're eliminated. Don't let that happen.`, 14)}

    ${cta(groupUrl, 'Make your pick', '→')}
  `;

  return wrapper({
    eyebrow: 'Reminder',
    title: `Time to pick for ${round}.`,
    body,
    footerEmail: email,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. ROUND RESULT — survival or elimination
// Queued for admin approval. Single template handles both outcomes.
// ═════════════════════════════════════════════════════════════════════════════

export async function sendRoundResultEmail({ userId, groupId, round, email, displayName, playerName, survived }) {
  const groupUrl = `${APP_URL}/group/${groupId}`;
  const subject = survived
    ? `${round}: You survived — Final Serve-ivor`
    : `${round}: You've been eliminated — Final Serve-ivor`;
  const html = buildRoundResultHTML({ email, displayName, round, playerName, survived, groupUrl });
  return sendWithDedup({ userId, groupId, round, emailType: 'round_result', to: email, subject, html });
}

export function buildRoundResultHTML({ email, displayName, round, playerName, survived, groupUrl }) {
  const tone = survived ? 'success' : 'danger';
  const symbol = survived ? '✓' : '✗';
  const statusLabel = survived ? 'You survived' : 'You\'ve been eliminated';
  const nextStepText = survived
    ? `You're through to the next round. We'll email you when the next pick window opens.`
    : `Tough one. Final Serve-ivor is a long game — you can still follow the action on the leaderboard, and you'll have first dibs on the next tournament pool.`;

  const body = `
    ${paragraph(`Hey <strong class="ink" style="color:${C.ink}">${displayName}</strong>, the <strong class="ink" style="color:${C.ink}">${round}</strong> results are in.`, 32)}

    ${card({ tone, label: 'Your pick', value: playerName, kicker: `${symbol} ${statusLabel}` })}

    ${paragraph(nextStepText, 8)}

    ${cta(groupUrl, 'View leaderboard', '→')}
  `;

  return wrapper({
    eyebrow: `${round} result`,
    title: `${symbol} ${statusLabel}`,
    body,
    footerEmail: email,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// 5b. WINNER ANNOUNCEMENT — pool winner crowned (tournament completed)
// Fires once a tournament's tour event finishes and a unique top survivor
// emerges. Per Option B (Mickey, 2026-05-15) this is gated by
// tournament.status === 'completed'. Queued for admin approval — Mickey
// reviews each champion email before it goes out.
//
// Dedup key uses round='F' so this can't collide with the F round_result
// email for the same user/group.
// ═════════════════════════════════════════════════════════════════════════════

export async function sendWinnerAnnouncementEmail({
  userId, groupId, email, displayName,
  tournamentName, tournamentShortName,
  winningPickName, roundCount, memberCount, prizePoolCents,
}) {
  const groupUrl = `${APP_URL}/group/${groupId}`;
  const subject = `🏆 You won the ${tournamentShortName} pool — Final Serve-ivor`;
  const html = buildWinnerAnnouncementHTML({
    email, displayName,
    tournamentName, tournamentShortName,
    winningPickName, roundCount, memberCount, prizePoolCents,
    groupUrl,
  });
  return sendWithDedup({
    userId, groupId, round: 'F',
    emailType: 'winner_announcement',
    to: email, subject, html,
  });
}

export function buildWinnerAnnouncementHTML({
  email, displayName,
  tournamentName, tournamentShortName,
  winningPickName, roundCount, memberCount, prizePoolCents,
  groupUrl,
}) {
  const prizeText = prizePoolCents > 0
    ? `The prize pot is yours: £${(prizePoolCents / 100).toFixed(2)}.`
    : `Free pool, so no payout this time. You'll have first dibs on the next one.`;

  const opponentLine = memberCount > 1
    ? `Out of ${memberCount} entrants in the pool, only you were left standing when the dust settled. That is the whole game.`
    : `Only one survivor when the dust settled, and that survivor was you.`;

  const body = `
    ${paragraph(`Hey <strong class="ink" style="color:${C.ink}">${displayName}</strong>, you outlasted everyone in the <strong class="ink" style="color:${C.ink}">${tournamentName}</strong> pool. Champion stuff.`, 32)}

    ${card({ tone: 'gold', label: 'Your winning Final pick', value: winningPickName, kicker: `Survived all ${roundCount} rounds` })}

    ${paragraph(`${opponentLine} ${prizeText}`, 8)}

    ${cta(groupUrl, 'View the leaderboard', '→')}

    ${sectionEyebrow("What's next")}

    ${paragraph(`The next pool opens shortly. You'll get an email the moment picks are live, so you can defend the crown.`, 12, 8)}
  `;

  return wrapper({
    eyebrow: 'Pool winner',
    title: '🏆 You won',
    subtitle: `${tournamentShortName} 2026`,
    body,
    footerEmail: email,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// 5c. TOURNAMENT WRAP — previous tournament concluded, next one opens
// Broadcast email queued for admin approval. Tells the user who won the
// tour event, who won the pool, and tees up the next event.
//
// Dedup key uses round='wrap' so this doesn't collide with round_result.
// One email per (user, group, type) — i.e. one per user per tournament
// they were a member of.
// ═════════════════════════════════════════════════════════════════════════════

export async function sendTournamentWrapEmail({
  userId, groupId, email, displayName,
  previousTournamentName, previousTournamentShortName,
  championName, scoreLine,
  poolWinnerName, winningPickName,
  nextTournamentName, nextTournamentShortName,
  nextStartsLabel, nextEntryFeeLabel, nextPoolUrl,
}) {
  const subject = `${championName} won ${previousTournamentShortName}. ${nextTournamentShortName} opens ${nextStartsLabel}.`;
  const html = buildTournamentWrapHTML({
    email, displayName,
    previousTournamentName, previousTournamentShortName,
    championName, scoreLine,
    poolWinnerName, winningPickName,
    nextTournamentName, nextTournamentShortName,
    nextStartsLabel, nextEntryFeeLabel, nextPoolUrl,
  });
  return sendWithDedup({
    userId, groupId, round: 'wrap',
    emailType: 'tournament_wrap',
    to: email, subject, html,
  });
}

export function buildTournamentWrapHTML({
  email, displayName,
  previousTournamentName, previousTournamentShortName,
  championName, scoreLine,
  poolWinnerName, winningPickName,
  nextTournamentName, nextTournamentShortName,
  nextStartsLabel, nextEntryFeeLabel, nextPoolUrl,
}) {
  const intro = displayName
    ? `Hey <strong class="ink" style="color:${C.ink}">${displayName}</strong>, here is how ${previousTournamentShortName} closed out.`
    : `Here is how ${previousTournamentShortName} closed out.`;

  const headlineFact = scoreLine
    ? `<strong class="ink" style="color:${C.ink}">${championName}</strong> won the ${previousTournamentShortName} Final ${scoreLine}.`
    : `<strong class="ink" style="color:${C.ink}">${championName}</strong> won ${previousTournamentShortName}.`;

  const poolFact = poolWinnerName && winningPickName
    ? `<strong class="ink" style="color:${C.ink}">${poolWinnerName}</strong> won our pool by picking ${winningPickName} in the Final and surviving every round.`
    : (poolWinnerName ? `<strong class="ink" style="color:${C.ink}">${poolWinnerName}</strong> won our pool.` : '');

  const feeLine = nextEntryFeeLabel
    ? `Entry is ${nextEntryFeeLabel}. Paid out to whoever lasts longest.`
    : `Entry details going out shortly.`;

  const body = `
    ${paragraph(intro, 32)}

    ${card({ tone: 'gold', label: `${previousTournamentShortName} 2026 — final`, value: `${championName} d. runner-up`, kicker: scoreLine || '' })}

    ${paragraph(`${headlineFact} ${poolFact}`, 8)}

    ${sectionEyebrow("What's next")}

    ${paragraph(`<strong class="ink" style="color:${C.ink}">${nextTournamentName}</strong> opens ${nextStartsLabel}. ${feeLine}`, 12)}

    ${cta(nextPoolUrl || `${APP_URL}/pools`, `Enter the ${nextTournamentShortName} pool`, '→')}
  `;

  return wrapper({
    eyebrow: 'Tournament wrap',
    title: `${previousTournamentShortName} is wrapped. ${nextTournamentShortName} is next.`,
    subtitle: scoreLine ? `${championName} won ${scoreLine}` : null,
    body,
    footerEmail: email,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. WITHDRAWAL ALERT — picked player withdrew before match
// Queued for admin approval.
// ═════════════════════════════════════════════════════════════════════════════

export async function sendWithdrawalEmail({ userId, groupId, round, email, displayName, withdrawnPlayer, replacementPlayer, groupName }) {
  const groupUrl = `${APP_URL}/group/${groupId}`;
  const subject = `${withdrawnPlayer} has withdrawn — re-pick now`;
  const html = buildWithdrawalHTML({ email, displayName, round, withdrawnPlayer, replacementPlayer, groupName, groupUrl });
  return sendWithDedup({ userId, groupId, round, emailType: 'withdrawal_alert', to: email, subject, html });
}

export function buildWithdrawalHTML({ email, displayName, round, withdrawnPlayer, replacementPlayer, groupName, groupUrl }) {
  const replacementText = replacementPlayer
    ? ` <strong class="ink" style="color:${C.ink}">${replacementPlayer}</strong> takes their place in the draw.`
    : '';

  const body = `
    ${paragraph(`Hey <strong class="ink" style="color:${C.ink}">${displayName}</strong>, <strong class="ink" style="color:${C.ink}">${withdrawnPlayer}</strong> has withdrawn from <strong class="ink" style="color:${C.ink}">${round}</strong> in <strong class="ink" style="color:${C.ink}">${groupName}</strong>.${replacementText}`, 32)}

    ${paragraph(`Your pick has been unlocked — make a new one before the round closes.`, 14)}

    ${card({ tone: 'danger', label: 'Action required', value: 'Make your new pick', kicker: 'The window is still open. Pick again, or you\'re out at lock.' })}

    ${cta(groupUrl, 'Re-pick now', '→')}
  `;

  return wrapper({
    eyebrow: 'Withdrawal',
    title: 'Re-pick required.',
    body,
    footerEmail: email,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. DRAW RELEASED — draw drops, pick window opens
// Queued for admin approval.
// ═════════════════════════════════════════════════════════════════════════════

export async function sendDrawReleasedEmail({ userId, groupId, email, displayName, tournamentName, groupName }) {
  const groupUrl = `${APP_URL}/group/${groupId}`;
  const subject = `The ${tournamentName} draw is out — make your pick`;
  const html = buildDrawReleasedHTML({ email, displayName, tournamentName, groupName, groupUrl });
  return sendWithDedup({ userId, groupId, round: 'R1', emailType: 'draw_released', to: email, subject, html });
}

export function buildDrawReleasedHTML({ email, displayName, tournamentName, groupName, groupUrl }) {
  const body = `
    ${paragraph(`Hey <strong class="ink" style="color:${C.ink}">${displayName}</strong>, the draw for <strong class="ink" style="color:${C.ink}">${tournamentName}</strong> has been released. The R1 pick window is now open in <strong class="ink" style="color:${C.ink}">${groupName}</strong>.`, 32)}

    ${card({ tone: 'success', label: 'First step', value: 'Pick your R1 winner', kicker: 'You can only use each player once across the tournament. Don\'t burn the big names too early.' })}

    ${cta(groupUrl, 'View the draw', '→')}
  `;

  return wrapper({
    eyebrow: 'Draw released',
    title: `${tournamentName} is live.`,
    subtitle: 'Time to make your first pick.',
    body,
    footerEmail: email,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. SUPPORT REQUEST — to support inbox (not user-facing)
// Sends directly to finalservivor@gmail.com.
// ═════════════════════════════════════════════════════════════════════════════

export async function sendSupportEmail({ category, subject, message, userContext }) {
  if (!EMAIL_CONFIGURED) {
    console.warn('[support-email] Brevo not configured — skipping send');
    return;
  }
  const html = buildSupportHTML({ category, subject, message, userContext });
  await sendViaBrevo({
    to: 'finalservivor@gmail.com',
    subject: `[Support] ${category}: ${subject}`,
    html,
  });
}

export function buildSupportHTML({ category, subject, message, userContext }) {
  const userRows = userContext ? `
    <tr>
      <td class="ink-soft" style="padding:6px 0;font-family:${FONT_SANS};font-size:13px;color:${C.inkSoft};width:120px;vertical-align:top;">Name</td>
      <td class="ink" style="padding:6px 0;font-family:${FONT_SANS};font-size:13px;color:${C.ink};">${userContext.displayName}</td>
    </tr>
    <tr>
      <td class="ink-soft" style="padding:6px 0;font-family:${FONT_SANS};font-size:13px;color:${C.inkSoft};vertical-align:top;">Email</td>
      <td class="ink" style="padding:6px 0;font-family:${FONT_SANS};font-size:13px;color:${C.ink};"><a href="mailto:${userContext.email}" style="color:${C.primary};">${userContext.email}</a></td>
    </tr>
    <tr>
      <td class="ink-soft" style="padding:6px 0;font-family:${FONT_SANS};font-size:13px;color:${C.inkSoft};vertical-align:top;">Groups</td>
      <td class="ink" style="padding:6px 0;font-family:${FONT_SANS};font-size:13px;color:${C.ink};">${userContext.groups}</td>
    </tr>
  ` : `
    <tr>
      <td colspan="2" class="ink-soft" style="padding:6px 0;font-family:${FONT_SANS};font-size:13px;color:${C.inkSoft};font-style:italic;">Not logged in</td>
    </tr>
  `;

  const body = `
    ${sectionEyebrow('Subject')}
    <tr><td class="px" style="padding:0 ${PAD_X_DESKTOP}px 16px;">
      <p class="ink" style="margin:0;font-family:${FONT_DISPLAY};font-size:18px;font-weight:700;color:${C.ink};line-height:1.3;">${subject}</p>
    </td></tr>

    ${divider(8, 0)}

    ${sectionEyebrow('Message')}
    <tr><td class="px" style="padding:0 ${PAD_X_DESKTOP}px 16px;">
      <div class="ink body-text" style="margin:0;font-family:${FONT_SANS};font-size:14px;color:${C.ink};line-height:1.65;white-space:pre-wrap;">${message}</div>
    </td></tr>

    ${divider(8, 0)}

    ${sectionEyebrow('User')}
    <tr><td class="px" style="padding:0 ${PAD_X_DESKTOP}px 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">${userRows}</table>
    </td></tr>

    ${userContext?.email ? cta(`mailto:${userContext.email}`, `Reply to ${userContext.displayName}`, '✉') : ''}
  `;

  return wrapper({
    eyebrow: 'Support',
    title: 'New support request',
    subtitle: category,
    body,
    footerEmail: 'finalservivor@gmail.com',
  });
}
