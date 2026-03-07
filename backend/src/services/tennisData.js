/**
 * Tennis draw & results: API-Tennis when configured, else Indian Wells mock.
 * BNP Paribas Open Indian Wells 2026 - 96 players, 32 byes in R1.
 */

import { ROUNDS, MATCHES_PER_ROUND } from '../config/tournament.js';
import { getIndianWellsMockDraw } from '../data/indianWellsDraw.js';
import nodeFetch from 'node-fetch';

const API_BASE = 'https://api.api-tennis.com/tennis';

// Map API round names to our round keys (R1, R64, R32, R16, QF, SF, F)
const ROUND_MAP = {
  'first round': 'R1',
  'round of 96': 'R1',
  '1st round': 'R1',
  'round 1': 'R1',
  'round of 64': 'R64',
  '2nd round': 'R64',
  'round 2': 'R64',
  'round of 32': 'R32',
  '3rd round': 'R32',
  'round 3': 'R32',
  'round of 16': 'R16',
  '4th round': 'R16',
  'round 4': 'R16',
  'quarter-final': 'QF',
  'quarter-final(s)': 'QF',
  'quarterfinal': 'QF',
  'quarterfinals': 'QF',
  'semi-final': 'SF',
  'semi-final(s)': 'SF',
  'semifinal': 'SF',
  'semifinals': 'SF',
  'final': 'F',
  'the final': 'F',
};

function normalizeRound(apiRound) {
  if (!apiRound) return null;
  const key = String(apiRound).toLowerCase().trim();
  return ROUND_MAP[key] || (ROUNDS.includes(key) ? key : null);
}

/**
 * Fetch fixtures from API-Tennis for Indian Wells 2026.
 * Requires TENNIS_API_KEY and optionally TOURNAMENT_KEY (Indian Wells ATP singles).
 */
const fetchImpl = typeof fetch !== 'undefined' ? fetch : nodeFetch;

async function fetchApiDraw() {
  const apiKey = process.env.TENNIS_API_KEY;
  const tournamentKey = process.env.INDIAN_WELLS_TOURNAMENT_KEY || process.env.TOURNAMENT_KEY;
  if (!apiKey || !tournamentKey) return null;

  // Indian Wells 2026 typically March 5-16
  const dateStart = '2026-03-05';
  const dateStop = '2026-03-16';
  const url = `${API_BASE}/?method=get_fixtures&APIkey=${apiKey}&tournament_key=${tournamentKey}&tournament_season=2026&date_start=${dateStart}&date_stop=${dateStop}`;

  try {
    const res = await fetchImpl(url);
    const data = await res.json();
    if (!data?.success || !Array.isArray(data.result)) return null;
    return data.result;
  } catch (e) {
    console.warn('Tennis API fetch failed:', e.message);
    return null;
  }
}

