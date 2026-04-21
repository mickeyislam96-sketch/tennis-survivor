import { pool } from '../db/pool.js';

// ── Startup check ────────────────────────────────────────────────────────────
const EMAIL_CONFIGURED = !!process.env.BREVO_API_KEY;
// ADMIN_EMAIL receives digest notifications when emails are queued
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'mickeyislam96@gmail.com';

if (!EMAIL_CONFIGURED) {
  console.warn('⚠️  EMAIL NOT CONFIGURED: BREVO_API_KEY env var is missing.');
} else {
  console.log('✅ Email configured — Brevo HTTP API (direct send mode)');
}

// Send via Brevo HTTP API (port 443 — works on Railway, no SMTP needed)
async function sendViaBrevo({ to, subject, html }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
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
    throw new Error(`Brevo API error ${res.status}: ${body}`);
  }
}

const APP_URL = process.env.FRONTEND_URL || 'https://finalserveivor.com';

// ─────────────────────────────────────────────────────────────────────────────
// Design system colour tokens — mirroring frontend/src/styles/tokens.css
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  // Canvas & neutrals
  canvas:      '#FAFAF7',
  surface:     '#FFFFFF',
  surfaceMuted:'#F4F2ED',
  ink:         '#141414',
  inkMuted:    '#4A4A46',
  inkSoft:     '#8A8780',
  inkGhost:    '#BEBAB0',
  border:      '#E3E0D7',
  // Primary — deep emerald
  primary:     '#0F4A23',
  primaryHover:'#0A3A1B',
  primaryInk:  '#FFFFFF',
  // Gold
  gold:        '#FFC933',
  goldDeep:    '#E6A500',
  goldSoft:    '#FFF3C4',
  goldInk:     '#2B1F00',
  // Status
  success:     '#1E7A3E',
  successSoft: '#E1F1E7',
  danger:      '#B03B2A',
  dangerSoft:  '#F7DFD9',
  // Accent
  accent:      '#C1572E',
};

// Font stacks — mirroring frontend/src/styles/tokens.css
const FONT_STACK   = "'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const FONT_DISPLAY = "'Fraunces', Georgia, 'Times New Roman', serif";
const FONT_MONO    = "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";
const FONT_LINK    = '<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,700;1,400&family=JetBrains+Mono:wght@600;700&family=Outfit:wght@400;600;700&display=swap" rel="stylesheet" />';

