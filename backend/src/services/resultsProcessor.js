/**
 * Automated results processor.
 * Polls the draw for completed matches and updates picks + group_members.
 * Idempotent — safe to run multiple times for the same round.
 */
import { pool } from '../db/pool.js';
import { getDraw, getDeadlines } from './tennisData.js';
import { ROUNDS, TOURNAMENT } from '../config/tournament.js';
import {
  sendSurvivalEmail, sendEliminationEmail, sendWinnerEmail, sendPickReminderEmail,
} from '../utils/email.js';

const ROUND_LABELS = { R1: 'Round 1', R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-finals', SF: 'Semi-finals', F: 'Final' };

/**
 * Process results for a single round.
 * Marks picks survived=true/false for completed matches.
 * Does NOT eliminate non-pickers here — that is handled separately
 * by eliminateNonPickers(), which must only run after the pick window locks.
 */
export async function processRoundResults(round) {
  console.log(`[results] Processing ${round}...`);
  const draw = await getDraw(round);
  const completed = (draw.matches || []).filter(
    m => m.round === round && m.status === 'completed' && m.winnerId
  );

  if (completed.length === 0) {
    console.log(`[results] No completed matches for ${round}`);
    return { round, processed: 0, picksUpdated: 0, eliminated: 0, nonPickers: 0 };
  }

  let picksUpdated = 0;
  let eliminated   = 0;

  for (const m of completed) {
    const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;

    // Grade picks by player_id first, fall back to player_name
    // Winner picks → survived = true
    const w = await pool.query(
      `UPDATE picks SET survived = true
         WHERE round = $1 AND survived IS NULL
           AND (player_id = $2 OR (player_id IS NULL AND lower(player_name) = lower($3)))`,
      [round, m.winnerId, m.winnerName || '']
    );
    picksUpdated += w.rowCount;

    // Loser picks → survived = false
    const l = await pool.query(
      `UPDATE picks SET survived = false
         WHERE round = $1 AND survived IS NULL
           AND (player_id = $2 OR (player_id IS NULL AND lower(player_name) = lower($3)))`,
      [round, loserId, (m.winnerId === m.player1Id ? m.player2Name : m.player1Name) || '']
    );
    picksUpdated += l.rowCount;

    // Eliminate group members whose pick lost
    const e = await pool.query(
      `UPDATE group_members gm
           SET is_alive = false, eliminated_round = $1
         FROM picks p
        WHERE p.round = $1
          AND (p.player_id = $2 OR (p.player_id IS NULL AND lower(p.player_name) = lower($3)))
          AND p.survived = false
          AND p.user_id  = gm.user_id
          AND p.group_id = gm.group_id
          AND gm.is_alive = true`,
      [round, loserId, (m.winnerId === m.player1Id ? m.player2Name : m.player1Name) || '']
    );
    eliminated += e.rowCount;
  }

  console.log(`[results] ${round}: ${completed.length} matches, ${picksUpdated} picks graded, ${eliminated} eliminated`);
  return { round, processed: completed.length, picksUpdated, eliminated, nonPickers: 0 };
}

/**
 * Eliminate group members who did not submit a pick for a round.
 * IMPORTANT: Only call this after the pick window for the round is confirmed locked.
 * Calling it before the window closes would unfairly eliminate users who still have time.
 */
export async function eliminateNonPickers(round) {
  // Safety guard: verify the pick window is locked before eliminating anyone
  try {
    const deadlines = await getDeadlines();
    const roundDeadline = deadlines.find(d => d.round === round);
    if (roundDeadline && !roundDeadline.isLocked) {
      console.log(`[results] Skipping non-picker elimination for ${round} — pick window still open`);
      return 0;
    }
  } catch (err) {
    console.warn(`[results] Could not verify deadline for ${round}, skipping elimination to be safe:`, err.message);
    return 0;
  }

  console.log(`[results] Eliminating non-pickers for ${round}...`);
  const result = await pool.query(
    `UPDATE group_members gm
        SET is_alive = false, eliminated_round = $1
      WHERE gm.is_alive = true
        AND NOT EXISTS (
          SELECT 1 FROM picks p
           WHERE p.group_id = gm.group_id
             AND p.user_id  = gm.user_id
             AND p.round    = $1
        )`,
    [round]
  );
  console.log(`[results] ${round}: ${result.rowCount} non-pickers eliminated`);
  return result.rowCount;
}

/**
 * Auto-detect and process all rounds with completed-but-unprocessed results.
 * Called on a schedule (every 15 min) and by the admin endpoint.
 *
 * eliminateNonPickers is only called when:
 *   1. The round's pick window is confirmed locked (isLocked = true), AND
 *   2. There are still ungraded picks for that round.
 * This prevents premature elimination when matches start before the window closes.
 */
export async function autoProcessResults() {
  console.log('[results] Auto-processing...');

  const draw      = await getDraw();
  const deadlines = await getDeadlines();
  const summary   = [];

  for (const round of ROUNDS) {
    const completed = (draw.matches || []).filter(
      m => m.round === round && m.status === 'completed' && m.winnerId
    );
    if (completed.length === 0) continue;

    // Check for unprocessed picks
    const { rows } = await pool.query(
      `SELECT COUNT(*) FROM picks WHERE round = $1 AND survived IS NULL`,
      [round]
    );
    if (Number(rows[0].count) > 0) {
      console.log(`[results] ${round}: ${rows[0].count} ungraded picks`);
      const result = await processRoundResults(round);
      summary.push(result);
    }

    // Check whether the pick window is locked — only then eliminate non-pickers
    const roundDeadline = deadlines.find(d => d.round === round);
    const windowLocked  = roundDeadline?.isLocked === true;

    if (windowLocked) {
      // Check if any alive members have no pick for this round
      const { rows: noPick } = await pool.query(
        `SELECT COUNT(*) FROM group_members gm
          WHERE gm.is_alive = true
            AND NOT EXISTS (
              SELECT 1 FROM picks p
               WHERE p.group_id = gm.group_id
                 AND p.user_id  = gm.user_id
                 AND p.round    = $1
            )`,
        [round]
      );
      if (Number(noPick[0].count) > 0) {
        const nonPickers = await eliminateNonPickers(round);
        // Update the last summary entry if it exists, or add one
        const existing = summary.find(s => s.round === round);
        if (existing) existing.nonPickers = nonPickers;
        else summary.push({ round, processed: completed.length, picksUpdated: 0, eliminated: 0, nonPickers });
      }
    }
  }

  if (summary.length === 0) console.log('[results] Nothing to process.');
  return summary;
}


// ─────────────────────────────────────────────────────────────────────────────
// Email notifications — called after results are processed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send survival + elimination emails for a round.
 * Also sends winner email if only 1 player remains.
 * Should be called once per round, after ALL matches in the round are completed.
 */
export async function sendRoundResultEmails(round) {
  const tournamentName = TOURNAMENT.name || 'Tournament';
  const roundLabel = ROUND_LABELS[round] || round;

  // Get all groups that have picks for this round
  const { rows: groups } = await pool.query(
    `SELECT DISTINCT g.id, g.name FROM groups g
       JOIN picks p ON p.group_id = g.id
      WHERE p.round = $1`,
    [round]
  );

  for (const group of groups) {
    const groupId = group.id;

    // Count total and alive members
    const { rows: [counts] } = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE is_alive) ::int AS alive
       FROM group_members WHERE group_id = $1`,
      [groupId]
    );

    // Survivors: picks that survived this round and member still alive
    const { rows: survivors } = await pool.query(
      `SELECT p.user_id, p.player_name, p.round, u.email, u.display_name
         FROM picks p
         JOIN users u ON u.id = p.user_id
         JOIN group_members gm ON gm.user_id = p.user_id AND gm.group_id = p.group_id
        WHERE p.group_id = $1 AND p.round = $2 AND p.survived = true AND gm.is_alive = true`,
      [groupId, round]
    );

    // Eliminated: picks that failed or members eliminated this round
    const { rows: eliminated } = await pool.query(
      `SELECT p.user_id, p.player_name, p.round, u.email, u.display_name,
              gm.eliminated_round
         FROM group_members gm
         JOIN users u ON u.id = gm.user_id
         LEFT JOIN picks p ON p.user_id = gm.user_id AND p.group_id = gm.group_id AND p.round = $2
        WHERE gm.group_id = $1 AND gm.eliminated_round = $2`,
      [groupId, round]
    );

    // Send survival emails with pick history
    for (const s of survivors) {
      const { rows: history } = await pool.query(
        `SELECT round, player_name AS "playerName" FROM picks
          WHERE user_id = $1 AND group_id = $2 AND survived = true
          ORDER BY created_at ASC`,
        [s.user_id, groupId]
      );
      sendSurvivalEmail({
        email: s.email,
        displayName: s.display_name,
        groupId,
        tournamentName,
        round,
        roundLabel,
        pickedPlayerName: s.player_name,
        matchScore: null, // Could be enriched from draw data later
        playersRemaining: counts.alive,
        totalPlayers: counts.total,
        pickHistory: history,
      }).catch(err => console.error(`[results-email] Survival email failed for ${s.email}:`, err.message));
    }

    // Send elimination emails
    for (const e of eliminated) {
      // Finishing position: total - alive at time of elimination + 1 would be complex;
      // simpler: count how many were eliminated in this round or later
      const { rows: [pos] } = await pool.query(
        `SELECT COUNT(*)::int AS behind
           FROM group_members
          WHERE group_id = $1 AND is_alive = true`,
        [groupId]
      );
      const finishingPosition = pos.behind + 1; // rough: they finished just behind all alive players

      sendEliminationEmail({
        email: e.email,
        displayName: e.display_name,
        groupId,
        tournamentName,
        round,
        roundLabel,
        pickedPlayerName: e.player_name || null,
        matchScore: null,
        finishingPosition,
        totalPlayers: counts.total,
        playersRemaining: counts.alive,
      }).catch(err => console.error(`[results-email] Elimination email failed for ${e.email}:`, err.message));
    }

    // Check for winner (1 player alive)
    if (counts.alive === 1) {
      const { rows: [winner] } = await pool.query(
        `SELECT gm.user_id, u.email, u.display_name
           FROM group_members gm
           JOIN users u ON u.id = gm.user_id
          WHERE gm.group_id = $1 AND gm.is_alive = true`,
        [groupId]
      );
      if (winner) {
        const { rows: history } = await pool.query(
          `SELECT round, player_name AS "playerName" FROM picks
            WHERE user_id = $1 AND group_id = $2 AND survived = true
            ORDER BY created_at ASC`,
          [winner.user_id, groupId]
        );
        sendWinnerEmail({
          email: winner.email,
          displayName: winner.display_name,
          groupId,
          tournamentName,
          pickHistory: history,
          totalPlayers: counts.total,
        }).catch(err => console.error(`[results-email] Winner email failed for ${winner.email}:`, err.message));
      }
    }
  }
}


/**
 * Send pick reminders to alive members who haven't picked yet.
 * Called by cron — checks each round's deadline and sends if within threshold.
 */
export async function sendPickReminders(hoursBeforeDeadline = 4) {
  const deadlines = await getDeadlines();
  const now = Date.now();
  const tournamentName = TOURNAMENT.name || 'Tournament';

  for (const dl of deadlines) {
    if (dl.isLocked) continue; // Window already closed
    const lockTime = new Date(dl.lockTime).getTime();
    const hoursLeft = (lockTime - now) / (1000 * 60 * 60);

    // Send reminder when within the threshold window (but not already past)
    if (hoursLeft <= 0 || hoursLeft > hoursBeforeDeadline) continue;

    // Only send once — check a simple flag. We use a narrow window:
    // send between hoursBeforeDeadline and (hoursBeforeDeadline - 0.5) hours before lock
    // This means the 15-min cron will hit this window at most twice
    if (hoursLeft < hoursBeforeDeadline - 0.5) continue;

    const round = dl.round;
    const roundLabel = ROUND_LABELS[round] || round;
    console.log(`[reminders] Sending pick reminders for ${round} (${hoursLeft.toFixed(1)}h before lock)`);

    // Find alive members with no pick for this round
    const { rows: needReminder } = await pool.query(
      `SELECT gm.user_id, gm.group_id, u.email, u.display_name
         FROM group_members gm
         JOIN users u ON u.id = gm.user_id
        WHERE gm.is_alive = true
          AND NOT EXISTS (
            SELECT 1 FROM picks p
             WHERE p.group_id = gm.group_id
               AND p.user_id  = gm.user_id
               AND p.round    = $1
          )`,
      [round]
    );

    console.log(`[reminders] ${round}: ${needReminder.length} players need reminders`);

    for (const m of needReminder) {
      sendPickReminderEmail({
        email: m.email,
        displayName: m.display_name,
        groupId: m.group_id,
        tournamentName,
        round,
        roundLabel,
      }).catch(err => console.error(`[reminders] Failed for ${m.email}:`, err.message));
    }
  }
}
