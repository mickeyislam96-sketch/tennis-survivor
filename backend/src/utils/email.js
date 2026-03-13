import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export const sendRegistrationEmail = async ({ email, displayName, tournamentName, drawDate, startDate }) => {
  const mailOptions = {
    from: `"Final Serve-ivor" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `You're in, ${displayName}! 🎾 Final Serve-ivor — ${tournamentName}`,
    html: buildRegistrationHTML({ email, displayName, tournamentName, drawDate, startDate }),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Registration email sent to ${email}`);
  } catch (err) {
    // Log but don't crash the registration response if email fails
    console.error(`Failed to send registration email to ${email}:`, err.message);
  }
};

const buildRegistrationHTML = ({ email, displayName, tournamentName, drawDate, startDate }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
              <p style="margin:0;color:#e8b84b;font-size:13px;letter-spacing:3px;text-transform:uppercase;">Final Serve-ivor</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:26px;">You're registered.</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;font-size:16px;color:#333;">Hey <strong>${displayName}</strong>,</p>
              <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
                You're officially signed up for <strong>${tournamentName}</strong>. Here's what happens next.
              </p>

              <!-- How it works -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-left:4px solid #e8b84b;border-radius:4px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px;font-size:14px;font-weight:bold;color:#1a1a2e;text-transform:uppercase;letter-spacing:1px;">How Final Serve-ivor works</p>
                    <p style="margin:0 0 10px;font-size:14px;color:#555;line-height:1.6;">
                      Each round, every player picks one match winner. Pick correctly and you survive. Pick wrong and you're out. Last player standing wins the tournament.
                    </p>
                    <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">
                      You can only pick each player <strong>once</strong> across the entire tournament — so manage your big names carefully.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- What's next -->
              <table width="100%" cellpadding="16" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:4px;margin-bottom:28px;">
                <tr>
                  <td>
                    <p style="margin:0 0 12px;font-size:14px;font-weight:bold;color:#1a1a2e;text-transform:uppercase;letter-spacing:1px;">What's next</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#555;border-bottom:1px solid #f0f0f0;">
                          📋 <strong>Draw released</strong> &nbsp;—&nbsp; ${drawDate}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#555;border-bottom:1px solid #f0f0f0;">
                          🎾 <strong>Tournament begins</strong> &nbsp;—&nbsp; ${startDate}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#555;">
                          🔓 <strong>Picks open</strong> &nbsp;—&nbsp; Once the draw drops, you'll be able to log in and make your Round 1 pick.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:14px;color:#888;line-height:1.6;">
                We'll be in touch when picks open. No action needed from you right now.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f4f4f4;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#aaa;">Final Serve-ivor &nbsp;|&nbsp; ATP Last Man Standing</p>
              <p style="margin:4px 0 0;font-size:12px;color:#aaa;">Sent to ${email}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

export const sendPasswordResetEmail = async ({ email, displayName, resetUrl }) => {
  const mailOptions = {
    from: `"Final Serve-ivor" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `Reset your password — Final Serve-ivor`,
    html: buildPasswordResetHTML({ email, displayName, resetUrl }),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`);
  } catch (err) {
    console.error(`Failed to send password reset email to ${email}:`, err.message);
    throw err;
  }
};

const buildPasswordResetHTML = ({ email, displayName, resetUrl }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
              <p style="margin:0;color:#e8b84b;font-size:13px;letter-spacing:3px;text-transform:uppercase;">Final Serve-ivor</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:26px;">Reset your password</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;font-size:16px;color:#333;">Hey <strong>${displayName}</strong>,</p>
              <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
                We received a request to reset your password. Click the button below to choose a new one.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background:#16a34a;color:#fff;font-size:15px;font-weight:bold;text-decoration:none;border-radius:6px;">
                      Reset password
                    </a>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-left:4px solid #e8b84b;border-radius:4px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:13px;color:#555;line-height:1.6;">
                      This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email — your password won't change.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#888;">
                If the button doesn't work, paste this link into your browser:<br/>
                <a href="${resetUrl}" style="color:#16a34a;word-break:break-all;">${resetUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f4f4f4;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#aaa;">Final Serve-ivor &nbsp;|&nbsp; ATP Last Man Standing</p>
              <p style="margin:4px 0 0;font-size:12px;color:#aaa;">Sent to ${email}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
