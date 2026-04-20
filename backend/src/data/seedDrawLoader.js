/**
 * Seed Draw Loader — generic, reusable draw builder.
 *
 * Reads a tournament seed draw JSON file and produces a mock draw object
 * (players + matches) in the exact format that getAvailablePlayers() and
 * the bracket viewer expect.
 *
 * The seed draw JSON is the "source of truth" for WHO plays WHO.
 * Goalserve (via seedDrawOverlay) is the source of truth for WHAT HAPPENED.
 *
 * Supports: 96-draw (Masters 1000), 128-draw (Grand Slams), 56-draw (ATP 500).
 *
 * Usage:
 *   import { loadSeedDraw } from './seedDrawLoader.js';
 *   const draw = loadSeedDraw('madrid-2026', currentRound);
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_DRAWS_DIR = join(__dirname, 'seedDraws');

// Cache loaded JSON so we don't re-read from disk on every request.
const jsonCache = {};

function loadJson(tournamentId) {
  if (jsonCache[tournamentId]) return jsonCache[tournamentId];
  try {
    const filePath = join(SEED_DRAWS_DIR, `${tournamentId}.json`);
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    jsonCache[tournamentId] = data;
    return data;
  } catch (err) {
    console.error(`[seedDrawLoader] Failed to load ${tournamentId}: ${err.message}`);
    return null;
  }
}

/**
 * Clear cached JSON for a tournament (useful if qualifier names are updated).
 */
export function clearSeedDrawCache(tournamentId) {
  delete jsonCache[tournamentId];
}

/**
 * Check whether a seed draw JSON exists for the given tournament.
 */
