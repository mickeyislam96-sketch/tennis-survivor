import { pool } from '../db/pool.js';

// ── Startup check ─────────────────────────────────────────────────────────
const EMAIL_CONFIGURED = !!process.env.BREVO_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'mickeyislam96@gmail.com';

if (!EMAIL_CONFIGURED) {
  console.warn('[email] BREVO_API_KEY env var is missing - emails disabled.');
} else {
  console.log('[email] Brevo configured (template mode). Batch emails queue as pending.');
}

const APP_URL = process.env.FRONTEND_URL || 'https://finalserveivor.com';

// ── Brevo template IDs (set on Railway) ───────────────────────────────────
const TPL = {
  WELCOME:         parseInt(process.env.BREVO_TPL_WELCOME, 10),
  TOURNAMENT_JOIN: parseInt(process.env.BREVO_TPL_TOURNAMENT_JOIN, 10),
  DRAW_RELEASED:   parseInt(process.env.BREVO_TPL_DRAW_RELEASED, 10),
  PICK_REMINDER:   parseInt(process.env.BREVO_TPL_PICK_REMINDER, 10),
  SURVIVAL:        parseInt(process.env.BREVO_TPL_SURVIVAL, 10),
  ELIMINATION:     parseInt(process.env.BREVO_TPL_ELIMINATION, 10),
  WINNER:          parseInt(process.env.BREVO_TPL_WINNER, 10),
  PASSWORD_RESET:  parseInt(process.env.BREVO_TPL_PASSWORD_RESET, 10),
  NEW_TOURNAMENT:  parseInt(process.env.BREVO_TPL_NEW_TOURNAMENT, 10),
};

// ─────────────────────────────────────────────────────────────────────────────
// Low-level Brevo API senders
// ─────────────────────────────────────────────────────────────────────────────

