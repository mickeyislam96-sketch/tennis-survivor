// ── Startup check ────────────────────────────────────────────────────────────
const EMAIL_CONFIGURED = !!process.env.BREVO_API_KEY;
if (!EMAIL_CONFIGURED) {
  console.warn('⚠️  EMAIL NOT CONFIGURED: BREVO_API_KEY env var is missing.');
} else {
  console.log('✅ Email configured — Brevo HTTP API');
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
// Shared layout helpers
// ─────────────────────────────────────────────────────────────────────────────

const emailWrapper = (headerContent, bodyContent, footerEmail) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f0f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f4f0;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          ${headerContent}
          ${bodyContent}

          <!-- Footer -->
          <tr>
            <td style="background:#0f3d20;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;color:rgba(255,255,255,0.7);font-weight:600;letter-spacing:0.5px;">FINAL SERVE-IVOR</p>
              <p style="margin:0 0 10px;font-size:12px;color:rgba(255,255,255,0.4);">A game of skill &middot; ATP &middot; 2026</p>
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.3);">This email was sent to ${footerEmail}</p>
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
        <tr><td style="border-top:1px solid #f0f0f0;font-size:0;line-height:0;">&nbsp;</td></tr>
      </table>
    </td>
  </tr>
`;


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
  const header = `
    <tr>
      <td style="background:linear-gradient(135deg,#0a2e14 0%,#14532d 40%,#16a34a 100%);padding:40px 40px 32px;text-align:center;">
        <p style="margin:0 0 14px;display:inline-block;padding:5px 14px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);border-radius:20px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#ffffff;">Final Serve-ivor</p>
        <h1 style="margin:0;font-size:30px;font-weight:700;color:#ffffff;line-height:1.2;">Welcome aboard,&nbsp;${displayName}.</h1>
        <p style="margin:10px 0 0;font-size:15px;color:rgba(255,255,255,0.7);">Your account is set up and ready to go.</p>
      </td>
    </tr>
  `;

  const body = `
    <tr>
      <td style="padding:36px 40px 8px;">
        <p style="margin:0;font-size:15px;color:#444;line-height:1.7;">
          Good to have you. Final Serve-ivor is a last-man-standing game played across ATP tournaments. Every round, every player in your group picks a match winner. Pick correctly and you survive. Pick wrong and you're out.
        </p>
      </td>
    </tr>

    <!-- How it works heading -->
    <tr>
      <td style="padding:28px 40px 16px;">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#999;">How it works</p>
      </td>
    </tr>

    <!-- Step 1 -->
    <tr>
      <td style="padding:0 40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fdf4;border-radius:8px;border-left:4px solid #16a34a;">
          <tr>
            <td style="padding:18px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:32px;vertical-align:top;">
                    <div style="width:24px;height:24px;background:#dcfce7;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#16a34a;">1</div>
                  </td>
                  <td style="padding-left:12px;vertical-align:top;">
                    <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#0f172a;">Join a tournament group</p>
                    <p style="margin:0;font-size:13px;color:#666;line-height:1.6;">Use an invite code to join a group for an upcoming ATP tournament. Each group has its own entry and prize pool.</p>
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
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fdf4;border-radius:8px;border-left:4px solid #16a34a;">
          <tr>
            <td style="padding:18px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:32px;vertical-align:top;">
                    <div style="width:24px;height:24px;background:#dcfce7;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#16a34a;">2</div>
                  </td>
                  <td style="padding-left:12px;vertical-align:top;">
                    <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#0f172a;">Pick a winner each round</p>
                    <p style="margin:0;font-size:13px;color:#666;line-height:1.6;">Once the draw is released, log in and select one match winner per round. Pick correctly and you move on. Pick wrong and you're eliminated.</p>
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
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fdf4;border-radius:8px;border-left:4px solid #15803d;">
          <tr>
            <td style="padding:18px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:32px;vertical-align:top;">
                    <div style="width:24px;height:24px;background:#16a34a;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#ffffff;">3</div>
                  </td>
                  <td style="padding-left:12px;vertical-align:top;">
                    <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#0f172a;">Last one standing wins</p>
                    <p style="margin:0;font-size:13px;color:#666;line-height:1.6;">You can only pick each player once across the whole tournament, so don't burn your big names too early. Outlast everyone else and take the prize pool.</p>
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
      <td style="padding:28px 40px 36px;text-align:center;">
        <p style="margin:0 0 20px;font-size:14px;color:#777;line-height:1.6;">Ready to play? Find a tournament group using your invite code, or check what's running.</p>
        <a href="${APP_URL}" style="display:inline-block;padding:14px 36px;background:#16a34a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.5px;">Open Final Serve-ivor &rarr;</a>
      </td>
    </tr>
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
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="font-size:13px;color:#999;width:40%;">Prize pool</td>
              <td style="font-size:13px;font-weight:700;color:#16a34a;text-align:right;">${fmtGBP(prizePoolCents)}</td>
            </tr>
          </table>
        </td>
      </tr>`
    : '';

  const timelineDrawRow = drawAvailable
    ? `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="width:28px;font-size:16px;vertical-align:middle;">✅</td>
              <td style="padding-left:10px;vertical-align:middle;">
                <p style="margin:0;font-size:13px;font-weight:700;color:#16a34a;">Draw is live</p>
                <p style="margin:2px 0 0;font-size:12px;color:#888;">Log in and make your Round 1 pick now.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="width:28px;font-size:16px;vertical-align:middle;">📋</td>
              <td style="padding-left:10px;vertical-align:middle;">
                <p style="margin:0;font-size:13px;font-weight:700;color:#0f172a;">Draw released</p>
                <p style="margin:2px 0 0;font-size:12px;color:#888;">${drawDate}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;

  const header = `
    <tr>
      <td style="background:linear-gradient(135deg,#0a2e14 0%,#14532d 40%,#16a34a 100%);padding:40px 40px 32px;text-align:center;">
        <p style="margin:0 0 14px;display:inline-block;padding:5px 14px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);border-radius:20px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#ffffff;">${tournamentName}</p>
        <h1 style="margin:0;font-size:32px;font-weight:700;color:#ffffff;line-height:1.2;">You're in.</h1>
        <p style="margin:10px 0 0;font-size:15px;color:rgba(255,255,255,0.7);">Your entry has been confirmed.</p>
      </td>
    </tr>
  `;

  const body = `
    <!-- Greeting -->
    <tr>
      <td style="padding:32px 40px 8px;">
        <p style="margin:0;font-size:15px;color:#444;line-height:1.7;">
          Hey <strong>${displayName}</strong>, you're officially entered into the <strong>${tournamentName}</strong> pool. Here's everything you need to know.
        </p>
      </td>
    </tr>

    <!-- Entry confirmation card -->
    <tr>
      <td style="padding:20px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;">
          <!-- Card header -->
          <tr>
            <td style="background:#0f3d20;padding:12px 20px;">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4ade80;">Your entry</p>
            </td>
          </tr>
          <!-- Card body -->
          <tr>
            <td style="padding:4px 20px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="font-size:13px;color:#999;width:40%;">Pool</td>
                        <td style="font-size:13px;font-weight:600;color:#222;text-align:right;">${groupName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="font-size:13px;color:#999;width:40%;">Tournament</td>
                        <td style="font-size:13px;font-weight:600;color:#222;text-align:right;">${tournamentName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="font-size:13px;color:#999;width:40%;">Level</td>
                        <td style="font-size:13px;font-weight:600;color:#222;text-align:right;">${tourLevel}</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:10px 0;${prizePoolCents > 0 ? 'border-bottom:1px solid #f0f0f0;' : ''}">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="font-size:13px;color:#999;width:40%;">Location</td>
                        <td style="font-size:13px;font-weight:600;color:#222;text-align:right;">${location}</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                ${prizeRow}

              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Timeline heading -->
    <tr>
      <td style="padding:28px 40px 14px;">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#999;">What's next</p>
      </td>
    </tr>

    <!-- Timeline card -->
    <tr>
      <td style="padding:0 40px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border:1px solid #e8e8e8;border-radius:8px;">
          <tr>
            <td style="padding:4px 20px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

                ${timelineDrawRow}

                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="width:28px;font-size:16px;vertical-align:middle;">🎾</td>
                        <td style="padding-left:10px;vertical-align:middle;">
                          <p style="margin:0;font-size:13px;font-weight:700;color:#0f172a;">Tournament begins</p>
                          <p style="margin:2px 0 0;font-size:12px;color:#888;">${startDate}</p>
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
                          <p style="margin:0;font-size:13px;font-weight:700;color:#0f172a;">Last one standing wins</p>
                          <p style="margin:2px 0 0;font-size:12px;color:#888;">Survive every round and take the pot.</p>
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

    <!-- Quick rules reminder -->
    <tr>
      <td style="padding:24px 40px 8px;">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#999;">Quick reminder</p>
      </td>
    </tr>
    <tr>
      <td style="padding:10px 40px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#555;line-height:1.6;">
              &#x2023;&nbsp; Pick one match winner per round. Get it wrong and you're out.
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#555;line-height:1.6;">
              &#x2023;&nbsp; You can only pick each player <strong>once</strong> across the whole tournament.
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#555;line-height:1.6;">
              &#x2023;&nbsp; Run out of valid picks and you're eliminated — don't burn your big names too soon.
            </td>
          </tr>
        </table>
      </td>
    </tr>

    ${divider}

    <!-- CTA -->
    <tr>
      <td style="padding:28px 40px 36px;text-align:center;">
        <p style="margin:0 0 20px;font-size:14px;color:#777;line-height:1.6;">
          ${drawAvailable
            ? 'The draw is live — head in and make your first pick.'
            : `No action needed right now. We'll be in touch once the draw drops on ${drawDate}.`
          }
        </p>
        <a href="${groupUrl}" style="display:inline-block;padding:14px 36px;background:#16a34a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.5px;">${drawAvailable ? 'Make your first pick' : "See who's joined"} &rarr;</a>
      </td>
    </tr>
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
  const header = `
    <tr>
      <td style="background:linear-gradient(135deg,#0a2e14 0%,#14532d 40%,#16a34a 100%);padding:40px 40px 32px;text-align:center;">
        <p style="margin:0 0 14px;display:inline-block;padding:5px 14px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);border-radius:20px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#ffffff;">Final Serve-ivor</p>
        <h1 style="margin:0;font-size:30px;font-weight:700;color:#ffffff;line-height:1.2;">Reset your password</h1>
      </td>
    </tr>
  `;

  const body = `
    <tr>
      <td style="padding:36px 40px 24px;">
        <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.7;">
          Hey <strong>${displayName}</strong>,
        </p>
        <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.7;">
          We received a request to reset your password. Click the button below — this link is valid for <strong>1 hour</strong>.
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
          <tr>
            <td align="center">
              <a href="${resetUrl}" style="display:inline-block;padding:14px 36px;background:#16a34a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:6px;letter-spacing:0.5px;">Reset my password</a>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border-left:4px solid #16a34a;border-radius:4px;margin-bottom:24px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0;font-size:13px;color:#666;line-height:1.6;">
                If you didn't request this, you can safely ignore this email. Your password won't change unless you follow the link above.
              </p>
            </td>
          </tr>
        </table>

        <p style="margin:0;font-size:12px;color:#aaa;line-height:1.6;">
          Button not working? Copy and paste this link into your browser:<br/>
          <a href="${resetUrl}" style="color:#16a34a;word-break:break-all;">${resetUrl}</a>
        </p>
      </td>
    </tr>
  `;

  return emailWrapper(header, body, email);
};


