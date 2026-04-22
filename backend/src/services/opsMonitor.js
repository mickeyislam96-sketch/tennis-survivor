/**
 * opsMonitor.js — Tournament operations automation.
 *
 * This is the "Operations Agent" brain. It runs on the 15-min cron
 * alongside resultsProcessor and emailScheduler, adding:
 *
 * 1. Withdrawal auto-detection  — polls fixtures for walkovers/retirements,
 *    cross-references against active picks, unlocks affected picks, queues
 *    withdrawal alert emails.
 *
 * 2. Draw release detection     — detects when fixtures first appear for the
 *    active tournament and queues draw-released emails.
 *
 * 3. Lock time auto-setting     — reads match start times from the API and
 *    sets lock time overrides to 1h before the first match of each round.
 *
 * 4. Persistent ops logging     — writes all automated actions to the ops_log
 *    DB table so Mickey can review what happened overnight.
 *
 * All actions are idempotent. Safe to call every 15 minutes.
 */

import { pool } from '../db/pool.js';
import { fetchFixtures } from './dataAdapter.js';
import { TOURNAMENT } from '../config/activeTournament.js';
import { getDeadlines } from './tennisData.js';
import {
  sendWithdrawalEmail,
  sendDrawReleasedEmail,
  sendAdminDigest,
} from '../utils/email.js';
import {
  setRuntimeLockOverride,
  getRuntimeLockOverrides,
} from './tennisData.js';

// ── Ops Log ─────────────────────────────────────────────────────────────────
// Persistent record of all automated actions. Replaces console.log for
// anything Mickey needs to see in the morning summary.

export async function logOps(category, action, details = {}) {
  try {
    await pool.query(
      `INSERT INTO ops_log (category, action, details, tournament_id)
       VALUES ($1, $2, $3, $4)`,
      [category, action, JSON.stringify(details), TOURNAMENT.id]
    );
  } catch (err) {
    // Non-fatal — don't let logging failures break operations
    console.error(`[ops-log] Failed to write: ${err.message}`);
  }
  // Also log to console for Railway's log stream
  console.log(`[ops] [${category}] ${action}`, Object.keys(details).length > 0 ? JSON.stringify(details) : '');
}

// ── State tracking (in-memory, resets on deploy) ────────────────────────────
// These flags prevent repeated actions within a single deployment cycle.
// The ops_log table is the persistent record; these are just rate limiters.

let drawReleaseDetected = false;
const processedWithdrawals = new Set(); // matchId set — don't re-process

// Track which rounds we've already auto-set lock times for (this deploy cycle).
// Prevents re-setting overrides that the admin has manually changed.
const autoSetRounds = new Set();

// ── 1. Withdrawal Auto-Detection ────────────────────────────────────────────

