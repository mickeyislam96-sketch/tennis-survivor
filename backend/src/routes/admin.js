/**
 * Admin control endpoints.
 *
 * Auth: pass the ADMIN_SECRET via Authorization header:
 *   Authorization: Bearer <ADMIN_SECRET>
 * Legacy support: also accepts { secret: "..." } in POST body (NOT query params).
 *
 * Rate-limited to 20 requests per minute per IP to prevent brute-force.
 *
 * These are emergency / operational tools — not user-facing.
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { autoProcessResults, processRoundResults, eliminateNonPickers } from '../services/resultsProcessor.js';
import { getDeadlines, setRuntimeLockOverride, clearRuntimeLockOverride, getRuntimeLockOverrides } from '../services/tennisData.js';
import { TOURNAMENT, ROUNDS } from '../config/tournament.js';
import { pool } from '../db/pool.js';
import { sendAdminDigest, getPendingEmailsSummary, sendPendingEmails, sendPendingEmailById, rejectPendingEmailById, sendWithdrawalEmail, sendDrawReleasedEmail } from '../utils/email.js';
import { setScrapedResults, getScraperCacheStatus } from '../services/scraperCache.js';

export const adminRouter = Router();

// Rate-limit all admin routes — prevents brute-force of admin secret
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 20,                // 20 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin requests. Please wait.' },
});
adminRouter.use(adminLimiter);

function getAdminSecret() {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    console.error('[admin] ADMIN_SECRET env var is not set — all admin requests will be rejected');
  }
  return secret;
}

/**
 * Check admin secret from (in priority order):
 *   1. Authorization: Bearer <secret>   (preferred — not logged in URLs)
 *   2. req.body.secret                  (legacy — POST body only)
 *   3. req.query.secret                 (for GET one-click links, e.g. email approval)
 */
function checkSecret(req, res) {
  let secret = null;

  // 1. Authorization header (preferred)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    secret = authHeader.slice(7);
  }

  // 2. POST body fallback
  if (!secret && req.body?.secret) {
    secret = req.body.secret;
  }

  // 3. Query param fallback (needed for one-click approval links in emails)
  if (!secret && req.query?.secret) {
    secret = req.query.secret;
  }

  if (!secret || secret !== getAdminSecret()) {
    res.status(401).json({ error: 'Unauthorised — invalid admin secret' });
    return false;
  }
  return true;
}