export function hasSeedDraw(tournamentId) {
  if (jsonCache[tournamentId]) return true;
  try {
    const filePath = join(SEED_DRAWS_DIR, `${tournamentId}.json`);
    readFileSync(filePath, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Build the full mock draw from a seed draw JSON.
 *
 * Returns the same shape as getMonteCarlMockDraw():
 * {
 *   players: Player[],
 *   matches: Match[],
 *   rounds: string[],
 *   currentRound: string | null,
 *   tournament: string,
 *   seedsWithByes: number,
 *   dataSource: 'seed_draw',
 * }
 */
export function loadSeedDraw(tournamentId, currentRound = null) {
  const data = loadJson(tournamentId);
  if (!data) {
    console.error(`[seedDrawLoader] No seed draw for ${tournamentId}`);
    return { players: [], matches: [], rounds: [], currentRound, dataSource: 'seed_draw_missing' };
  }

  const { drawPositions, rounds, matchesPerRound, seedsWithByes } = data;
  const prefix = tournamentId.replace(/-\d+$/, ''); // e.g. 'madrid' from 'madrid-2026'

  // ── Build players array ───────────────────────────────────────────────────
  const players = [];
  const posToPlayerId = {};  // drawPos → player ID (for match building)

  for (const dp of drawPositions) {
    if (dp.bye) continue; // Bye slots aren't real players

    let id;
    if (dp.qualifier && !dp.name) {
      id = `${prefix}-q${dp.pos}`;
    } else if (dp.seed && typeof dp.seed === 'number') {
      id = `${prefix}-s${dp.seed}`;
    } else {
      id = `${prefix}-p${dp.pos}`;
    }

    const player = {
      id,
      name: dp.name || `Qualifier ${dp.pos}`,
      seed: dp.seed || null,
      country: dp.country || null,
      roundEliminated: null,
      apiKey: null,
      isQualifier: dp.qualifier || false,
    };

    players.push(player);
    posToPlayerId[dp.pos] = id;
  }

  // Build a lookup: player ID → player object
  const playerById = {};
  for (const p of players) {
    playerById[p.id] = p;
  }

  // ── Build matches ─────────────────────────────────────────────────────────
  const matches = [];
  const roundIndex = currentRound ? rounds.indexOf(currentRound) : -1;

  // In a 96-draw Masters 1000:
  //   128 draw positions → 64 first-round slots (pairs: 1v2, 3v4, 5v6, ...)
  //   32 of these are byes (seed + bye position)
  //   32 are real R1 matches
  //
  // In a 128-draw Grand Slam:
  //   128 draw positions → 64 first-round matches (32 seeds + 32 non-seeds,
  //   but seeds DO play R1 — no byes)
  //
  // The JSON drawPositions array handles both: bye positions have bye:true.

  // R1 / Round of 128: pair consecutive draw positions (1v2, 3v4, etc.)
  const firstRound = rounds[0]; // 'R1' for both Masters and Slams
  const firstRoundMatches = [];
  let matchOrder = 0;

  for (let i = 0; i < drawPositions.length; i += 2) {
    const dp1 = drawPositions[i];
    const dp2 = drawPositions[i + 1];
    const matchIdx = i / 2;

    const isBye = dp1.bye || dp2.bye;
    const p1Id = posToPlayerId[dp1.pos] || null;
    const p2Id = posToPlayerId[dp2.pos] || null;
    const p1Name = dp1.name || (dp1.qualifier ? `Qualifier ${dp1.pos}` : 'BYE');
    const p2Name = dp2.name || (dp2.qualifier ? `Qualifier ${dp2.pos}` : 'BYE');

    const match = {
      id: `m-${firstRound}-${matchIdx}`,
      round: firstRound,
      matchOrder: matchOrder++,
      player1Id: p1Id,
      player1Name: dp1.bye ? 'BYE' : p1Name,
      player2Id: p2Id,
      player2Name: dp2.bye ? 'BYE' : p2Name,
      winnerId: null,
      winnerName: null,
      status: 'scheduled',
      bye: isBye,
      startTime: null,
    };

    // For bye matches, the non-bye player automatically advances
    if (isBye) {
      match.status = 'bye';
      if (dp1.bye && !dp2.bye) {
        match.winnerId = p2Id;
        match.winnerName = p2Name;
      } else if (dp2.bye && !dp1.bye) {
        match.winnerId = p1Id;
        match.winnerName = p1Name;
      }
    }

    matches.push(match);
    firstRoundMatches.push(match);
  }

  // Subsequent rounds: pair consecutive winners from the previous round
  let prevRoundMatches = firstRoundMatches;

  for (let ri = 1; ri < rounds.length; ri++) {
    const round = rounds[ri];
    const count = matchesPerRound[round];
    const roundMatches = [];

    for (let i = 0; i < count; i++) {
      const feeder1 = prevRoundMatches[i * 2];
      const feeder2 = prevRoundMatches[i * 2 + 1];

      // For the immediate next round after R1, use bye winners as known players.
      // For further rounds, players are TBD until results come in.
      const p1Known = feeder1?.winnerId && feeder1.bye;
      const p2Known = feeder2?.winnerId && feeder2.bye;

      const p1Id = p1Known ? feeder1.winnerId : null;
      const p1Name = p1Known ? feeder1.winnerName : null;
      const p2Id = p2Known ? feeder2.winnerId : null;
      const p2Name = p2Known ? feeder2.winnerName : null;

      const match = {
        id: `m-${round}-${i}`,
        round,
        matchOrder: i,
        player1Id: p1Id,
        player1Name: p1Name,
        player2Id: p2Id,
        player2Name: p2Name,
        winnerId: null,
        winnerName: null,
        status: 'scheduled',
        bye: false,
        startTime: null,
      };

      matches.push(match);
      roundMatches.push(match);
    }

    prevRoundMatches = roundMatches;
  }

  // ── Apply round statuses based on currentRound ────────────────────────────
  if (roundIndex >= 0) {
    const eliminated = new Set();

    matches.forEach(m => {
      if (m.bye) return;
      const r = rounds.indexOf(m.round);
      if (r < roundIndex) {
        // Past round — mark completed. player1 wins in mock mode.
        m.status = 'completed';
        m.winnerId = m.player1Id;
        m.winnerName = m.player1Name;
        if (m.player2Id) eliminated.add(m.player2Id);
      } else if (r === roundIndex) {
        m.status = 'in_progress';
      }
    });

    // Mark eliminated players
    for (const p of players) {
      if (eliminated.has(p.id)) {
        p.roundEliminated = currentRound; // approximate — real data overrides this
      }
    }
  }

  return {
    players,
    matches,
    rounds,
    currentRound,
    tournament: data.tournament,
    seedsWithByes: seedsWithByes || 0,
    dataSource: 'seed_draw',
  };
}
