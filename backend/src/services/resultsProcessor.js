/**
 * Automated results processor.
 * Polls the draw for completed matches and updates picks + group_members.
 * Idempotent — safe to run multiple times for the same round.
 */
import { pool } from '../db/pool.js';
import { getDraw, getDeadlines } from './tennisData.js';
import { TOURNAMENT, ROUNDS } from '../config/tournament.js';
import { sendRoundResultEmail } from '../utils/email.js';
import { logOps } from './opsMonitor.js';

/**
 * Process results for a single round.
 * Marks picks survived=true/false, eliminates members who picked losers.
 */
export async function processRoundResults(round) {
  console.log(`[results] Processing ${round}...`);
  const draw = await getDraw(round);
  const completed = (draw.matches || []).filter(
    (m) => m.round === round && m.status === 'completed' && m.winnerId
  );

  if (completed.length === 0) {
    console.log(`[results] No completed matches for ${round}`);
    return { round, processed: 0, picksUpdated: 0, eliminated: 0 };
  }

  const outcomes = completed.map((m) => ({
    winnerId: m.winnerId,
    loserId: m.winnerId === m.player1Id ? m.player2Id : m.player1Id,
  }));

  let picksUpdated = 0;
  let eliminated = 0;

  for (const { winnerId, loserId } of outcomes) {
    const w = await pool.query(
      `UPDATE picks SET survived = true WHERE round = $1 AND player_id = $2 AND survived IS NULL AND tournament_id = $3`,
      [round, winnerId, TOURNAMENT.id]
    );
    picksUpdated += w.rowCount;

    const l = await pool.query(
      `UPDATE picks SET survived = false WHERE round = $1 AND player_id = $2 AND survived IS NULL AND tournament_id = $3`,
      [round, loserId, TOURNAMENT.id]
    );
    picksUpdated += l.rowCount;

    const e = await pool.query(
      `UPDATE group_members gm
         SET is_alive = false, eliminated_round = $1
         FROM picks p
         JOIN groups g ON g.id = p.group_id
        WHERE p.round = $1
          AND p.player_id = $2
          AND p.survived = false
          AND p.user_id = gm.user_id
          AND p.group_id = gm.group_id
          AND gm.is_alive = true
          AND g.tournament_id = $3`,
      [round, loserId, TOURNAMENT.id]
    );
    eliminated += e.rowCount;
  }

  // Send round result emails for all picks that now have a result.
  // sendWithDedup ensures each user only gets one email per round,
  // even if this function runs multiple times.
  await sendResultEmails(round);

  const nonPickers = await eliminateNonPickers(round);
  console.log(`[results] ${round}: ${completed.length} matches, ${picksUpdated} picks updated, ${eliminated} eliminated, ${nonPickers} non-pickers removed`);

  // Log to persistent ops log (only when something actually happened)
  if (picksUpdated > 0 || eliminated > 0 || nonPickers > 0) {
    await logOps('results', 'processed', {
      round,
      matchesCompleted: completed.length,
      picksUpdated,
      eliminated,
      nonPickers,
    });
  }

  return { round, processed: completed.length, picksUpdated, eliminated, nonPickers };
}

/**
 * Auto-detect and process all rounds with completed-but-unprocessed results.
 * Safe to call on a schedule.
 */
export async function autoProcessResults() {
  console.log('[results] Auto-processing...');
  const draw = await getDraw();
  const summary = [];

  for (const round of ROUNDS) {
    const completed = (draw.matches || []).filter(
      (m) => m.round === round && m.status === 'completed' && m.winnerId
    );
    if (completed.length === 0) continue;

    const { rows } = await pool.query(
      `SELECT COUNT(*) FROM picks WHERE round = $1 AND survived IS NULL AND tournament_id = $2`,
      [round, TOURNAMENT.id]
    );
    if (Number(rows[0].count) === 0) continue;

    console.log(`[results] ${round}: ${rows[0].count} unprocessed picks found`);
    const result = await processRoundResults(round);
    summary.push(result);
  }

  if (summary.length === 0) console.log('[results] Nothing to process.');
  return summary;
}

/**
 * Eliminate group members who did not submit a pick for a round.
 * Called after a round locks — anyone still alive with no pick is out.
 */
export async function eliminateNonPickers(round) {
  // Guard: do not eliminate non-pickers if the pick window is still open
  try {
    const deadlines = await getDeadlines();
    const roundDeadline = deadlines.find(d => d.round === round);
    if (roundDeadline && !roundDeadline.isLocked) {
      console.log(`[results] Skipping non-picker elimination for ${round} — pick window still open`);
      return 0;
    }
  } catch (err) {
    console.warn(`[results] Could not check deadline for ${round}, proceeding cautiously:`, err.message);
    // If we can't verify the deadline, skip elimination to be safe
    return 0;
  }

  console.log(`[results] Eliminating non-pickers for ${round}...`);
  const result = await pool.query(
    `UPDATE group_members gm
        SET is_alive = false, eliminated_round = $1
       FROM groups g
      WHERE g.id = gm.group_id
        AND g.tournament_id = $2
        AND gm.is_alive = true
        AND NOT EXISTS (
          SELECT 1 FROM picks p
           WHERE p.group_id = gm.group_id
             AND p.user_id  = gm.user_id
             AND p.round    = $1
        )`,
    [round, TOURNAMENT.id]
  );
  console.log(`[results] ${round}: ${result.rowCount} non-pickers eliminated`);
  return result.rowCount;
}

/**
 * Send round result emails for all resolved picks in a round.
 * Uses sendWithDedup — safe to call repeatedly; duplicates are impossible.
 */
async function sendResultEmails(round) {
  try {
    const { rows } = await pool.query(
      `SELECT p.user_id, p.group_id, p.player_name, p.survived,
              u.email, u.display_name
         FROM picks p
         JOIN users u ON u.id = p.user_id
         JOIN groups g ON g.id = p.group_id
        WHERE p.round = $1
          AND p.survived IS NOT NULL
          AND u.email IS NOT NULL
          AND g.tournament_id = $2`,
      [round, TOURNAMENT.id]
    );

    let sent = 0;
    for (const row of rows) {
      try {
        const result = await sendRoundResultEmail({
          userId: row.user_id,
          groupId: row.group_id,
          round,
          email: row.email,
          displayName: row.display_name,
          playerName: row.player_name,
          survived: row.survived,
        });
        if (result.sent || result.reason === 'dry_run') sent++;
      } catch (err) {
        // Non-fatal — log and continue to next user
        console.error(`[results-email] Failed for ${row.email}: ${err.message}`);
      }
    }
    console.log(`[results-email] ${round}: ${sent} result emails processed (${rows.length} total picks)`);
  } catch (err) {
    // Non-fatal — don't let email failures break results processing
    console.error(`[results-email] Error querying picks for ${round}: ${err.message}`);
  }
}