// ── POST /api/admin/process-results ──────────────────────────────────────────
// Trigger results processing. Optionally for a specific round only.
adminRouter.post('/process-results', async (req, res) => {
  if (!checkSecret(req, res)) return;
  const { round } = req.body;
  try {
    const result = round
      ? await processRoundResults(round)
      : await autoProcessResults();
    res.json({ ok: true, result });
  } catch (err) {
    console.error('[admin] process-results error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/admin/set-lock-override ────────────────────────────────────────
// Force a round's lock time without redeploying.
// Body: { secret, round: "R32", lockAt: "2026-04-26T17:00:00Z" }
adminRouter.post('/set-lock-override', (req, res) => {
  if (!checkSecret(req, res)) return;
  const { round, lockAt } = req.body;
  if (!round)  return res.status(400).json({ error: 'round is required (e.g. "R32")' });
  if (!lockAt) return res.status(400).json({ error: 'lockAt is required (ISO 8601 date string)' });
  try {
    setRuntimeLockOverride(round, lockAt);
    res.json({ ok: true, round, lockAt, message: `Lock override set: ${round} locks at ${lockAt}` });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// ── POST /api/admin/clear-lock-override ──────────────────────────────────────
// Remove a runtime lock override. Falls back to config or API times.
// Body: { secret, round: "R32" }
adminRouter.post('/clear-lock-override', (req, res) => {
  if (!checkSecret(req, res)) return;
  const { round } = req.body;
  if (!round) return res.status(400).json({ error: 'round is required' });
  try {
    clearRuntimeLockOverride(round);
    res.json({ ok: true, round, message: `Lock override cleared for ${round}` });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// ── POST /api/admin/invalidate-cache ─────────────────────────────────────────
// TODO: Needs invalidateCache() in tennisData.js when caching is implemented.

// ── POST /api/admin/eliminate-non-pickers ────────────────────────────────────
// Manually eliminate players who didn't pick for a specific round.
// Only use after confirming the pick window is closed.
// Body: { secret, round: "R32" }
adminRouter.post('/eliminate-non-pickers', async (req, res) => {
  if (!checkSecret(req, res)) return;
  const { round } = req.body;
  if (!round || !ROUNDS.includes(round)) {
    return res.status(400).json({ error: `Unknown round "${round}". Valid: ${ROUNDS.join(', ')}` });
  }
  try {
    const count = await eliminateNonPickers(round);
    res.json({ ok: true, round, eliminated: count, message: `${count} non-pickers eliminated for ${round}` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/admin/status ─────────────────────────────────────────────────────
// System status overview — current tournament, cache, deadlines, runtime overrides.
adminRouter.get('/status', async (req, res) => {
  if (!checkSecret(req, res)) return;
  try {
    const [deadlines, dbResult] = await Promise.all([
      getDeadlines().catch(() => null),
      pool.query(`SELECT
        (SELECT COUNT(*) FROM users)         AS users,
        (SELECT COUNT(*) FROM groups)        AS groups,
        (SELECT COUNT(*) FROM group_members) AS members,
        (SELECT COUNT(*) FROM picks)         AS picks,
        (SELECT COUNT(*) FROM picks WHERE survived IS NULL) AS pending_picks,
        (SELECT COUNT(*) FROM group_members WHERE is_alive = true) AS alive_members
      `).catch(() => null),
    ]);

    res.json({
      ok: true,
      tournament: {
        id:        TOURNAMENT.id,
        name:      TOURNAMENT.name,
        rounds:    ROUNDS,
        apiKeySet: !!TOURNAMENT.apiTennisTournamentKey,
        r1PerMatchLock: TOURNAMENT.r1PerMatchLock || false,
      },
      deadlines,
      runtimeLockOverrides: getRuntimeLockOverrides(),
      db:              dbResult?.rows?.[0] ?? null,
      timestamp:       new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/admin/regenerate-invite ─────────────────────────────────────────
// Generate a new invite code for a group.
// Body: { secret, groupId }
adminRouter.post('/regenerate-invite', async (req, res) => {
  if (!checkSecret(req, res)) return;
  const { groupId } = req.body;
  if (!groupId) return res.status(400).json({ error: 'groupId is required' });
  try {
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    // Get group name for prefix
    const group = await pool.query('SELECT name FROM groups WHERE id = $1::uuid', [groupId]);
    if (group.rows.length === 0) return res.status(404).json({ error: 'Group not found' });
    const prefix = group.rows[0].name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
    const newCode = `${prefix}-${suffix}`;
    await pool.query('UPDATE groups SET invite_code = $1 WHERE id = $2::uuid', [newCode, groupId]);
    res.json({ ok: true, groupId, inviteCode: newCode });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/admin/fix-r1-picks ────────────────────────────────────────────
// One-time migration: rename picks from round='R32' to round='R1'.
// These picks were submitted while the round mapping bug was active (API
// "1/32-finals" was incorrectly mapped to R32 instead of R1). The picks were
// actually R1 picks — non-seeds playing in the first round.
// After renaming, triggers results processing so R1 wins/losses get graded.
adminRouter.post('/fix-r1-picks', async (req, res) => {
  if (!checkSecret(req, res)) return;
  try {
    // Only rename picks that haven't been graded yet and were created before
    // the R32 window properly opened (i.e. before R1 lock time).
    // Safety: also check there are NO existing R1 picks (to avoid duplicates).
    const existingR1 = await pool.query(
      `SELECT COUNT(*) FROM picks WHERE round = 'R1'`
    );
    if (Number(existingR1.rows[0].count) > 0) {
      return res.json({
        ok: false,
        message: `Already ${existingR1.rows[0].count} R1 picks in DB — migration may have already run. Aborting to avoid duplicates.`,
      });
    }

    const result = await pool.query(
      `UPDATE picks SET round = 'R1' WHERE round = 'R32' RETURNING id::text, user_id::text, player_name, round`
    );

    console.log(`[admin] fix-r1-picks: renamed ${result.rowCount} picks from R32 → R1`);

    // Now trigger results processing so R1 matches get graded
    let gradeResult = null;
    if (result.rowCount > 0) {
      gradeResult = await autoProcessResults();
    }

    res.json({
      ok: true,
      renamed: result.rowCount,
      picks: result.rows,
      gradeResult,
    });
  } catch (err) {
    console.error('[admin] fix-r1-picks error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/admin/delete-email ─────────────────────────────────────────────
// Delete a specific pending email by its database ID.
// Body: { secret, emailId }
adminRouter.post('/delete-email', async (req, res) => {
  if (!checkSecret(req, res)) return;
  const { emailId } = req.body;
  if (!emailId) return res.status(400).json({ error: 'emailId is required' });
  try {
    const result = await pool.query(
      `DELETE FROM emails_sent WHERE id = $1 AND status = 'pending' RETURNING id, recipient_email, email_type, round, subject`,
      [emailId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'No pending email found with that ID' });
    }
    const deleted = result.rows[0];
    console.log(`[admin] delete-email: removed pending ${deleted.email_type} for ${deleted.recipient_email} (round=${deleted.round})`);
    res.json({ ok: true, deleted });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/admin/reset-round-emails ─────────────────────────────────────
// Delete ALL emails_sent records for a given round + email type (including
// already-sent ones). This clears the dedup constraint so the results
// processor can re-queue corrected emails.
// Body: { secret, round, emailType? }   emailType defaults to 'round_result'
adminRouter.post('/reset-round-emails', async (req, res) => {
  if (!checkSecret(req, res)) return;
  const { round, emailType } = req.body;
  if (!round) return res.status(400).json({ error: 'round is required' });
  const type = emailType || 'round_result';
  try {
    const result = await pool.query(
      `DELETE FROM emails_sent WHERE round = $1 AND email_type = $2
       RETURNING id, recipient_email, email_type, round, status, subject`,
      [round, type]
    );
    console.log(`[admin] reset-round-emails: deleted ${result.rowCount} ${type} emails for round ${round}`);
    res.json({
      ok: true,
      deleted: result.rowCount,
      round,
      emailType: type,
      emails: result.rows,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/admin/pending-emails ───────────────────────────────────────────
// List all pending emails with their IDs (for selective deletion).
adminRouter.get('/pending-emails', async (req, res) => {
  if (!checkSecret(req, res)) return;
  try {
    const { rows } = await pool.query(
      `SELECT id, user_id::text, group_id::text, round, email_type, subject, recipient_email, recipient_name, created_at
         FROM emails_sent
        WHERE status = 'pending'
        ORDER BY created_at ASC`
    );
    res.json({ ok: true, count: rows.length, emails: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/admin/force-digest ────────────────────────────────────────────
// Manually trigger the admin approval digest email, bypassing the
// "only send when pending count increases" guard.
// Body: { secret }
adminRouter.post('/force-digest', async (req, res) => {
  if (!checkSecret(req, res)) return;
  try {
    await sendAdminDigest({ force: true });
    res.json({ ok: true, message: 'Admin digest sent (forced).' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/admin/api-diag ──────────────────────────────────────────────────
// Diagnostic: test API-Tennis connectivity, look up correct tournament key,
// and try fetching Monte Carlo fixtures.
adminRouter.get('/api-diag', async (req, res) => {
  if (!checkSecret(req, res)) return;
  const apiKey = process.env.TENNIS_API_KEY;
  const configuredKey = TOURNAMENT.apiTournamentKey;
  const results = { apiKey: apiKey ? 'present' : 'MISSING', configuredTournamentKey: configuredKey };

  if (!apiKey) return res.json({ ok: false, ...results, error: 'No TENNIS_API_KEY set' });

  const API_BASE = 'https://api.api-tennis.com/tennis';

  // 1. Test API key by calling get_tournaments (lightweight)
  try {
    const tourRes = await fetch(
      `${API_BASE}/?method=get_tournaments&APIkey=${apiKey}`
    );
    const tourData = await tourRes.json();
    if (!tourData?.success) {
      results.keyTest = { status: 'FAIL', response: JSON.stringify(tourData).slice(0, 500) };
    } else if (!Array.isArray(tourData.result)) {
      results.keyTest = { status: 'FAIL', message: 'success=1 but no result array — key may be expired', raw: JSON.stringify(tourData).slice(0, 500) };
    } else {
      results.keyTest = { status: 'ok', tournamentCount: tourData.result.length };
      // 2. Search for Monte Carlo in the tournament list
      const mc = tourData.result.filter(t =>
        (t.tournament_name || '').toLowerCase().includes('monte carlo') ||
        (t.tournament_name || '').toLowerCase().includes('monte-carlo')
      );
      results.monteCarloMatches = mc.map(t => ({
        key: t.tournament_key,
        name: t.tournament_name,
        eventType: t.event_type_key || t.event_type,
      }));
    }
  } catch (err) {
    results.keyTest = { status: 'ERROR', message: err.message };
  }

  // 3. Test the configured tournament key with current date range
  try {
    const url =
      `${API_BASE}/?method=get_fixtures` +
      `&APIkey=${apiKey}` +
      `&tournament_key=${configuredKey}` +
      (TOURNAMENT.apiSeason ? `&tournament_season=${TOURNAMENT.apiSeason}` : '') +
      `&date_start=${TOURNAMENT.apiDateStart}` +
      `&date_stop=${TOURNAMENT.apiDateStop}`;
    const fixRes = await fetch(url);
    const fixData = await fixRes.json();
    results.fixtureTest = {
      url: url.replace(apiKey, 'REDACTED'),
      success: fixData?.success,
      hasResult: Array.isArray(fixData?.result),
      fixtureCount: Array.isArray(fixData?.result) ? fixData.result.length : 0,
      raw: JSON.stringify(fixData).slice(0, 500),
    };
    // Show first fixture for debugging
    if (Array.isArray(fixData?.result) && fixData.result.length > 0) {
      results.sampleFixture = fixData.result[0];
    }
  } catch (err) {
    results.fixtureTest = { status: 'ERROR', message: err.message };
  }

  res.json({ ok: true, ...results });
});

// ── GET /api/admin/user/:userId ──────────────────────────────────────────────
// Look up a user's details (for debugging / email fixes).
adminRouter.get('/user/:userId', async (req, res) => {
  if (!checkSecret(req, res)) return;
  try {
    const result = await pool.query(
      'SELECT id::text, email, display_name, created_at FROM users WHERE id = $1::uuid',
      [req.params.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/admin/fix-email ────────────────────────────────────────────────
// Correct a user's email address.
// Body: { secret, userId, newEmail }
adminRouter.post('/fix-email', async (req, res) => {
  if (!checkSecret(req, res)) return;
  const { userId, newEmail } = req.body;
  if (!userId || !newEmail) {
    return res.status(400).json({ error: 'userId and newEmail are required' });
  }
  try {
    const current = await pool.query(
      'SELECT id::text, email, display_name FROM users WHERE id = $1::uuid',
      [userId]
    );
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const oldEmail = current.rows[0].email;
    await pool.query('UPDATE users SET email = $1 WHERE id = $2::uuid', [newEmail, userId]);
    console.log(`[admin] fix-email: ${current.rows[0].display_name} email changed from ${oldEmail} to ${newEmail}`);
    res.json({ ok: true, userId, oldEmail, newEmail, displayName: current.rows[0].display_name });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/admin/revive-member ────────────────────────────────────────────
// Revive a member who was incorrectly eliminated.
// Body: { secret, userId, groupId }
// Also resets their pick for the eliminated round to survived=NULL.
adminRouter.post('/revive-member', async (req, res) => {
  if (!checkSecret(req, res)) return;
  const { userId, groupId } = req.body;
  if (!userId || !groupId) {
    return res.status(400).json({ error: 'userId and groupId are required' });
  }
  try {
    const member = await pool.query(
      'SELECT id::text, user_id::text, display_name, is_alive, eliminated_round FROM group_members WHERE group_id = $1::uuid AND user_id = $2::uuid',
      [groupId, userId]
    );
    if (member.rows.length === 0) return res.status(404).json({ error: 'Member not found' });
    const m = member.rows[0];
    if (m.is_alive) return res.json({ ok: true, message: 'Member is already alive', member: m });

    const eliminatedRound = m.eliminated_round;
    await pool.query(
      'UPDATE group_members SET is_alive = true, eliminated_round = NULL WHERE group_id = $1::uuid AND user_id = $2::uuid',
      [groupId, userId]
    );
    // Reset the pick for the eliminated round to NULL so they can change it
    if (eliminatedRound) {
      await pool.query(
        'UPDATE picks SET survived = NULL WHERE group_id = $1::uuid AND user_id = $2::uuid AND round = $3',
        [groupId, userId, eliminatedRound]
      );
    }
    console.log(`[admin] revive-member: ${m.display_name} revived (was eliminated in ${eliminatedRound})`);
    res.json({ ok: true, userId, groupId, displayName: m.display_name, previouslyEliminatedIn: eliminatedRound });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/admin/withdrawal ───────────────────────────────────────────────
// Flag a player withdrawal. Any user in the current tournament who picked that
// player in that round (and hasn't yet been eliminated) gets their pick unlocked
// so they can re-pick.
// Body: { secret, playerId, playerName, round, replacementName? }
adminRouter.post('/withdrawal', async (req, res) => {
  if (!checkSecret(req, res)) return;
  const { playerId, playerName, round, replacementName } = req.body;
  if (!playerId || !playerName || !round) {
    return res.status(400).json({ error: 'playerId, playerName, and round are required' });
  }
  try {
    // Find all picks in the current tournament for this player in this round
    // where the pick hasn't been resolved (survived IS NULL).
    const pickResult = await pool.query(
      `SELECT p.id, p.user_id::text, p.group_id::text, u.email, u.display_name, gm.display_name as group_name
         FROM picks p
         JOIN users u ON u.id = p.user_id
         JOIN group_members gm ON gm.user_id = p.user_id AND gm.group_id = p.group_id
         JOIN groups g ON g.id = p.group_id
        WHERE p.player_id = $1
          AND p.round = $2
          AND p.survived IS NULL
          AND g.tournament_id = $3
        ORDER BY p.created_at`,
      [playerId, round, TOURNAMENT.id]
    );

    const affectedPicks = pickResult.rows;
    if (affectedPicks.length === 0) {
      return res.json({ ok: true, message: 'No active picks found for this player/round', count: 0, userIds: [] });
    }

    // Unlock each pick and queue a withdrawal notification email
    const userIds = [];
    for (const pick of affectedPicks) {
      // Unlock the pick
      await pool.query(
        'UPDATE picks SET player_id = NULL, player_name = NULL WHERE id = $1',
        [pick.id]
      );

      // Queue withdrawal notification email
      try {
        await sendWithdrawalEmail({
          userId: pick.user_id,
          groupId: pick.group_id,
          round,
          email: pick.email,
          displayName: pick.display_name,
          withdrawnPlayer: playerName,
          replacementPlayer: replacementName || null,
          groupName: pick.group_name,
        });
      } catch (emailErr) {
        // Log the error but don't fail the whole operation
        console.error(`[admin] withdrawal: failed to queue email for ${pick.email}:`, emailErr.message);
      }

      userIds.push(pick.user_id);
    }

    console.log(`[admin] withdrawal: ${playerName} flagged as withdrawn in ${round}. Unlocked ${affectedPicks.length} picks (${userIds.join(', ')})`);
    res.json({
      ok: true,
      playerName,
      round,
      count: affectedPicks.length,
      userIds,
      message: `Unlocked ${affectedPicks.length} pick(s) and queued withdrawal notifications`,
    });
  } catch (err) {
    console.error('[admin] withdrawal error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/admin/picks/:groupId ────────────────────────────────────────────
// View all picks for a group (useful for debugging / manual review).
adminRouter.get('/picks/:groupId', async (req, res) => {
  if (!checkSecret(req, res)) return;
  const { groupId } = req.params;
  try {
    const result = await pool.query(
      `SELECT p.user_id::text, gm.display_name, p.round, p.player_name, p.survived, p.created_at
         FROM picks p
         JOIN group_members gm ON gm.group_id = p.group_id AND gm.user_id = p.user_id
        WHERE p.group_id = $1::uuid
        ORDER BY gm.display_name, array_position($2::text[], p.round)`,
      [groupId, ROUNDS]
    );
    res.json({ ok: true, picks: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/admin/approve-emails ──────────────────────────────────────────
// Preview or approve pending emails.
// POST { secret }          → preview (list what's queued)
// POST { secret, confirm } → send all pending emails
adminRouter.post('/approve-emails', async (req, res) => {
  if (!checkSecret(req, res)) return;
  const { confirm } = req.body;
  try {
    if (confirm) {
      const result = await sendPendingEmails();
      res.json({ ok: true, action: 'sent', ...result });
    } else {
      const pending = await getPendingEmailsSummary();
      res.json({ ok: true, action: 'preview', count: pending.length, emails: pending });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/admin/approve-emails ──────────────────────────────────────────
// One-click approval from admin digest email.
// GET ?secret=X&confirm=true → send all pending and show HTML result page
// GET ?secret=X              → preview pending as HTML page
adminRouter.get('/approve-emails', async (req, res) => {
  if (!checkSecret(req, res)) return;
  const { confirm } = req.query;
  try {
    if (confirm === 'true') {
      const result = await sendPendingEmails();
      const sent = result.sent || 0;
      const failed = result.failed || 0;
      res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
        <body style="margin:0;padding:40px 20px;background:#FAFAF7;font-family:system-ui,sans-serif;text-align:center;">
          <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
            <h1 style="margin:0 0 12px;color:#0F4A23;font-size:24px;">${sent > 0 ? '✅' : '📭'} Emails ${sent > 0 ? 'Sent' : 'None to Send'}</h1>
            <p style="margin:0 0 8px;color:#555;font-size:16px;">${sent} sent${failed > 0 ? `, ${failed} failed` : ''}</p>
            <p style="margin:16px 0 0;color:#999;font-size:13px;">You can close this tab.</p>
          </div>
        </body></html>`);
    } else {
      const pending = await getPendingEmailsSummary();
      let rows = '';
      for (const e of pending) {
        rows += `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee;font-size:14px;">${e.recipient_name || e.recipient_email}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;font-size:14px;">${e.email_type}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;font-size:14px;">${e.round || ''}</td>
        </tr>`;
      }
      const secret = req.query.secret;
      const approveUrl = `https://tennis-survivor-production.up.railway.app/api/admin/approve-emails?secret=${encodeURIComponent(secret)}&confirm=true`;
      res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
        <body style="margin:0;padding:40px 20px;background:#FAFAF7;font-family:system-ui,sans-serif;">
          <div style="max-width:540px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
            <h1 style="margin:0 0 8px;color:#0F4A23;font-size:22px;">📧 ${pending.length} email${pending.length === 1 ? '' : 's'} queued</h1>
            <p style="margin:0 0 20px;color:#777;font-size:14px;">Review below, then click approve to send.</p>
            ${pending.length > 0 ? `<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
              <thead><tr style="background:#f5f5f0;">
                <th style="padding:8px;text-align:left;font-size:12px;color:#888;">Recipient</th>
                <th style="padding:8px;text-align:left;font-size:12px;color:#888;">Type</th>
                <th style="padding:8px;text-align:left;font-size:12px;color:#888;">Round</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>` : ''}
            <a href="${approveUrl}" style="display:inline-block;background:#FFC933;color:#2B1F00;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:600;font-size:16px;">
              ✅ Approve &amp; Send ${pending.length} Email${pending.length === 1 ? '' : 's'}
            </a>
          </div>
        </body></html>`);
    }
  } catch (err) {
    res.status(500).send(`<!DOCTYPE html><html><body style="padding:40px;font-family:system-ui;text-align:center;">
      <h1 style="color:red;">Error</h1><p>${err.message}</p></body></html>`);
  }
});

// ── POST /api/admin/send-draw-released ──────────────────────────────────────
// Queue draw-released emails for all members of the current tournament's groups.
// Body: { secret }
adminRouter.post('/send-draw-released', async (req, res) => {
  if (!checkSecret(req, res)) return;
  try {
    // Find all members in all groups for the current tournament
    const result = await pool.query(
      `SELECT DISTINCT u.id::text, u.email, u.display_name, gm.group_id::text, g.name as group_name
         FROM group_members gm
         JOIN users u ON u.id = gm.user_id
         JOIN groups g ON g.id = gm.group_id
        WHERE g.tournament_id = $1
        ORDER BY u.email, g.name`,
      [TOURNAMENT.id]
    );

    if (result.rows.length === 0) {
      return res.json({ ok: true, message: 'No members found in this tournament', count: 0 });
    }

    // Queue an email for each member
    let queued = 0;
    let skipped = 0;

    for (const row of result.rows) {
      try {
        const emailResult = await sendDrawReleasedEmail({
          userId: row.id,
          groupId: row.group_id,
          email: row.email,
          displayName: row.display_name,
          tournamentName: TOURNAMENT.name,
          groupName: row.group_name,
        });

        if (emailResult.queued) {
          queued++;
        } else {
          skipped++;
        }
      } catch (emailErr) {
        console.error(`[admin] send-draw-released: failed to queue for ${row.email}:`, emailErr.message);
        skipped++;
      }
    }

    console.log(`[admin] send-draw-released: queued ${queued} emails, ${skipped} skipped (dedup)`, TOURNAMENT.name);
    res.json({
      ok: true,
      tournament: TOURNAMENT.name,
      total: result.rows.length,
      queued,
      skipped,
      message: `Draw released emails queued: ${queued} new, ${skipped} already queued`,
    });
  } catch (err) {
    console.error('[admin] send-draw-released error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/admin/send-new-tournament ─────────────────────────────────────
// TODO: Needs sendNewTournamentEmail() in email.js — build email template first.
adminRouter.post('/send-new-tournament', async (req, res) => {
  if (!checkSecret(req, res)) return;
  res.status(501).json({ error: 'New tournament email template not yet implemented' });
});

// ── POST /api/admin/scrape-results ──────────────────────────────────────────
// Receive scraped match results from the local FlashScore scraper.
// Body: { secret, fixtures: [...], scrapedAt: "ISO string" }
// The fixtures array must use the internal fixture format (see dataAdapter.js).
adminRouter.post('/scrape-results', async (req, res) => {
  if (!checkSecret(req, res)) return;
  const { fixtures, scrapedAt } = req.body;

  if (!Array.isArray(fixtures)) {
    return res.status(400).json({ error: 'fixtures must be an array' });
  }
  if (fixtures.length === 0) {
    return res.status(400).json({ error: 'fixtures array is empty — nothing to store' });
  }

  // Basic validation: each fixture needs at least matchId and round
  const invalid = fixtures.filter(f => !f.matchId || !f.round);
  if (invalid.length > 0) {
    return res.status(400).json({
      error: `${invalid.length} fixture(s) missing matchId or round`,
      sample: invalid.slice(0, 3),
    });
  }

  try {
    const result = await setScrapedResults(fixtures, scrapedAt);

    // Log summary
    const roundCounts = {};
    for (const f of fixtures) { roundCounts[f.round] = (roundCounts[f.round] || 0) + 1; }
    const decided = fixtures.filter(f => ['completed', 'retired', 'walkover'].includes(f.status) && f.winnerId).length;
    const completed = fixtures.filter(f => f.status === 'completed').length;
    const live = fixtures.filter(f => f.status === 'live').length;
    const withTimes = fixtures.filter(f => f.startTime).length;

    console.log(`[admin] scrape-results: ${fixtures.length} fixtures received. ` +
      `Rounds: ${JSON.stringify(roundCounts)}. ` +
      `Decided: ${decided} (completed: ${completed}), Live: ${live}, With start times: ${withTimes}`);

    res.json({
      ok: true,
      stored: result.stored,
      rounds: roundCounts,
      completed,
      live,
      withStartTimes: withTimes,
      scrapedAt: scrapedAt || new Date().toISOString(),
    });
  } catch (err) {
    console.error('[admin] scrape-results error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/admin/scraper-status ────────────────────────────────────────────
// Check the scraper cache status (is data flowing? how old is it?).
adminRouter.get('/scraper-status', (req, res) => {
  if (!checkSecret(req, res)) return;
  res.json({ ok: true, ...getScraperCacheStatus() });
});