export async function checkWithdrawals() {
  try {
    const { provider, fixtures } = await fetchFixtures();
    if (!fixtures || fixtures.length === 0) return;

    // Find fixtures with withdrawal/walkover status
    const withdrawals = fixtures.filter(
      f => f.isWithdrawal && f.withdrawnPlayerId && !processedWithdrawals.has(f.matchId)
    );

    if (withdrawals.length === 0) return;

    for (const w of withdrawals) {
      processedWithdrawals.add(w.matchId);

      // Find any active picks for the withdrawn player
      const { rows: affectedPicks } = await pool.query(
        `SELECT p.id, p.user_id, p.group_id, p.round, p.player_name,
                u.email, u.display_name, g.name AS group_name
           FROM picks p
           JOIN users u ON u.id = p.user_id
           JOIN groups g ON g.id = p.group_id
          WHERE p.player_id = $1
            AND p.survived IS NULL
            AND g.tournament_id = $2`,
        [w.withdrawnPlayerId, TOURNAMENT.id]
      );

      if (affectedPicks.length === 0) {
        await logOps('withdrawal', 'detected_no_impact', {
          matchId: w.matchId,
          withdrawnPlayer: w.withdrawnPlayerId,
          round: w.round,
          status: w.status,
        });
        continue;
      }

      // Determine the advancing player (opponent of the withdrawn player)
      const advancingPlayer = w.withdrawnPlayerId === w.player1Id
        ? { id: w.player2Id, name: w.player2Name }
        : { id: w.player1Id, name: w.player1Name };

      // Unlock affected picks — set survived to NULL and delete the pick
      // so the user can re-pick from remaining available players
      for (const pick of affectedPicks) {
        await pool.query(
          `DELETE FROM picks WHERE id = $1`,
          [pick.id]
        );

        // Queue withdrawal alert email
        try {
          await sendWithdrawalEmail({
            userId: pick.user_id,
            groupId: pick.group_id,
            round: pick.round,
            email: pick.email,
            displayName: pick.display_name,
            withdrawnPlayer: pick.player_name,
            replacementPlayer: advancingPlayer.name,
            groupName: pick.group_name,
          });
        } catch (emailErr) {
          console.error(`[ops] Withdrawal email failed for ${pick.email}: ${emailErr.message}`);
        }
      }

      await logOps('withdrawal', 'processed', {
        matchId: w.matchId,
        withdrawnPlayer: w.withdrawnPlayerId,
        advancingPlayer: advancingPlayer.name,
        round: w.round,
        affectedUsers: affectedPicks.length,
        userIds: affectedPicks.map(p => p.user_id),
      });
    }
  } catch (err) {
    console.error('[ops] Withdrawal check error:', err.message);
    await logOps('withdrawal', 'error', { error: err.message });
  }
}

// ── 2. Draw Release Detection ───────────────────────────────────────────────

export async function checkDrawRelease() {
  if (drawReleaseDetected) return; // Already handled this deploy cycle

  try {
    // Check if we've already detected the draw in a previous deploy
    const { rows: existing } = await pool.query(
      `SELECT 1 FROM ops_log
        WHERE category = 'draw'
          AND action = 'released'
          AND tournament_id = $1
        LIMIT 1`,
      [TOURNAMENT.id]
    );
    if (existing.length > 0) {
      drawReleaseDetected = true;
      return;
    }

    const { provider, fixtures } = await fetchFixtures();

    // Need at least 10 fixtures with round info to consider the draw "released"
    const fixturesWithRound = fixtures.filter(f => f.round);
    if (fixturesWithRound.length < 10) return;

    // Draw is available! Log it and queue emails.
    drawReleaseDetected = true;

    // Get all members of the active tournament groups
    const { rows: members } = await pool.query(
      `SELECT gm.user_id, gm.group_id, u.email, u.display_name, g.name AS group_name
         FROM group_members gm
         JOIN users u ON u.id = gm.user_id
         JOIN groups g ON g.id = gm.group_id
        WHERE g.tournament_id = $1
          AND gm.is_alive = true
          AND u.email IS NOT NULL`,
      [TOURNAMENT.id]
    );

    let queued = 0;
    for (const m of members) {
      try {
        await sendDrawReleasedEmail({
          userId: m.user_id,
          groupId: m.group_id,
          email: m.email,
          displayName: m.display_name,
          groupName: m.group_name,
          tournamentName: TOURNAMENT.name,
        });
        queued++;
      } catch (err) {
        console.error(`[ops] Draw released email failed for ${m.email}: ${err.message}`);
      }
    }

    await logOps('draw', 'released', {
      provider,
      fixtureCount: fixturesWithRound.length,
      rounds: [...new Set(fixturesWithRound.map(f => f.round))],
      emailsQueued: queued,
      memberCount: members.length,
    });

    // Notify admin immediately
    try { await sendAdminDigest(); } catch (e) { /* non-fatal */ }

  } catch (err) {
    console.error('[ops] Draw release check error:', err.message);
  }
}

// ── 3. Lock Time Auto-Setting ───────────────────────────────────────────────