/** Send a transactional email using a Brevo template. */
async function sendViaBrevoTemplate({ to, toName, templateId, params, subject }) {
  const payload = {
    templateId,
    to: [{ email: to, name: toName || to }],
    params: params || {},
  };
  // Pass subject override so code-generated subjects are used instead of Brevo template defaults
  if (subject) payload.subject = subject;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo API error ${res.status}: ${body}`);
  }
  const data = await res.json();
  return { messageId: data.messageId || null };
}

/** Send a raw HTML email via Brevo (used for admin digest only). */
async function sendViaBrevoRaw({ to, subject, html }) {
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

// ─────────────────────────────────────────────────────────────────────────────
// Dedup + approval wrapper
//
// Flow:
//   1. INSERT into emails_sent with status='pending', ON CONFLICT DO NOTHING.
//   2. If rowCount === 0, this email was already queued or sent. Stop.
//   3. Email stays pending until admin approves via /api/admin/approve-emails.
//   4. On approval, sendPendingEmails reads metadata.templateId + metadata.params
//      and sends via Brevo template API.
// ─────────────────────────────────────────────────────────────────────────────

export async function sendWithDedup({ userId, groupId, round, emailType, to, toName, subject, templateId, params }) {
  const { rowCount } = await pool.query(
    `INSERT INTO emails_sent (user_id, group_id, round, email_type, status, subject, recipient_email, recipient_name, metadata)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8)
     ON CONFLICT (user_id, group_id, round, email_type) DO NOTHING`,
    [userId, groupId, round, emailType, subject, to, toName || null, JSON.stringify({ templateId, params })]
  );

  if (rowCount === 0) {
    return { queued: false, reason: 'already_exists' };
  }

  console.log(`[email-queue] Queued "${emailType}" for ${to} | round=${round}`);
  return { queued: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: send all pending emails (called from approval endpoint)
// ─────────────────────────────────────────────────────────────────────────────

export async function sendPendingEmails() {
  if (!EMAIL_CONFIGURED) {
    return { error: 'BREVO_API_KEY not configured', sent: 0, failed: 0 };
  }

  const { rows } = await pool.query(
    `SELECT id, user_id, group_id, round, email_type, subject, recipient_email, recipient_name, metadata
       FROM emails_sent
      WHERE status = 'pending'
      ORDER BY created_at ASC`
  );

  if (rows.length === 0) {
    return { sent: 0, failed: 0, total: 0, message: 'No pending emails' };
  }

  let sent = 0;
  let failed = 0;
  const results = [];

  for (const row of rows) {
    try {
      const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});

      if (meta.templateId) {
        // New Brevo template path
        await sendViaBrevoTemplate({
          to: row.recipient_email,
          toName: row.recipient_name || row.recipient_email,
          templateId: meta.templateId,
          params: meta.params || {},
          subject: row.subject || undefined,
        });
      } else if (meta.html) {
        // Legacy inline HTML path (for any old queued emails still in the DB)
        await sendViaBrevoRaw({ to: row.recipient_email, subject: row.subject, html: meta.html });
      } else {
        console.error(`[email-send] No templateId or HTML for ${row.id} (${row.email_type})`);
        failed++;
        results.push({ id: row.id, to: row.recipient_email, type: row.email_type, status: 'no_content' });
        continue;
      }

      await pool.query(
        `UPDATE emails_sent SET status = 'sent', sent_at = NOW() WHERE id = $1`,
        [row.id]
      );
      sent++;
      results.push({ id: row.id, to: row.recipient_email, type: row.email_type, status: 'sent' });
      console.log(`[email] Sent "${row.email_type}" to ${row.recipient_email} (round=${row.round})`);
    } catch (err) {
      await pool.query(
        `UPDATE emails_sent SET status = 'failed' WHERE id = $1`,
        [row.id]
      );
      failed++;
      results.push({ id: row.id, to: row.recipient_email, type: row.email_type, status: 'failed', error: err.message });
      console.error(`[email] FAILED "${row.email_type}" for ${row.recipient_email}: ${err.message}`);
    }
  }

  return { sent, failed, total: rows.length, results };
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: get a preview of all pending emails
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
// Admin digest: notify admin when new emails are queued
// ─────────────────────────────────────────────────────────────────────────────

let _lastDigestPendingCount = 0;

export async function sendAdminDigest({ force = false } = {}) {
  if (!EMAIL_CONFIGURED) return;

  const pending = await getPendingEmailsSummary();
  if (pending.length === 0) { _lastDigestPendingCount = 0; return; }
  if (!force && pending.length <= _lastDigestPendingCount) return;
  _lastDigestPendingCount = pending.length;

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
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;">${e.recipient_name || e.recipient_email}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;">${type}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;">${e.round}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#666;">${e.subject || ''}</td>
        </tr>`;
    }
  }

  const adminSecret = process.env.ADMIN_SECRET || '';
  const baseUrl = 'https://tennis-survivor-production.up.railway.app/api/admin/approve-emails';
  const previewUrl = `${baseUrl}?secret=${encodeURIComponent(adminSecret)}`;
  const approveUrl = `${baseUrl}?secret=${encodeURIComponent(adminSecret)}&confirm=true`;

  const html = `
    <!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
    <body style="margin:0;padding:20px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <h2 style="margin:0 0 8px;color:#1a1a2e;">${pending.length} email${pending.length === 1 ? '' : 's'} queued for approval</h2>
        <p style="margin:0 0 20px;color:#666;font-size:14px;">These will NOT be sent until you approve them.</p>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <thead>
            <tr style="background:#f9f9f9;">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#999;font-weight:600;">Recipient</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#999;font-weight:600;">Type</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#999;font-weight:600;">Round</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#999;font-weight:600;">Subject</th>
            </tr>
          </thead>
          <tbody>${summaryRows}</tbody>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
          <tr>
            <td align="center" style="padding:0 0 12px;">
              <a href="${approveUrl}" style="display:inline-block;padding:14px 36px;background:#16a34a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:6px;">Approve &amp; Send All</a>
            </td>
          </tr>
          <tr>
            <td align="center">
              <a href="${previewUrl}" style="display:inline-block;padding:10px 24px;background:#f5f5f5;color:#555;font-size:13px;font-weight:600;text-decoration:none;border-radius:6px;border:1px solid #ddd;">Preview first</a>
            </td>
          </tr>
        </table>

        <p style="margin:16px 0 0;font-size:11px;color:#bbb;text-align:center;">Do not forward this email. The links contain your admin credentials.</p>
      </div>
    </body></html>
  `;

  try {
    await sendViaBrevoRaw({
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
//  AUTO-SEND EMAILS (fire immediately, no approval gate)
// ═════════════════════════════════════════════════════════════════════════════

// ── 1. WELCOME ──────────────────────────────────────────────────────────────

export const sendWelcomeEmail = async ({ email, displayName }) => {
  if (!EMAIL_CONFIGURED) {
    console.warn(`[email] Skipping welcome email to ${email} - not configured.`);
    return;
  }
  try {
    await sendViaBrevoTemplate({
      to: email,
      toName: displayName,
      templateId: TPL.WELCOME,
      params: { firstName: displayName },
    });
    console.log(`[email] Welcome email sent to ${email}`);
  } catch (err) {
    console.error(`[email] Failed to send welcome email to ${email}:`, err.message);
  }
};


// ── 2. PASSWORD RESET ───────────────────────────────────────────────────────

export const sendPasswordResetEmail = async ({ email, displayName, resetUrl }) => {
  if (!EMAIL_CONFIGURED) {
    throw new Error('Email service not configured - BREVO_API_KEY must be set on Railway.');
  }
  try {
    await sendViaBrevoTemplate({
      to: email,
      toName: displayName,
      templateId: TPL.PASSWORD_RESET,
      params: { firstName: displayName, resetUrl },
    });
    console.log(`[email] Password reset email sent to ${email}`);
  } catch (err) {
    console.error(`[email] Failed to send password reset email to ${email}:`, err.message);
    throw err;
  }
};


// ═════════════════════════════════════════════════════════════════════════════
//  APPROVAL-GATED EMAILS (queued as pending, admin approves)
// ═════════════════════════════════════════════════════════════════════════════

// ── 3. TOURNAMENT JOIN ──────────────────────────────────────────────────────

export async function sendTournamentJoinEmail({
  userId, groupId, email, displayName,
  tournamentName, tournamentShortName, tournamentLevel,
  drawDate, firstMatchDate, groupPlayerCount, groupUrl, inviteUrl,
}) {
  const subject = `You're in - ${tournamentName} · Final Serve-ivor`;
  return sendWithDedup({
    userId,
    groupId,
    round: 'join',
    emailType: 'tournament_join',
    to: email,
    toName: displayName,
    subject,
    templateId: TPL.TOURNAMENT_JOIN,
    params: {
      firstName: displayName,
      tournamentName,
      tournamentShortName: tournamentShortName || tournamentName,
      tournamentLevel: tournamentLevel || '',
      drawDate: drawDate || '',
      firstMatchDate: firstMatchDate || '',
      groupPlayerCount: groupPlayerCount || 0,
      groupUrl: groupUrl || `${APP_URL}/group/${groupId}`,
      inviteUrl: inviteUrl || '',
    },
  });
}

// Re-export buildTournamentJoinHTML as a no-op for backward compatibility
// (groups.js imports it - will be cleaned up later)
export function buildTournamentJoinHTML() {
  return '<!-- migrated to Brevo template -->';
}

// ── 4. DRAW RELEASED ────────────────────────────────────────────────────────

export async function sendDrawReleasedEmail({
  userId, groupId, email, displayName,
  tournamentName, tournamentShortName,
  drawSize, totalRounds, deadline, groupPlayerCount,
  pickUrl, availablePlayerCount, topSeeds,
}) {
  const subject = `The ${tournamentShortName || tournamentName} draw is out - make your R1 pick`;
  return sendWithDedup({
    userId,
    groupId,
    round: 'draw',
    emailType: 'draw_released',
    to: email,
    toName: displayName,
    subject,
    templateId: TPL.DRAW_RELEASED,
    params: {
      firstName: displayName,
      tournamentName,
      tournamentShortName: tournamentShortName || tournamentName,
      drawSize: drawSize || 0,
      totalRounds: totalRounds || 0,
      deadline: deadline || '',
      groupPlayerCount: groupPlayerCount || 0,
      pickUrl: pickUrl || `${APP_URL}/pick`,
      availablePlayerCount: availablePlayerCount || 0,
      topSeeds: topSeeds || [],
    },
  });
}

// ── 5. PICK REMINDER ────────────────────────────────────────────────────────

export async function sendPickReminderEmail({
  userId, groupId, round, email, displayName, groupName, lockAt,
  tournamentName, roundShortName, hoursLeft, windowPercentUsed,
  pickedCount, groupPlayerCount, availablePlayerCount,
}) {
  const lockDate = new Date(lockAt);
  const lockStr = lockDate.toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  });

  // Calculate hoursLeft if not provided
  const computedHoursLeft = hoursLeft ?? Math.max(0, Math.round((lockDate.getTime() - Date.now()) / (1000 * 60 * 60)));

  const ROUND_LABELS = { R1: 'Round 1', R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-Finals', SF: 'Semi-Finals', F: 'Final' };
  const roundName = ROUND_LABELS[round] || round;

  const subject = `Pick reminder: ${round} locks soon - Final Serve-ivor`;
  return sendWithDedup({
    userId,
    groupId,
    round,
    emailType: 'pick_reminder',
    to: email,
    toName: displayName,
    subject,
    templateId: TPL.PICK_REMINDER,
    params: {
      firstName: displayName,
      roundName,
      roundShortName: roundShortName || round,
      hoursLeft: computedHoursLeft,
      deadline: lockStr,
      tournamentName: tournamentName || groupName || '',
      windowPercentUsed: windowPercentUsed ?? 50,
      pickedCount: pickedCount ?? 0,
      groupPlayerCount: groupPlayerCount ?? 0,
      pickUrl: `${APP_URL}/pick`,
      availablePlayerCount: availablePlayerCount ?? 0,
    },
  });
}


// ── 6. ROUND RESULT (survival or elimination) ─────────────────────────────

export async function sendRoundResultEmail({
  userId, groupId, round, email, displayName, playerName, survived,
  // Optional - enriched data from resultsProcessor
  pickOpponent, pickScore, playersLeft, eliminatedCount, roundsSurvived,
  nextRoundName, nextRoundShortName, nextDeadline,
  tournamentName, tournamentShortName,
  finishPosition, groupPlayerCount, leaderboardUrl,
  nextTournamentName, nextTournamentMonth,
}) {
  const ROUND_LABELS = { R1: 'Round 1', R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-Finals', SF: 'Semi-Finals', F: 'Final' };
  const roundName = ROUND_LABELS[round] || round;
  const groupUrl = `${APP_URL}/group/${groupId}`;

  if (survived) {
    const subject = `You survived ${roundName}. ${playersLeft || '?'} player${playersLeft === 1 ? '' : 's'} left.`;
    return sendWithDedup({
      userId,
      groupId,
      round,
      emailType: 'round_result',
      to: email,
      toName: displayName,
      subject,
      templateId: TPL.SURVIVAL,
      params: {
        firstName: displayName,
        tournamentName: tournamentName || '',
        roundName,
        roundShortName: round,
        nextRoundName: nextRoundName || '',
        nextRoundShortName: nextRoundShortName || '',
        playerName: playerName,
        pickOpponent: pickOpponent || '',
        pickScore: pickScore || '',
        playersLeft: playersLeft || 0,
        eliminatedCount: eliminatedCount || 0,
        roundsSurvived: roundsSurvived || 0,
        nextDeadline: nextDeadline || '',
        pickUrl: `${APP_URL}/pick`,
      },
    });
  } else {
    const subject = `Your ${tournamentShortName || 'tournament'} run is over - finished ${finishPosition || '?'}/${groupPlayerCount || '?'}`;
    return sendWithDedup({
      userId,
      groupId,
      round,
      emailType: 'round_result',
      to: email,
      toName: displayName,
      subject,
      templateId: TPL.ELIMINATION,
      params: {
        firstName: displayName,
        tournamentName: tournamentName || '',
        tournamentShortName: tournamentShortName || '',
        roundName,
        roundShortName: round,
        playerName: playerName,
        pickOpponent: pickOpponent || '',
        pickScore: pickScore || '',
        roundsSurvived: roundsSurvived || 0,
        finishPosition: finishPosition || 0,
        groupPlayerCount: groupPlayerCount || 0,
        playersLeft: playersLeft || 0,
        leaderboardUrl: leaderboardUrl || groupUrl,
        nextTournamentName: nextTournamentName || '',
        nextTournamentMonth: nextTournamentMonth || '',
      },
    });
  }
}


// ── 7. WINNER ─────────────────────────────────────────────────────────────

export async function sendWinnerEmail({
  userId, groupId, email, displayName,
  tournamentName, groupPlayerCount, roundsSurvived,
  pickHistory, leaderboardUrl,
}) {
  const subject = `You won the ${tournamentName} pool!`;
  return sendWithDedup({
    userId,
    groupId,
    round: 'winner',
    emailType: 'winner',
    to: email,
    toName: displayName,
    subject,
    templateId: TPL.WINNER,
    params: {
      firstName: displayName,
      tournamentName,
      groupPlayerCount: groupPlayerCount || 0,
      roundsSurvived: roundsSurvived || 0,
      pickHistory: pickHistory || [],
      leaderboardUrl: leaderboardUrl || `${APP_URL}/group/${groupId}`,
    },
  });
}


// ── 8. NEW TOURNAMENT ─────────────────────────────────────────────────────

export async function sendNewTournamentEmail({
  userId, groupId, email, displayName,
  tournamentName, tournamentShortName, tournamentLevel,
  drawDate, firstMatchDate, totalRounds, drawSize,
  joinUrl, inviteUrl,
}) {
  const subject = `${tournamentName} pool is open - join now`;
  // Use a synthetic groupId for new tournament emails (not group-specific)
  return sendWithDedup({
    userId,
    groupId: groupId || '00000000-0000-0000-0000-000000000000',
    round: 'announce',
    emailType: 'new_tournament',
    to: email,
    toName: displayName,
    subject,
    templateId: TPL.NEW_TOURNAMENT,
    params: {
      firstName: displayName,
      tournamentName,
      tournamentShortName: tournamentShortName || tournamentName,
      tournamentLevel: tournamentLevel || '',
      drawDate: drawDate || '',
      firstMatchDate: firstMatchDate || '',
      totalRounds: totalRounds || 0,
      drawSize: drawSize || 0,
      joinUrl: joinUrl || `${APP_URL}/pools`,
      inviteUrl: inviteUrl || '',
    },
  });
}
