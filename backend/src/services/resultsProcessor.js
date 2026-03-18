/**
 * Automated results processor.
 * Polls the draw for completed matches and updates picks + group_members.
 * Idempotent — safe to run multiple times for the same round.
 */
import { pool } from '../db/pool.js';
import { getDraw } from './tennisData.js';
import { ROUNDS } from '../config/tournament.js';

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
      `UPDATE picks SET survived = true WHERE round = $1 AND player_id = $2 AND survived IS NULL`,
      [round, winnerId]
    );
    picksUpdated += w.rowCount;

    const l = await pool.query(
      `UPDATE picks SET survived = false WHERE round = $1 AND player_id = $2 AND survived IS NULL`,
      [round, loserId]
    );
    picksUpdated += l.rowCount;

    const e = await pool.query(
      `UPDATE group_members gm
         SET is_alive = false, eliminated_round = $1
         FROM picks p
        WHERE p.round = $1
          AND p.player_id = $2
          AND p.survived = false
          AND p.user_id = gm.user_id
          AND p.group_id = gm.group_id
          AND gm.is_alive = true`,
      [round, loserId]
    );
    eliminated += e.rowCount;
  }

  console.log(`[results] ${round}: ${completed.length} matches, ${picksUpdated} picks updated, ${eliminated} eliminated`);
  return { round, processed: completed.length, picksUpdated, eliminated };
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
      `SELECT COUNT(*) FROM picks WHERE round = $1 AND survived IS NULL`,
      [round]
    );
    if (Number(rows[0].count) === 0) continue;

    console.log(`[results] ${round}: ${rows[0].count} unprocessed picks found`);
    const result = await processRoundResults(round);
    summary.push(result);
  }

  if (summary.length === 0) console.log('[results] Nothing to process.');
  return summary;
}