export async function autoSetLockTimes() {
  try {
    const { fixtures } = await fetchFixtures();
    if (!fixtures || fixtures.length === 0) return;

    const rounds = TOURNAMENT.rounds.filter(r => r !== 'R1'); // R1 uses per-match lock
    const currentOverrides = getRuntimeLockOverrides();

    for (const round of rounds) {
      // Skip if a manual override is already set in activeTournament config
      if (TOURNAMENT.lockTimeOverrides[round]) continue;

      // Skip if there's already a runtime override (manual or from a previous auto-set)
      if (currentOverrides[round]) continue;

      // Skip if we already auto-set this round this deploy cycle
      if (autoSetRounds.has(round)) continue;

      // Find all fixtures for this round with start times
      const roundFixtures = fixtures.filter(f => f.round === round && f.startTime);
      if (roundFixtures.length === 0) continue;

      // Find the earliest match start time
      const startTimes = roundFixtures.map(f => new Date(f.startTime));
      const earliest = new Date(Math.min(...startTimes));

      // Lock time = 1 hour before earliest match
      const lockTime = new Date(earliest.getTime() - (60 * 60 * 1000));

      // Only set if lock time is in the future
      if (lockTime <= new Date()) continue;

      // Use the existing runtime lock override system in tennisData.js
      setRuntimeLockOverride(round, lockTime.toISOString());
      autoSetRounds.add(round);

      await logOps('lock_time', 'auto_set', {
        round,
        lockAt: lockTime.toISOString(),
        firstMatch: earliest.toISOString(),
        matchCount: roundFixtures.length,
        source: 'api_start_times',
      });
    }
  } catch (err) {
    console.error('[ops] Lock time auto-set error:', err.message);
    await logOps('lock_time', 'error', { error: err.message });
  }
}

// ── 4. Operations Summary ───────────────────────────────────────────────────

export async function getOpsSummary(hoursBack = 24) {
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  // Recent ops log entries
  const { rows: recentOps } = await pool.query(
    `SELECT category, action, details, created_at
       FROM ops_log
      WHERE tournament_id = $1
        AND created_at >= $2
      ORDER BY created_at DESC
      LIMIT 100`,
    [TOURNAMENT.id, since]
  );

  // Current tournament state
  const { rows: groupStats } = await pool.query(
    `SELECT
       COUNT(DISTINCT gm.user_id) AS total_members,
       COUNT(DISTINCT CASE WHEN gm.is_alive THEN gm.user_id END) AS alive_members,
       COUNT(DISTINCT CASE WHEN NOT gm.is_alive THEN gm.user_id END) AS eliminated_members
     FROM group_members gm
     JOIN groups g ON g.id = gm.group_id
     WHERE g.tournament_id = $1`,
    [TOURNAMENT.id]
  );

  // Picks by round
  const { rows: pickStats } = await pool.query(
    `SELECT p.round,
       COUNT(*) AS total_picks,
       COUNT(CASE WHEN p.survived = true THEN 1 END) AS survived,
       COUNT(CASE WHEN p.survived = false THEN 1 END) AS eliminated,
       COUNT(CASE WHEN p.survived IS NULL THEN 1 END) AS pending
     FROM picks p
     JOIN groups g ON g.id = p.group_id
     WHERE g.tournament_id = $1
     GROUP BY p.round
     ORDER BY ARRAY_POSITION(ARRAY['R1','R64','R32','R16','QF','SF','F'], p.round)`,
    [TOURNAMENT.id]
  );

  // Pending emails
  const { rows: emailStats } = await pool.query(
    `SELECT email_type, COUNT(*) AS count
       FROM emails_sent
      WHERE status = 'pending'
      GROUP BY email_type`
  );

  // Recent match results (from ops log)
  const matchResults = recentOps.filter(o => o.category === 'results');
  const withdrawals = recentOps.filter(o => o.category === 'withdrawal');
  const lockChanges = recentOps.filter(o => o.category === 'lock_time');

  // Current deadlines
  let deadlines = [];
  try {
    deadlines = await getDeadlines();
  } catch (e) {
    deadlines = [{ error: e.message }];
  }

  // Data provider status
  let providerStatus = 'unknown';
  let fixtureCount = 0;
  try {
    const { provider, fixtures } = await fetchFixtures();
    providerStatus = provider;
    fixtureCount = fixtures.length;
  } catch (e) {
    providerStatus = `error: ${e.message}`;
  }

  return {
    tournament: {
      id: TOURNAMENT.id,
      name: TOURNAMENT.name,
      startDate: TOURNAMENT.startDate,
      endDate: TOURNAMENT.endDate,
    },
    dataProvider: {
      active: providerStatus,
      fixtureCount,
    },
    members: groupStats[0] || { total_members: 0, alive_members: 0, eliminated_members: 0 },
    picksByRound: pickStats,
    pendingEmails: emailStats,
    deadlines,
    autoLockOverrides: getRuntimeLockOverrides(),
    recentActivity: {
      period: `Last ${hoursBack} hours`,
      totalEvents: recentOps.length,
      matchResults: matchResults.length,
      withdrawals: withdrawals.length,
      lockTimeChanges: lockChanges.length,
    },
    opsLog: recentOps.slice(0, 50), // Last 50 events
  };
}

