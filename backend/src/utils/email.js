import nodemailer from 'nodemailer';

// ── Startup check — log clearly if email is not configured ──────────────────
const EMAIL_CONFIGURED = !!(process.env.GMAIL_USER && process.env.BREVO_SMTP_KEY);
if (!EMAIL_CONFIGURED) {
  console.warn(
    '⚠️  EMAIL NOT CONFIGURED: GMAIL_USER and/or BREVO_SMTP_KEY env vars are missing. ' +
    'All emails will be silently skipped until these are set on Railway.',
  );
} else {
  console.log(`✅ Email configured — sending from ${process.env.GMAIL_USER} via Brevo`);
}

// Brevo SMTP — reliable transactional email, no IPv6 issues
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.BREVO_SMTP_KEY,
  },
  connectionTimeout: 10000,
  greetingTimeout:   10000,
  socketTimeout:     15000,
});

const APP_URL = process.env.FRONTEND_URL || 'https://final-serve-ivor.vercel.app';

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
<body style="margin:0;padding:0;background-color:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f0f0;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          ${headerContent}
          ${bodyContent}

          <!-- Footer -->
          <tr>
            <td style="background:#f7f7f7;border-top:1px solid #ebebeb;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;color:#999;font-weight:600;letter-spacing:0.5px;">FINAL SERVE-IVOR</p>
              <p style="margin:0 0 10px;font-size:12px;color:#bbb;">ATP Last Man Standing</p>
              <p style="margin:0;font-size:11px;color:#ccc;">This email was sent to ${footerEmail}</p>
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
    from: `"Final Serve-ivor" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `Welcome to Final Serve-ivor, ${displayName} 🎾`,
    html: buildWelcomeHTML({ email, displayName }),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent to ${email}`);
  } catch (err) {
    console.error(`❌ Failed to send welcome email to ${email}:`, err.message);
    // Non-fatal — don't throw
  }
};

const buildWelcomeHTML = ({ email, displayName }) => {
  const header = `
    <tr>
      <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:40px 40px 32px;text-align:center;">
        <p style="margin:0 0 14px;display:inline-block;padding:5px 14px;background:rgba(232,184,75,0.15);border:1px solid rgba(232,184,75,0.4);border-radius:20px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#e8b84b;">Final Serve-ivor</p>
        <h1 style="margin:0;font-size:30px;font-weight:700;color:#ffffff;line-height:1.2;">Welcome aboard,&nbsp;${displayName}.</h1>
        <p style="margin:10px 0 0;font-size:15px;color:rgba(255,255,255,0.6);">Your account is set up and ready to go.</p>
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
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border-radius:8px;border-left:4px solid #e8b84b;">
          <tr>
            <td style="padding:18px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:32px;vertical-align:top;">
                    <div style="width:24px;height:24px;background:#e8b84b;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#1a1a2e;">1</div>
                  </td>
                  <td style="padding-left:12px;vertical-align:top;">
                    <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1a1a2e;">Join a tournament group</p>
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
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border-radius:8px;border-left:4px solid #e8b84b;">
          <tr>
            <td style="padding:18px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:32px;vertical-align:top;">
                    <div style="width:24px;height:24px;background:#e8b84b;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#1a1a2e;">2</div>
                  </td>
                  <td style="padding-left:12px;vertical-align:top;">
                    <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1a1a2e;">Pick a winner each round</p>
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
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border-radius:8px;border-left:4px solid #16a34a;">
          <tr>
            <td style="padding:18px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:32px;vertical-align:top;">
                    <div style="width:24px;height:24px;background:#16a34a;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#ffffff;">3</div>
                  </td>
                  <td style="padding-left:12px;vertical-align:top;">
                    <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1a1a2e;">Last one standing wins</p>
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
        <a href="${APP_URL}" style="display:inline-block;padding:14px 36px;background:#1a1a2e;color:#e8b84b;font-size:14px;font-weight:700;text-decoration:none;border-radius:6px;letter-spacing:0.5px;">Open Final Serve-ivor &rarr;</a>
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
    from: `"Final Serve-ivor" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `You're in — ${tournamentName} · Final Serve-ivor`,
    html: buildTournamentJoinHTML({
      email, displayName, groupId, groupName,
      tournamentName, tourLevel, location,
      drawDate, startDate, drawAvailable, prizePoolCents,
    }),
  };

  try {
    await transporter.sendMail(mailOptions);
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
                <p style="margin:0;font-size:13px;font-weight:700;color:#1a1a2e;">Draw released</p>
                <p style="margin:2px 0 0;font-size:12px;color:#888;">${drawDate}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;

  const header = `
    <tr>
      <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:40px 40px 32px;text-align:center;">
        <p style="margin:0 0 14px;display:inline-block;padding:5px 14px;background:rgba(232,184,75,0.15);border:1px solid rgba(232,184,75,0.4);border-radius:20px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#e8b84b;">${tournamentName}</p>
        <h1 style="margin:0;font-size:32px;font-weight:700;color:#ffffff;line-height:1.2;">You're in.</h1>
        <p style="margin:10px 0 0;font-size:15px;color:rgba(255,255,255,0.6);">Your entry has been confirmed.</p>
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
            <td style="background:#1a1a2e;padding:12px 20px;">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#e8b84b;">Your entry</p>
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
                        <td style="font-size:13px;color:#999;width:40%;">Group</td>
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
                          <p style="margin:0;font-size:13px;font-weight:700;color:#1a1a2e;">Tournament begins</p>
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
                          <p style="margin:0;font-size:13px;font-weight:700;color:#1a1a2e;">Last one standing wins</p>
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
        <a href="${groupUrl}" style="display:inline-block;padding:14px 36px;background:#1a1a2e;color:#e8b84b;font-size:14px;font-weight:700;text-decoration:none;border-radius:6px;letter-spacing:0.5px;">View your group &rarr;</a>
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
    const msg = 'Email service not configured — GMAIL_USER and BREVO_SMTP_KEY must be set on Railway.';
    console.warn(`[email] ${msg}`);
    throw new Error(msg);
  }
  const mailOptions = {
    from: `"Final Serve-ivor" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `Reset your password — Final Serve-ivor`,
    html: buildPasswordResetHTML({ email, displayName, resetUrl }),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${email}`);
  } catch (err) {
    console.error(`❌ Failed to send password reset email to ${email}:`, err.message);
    throw err;
  }
};

const buildPasswordResetHTML = ({ email, displayName, resetUrl }) => {
  const header = `
    <tr>
      <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:40px 40px 32px;text-align:center;">
        <p style="margin:0 0 14px;display:inline-block;padding:5px 14px;background:rgba(232,184,75,0.15);border:1px solid rgba(232,184,75,0.4);border-radius:20px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#e8b84b;">Final Serve-ivor</p>
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

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border-left:4px solid #e8b84b;border-radius:4px;margin-bottom:24px;">
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