// ─────────────────────────────────────────────────────────────────────────────
// Shared constants for tournament emails
// ─────────────────────────────────────────────────────────────────────────────

const ROUND_LABELS = { R1: 'Round 1', R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-finals', SF: 'Semi-finals', F: 'Final' };
const ROUNDS_ORDER = ['R1', 'R32', 'R16', 'QF', 'SF', 'F'];


// ─────────────────────────────────────────────────────────────────────────────
// 4. PICK REMINDER EMAIL — fires before pick window closes
// ─────────────────────────────────────────────────────────────────────────────

export const sendPickReminderEmail = async ({
  email, displayName, groupId, tournamentName, round, roundLabel,
}) => {
  if (!EMAIL_CONFIGURED) {
    console.warn(`[email] Skipping pick reminder to ${email} — email not configured.`);
    return;
  }
  const subject = `You haven't picked yet — ${roundLabel} closes soon · Final Serve-ivor`;
  try {
    await sendViaBrevo({ to: email, subject, html: buildPickReminderHTML({
      email, displayName, groupId, tournamentName, round, roundLabel,
    }) });
    console.log(`✅ Pick reminder sent to ${email} for ${round}`);
  } catch (err) {
    console.error(`❌ Failed to send pick reminder to ${email}:`, err.message);
  }
};

const buildPickReminderHTML = ({ email, displayName, groupId, tournamentName, round, roundLabel }) => {
  const pickUrl = `${APP_URL}/group/${groupId}/pick`;
  const header = `
    <tr>
      <td style="background:linear-gradient(135deg,#7c2d12 0%,#c2410c 40%,#f97316 100%);padding:40px 40px 32px;text-align:center;">
        <p style="margin:0 0 14px;display:inline-block;padding:5px 14px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:20px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#ffffff;">&#9201; Time running out</p>
        <h1 style="margin:0;font-size:30px;font-weight:700;color:#ffffff;line-height:1.2;">You haven't picked yet.</h1>
        <p style="margin:10px 0 0;font-size:15px;color:rgba(255,255,255,0.8);">${roundLabel} is closing soon. Miss it and you're out.</p>
      </td>
    </tr>`;
  const body = `
    <tr>
      <td style="padding:32px 40px 8px;">
        <p style="margin:0;font-size:15px;color:#444;line-height:1.7;">
          Hey <strong>${displayName}</strong>, the ${roundLabel} pick window for <strong>${tournamentName}</strong> is closing soon and you still haven't submitted a pick.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff7ed;border:1px solid #fed7aa;border-left:4px solid #f97316;border-radius:8px;">
          <tr><td style="padding:18px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="width:28px;font-size:18px;vertical-align:top;">&#9888;&#65039;</td>
              <td style="padding-left:10px;vertical-align:top;">
                <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#9a3412;">No pick = automatic elimination</p>
                <p style="margin:0;font-size:13px;color:#c2410c;line-height:1.6;">If you don't submit a pick before the deadline, you'll be eliminated from the pool. This can't be undone.</p>
              </td>
            </tr></table>
          </td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:32px 40px 36px;text-align:center;">
        <a href="${pickUrl}" style="display:inline-block;padding:16px 44px;background:#f97316;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.5px;">Make your ${round} pick now &rarr;</a>
      </td>
    </tr>`;
  return emailWrapper(header, body, email);
};


// ─────────────────────────────────────────────────────────────────────────────
// 5. ROUND SURVIVAL EMAIL — fires after round completes, for survivors
// ─────────────────────────────────────────────────────────────────────────────

export const sendSurvivalEmail = async ({
  email, displayName, groupId, tournamentName,
  round, roundLabel, pickedPlayerName, matchScore,
  playersRemaining, totalPlayers, pickHistory,
}) => {
  if (!EMAIL_CONFIGURED) {
    console.warn(`[email] Skipping survival email to ${email} — email not configured.`);
    return;
  }
  const subject = `You survived ${roundLabel} — ${tournamentName} · Final Serve-ivor`;
  try {
    await sendViaBrevo({ to: email, subject, html: buildSurvivalHTML({
      email, displayName, groupId, tournamentName, round, roundLabel,
      pickedPlayerName, matchScore, playersRemaining, totalPlayers, pickHistory,
    }) });
    console.log(`✅ Survival email sent to ${email} for ${round}`);
  } catch (err) {
    console.error(`❌ Failed to send survival email to ${email}:`, err.message);
  }
};

const buildSurvivalHTML = ({
  email, displayName, groupId, tournamentName, round, roundLabel,
  pickedPlayerName, matchScore, playersRemaining, totalPlayers, pickHistory,
}) => {
  const pickUrl = `${APP_URL}/group/${groupId}/pick`;
  const roundsSurvived = (pickHistory || []).length;
  const historyRows = (pickHistory || []).map((p, i) => {
    const isLast = i === pickHistory.length - 1;
    return `<tr>
      <td style="padding:10px 0;${isLast ? '' : 'border-bottom:1px solid #f0f0f0;'}font-size:13px;color:#999;width:30%;">${ROUND_LABELS[p.round] || p.round}</td>
      <td style="padding:10px 0;${isLast ? '' : 'border-bottom:1px solid #f0f0f0;'}font-size:13px;font-weight:600;color:#16a34a;text-align:right;">${p.playerName} &#10003;</td>
    </tr>`;
  }).join('');

  const header = `
    <tr>
      <td style="background:linear-gradient(135deg,#0a2e14 0%,#14532d 40%,#16a34a 100%);padding:40px 40px 32px;text-align:center;">
        <p style="margin:0 0 14px;display:inline-block;padding:5px 14px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);border-radius:20px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#ffffff;">${tournamentName}</p>
        <h1 style="margin:0;font-size:32px;font-weight:700;color:#ffffff;line-height:1.2;">You survived ${roundLabel}. &#10003;</h1>
        <p style="margin:10px 0 0;font-size:15px;color:rgba(255,255,255,0.7);">Your pick came through.</p>
      </td>
    </tr>`;
  const body = `
    <tr>
      <td style="padding:32px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;overflow:hidden;">
          <tr><td style="background:#dcfce7;padding:12px 20px;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#16a34a;">Your ${round} pick</p>
          </td></tr>
          <tr><td style="padding:20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="vertical-align:middle;">
                <p style="margin:0;font-size:18px;font-weight:700;color:#0f172a;">${pickedPlayerName}</p>
                ${matchScore ? `<p style="margin:4px 0 0;font-size:13px;color:#666;">${matchScore}</p>` : ''}
              </td>
              <td style="width:48px;text-align:right;vertical-align:middle;">
                <div style="width:40px;height:40px;background:#16a34a;border-radius:50%;text-align:center;line-height:40px;font-size:20px;color:#fff;">&#10003;</div>
              </td>
            </tr></table>
          </td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="width:50%;padding:12px 0;text-align:center;border-right:1px solid #f0f0f0;">
            <p style="margin:0;font-size:24px;font-weight:700;color:#16a34a;">${playersRemaining}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#999;font-weight:600;letter-spacing:0.5px;">PLAYERS LEFT</p>
          </td>
          <td style="width:50%;padding:12px 0;text-align:center;">
            <p style="margin:0;font-size:24px;font-weight:700;color:#0f172a;">${roundsSurvived}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#999;font-weight:600;letter-spacing:0.5px;">ROUNDS SURVIVED</p>
          </td>
        </tr></table>
      </td>
    </tr>
    ${pickHistory && pickHistory.length > 0 ? `
    <tr>
      <td style="padding:28px 40px 0;">
        <p style="margin:0 0 14px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#999;">Players used</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border:1px solid #e8e8e8;border-radius:8px;">
          <tr><td style="padding:4px 20px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${historyRows}</table>
          </td></tr>
        </table>
      </td>
    </tr>` : ''}
    ${divider}
    <tr>
      <td style="padding:24px 40px 8px;">
        <p style="margin:0;font-size:15px;color:#444;line-height:1.7;">The next pick window is open. Head in and make your pick before it closes.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 40px 36px;text-align:center;">
        <a href="${pickUrl}" style="display:inline-block;padding:14px 36px;background:#16a34a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.5px;">Make your next pick &rarr;</a>
      </td>
    </tr>`;
  return emailWrapper(header, body, email);
};


// ─────────────────────────────────────────────────────────────────────────────
// 6. ELIMINATION EMAIL — fires after round completes, for eliminated players
// ─────────────────────────────────────────────────────────────────────────────

export const sendEliminationEmail = async ({
  email, displayName, groupId, tournamentName,
  round, roundLabel, pickedPlayerName, matchScore,
  finishingPosition, totalPlayers, playersRemaining,
}) => {
  if (!EMAIL_CONFIGURED) {
    console.warn(`[email] Skipping elimination email to ${email} — email not configured.`);
    return;
  }
  const subject = `Tough break — you're out of ${tournamentName} · Final Serve-ivor`;
  try {
    await sendViaBrevo({ to: email, subject, html: buildEliminationHTML({
      email, displayName, groupId, tournamentName, round, roundLabel,
      pickedPlayerName, matchScore, finishingPosition, totalPlayers, playersRemaining,
    }) });
    console.log(`✅ Elimination email sent to ${email} for ${round}`);
  } catch (err) {
    console.error(`❌ Failed to send elimination email to ${email}:`, err.message);
  }
};

const buildEliminationHTML = ({
  email, displayName, groupId, tournamentName, round, roundLabel,
  pickedPlayerName, matchScore, finishingPosition, totalPlayers, playersRemaining,
}) => {
  const lbUrl = `${APP_URL}/group/${groupId}/leaderboard`;
  const roundsSurvived = ROUNDS_ORDER.indexOf(round);
  const header = `
    <tr>
      <td style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 40%,#4f46e5 100%);padding:40px 40px 32px;text-align:center;">
        <p style="margin:0 0 14px;display:inline-block;padding:5px 14px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);border-radius:20px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#ffffff;">${tournamentName}</p>
        <h1 style="margin:0;font-size:30px;font-weight:700;color:#ffffff;line-height:1.2;">Tough break.</h1>
        <p style="margin:10px 0 0;font-size:15px;color:rgba(255,255,255,0.7);">Your ${roundLabel} pick didn't come through.</p>
      </td>
    </tr>`;
  const body = `
    <tr>
      <td style="padding:32px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;overflow:hidden;">
          <tr><td style="background:#fee2e2;padding:12px 20px;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#dc2626;">Your ${round} pick</p>
          </td></tr>
          <tr><td style="padding:20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="vertical-align:middle;">
                <p style="margin:0;font-size:18px;font-weight:700;color:#0f172a;">${pickedPlayerName || 'No pick submitted'}</p>
                ${matchScore ? `<p style="margin:4px 0 0;font-size:13px;color:#666;">${matchScore}</p>` : ''}
              </td>
              <td style="width:48px;text-align:right;vertical-align:middle;">
                <div style="width:40px;height:40px;background:#dc2626;border-radius:50%;text-align:center;line-height:40px;font-size:20px;color:#fff;">&#10007;</div>
              </td>
            </tr></table>
          </td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="width:33%;padding:12px 0;text-align:center;border-right:1px solid #f0f0f0;">
            <p style="margin:0;font-size:24px;font-weight:700;color:#0f172a;">${roundsSurvived}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#999;font-weight:600;letter-spacing:0.5px;">${roundsSurvived === 1 ? 'ROUND SURVIVED' : 'ROUNDS SURVIVED'}</p>
          </td>
          ${finishingPosition ? `<td style="width:33%;padding:12px 0;text-align:center;border-right:1px solid #f0f0f0;">
            <p style="margin:0;font-size:24px;font-weight:700;color:#0f172a;">${finishingPosition}<span style="font-size:14px;color:#999;">/${totalPlayers}</span></p>
            <p style="margin:4px 0 0;font-size:11px;color:#999;font-weight:600;letter-spacing:0.5px;">FINISHING POSITION</p>
          </td>` : ''}
          <td style="padding:12px 0;text-align:center;">
            <p style="margin:0;font-size:24px;font-weight:700;color:#16a34a;">${playersRemaining}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#999;font-weight:600;letter-spacing:0.5px;">STILL ALIVE</p>
          </td>
        </tr></table>
      </td>
    </tr>
    ${divider}
    <tr>
      <td style="padding:24px 40px 8px;">
        <p style="margin:0;font-size:15px;color:#444;line-height:1.7;">You're out of the ${tournamentName} pool, but you can still follow the action. Check in to see who survives and who falls.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 40px 36px;text-align:center;">
        <a href="${lbUrl}" style="display:inline-block;padding:14px 36px;background:#4f46e5;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.5px;">View the leaderboard &rarr;</a>
      </td>
    </tr>`;
  return emailWrapper(header, body, email);
};


// ─────────────────────────────────────────────────────────────────────────────
// 7. WINNER EMAIL — fires when one player is left standing
// ─────────────────────────────────────────────────────────────────────────────

export const sendWinnerEmail = async ({
  email, displayName, groupId, tournamentName, pickHistory, totalPlayers,
}) => {
  if (!EMAIL_CONFIGURED) {
    console.warn(`[email] Skipping winner email to ${email} — email not configured.`);
    return;
  }
  const subject = `You won ${tournamentName}! — Final Serve-ivor`;
  try {
    await sendViaBrevo({ to: email, subject, html: buildWinnerHTML({
      email, displayName, groupId, tournamentName, pickHistory, totalPlayers,
    }) });
    console.log(`✅ Winner email sent to ${email}`);
  } catch (err) {
    console.error(`❌ Failed to send winner email to ${email}:`, err.message);
  }
};

const buildWinnerHTML = ({ email, displayName, groupId, tournamentName, pickHistory, totalPlayers }) => {
  const lbUrl = `${APP_URL}/group/${groupId}/leaderboard`;
  const roundsSurvived = (pickHistory || []).length;
  const historyRows = (pickHistory || []).map((p, i) => {
    const isLast = i === pickHistory.length - 1;
    return `<tr>
      <td style="padding:10px 0;${isLast ? '' : 'border-bottom:1px solid #fde68a;'}font-size:13px;color:#92400e;width:30%;">${ROUND_LABELS[p.round] || p.round}</td>
      <td style="padding:10px 0;${isLast ? '' : 'border-bottom:1px solid #fde68a;'}font-size:13px;font-weight:600;color:#16a34a;text-align:right;">${p.playerName} &#10003;</td>
    </tr>`;
  }).join('');

  const header = `
    <tr>
      <td style="background:linear-gradient(135deg,#713f12 0%,#a16207 30%,#eab308 70%,#facc15 100%);padding:48px 40px 36px;text-align:center;">
        <p style="margin:0 0 8px;font-size:48px;">&#127942;</p>
        <p style="margin:0 0 14px;display:inline-block;padding:5px 14px;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.35);border-radius:20px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#ffffff;">${tournamentName}</p>
        <h1 style="margin:0;font-size:34px;font-weight:700;color:#ffffff;line-height:1.2;">You won.</h1>
        <p style="margin:10px 0 0;font-size:16px;color:rgba(255,255,255,0.85);font-weight:500;">Last one standing. The pool is yours.</p>
      </td>
    </tr>`;
  const body = `
    <tr>
      <td style="padding:36px 40px 8px;">
        <p style="margin:0;font-size:15px;color:#444;line-height:1.7;">
          <strong>${displayName}</strong>, you've outlasted every other player in the ${tournamentName} pool. ${totalPlayers} players entered. You're the only one left.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbeb;border:2px solid #fcd34d;border-radius:10px;overflow:hidden;">
          <tr><td style="background:linear-gradient(90deg,#fef3c7,#fde68a);padding:14px 20px;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#92400e;">Champion</p>
          </td></tr>
          <tr><td style="padding:20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="width:50%;padding:12px 0;text-align:center;border-right:1px solid #fde68a;">
                <p style="margin:0;font-size:28px;font-weight:800;color:#92400e;">${roundsSurvived}</p>
                <p style="margin:4px 0 0;font-size:11px;color:#a16207;font-weight:600;letter-spacing:0.5px;">ROUNDS SURVIVED</p>
              </td>
              <td style="width:50%;padding:12px 0;text-align:center;">
                <p style="margin:0;font-size:28px;font-weight:800;color:#92400e;">${roundsSurvived}/${roundsSurvived}</p>
                <p style="margin:4px 0 0;font-size:11px;color:#a16207;font-weight:600;letter-spacing:0.5px;">PICKS CORRECT</p>
              </td>
            </tr></table>
          </td></tr>
        </table>
      </td>
    </tr>
    ${pickHistory && pickHistory.length > 0 ? `
    <tr>
      <td style="padding:28px 40px 0;">
        <p style="margin:0 0 14px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#999;">Your winning picks</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
          <tr><td style="padding:4px 20px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${historyRows}</table>
          </td></tr>
        </table>
      </td>
    </tr>` : ''}
    ${divider}
    <tr>
      <td style="padding:28px 40px 36px;text-align:center;">
        <p style="margin:0 0 20px;font-size:14px;color:#777;line-height:1.6;">View the final leaderboard and your complete pick history.</p>
        <a href="${lbUrl}" style="display:inline-block;padding:14px 36px;background:#eab308;color:#422006;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.5px;">See the final standings &rarr;</a>
      </td>
    </tr>`;
  return emailWrapper(header, body, email);
};