// ── 5. Tournament Setup ─────────────────────────────────────────────────────

/**
 * Create a new tournament group with all necessary DB records.
 * Returns the created group details + generated invite code.
 */
export async function setupTournament({
  tournamentId,
  groupName,
  entryFeeCents = 0,
  adminUserId,
}) {
  // Generate a readable invite code
  const prefix = (tournamentId || 'FSV').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);
  const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const inviteCode = `${prefix}-${suffix}`;

  // Check tournament exists in config
  const tournamentConfig = TOURNAMENT.id === tournamentId ? TOURNAMENT : null;

  // Create the group
  const { rows } = await pool.query(
    `INSERT INTO groups (name, invite_code, entry_fee_cents, tournament_id, admin_user_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, invite_code, tournament_id, entry_fee_cents, created_at`,
    [groupName, inviteCode, entryFeeCents, tournamentId, adminUserId]
  );

  const group = rows[0];

  // Verify data provider can reach this tournament
  let providerCheck = { status: 'skipped' };
  try {
    const { provider, fixtures } = await fetchFixtures();
    providerCheck = {
      status: 'ok',
      provider,
      fixtureCount: fixtures.length,
      hasDrawData: fixtures.length > 0,
    };
  } catch (err) {
    providerCheck = { status: 'error', error: err.message };
  }

  await logOps('tournament', 'setup', {
    groupId: group.id,
    groupName: group.name,
    inviteCode: group.invite_code,
    tournamentId,
    entryFeeCents,
    providerCheck,
  });

  return {
    group,
    inviteCode: group.invite_code,
    inviteUrl: `${process.env.FRONTEND_URL || 'https://finalserveivor.com'}/join/${group.invite_code}`,
    providerCheck,
    tournamentConfig: tournamentConfig ? {
      name: tournamentConfig.name,
      startDate: tournamentConfig.startDate,
      endDate: tournamentConfig.endDate,
      drawSize: tournamentConfig.drawSize,
      r1PerMatchLock: tournamentConfig.r1PerMatchLock,
    } : null,
  };
}

// ── Main cron entry point ───────────────────────────────────────────────────

/**
 * Run all operations checks. Called every 15 minutes from index.js.
 * Each check is independent and non-fatal.
 */
export async function runOpsChecks() {
  const startTime = Date.now();

  try { await checkDrawRelease(); }
  catch (err) { console.error('[ops-cron] Draw release check failed:', err.message); }

  try { await checkWithdrawals(); }
  catch (err) { console.error('[ops-cron] Withdrawal check failed:', err.message); }

  try { await autoSetLockTimes(); }
  catch (err) { console.error('[ops-cron] Lock time auto-set failed:', err.message); }

  const elapsed = Date.now() - startTime;
  if (elapsed > 10000) {
    // Log slow runs for debugging
    await logOps('system', 'slow_cron', { elapsedMs: elapsed });
  }
}