function toFixtureDate(f) {
  if (f.startTime) {
    const d = new Date(f.startTime);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (f.event_date) {
    const time = typeof f.event_time === 'string' && f.event_time ? f.event_time : '00:00';
    const d = new Date(`${f.event_date}T${time}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Build draw + results from API fixtures.
 * We do NOT rely on `tournament_round` because for many tournaments it is blank,
 * which was causing the frontend to see no players/matches.
 * Instead we:
 * - Filter to main-draw matches (exclude explicit qualifications).
 * - Sort by scheduled date/time.
 * - Assign matches to rounds sequentially using MATCHES_PER_ROUND (R1, R64, R32, R16, QF, SF, F).
 */
function buildDrawFromFixtures(fixtures) {
  const playersMap = new Map(); // id -> { id, name, seed?, roundEliminated }
  const matchesByRound = {};
  ROUNDS.forEach((r) => (matchesByRound[r] = []));

  // Filter out explicit qualification matches if present
  const mainFixtures = fixtures.filter((f) => {
    const q = String(f.event_qualification ?? '').toLowerCase();
    return q !== 'true' && q !== '1';
  });

  const sorted = [...mainFixtures].sort((a, b) => {
    const da = toFixtureDate(a);
    const db = toFixtureDate(b);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da - db;
  });

  let fixtureIndex = 0;

  for (const round of ROUNDS) {
    const count = MATCHES_PER_ROUND[round] || 0;
    for (let i = 0; i < count && fixtureIndex < sorted.length; i += 1, fixtureIndex += 1) {
      const f = sorted[fixtureIndex];

      const player1 = {
        id: String(f.first_player_key ?? `${f.event_key}-p1`),
        name: f.event_first_player || 'TBD',
      };
      const player2 = {
        id: String(f.second_player_key ?? `${f.event_key}-p2`),
        name: f.event_second_player || 'TBD',
      };

      playersMap.set(player1.id, { ...player1, roundEliminated: null });
      playersMap.set(player2.id, { ...player2, roundEliminated: null });

      const dt = toFixtureDate(f);
      const startTime = dt ? dt.toISOString() : null;

      let winnerId = null;
      let winnerName = null;
      let status = (f.event_status || '').toLowerCase().includes('finish') ? 'completed' : 'scheduled';
      if (f.event_winner === 'First Player') {
        winnerId = player1.id;
        winnerName = player1.name;
      } else if (f.event_winner === 'Second Player') {
        winnerId = player2.id;
        winnerName = player2.name;
      }
      if (winnerId) status = 'completed';

      matchesByRound[round].push({
        id: `m-${round}-${f.event_key}`,
        round,
        matchOrder: matchesByRound[round].length,
        player1Id: player1.id,
        player1Name: player1.name,
        player2Id: player2.id,
        player2Name: player2.name,
        winnerId,
        winnerName,
        status,
        startTime,
      });
    }
  }

  // Compute roundEliminated for each player from completed matches
  const eliminated = new Set();
  for (const round of ROUNDS) {
    for (const m of matchesByRound[round] || []) {
      if (m.status !== 'completed' || !m.winnerId) continue;
      const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
      eliminated.add(loserId);
    }
    eliminated.forEach((id) => {
      const p = playersMap.get(id);
      if (p && p.roundEliminated == null) p.roundEliminated = round;
    });
  }

  const players = Array.from(playersMap.values());
  const matches = ROUNDS.flatMap((r) => matchesByRound[r] || []);

  return { players, matches, rounds: ROUNDS };
}

/**
 * Get draw with results. Uses live API if configured, else Indian Wells mock.
 */
export async function getDraw(roundFilter = null) {
  const fixtures = await fetchApiDraw();
  if (fixtures && fixtures.length > 0) {
    const draw = buildDrawFromFixtures(fixtures);
    const currentRound = roundFilter || ROUNDS[ROUNDS.length - 1];
    return { ...draw, currentRound };
  }
  return getIndianWellsMockDraw(roundFilter || 'R32');
}

/**
 * Get list of rounds (for dropdowns etc.)
 */
export function getRounds() {
  return [...ROUNDS];
}

/**
 * Get round lock deadlines based on live fixtures.
 * - Each round locks 30 minutes before the first scheduled match of that round.
 * - A round is considered "open" only after all matches in the previous round are completed.
 */
export async function getDeadlines() {
  const fixtures = await fetchApiDraw();
  if (!fixtures || fixtures.length === 0) {
    // Fallback: no live data, keep a simple sequential schedule starting now.
    const now = new Date();
    return ROUNDS.map((round, i) => ({
      round,
      lockAt: new Date(now.getTime() + (i + 1) * 24 * 60 * 60 * 1000).toISOString(),
      isLocked: false,
      isOpen: i === 0,
    }));
  }

  const draw = buildDrawFromFixtures(fixtures);
  const matchesByRound = {};
  ROUNDS.forEach((r) => (matchesByRound[r] = []));
  (draw.matches || []).forEach((m) => {
    if (!matchesByRound[m.round]) matchesByRound[m.round] = [];
    matchesByRound[m.round].push(m);
  });

  const now = new Date();
  return ROUNDS.map((round, index) => {
    const roundMatches = matchesByRound[round] || [];
    const firstStart = roundMatches
      .map((m) => (m.startTime ? new Date(m.startTime) : null))
      .filter((d) => d && !Number.isNaN(d.getTime()))
      .sort((a, b) => a - b)[0] || null;

    const lockAtDate = firstStart ? new Date(firstStart.getTime() - 30 * 60 * 1000) : null;
    const lockAt = lockAtDate ? lockAtDate.toISOString() : null;
    const isLocked = lockAtDate ? now >= lockAtDate : false;

    let previousRoundFinished = true;
    if (index > 0) {
      const prevRound = ROUNDS[index - 1];
      const prevMatches = matchesByRound[prevRound] || [];
      previousRoundFinished =
        prevMatches.length > 0 && prevMatches.every((m) => m.status === 'completed');
    }

    const isOpen = previousRoundFinished && !isLocked;

    return {
      round,
      lockAt,
      isLocked,
      isOpen,
    };
  });
}
