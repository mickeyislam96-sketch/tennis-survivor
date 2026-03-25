/**
 * Automated results processor.
 * Polls the draw for completed matches and updates picks + group_members.
 * Idempotent — safe to run multiple times for the same round.
 */
import { pool } from '../db/pool.js';
import { getDraw, getDeadlines } from './tennisData.js';
import { ROUNDS } from '../config/tournament.js';

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