// ─────────────────────────────────────────────────────────────────────────────
// Dedup + direct send — sends immediately via Brevo, uses DB for dedup only.
//
// Flow:
//   1. INSERT into emails_sent with status='sending', ON CONFLICT DO NOTHING.
//   2. If rowCount === 0, this email was already sent. Stop (dedup).
//   3. Send immediately via Brevo.
//   4. Update status to 'sent' (or 'failed').
//
// No approval queue. No admin step. Emails go out as soon as triggered.
// ─────────────────────────────────────────────────────────────────────────────
export async function sendWithDedup({ userId, groupId, round, emailType, to, subject, html }) {
  // Attempt dedup insert — prevents sending the same email twice
  const { rowCount } = await pool.query(
    `INSERT INTO emails_sent (user_id, group_id, round, email_type, status, subject, recipient_email, recipient_name, metadata)
     VALUES ($1, $2, $3, $4, 'sending', $5, $6, $7, $8)
     ON CONFLICT (user_id, group_id, round, email_type) DO NOTHING`,
    [userId, groupId, round, emailType, subject, to, null, JSON.stringify({ html })]
  );

  if (rowCount === 0) {
    return { sent: false, reason: 'already_exists' };
  }

  if (!EMAIL_CONFIGURED) {
    console.warn(`[email] Would send "${emailType}" to ${to} but BREVO_API_KEY not set`);
    return { sent: false, reason: 'not_configured' };
  }

  try {
    await sendViaBrevo({ to, subject, html });
    await pool.query(
      `UPDATE emails_sent SET status = 'sent', sent_at = NOW() WHERE user_id = $1 AND group_id = $2 AND round = $3 AND email_type = $4`,
      [userId, groupId, round, emailType]
    );
    console.log(`✅ [${emailType}] sent to ${to} | round=${round}`);
    return { sent: true };
  } catch (err) {
    await pool.query(
      `UPDATE emails_sent SET status = 'failed' WHERE user_id = $1 AND group_id = $2 AND round = $3 AND email_type = $4`,
      [userId, groupId, round, emailType]
    );
    console.error(`❌ [${emailType}] failed for ${to}: ${err.message}`);
    return { sent: false, reason: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: send all pending emails (called from approval endpoint)
// Returns a summary of what was sent.
// ─────────────────────────────────────────────────────────────────────────────
export async function sendPendingEmails() {
  if (!EMAIL_CONFIGURED) {
    return { error: 'BREVO_API_KEY not configured', sent: 0, failed: 0 };
  }

  const { rows } = await pool.query(
    `SELECT id, user_id, group_id, round, email_type, subject, recipient_email, metadata
       FROM emails_sent
      WHERE status = 'pending'
      ORDER BY created_at ASC`
  );

  if (rows.length === 0) {
    return { sent: 0, failed: 0, message: 'No pending emails' };
  }

  let sent = 0;
  let failed = 0;
  const results = [];

  for (const row of rows) {
    try {
      // HTML was stored in metadata at queue time
      const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
      const html = meta.html;
      if (!html) {
        console.error(`[email-send] No stored HTML for ${row.id} (${row.email_type})`);
        failed++;
        results.push({ id: row.id, to: row.recipient_email, type: row.email_type, status: 'no_html' });
        continue;
      }

      await sendViaBrevo({ to: row.recipient_email, subject: row.subject, html });

      await pool.query(
        `UPDATE emails_sent SET status = 'sent', sent_at = NOW() WHERE id = $1`,
        [row.id]
      );
      sent++;
      results.push({ id: row.id, to: row.recipient_email, type: row.email_type, status: 'sent' });
      console.log(`✅ [${row.email_type}] sent to ${row.recipient_email} (round=${row.round})`);
    } catch (err) {
      // Mark as failed — no retry (missed email > duplicate email)
      await pool.query(
        `UPDATE emails_sent SET status = 'failed' WHERE id = $1`,
        [row.id]
      );
      failed++;
      results.push({ id: row.id, to: row.recipient_email, type: row.email_type, status: 'failed', error: err.message });
      console.error(`❌ [${row.email_type}] failed for ${row.recipient_email}: ${err.message}`);
    }
  }

  return { sent, failed, total: rows.length, results };
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: get a preview of all pending emails (for the approval endpoint)
// ─────────────────────────────────────────────────────────────────────────────
export async function getPendingEmailsSummary() {
  const { rows } = await pool.query(
    `SELECT email_type, round, recipient_email, recipient_name, subject, created_at
       FROM emails_sent
      WHERE status = 'pending'
      ORDER BY created_at ASC`
  );
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin digest — DISABLED (direct send mode, no queue to approve).
// Kept as no-op so callers don't break.
// ─────────────────────────────────────────────────────────────────────────────
export async function sendAdminDigest() {
  // No-op: emails now send directly, no approval queue.
  return;

  /* --- Original digest code (preserved for reference) ---
  if (!EMAIL_CONFIGURED) return;

  const pending = await getPendingEmailsSummary();
  if (pending.length === 0) { _lastDigestPendingCount = 0; return; }

  if (pending.length <= _lastDigestPendingCount) return;
  _lastDigestPendingCount = pending.length;

  // Group by type for a clean summary
  const byType = {};
  for (const row of pending) {
    if (!byType[row.email_type]) byType[row.email_type] = [];
    byType[row.email_type].push(row);
  }

  let summaryRows = '';
  for (const [type, emails] of Object.entries(byType)) {
    for (const e of emails) {
      summaryRows += `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid ${C.border};font-size:13px;color:${C.inkMuted};">${e.recipient_name || e.recipient_email}</td>
          <td style="padding:8px 12px;border-bottom:1px solid ${C.border};font-size:13px;color:${C.inkMuted};">${type}</td>
          <td style="padding:8px 12px;border-bottom:1px solid ${C.border};font-size:13px;color:${C.inkMuted};">${e.round}</td>
          <td style="padding:8px 12px;border-bottom:1px solid ${C.border};font-size:13px;color:${C.inkSoft};">${e.subject || ''}</td>
        </tr>`;
    }
  }

  const adminSecret = process.env.ADMIN_SECRET || '';
  const baseUrl = 'https://tennis-survivor-production.up.railway.app/api/admin/approve-emails';
  const previewUrl = `${baseUrl}?secret=${encodeURIComponent(adminSecret)}`;
  const approveUrl = `${baseUrl}?secret=${encodeURIComponent(adminSecret)}&confirm=true`;

  // Admin digest — functional with one-click approve button
  const html = `
    <!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
    <body style="margin:0;padding:20px;background:${C.canvas};font-family:${FONT_STACK};">
      <div style="max-width:600px;margin:0 auto;background:${C.surface};border-radius:12px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <h2 style="margin:0 0 8px;color:${C.primary};">📧 ${pending.length} email${pending.length === 1 ? '' : 's'} queued for approval</h2>
        <p style="margin:0 0 20px;color:${C.inkSoft};font-size:14px;">These will NOT be sent until you approve them.</p>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <thead>
            <tr style="background:${C.surfaceMuted};">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:${C.inkSoft};font-weight:600;">Recipient</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:${C.inkSoft};font-weight:600;">Type</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:${C.inkSoft};font-weight:600;">Round</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:${C.inkSoft};font-weight:600;">Subject</th>
            </tr>
          </thead>
          <tbody>${summaryRows}</tbody>
        </table>

        <div style="text-align:center;margin-bottom:16px;">
          <a href="${approveUrl}" style="display:inline-block;background:${C.gold};color:#2B1F00;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:600;font-size:16px;">
            ✅ Approve &amp; Send ${pending.length} Email${pending.length === 1 ? '' : 's'}
          </a>
        </div>

        <p style="margin:0;text-align:center;font-size:12px;color:${C.inkGhost};">
          <a href="${previewUrl}" style="color:${C.inkMuted};text-decoration:underline;">Preview without sending</a>
        </p>
      </div>
    </body></html>
  `;

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
  --- end of preserved digest code --- */
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared layout helpers
// ─────────────────────────────────────────────────────────────────────────────

const emailWrapper = (headerContent, bodyContent, footerEmail) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  ${FONT_LINK}
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${C.canvas};font-family:${FONT_STACK};-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.canvas};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${C.surface};border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(20,20,20,0.06), 0 2px 4px rgba(20,20,20,0.04);">

          ${headerContent}
          ${bodyContent}

          <!-- Footer -->
          <tr>
            <td style="background:${C.surfaceMuted};border-top:1px solid ${C.border};padding:24px 40px;text-align:center;">
              <p style="margin:0 0 4px;font-size:14px;color:${C.inkSoft};"><span style="font-family:${FONT_STACK};font-weight:700;">Final </span><span style="font-family:${FONT_DISPLAY};font-style:italic;font-weight:400;color:${C.primary};">Serve-ivor</span></p>
              <p style="margin:0 0 10px;font-family:${FONT_MONO};font-size:11px;color:${C.inkGhost};letter-spacing:1.5px;text-transform:uppercase;">A tennis survivor pool</p>
              <p style="margin:0;font-family:${FONT_STACK};font-size:11px;color:${C.inkGhost};">This email was sent to ${footerEmail}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const divider = `
  <tr>
    <td style="padding:0 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="border-top:1px solid ${C.border};font-size:0;line-height:0;">&nbsp;</td></tr>
      </table>
    </td>
  </tr>
`;

// Court background image URL (hosted in frontend/public/)
const COURT_BG = `${APP_URL}/email-court-bg.png`;

// Shared header builder — emerald with tennis court background
function emailHeader({ eyebrow, title, subtitle }) {
  return `
    <tr>
      <td style="background-color:${C.primary};background-image:url('${COURT_BG}');background-size:cover;background-position:center;padding:40px 40px 32px;text-align:center;">
        <!--[if gte mso 9]>
        <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:180px;">
          <v:fill type="tile" src="${COURT_BG}" color="${C.primary}" />
          <v:textbox inset="0,0,0,0">
        <![endif]-->
        <p style="margin:0 0 14px;display:inline-block;padding:5px 14px;background:rgba(255,201,51,0.15);border:1px solid rgba(255,201,51,0.4);border-radius:20px;font-family:${FONT_MONO};font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${C.gold};">${eyebrow}</p>
        <h1 style="margin:0;font-family:${FONT_DISPLAY};font-size:30px;font-weight:700;color:${C.primaryInk};line-height:1.2;">${title}</h1>
        ${subtitle ? `<p style="margin:10px 0 0;font-family:${FONT_STACK};font-size:15px;color:rgba(255,255,255,0.65);">${subtitle}</p>` : ''}
        <!--[if gte mso 9]>
          </v:textbox>
        </v:rect>
        <![endif]-->
      </td>
    </tr>
  `;
}

// Shared CTA button
function emailCTA(href, label) {
  return `
    <tr>
      <td style="padding:28px 40px 36px;text-align:center;">
        <a href="${href}" style="display:inline-block;padding:14px 36px;background:${C.gold};color:${C.goldInk};font-family:${FONT_STACK};font-size:14px;font-weight:600;text-decoration:none;border-radius:999px;letter-spacing:0.3px;">${label}</a>
      </td>
    </tr>
  `;
}

// Section eyebrow (e.g. "How it works", "What's next")
function sectionEyebrow(text) {
  return `
    <tr>
      <td style="padding:28px 40px 16px;">
        <p style="margin:0;font-family:${FONT_MONO};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${C.inkSoft};">${text}</p>
      </td>
    </tr>
  `;
}


// ─────────────────────────────────────────────────────────────────────────────
// 1. WELCOME EMAIL — fires on account creation
// ─────────────────────────────────────────────────────────────────────────────

export const sendWelcomeEmail = async ({ email, displayName }) => {
  if (!EMAIL_CONFIGURED) {
    console.warn(`[email] Skipping welcome email to ${email} — email not configured.`);
    return;
  }
  const mailOptions = {
    from: `"Final Serve-ivor" <noreply@finalserveivor.com>`,
    to: email,
    subject: `Welcome to Final Serve-ivor, ${displayName} 🎾`,
    html: buildWelcomeHTML({ email, displayName }),
  };

  try {
    await sendViaBrevo({ to: email, subject: mailOptions.subject, html: mailOptions.html });
    console.log(`✅ Welcome email sent to ${email}`);
  } catch (err) {
    console.error(`❌ Failed to send welcome email to ${email}:`, err.message);
    // Non-fatal — don't throw
  }
};

const buildWelcomeHTML = ({ email, displayName }) => {
  const header = emailHeader({
    eyebrow: 'Final Serve-ivor',
    title: `Welcome aboard,&nbsp;${displayName}.`,
    subtitle: 'Your account is set up and ready to go.',
  });

  const body = `
    <tr>
      <td style="padding:36px 40px 8px;">
        <p style="margin:0;font-family:${FONT_STACK};font-size:15px;color:${C.inkMuted};line-height:1.7;">
          Good to have you. Final Serve-ivor is a last-man-standing game played across ATP tournaments. Every round, every player in your pool picks a match winner. Pick correctly and you survive. Pick wrong and you're out.
        </p>
      </td>
    </tr>

    ${sectionEyebrow('How it works')}

    <!-- Step 1 -->
    <tr>
      <td style="padding:0 40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.surfaceMuted};border-radius:8px;border-left:4px solid ${C.gold};">
          <tr>
            <td style="padding:18px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:32px;vertical-align:top;">
                    <div style="width:24px;height:24px;background:${C.gold};border-radius:50%;text-align:center;line-height:24px;font-family:${FONT_STACK};font-size:12px;font-weight:700;color:${C.goldInk};">1</div>
                  </td>
                  <td style="padding-left:12px;vertical-align:top;">
                    <p style="margin:0 0 4px;font-family:${FONT_DISPLAY};font-size:15px;font-weight:700;color:${C.ink};">Join a tournament pool</p>
                    <p style="margin:0;font-family:${FONT_STACK};font-size:13px;color:${C.inkMuted};line-height:1.6;">Use an invite code to join a pool for an upcoming ATP tournament. Each pool has its own entry and prize pot.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Step 2 -->
    <tr>
      <td style="padding:0 40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.surfaceMuted};border-radius:8px;border-left:4px solid ${C.gold};">
          <tr>
            <td style="padding:18px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:32px;vertical-align:top;">
                    <div style="width:24px;height:24px;background:${C.gold};border-radius:50%;text-align:center;line-height:24px;font-family:${FONT_STACK};font-size:12px;font-weight:700;color:${C.goldInk};">2</div>
                  </td>
                  <td style="padding-left:12px;vertical-align:top;">
                    <p style="margin:0 0 4px;font-family:${FONT_DISPLAY};font-size:15px;font-weight:700;color:${C.ink};">Pick a winner each round</p>
                    <p style="margin:0;font-family:${FONT_STACK};font-size:13px;color:${C.inkMuted};line-height:1.6;">Once the draw is released, log in and select one match winner per round. Pick correctly and you move on. Pick wrong and you're eliminated.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Step 3 -->
    <tr>
      <td style="padding:0 40px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.surfaceMuted};border-radius:8px;border-left:4px solid ${C.success};">
          <tr>
            <td style="padding:18px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:32px;vertical-align:top;">
                    <div style="width:24px;height:24px;background:${C.success};border-radius:50%;text-align:center;line-height:24px;font-family:${FONT_STACK};font-size:12px;font-weight:700;color:${C.primaryInk};">3</div>
                  </td>
                  <td style="padding-left:12px;vertical-align:top;">
                    <p style="margin:0 0 4px;font-family:${FONT_DISPLAY};font-size:15px;font-weight:700;color:${C.ink};">Last one standing wins</p>
                    <p style="margin:0;font-family:${FONT_STACK};font-size:13px;color:${C.inkMuted};line-height:1.6;">You can only pick each player once across the whole tournament, so don't burn your big names too early. Outlast everyone else and take the prize pot.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    ${divider}

    <!-- CTA -->
    <tr>
      <td style="padding:28px 40px 8px;text-align:center;">
        <p style="margin:0 0 20px;font-family:${FONT_STACK};font-size:14px;color:${C.inkSoft};line-height:1.6;">Ready to play? Find a tournament pool using your invite code, or check what's running.</p>
      </td>
    </tr>
    ${emailCTA(APP_URL, 'Open Final Serve-ivor &rarr;')}
  `;

  return emailWrapper(header, body, email);
};


// ─────────────────────────────────────────────────────────────────────────────
// 2. TOURNAMENT JOIN EMAIL — fires when a user joins a group
// ─────────────────────────────────────────────────────────────────────────────

export const sendTournamentJoinEmail = async ({
  email,
  displayName,
  groupId,
  groupName,
  tournamentName,
  tourLevel,
  location,
  drawDate,
  startDate,
  drawAvailable,
  prizePoolCents,
}) => {
  if (!EMAIL_CONFIGURED) {
    console.warn(`[email] Skipping tournament join email to ${email} — email not configured.`);
    return;
  }
  const mailOptions = {
    from: `"Final Serve-ivor" <noreply@finalserveivor.com>`,
    to: email,
    subject: `You're in — ${tournamentName} · Final Serve-ivor`,
    html: buildTournamentJoinHTML({
      email, displayName, groupId, groupName,
      tournamentName, tourLevel, location,
      drawDate, startDate, drawAvailable, prizePoolCents,
    }),
  };

  try {
    await sendViaBrevo({ to: email, subject: mailOptions.subject, html: mailOptions.html });
    console.log(`✅ Tournament join email sent to ${email} for ${tournamentName}`);
  } catch (err) {
    console.error(`❌ Failed to send tournament join email to ${email}:`, err.message);
    // Non-fatal — don't throw
  }
};

const fmtGBP = (cents) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(cents / 100);

const buildTournamentJoinHTML = ({
  email, displayName, groupId, groupName,
  tournamentName, tourLevel, location,
  drawDate, startDate, drawAvailable, prizePoolCents,
}) => {
  const groupUrl = `${APP_URL}/group/${groupId}`;

  const prizeRow = prizePoolCents > 0
    ? `<tr>
        <td style="padding:10px 0;border-bottom:1px solid ${C.border};">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="font-family:${FONT_STACK};font-size:13px;color:${C.inkSoft};width:40%;">Prize pool</td>
              <td style="font-family:${FONT_STACK};font-size:13px;font-weight:700;color:${C.success};text-align:right;">${fmtGBP(prizePoolCents)}</td>
            </tr>
          </table>
        </td>
      </tr>`
    : '';

  const timelineDrawRow = drawAvailable
    ? `<tr>
        <td style="padding:12px 0;border-bottom:1px solid ${C.border};">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="width:28px;font-size:16px;vertical-align:middle;">✅</td>
              <td style="padding-left:10px;vertical-align:middle;">
                <p style="margin:0;font-family:${FONT_STACK};font-size:13px;font-weight:700;color:${C.success};">Draw is live</p>
                <p style="margin:2px 0 0;font-family:${FONT_STACK};font-size:12px;color:${C.inkSoft};">Log in and make your Round 1 pick now.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : `<tr>
        <td style="padding:12px 0;border-bottom:1px solid ${C.border};">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="width:28px;font-size:16px;vertical-align:middle;">📋</td>
              <td style="padding-left:10px;vertical-align:middle;">
                <p style="margin:0;font-family:${FONT_STACK};font-size:13px;font-weight:700;color:${C.ink};">Draw released</p>
                <p style="margin:2px 0 0;font-family:${FONT_STACK};font-size:12px;color:${C.inkSoft};">${drawDate}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;

  const header = emailHeader({
    eyebrow: tournamentName,
    title: "You're in.",
    subtitle: 'Your entry has been confirmed.',
  });

  // Detail row helper
  const detailRow = (label, value, hasBorder = true) => `
    <tr>
      <td style="padding:10px 0;${hasBorder ? `border-bottom:1px solid ${C.border};` : ''}">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="font-family:${FONT_STACK};font-size:13px;color:${C.inkSoft};width:40%;">${label}</td>
            <td style="font-family:${FONT_STACK};font-size:13px;font-weight:600;color:${C.ink};text-align:right;">${value}</td>
          </tr>
        </table>
      </td>
    </tr>`;

  const body = `
    <!-- Greeting -->
    <tr>
      <td style="padding:32px 40px 8px;">
        <p style="margin:0;font-family:${FONT_STACK};font-size:15px;color:${C.inkMuted};line-height:1.7;">
          Hey <strong>${displayName}</strong>, you're officially entered into the <strong>${tournamentName}</strong> pool. Here's everything you need to know.
        </p>
      </td>
    </tr>

    <!-- Entry confirmation card -->
    <tr>
      <td style="padding:20px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.surfaceMuted};border:1px solid ${C.border};border-radius:12px;overflow:hidden;">
          <!-- Card header -->
          <tr>
            <td style="background:${C.primary};padding:12px 20px;">
              <p style="margin:0;font-family:${FONT_MONO};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${C.gold};">Your entry</p>
            </td>
          </tr>
          <!-- Card body -->
          <tr>
            <td style="padding:4px 20px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${detailRow('Pool', groupName)}
                ${detailRow('Tournament', tournamentName)}
                ${detailRow('Level', tourLevel)}
                ${detailRow('Location', location, prizePoolCents > 0)}
                ${prizeRow}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    ${sectionEyebrow("What's next")}

    <!-- Timeline card -->
    <tr>
      <td style="padding:0 40px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.surfaceMuted};border:1px solid ${C.border};border-radius:12px;">
          <tr>
            <td style="padding:4px 20px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

                ${timelineDrawRow}

                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid ${C.border};">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="width:28px;font-size:16px;vertical-align:middle;">🎾</td>
                        <td style="padding-left:10px;vertical-align:middle;">
                          <p style="margin:0;font-family:${FONT_STACK};font-size:13px;font-weight:700;color:${C.ink};">Tournament begins</p>
                          <p style="margin:2px 0 0;font-family:${FONT_STACK};font-size:12px;color:${C.inkSoft};">${startDate}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:12px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="width:28px;font-size:16px;vertical-align:middle;">🏆</td>
                        <td style="padding-left:10px;vertical-align:middle;">
                          <p style="margin:0;font-family:${FONT_STACK};font-size:13px;font-weight:700;color:${C.ink};">Last one standing wins</p>
                          <p style="margin:2px 0 0;font-family:${FONT_STACK};font-size:12px;color:${C.inkSoft};">Survive every round and take the pot.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    ${divider}

    ${sectionEyebrow('Quick reminder')}
    <tr>
      <td style="padding:10px 40px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:6px 0;font-family:${FONT_STACK};font-size:13px;color:${C.inkMuted};line-height:1.6;">
              &#x2023;&nbsp; Pick one match winner per round. Get it wrong and you're out.
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-family:${FONT_STACK};font-size:13px;color:${C.inkMuted};line-height:1.6;">
              &#x2023;&nbsp; You can only pick each player <strong>once</strong> across the whole tournament.
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-family:${FONT_STACK};font-size:13px;color:${C.inkMuted};line-height:1.6;">
              &#x2023;&nbsp; Run out of valid picks and you're eliminated. Don't burn your big names too soon.
            </td>
          </tr>
        </table>
      </td>
    </tr>

    ${divider}

    <!-- CTA -->
    <tr>
      <td style="padding:28px 40px 8px;text-align:center;">
        <p style="margin:0 0 20px;font-family:${FONT_STACK};font-size:14px;color:${C.inkSoft};line-height:1.6;">
          ${drawAvailable
            ? 'The draw is live. Head in and make your first pick.'
            : `No action needed right now. We'll be in touch once the draw drops on ${drawDate}.`
          }
        </p>
      </td>
    </tr>
    ${emailCTA(groupUrl, 'View your pool &rarr;')}
  `;

  return emailWrapper(header, body, email);
};


// ─────────────────────────────────────────────────────────────────────────────
// 3. PASSWORD RESET EMAIL
// ─────────────────────────────────────────────────────────────────────────────

export const sendPasswordResetEmail = async ({ email, displayName, resetUrl }) => {
  if (!EMAIL_CONFIGURED) {
    const msg = 'Email service not configured — BREVO_API_KEY must be set on Railway.';
    console.warn(`[email] ${msg}`);
    throw new Error(msg);
  }
  const mailOptions = {
    from: `"Final Serve-ivor" <noreply@finalserveivor.com>`,
    to: email,
    subject: `Reset your password — Final Serve-ivor`,
    html: buildPasswordResetHTML({ email, displayName, resetUrl }),
  };

  try {
    await sendViaBrevo({ to: email, subject: mailOptions.subject, html: mailOptions.html });
    console.log(`✅ Password reset email sent to ${email}`);
  } catch (err) {
    console.error(`❌ Failed to send password reset email to ${email}:`, err.message);
    throw err;
  }
};

const buildPasswordResetHTML = ({ email, displayName, resetUrl }) => {
  const header = emailHeader({
    eyebrow: 'Final Serve-ivor',
    title: 'Reset your password',
  });

  const body = `
    <tr>
      <td style="padding:36px 40px 24px;">
        <p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;color:${C.inkMuted};line-height:1.7;">
          Hey <strong>${displayName}</strong>,
        </p>
        <p style="margin:0 0 28px;font-family:${FONT_STACK};font-size:15px;color:${C.inkMuted};line-height:1.7;">
          We received a request to reset your password. Click the button below. This link is valid for <strong>1 hour</strong>.
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
          <tr>
            <td align="center">
              <a href="${resetUrl}" style="display:inline-block;padding:14px 36px;background:${C.gold};color:${C.goldInk};font-family:${FONT_STACK};font-size:14px;font-weight:600;text-decoration:none;border-radius:999px;letter-spacing:0.3px;">Reset my password</a>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.surfaceMuted};border-left:4px solid ${C.gold};border-radius:8px;margin-bottom:24px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0;font-family:${FONT_STACK};font-size:13px;color:${C.inkMuted};line-height:1.6;">
                If you didn't request this, you can safely ignore this email. Your password won't change unless you follow the link above.
              </p>
            </td>
          </tr>
        </table>

        <p style="margin:0;font-family:${FONT_STACK};font-size:12px;color:${C.inkGhost};line-height:1.6;">
          Button not working? Copy and paste this link into your browser:<br/>
          <a href="${resetUrl}" style="color:${C.primary};word-break:break-all;">${resetUrl}</a>
        </p>
      </td>
    </tr>
  `;

  return emailWrapper(header, body, email);
};


// ─────────────────────────────────────────────────────────────────────────────
// 4. PICK REMINDER — 24h before lock, user has no pick for the round
//    Uses sendWithDedup — dedup prevents duplicate sends.
// ─────────────────────────────────────────────────────────────────────────────

export async function sendPickReminderEmail({ userId, groupId, round, email, displayName, groupName, lockAt }) {
  const lockDate = new Date(lockAt);
  const lockStr = lockDate.toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  });
  const groupUrl = `${APP_URL}/group/${groupId}`;

  const subject = `Pick reminder: ${round} locks soon — Final Serve-ivor`;
  const header = emailHeader({
    eyebrow: 'Reminder',
    title: `You haven't made your ${round} pick yet.`,
  });

  const body = `
    <tr>
      <td style="padding:32px 40px 8px;">
        <p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;color:${C.inkMuted};line-height:1.7;">
          Hey <strong>${displayName}</strong>, the pick window for <strong>${round}</strong> in <strong>${groupName}</strong> closes at <strong>${lockStr}</strong>.
        </p>
        <p style="margin:0 0 24px;font-family:${FONT_STACK};font-size:15px;color:${C.inkMuted};line-height:1.7;">
          If you don't submit a pick before then, you'll be eliminated. Don't let that happen.
        </p>
      </td>
    </tr>

    ${emailCTA(groupUrl, 'Make your pick &rarr;')}
  `;
  const html = emailWrapper(header, body, email);

  return sendWithDedup({ userId, groupId, round, emailType: 'pick_reminder', to: email, subject, html });
}


// ─────────────────────────────────────────────────────────────────────────────
// 5. ROUND RESULT — sent after a user's pick is resolved (survived or eliminated)
//    Uses sendWithDedup — dedup prevents duplicate sends.
// ─────────────────────────────────────────────────────────────────────────────

export async function sendRoundResultEmail({ userId, groupId, round, email, displayName, playerName, survived }) {
  const groupUrl = `${APP_URL}/group/${groupId}`;

  const statusLabel = survived ? 'You survived' : "You've been eliminated";
  const statusColor = survived ? C.success : C.danger;
  const statusEmoji = survived ? '✅' : '❌';
  const subject = survived
    ? `${round}: You survived — Final Serve-ivor`
    : `${round}: You've been eliminated — Final Serve-ivor`;

  const header = emailHeader({
    eyebrow: `${round} Result`,
    title: `${statusEmoji} ${statusLabel}`,
  });

  const nextStepText = survived
    ? "You're through to the next round. Keep your eyes open for when the next pick window opens."
    : 'Better luck next time. You can still follow the action on the leaderboard.';

  const body = `
    <tr>
      <td style="padding:32px 40px 8px;">
        <p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;color:${C.inkMuted};line-height:1.7;">
          Hey <strong>${displayName}</strong>, the results for <strong>${round}</strong> are in.
        </p>
      </td>
    </tr>

    <!-- Result card -->
    <tr>
      <td style="padding:0 40px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.surfaceMuted};border:1px solid ${C.border};border-radius:12px;border-left:4px solid ${statusColor};overflow:hidden;">
          <tr>
            <td style="padding:20px 24px;">
              <p style="margin:0 0 6px;font-family:${FONT_MONO};font-size:11px;color:${C.inkSoft};font-weight:700;letter-spacing:2px;text-transform:uppercase;">Your pick</p>
              <p style="margin:0 0 12px;font-family:${FONT_DISPLAY};font-size:18px;font-weight:700;color:${C.ink};">${playerName}</p>
              <p style="margin:0;font-family:${FONT_STACK};font-size:14px;font-weight:700;color:${statusColor};">${statusLabel}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:0 40px 8px;">
        <p style="margin:0;font-family:${FONT_STACK};font-size:15px;color:${C.inkMuted};line-height:1.7;">${nextStepText}</p>
      </td>
    </tr>

    ${divider}

    ${emailCTA(groupUrl, 'View leaderboard &rarr;')}
  `;
  const html = emailWrapper(header, body, email);

  return sendWithDedup({ userId, groupId, round, emailType: 'round_result', to: email, subject, html });
}


// ─────────────────────────────────────────────────────────────────────────────
// 6. WITHDRAWAL NOTIFICATION — sent when a picked player withdraws before match
//    Uses sendWithDedup — dedup prevents duplicate sends.
// ─────────────────────────────────────────────────────────────────────────────

export async function sendWithdrawalEmail({ userId, groupId, round, email, displayName, withdrawnPlayer, replacementPlayer, groupName }) {
  const groupUrl = `${APP_URL}/group/${groupId}`;

  const subject = `${withdrawnPlayer} has withdrawn — re-pick now`;

  const header = emailHeader({
    eyebrow: 'Withdrawal Alert',
    title: 'Your picked player has withdrawn',
  });

  const replacementText = replacementPlayer
    ? `${replacementPlayer} has been added to the draw as their replacement.`
    : 'A replacement has been added to the draw.';

  const body = `
    <tr>
      <td style="padding:32px 40px 8px;">
        <p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;color:${C.inkMuted};line-height:1.7;">
          Hey <strong>${displayName}</strong>, <strong>${withdrawnPlayer}</strong> has withdrawn from the tournament.
        </p>
        <p style="margin:0 0 24px;font-family:${FONT_STACK};font-size:15px;color:${C.inkMuted};line-height:1.7;">
          ${replacementText} You've been unlocked to make a new pick for <strong>${round}</strong> before the deadline.
        </p>
      </td>
    </tr>

    <!-- Alert card -->
    <tr>
      <td style="padding:0 40px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.surfaceMuted};border:1px solid ${C.border};border-radius:12px;border-left:4px solid ${C.accent};overflow:hidden;">
          <tr>
            <td style="padding:20px 24px;">
              <p style="margin:0 0 6px;font-family:${FONT_MONO};font-size:11px;color:${C.inkSoft};font-weight:700;letter-spacing:2px;text-transform:uppercase;">Action required</p>
              <p style="margin:0 0 12px;font-family:${FONT_DISPLAY};font-size:15px;font-weight:700;color:${C.ink};">Make your new pick</p>
              <p style="margin:0;font-family:${FONT_STACK};font-size:13px;color:${C.inkMuted};line-height:1.6;">Log in to your pool and select a different player for ${round}. Pick soon — the deadline is approaching.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    ${divider}

    ${emailCTA(groupUrl, 'Make your new pick &rarr;')}
  `;
  const html = emailWrapper(header, body, email);

  return sendWithDedup({ userId, groupId, round, emailType: 'withdrawal_alert', to: email, subject, html });
}


// ─────────────────────────────────────────────────────────────────────────────
// 7. DRAW RELEASED — sent when tournament draw is published and picking opens
//    Uses sendWithDedup — dedup prevents duplicate sends.
// ─────────────────────────────────────────────────────────────────────────────

export async function sendDrawReleasedEmail({ userId, groupId, email, displayName, tournamentName, groupName }) {
  const groupUrl = `${APP_URL}/group/${groupId}`;

  const subject = `The ${tournamentName} draw is out — make your pick`;

  const header = emailHeader({
    eyebrow: 'Draw Released',
    title: `${tournamentName} is live`,
    subtitle: 'Time to make your first pick.',
  });

  const body = `
    <tr>
      <td style="padding:32px 40px 8px;">
        <p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;color:${C.inkMuted};line-height:1.7;">
          Hey <strong>${displayName}</strong>, the draw for <strong>${tournamentName}</strong> has been released. The pick window is now open in <strong>${groupName}</strong>.
        </p>
        <p style="margin:0 0 24px;font-family:${FONT_STACK};font-size:15px;color:${C.inkMuted};line-height:1.7;">
          Log in and select your Round 1 pick. Remember, you can only pick each player once across the entire tournament, so choose wisely.
        </p>
      </td>
    </tr>

    <!-- Info card -->
    <tr>
      <td style="padding:0 40px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.successSoft};border:1px solid ${C.border};border-radius:12px;border-left:4px solid ${C.success};overflow:hidden;">
          <tr>
            <td style="padding:20px 24px;">
              <p style="margin:0 0 6px;font-family:${FONT_MONO};font-size:11px;color:${C.inkSoft};font-weight:700;letter-spacing:2px;text-transform:uppercase;">Get started</p>
              <p style="margin:0 0 12px;font-family:${FONT_DISPLAY};font-size:15px;font-weight:700;color:${C.ink};">Make your Round 1 pick</p>
              <p style="margin:0;font-family:${FONT_STACK};font-size:13px;color:${C.inkMuted};line-height:1.6;">The pick window is open now. Head to your pool and select the match winner you're backing for Round 1.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    ${divider}

    ${emailCTA(groupUrl, 'View the draw &rarr;')}
  `;
  const html = emailWrapper(header, body, email);

  return sendWithDedup({ userId, groupId, round: 'R1', emailType: 'draw_released', to: email, subject, html });
}

// ── Support request notification ─────────────────────────────────────────────
// Sends directly via Brevo (NOT queued for approval — support requests need
// immediate delivery to finalservivor@gmail.com).
export async function sendSupportEmail({ category, subject, message, userContext }) {
  if (!EMAIL_CONFIGURED) {
    console.warn('[support-email] Brevo not configured — skipping send');
    return;
  }

  const userRows = userContext ? `
    <tr>
      <td style="padding:6px 0;font-family:${FONT_STACK};font-size:13px;color:${C.inkMuted};width:120px;vertical-align:top;">Name</td>
      <td style="padding:6px 0;font-family:${FONT_STACK};font-size:13px;color:${C.ink};">${userContext.displayName}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-family:${FONT_STACK};font-size:13px;color:${C.inkMuted};vertical-align:top;">Email</td>
      <td style="padding:6px 0;font-family:${FONT_STACK};font-size:13px;color:${C.ink};"><a href="mailto:${userContext.email}" style="color:${C.primary};">${userContext.email}</a></td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-family:${FONT_STACK};font-size:13px;color:${C.inkMuted};vertical-align:top;">Groups</td>
      <td style="padding:6px 0;font-family:${FONT_STACK};font-size:13px;color:${C.ink};">${userContext.groups}</td>
    </tr>
  ` : `
    <tr>
      <td colspan="2" style="padding:6px 0;font-family:${FONT_STACK};font-size:13px;color:${C.inkMuted};font-style:italic;">Not logged in</td>
    </tr>
  `;

  const header = emailHeader({
    eyebrow: 'SUPPORT',
    title: 'New support request',
    subtitle: category,
  });

  const body = `
    ${sectionEyebrow('Subject')}
    <tr>
      <td style="padding:0 40px 24px;">
        <p style="margin:0;font-family:${FONT_DISPLAY};font-size:18px;font-weight:700;color:${C.ink};">${subject}</p>
      </td>
    </tr>

    ${divider}

    ${sectionEyebrow('Message')}
    <tr>
      <td style="padding:0 40px 24px;">
        <div style="margin:0;font-family:${FONT_STACK};font-size:14px;color:${C.ink};line-height:1.6;white-space:pre-wrap;">${message}</div>
      </td>
    </tr>

    ${divider}

    ${sectionEyebrow('User details')}
    <tr>
      <td style="padding:0 40px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
          ${userRows}
        </table>
      </td>
    </tr>

    ${userContext?.email ? `
    <tr>
      <td style="padding:0 40px 32px;text-align:center;">
        <a href="mailto:${userContext.email}" style="display:inline-block;padding:12px 32px;background:${C.gold};color:${C.goldInk};font-family:${FONT_STACK};font-size:14px;font-weight:700;text-decoration:none;border-radius:999px;">Reply to ${userContext.displayName} &rarr;</a>
      </td>
    </tr>
    ` : ''}
  `;

  const html = emailWrapper(header, body, 'finalservivor@gmail.com');

  await sendViaBrevo({
    to: 'finalservivor@gmail.com',
    subject: `[Support] ${category}: ${subject}`,
    html,
  });
}

