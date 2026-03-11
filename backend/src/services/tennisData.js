/**
 * Tennis draw & results: API-Tennis when configured, else Indian Wells mock.
 * BNP Paribas Open Indian Wells 2026 - 96 players, 32 byes in R1.
 */

import { ROUNDS, MATCHES_PER_ROUND } from '../config/tournament.js';
import { getIndianWellsMockDraw } from '../data/indianWellsDraw.js';
import nodeFetch from 'node-fetch';

const API_BASE = 'https://api.api-tennis.com/tennis';

// Map API round names to our internal round keys (R1, R64, R32, R16, QF, SF, F).
// Indian Wells is a 96-draw: round 1 = R1 (byes), round 2 = R64, round 3 = R32, etc.
const ROUND_MAP = {
  // Text names
  'first round': 'R1',
  'round of 96': 'R1',
  '1st round':   'R1',
  'round 1':     'R1',
  'round of 64': 'R64',
  '2nd round':   'R64',
  'round 2':     'R64',
  'round of 32': 'R32',
  '3rd round':   'R32',
  'round 3':     'R32',
  'round of 16': 'R16',
  '4th round':   'R16',
  'round 4':     'R16',
  'quarter-final':    'QF',
  'quarter-final(s)': 'QF',
  'quarterfinal':     'QF',
  'quarterfinals':    'QF',
  'quarter finals':   'QF',
  'semi-final':    'SF',
  'semi-final(s)': 'SF',
  'semifinal':     'SF',
  'semifinals':    'SF',
  'semi finals':   'SF',
  'final':     'F',
  'the final': 'F',
};

// Numeric round values (API-Tennis often returns "1", "2", "3"...).
// Maps position in ROUNDS array: ROUNDS[0]=R1, ROUNDS[1]=R64, etc.
function normalizeRound(apiRound) {
  if (apiRound === null || apiRound === undefined || apiRound === '') return null;
  const str = String(apiRound).toLowerCase().trim();

  // Named round (direct map)
  if (ROUND_MAP[str]) return ROUND_MAP[str];

  // Already a valid internal key (e.g. "R32")
  if (ROUNDS.includes(str.toUpperCase())) return str.toUpperCase();

  // Strip "ATP [Tournament Name] - " prefix, e.g. "ATP Indian Wells - 1/64-finals"
  const roundPart = str.replace(/^atp\s+.+?\s+-\s+/, '').trim();

  // Try direct map again after stripping prefix (e.g. "final", "semifinals")
  if (ROUND_MAP[roundPart]) return ROUND_MAP[roundPart];

  // Fraction notation: "1/64-finals", "1/32-finals", "1/4-finals", etc.
  // The denominator corresponds to the number of matches in a standard 128-draw bracket.
  // For Indian Wells 96-draw: "1/64-finals" covers both R1 (pre-seeds) and R64 (seeds enter).
  const fracMatch = roundPart.match(/^1\/(\d+)-finals?$/);
  if (fracMatch) {
    const denom = parseInt(fracMatch[1], 10);
    // Indian Wells 96-draw confirmed mapping from live API data:
    //   1/64-finals (24 fixtures) = R1  — non-seeds first round
    //   1/32-finals (32 fixtures) = R64 — top seeds enter + R1 winners
    //   1/16-finals (16 fixtures) = R32
    //   1/8-finals               = R16
    //   1/4-finals               = QF
    //   1/2-finals               = SF
    if (denom === 64) return 'R1';
    if (denom === 32) return 'R64';
    if (denom === 16) return 'R32';
    if (denom === 8)  return 'R16';
    if (denom === 4)  return 'QF';
    if (denom === 2)  return 'SF';
  }

  // Numeric round: "1" → ROUNDS[0], "2" → ROUNDS[1], etc.
  const num = parseInt(str, 10);
  if (!Number.isNaN(num) && num >= 1 && num <= ROUNDS.length) {
    return ROUNDS[num - 1];
  }

  return null;
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
 *
 * Strategy:
 * 1. Try to use `tournament_round` field from the API via ROUND_MAP — this is the most
 *    accurate approach and handles Indian Wells byes correctly (R1 and R64 overlap in dates).
 * 2. Fall back to sequential date-based assignment only when round fields are all blank.
 */
function buildDrawFromFixtures(fixtures) {
  const playersMap = new Map();
  const matchesByRound = {};
  ROUNDS.forEach((r) => (matchesByRound[r] = []));

  // Filter out explicit qualification matches
  const mainFixtures = fixtures.filter((f) => {
    const q = String(f.event_qualification ?? '').toLowerCase();
    return q !== 'true' && q !== '1';
  });

  // Check whether the API provides usable round names
  const hasRoundField = mainFixtures.some((f) => {
    const raw = f.tournament_round || f.event_round || '';
    return raw && normalizeRound(raw);
  });

  function buildMatch(f, round) {
    const player1 = {
      id: String(f.first_player_key ?? `${f.event_key}-p1`),
      name: f.event_first_player || 'TBD',
    };
    const player2 = {
      id: String(f.second_player_key ?? `${f.event_key}-p2`),
      name: f.event_second_player || 'TBD',
    };
    playersMap.set(player1.id, playersMap.get(player1.id) ?? { ...player1, roundEliminated: null });
    playersMap.set(player2.id, playersMap.get(player2.id) ?? { ...player2, roundEliminated: null });

    const dt = toFixtureDate(f);
    const startTime = dt ? dt.toISOString() : null;

    let winnerId = null;
    let winnerName = null;
    let status = (f.event_status || '').toLowerCase().includes('finish') ? 'completed' : 'scheduled';
    if (f.event_winner === 'First Player') { winnerId = player1.id; winnerName = player1.name; }
    else if (f.event_winner === 'Second Player') { winnerId = player2.id; winnerName = player2.name; }
    if (winnerId) status = 'completed';

    return {
      id: `m-${round}-${f.event_key}`,
      round,
      matchOrder: (matchesByRound[round] || []).length,
      player1Id: player1.id, player1Name: player1.name,
      player2Id: player2.id, player2Name: player2.name,
      winnerId, winnerName, status, startTime,
    };
  }

  if (hasRoundField) {
    // ── Path 1: use API round names ──────────────────────────────────────────
    for (const f of mainFixtures) {
      const raw = f.tournament_round || f.event_round || '';
      const round = normalizeRound(raw);
      if (!round || !matchesByRound[round]) continue;
      matchesByRound[round].push(buildMatch(f, round));
    }
  } else {
    // ── Path 2: sequential assignment by date (fallback) ─────────────────────
    const sorted = [...mainFixtures].sort((a, b) => {
      const da = toFixtureDate(a);
      const db = toFixtureDate(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    });
    let idx = 0;
    for (const round of ROUNDS) {
      const count = MATCHES_PER_ROUND[round] || 0;
      for (let i = 0; i < count && idx < sorted.length; i++, idx++) {
        matchesByRound[round].push(buildMatch(sorted[idx], round));
      }
    }
  }

  // Compute roundEliminated per player
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
 * Expose raw API fixtures for debugging — used by GET /api/draw/debug.
 * Returns null if API not configured or unavailable.
 */
export async function getRawFixtures() {
  return fetchApiDraw();
}

/**
 * Get round pick-window deadlines.
 *
 * A round's pick window:
 *   OPENS  — 12 hours after the first match of the PREVIOUS round starts.
 *            This doesn't require all previous matches to finish, which is
 *            important because rounds overlap in tournaments with byes.
 *            R1 (first round) is always considered open from the start.
 *   LOCKS  — 30 minutes before the first scheduled match of THIS round.
 *
 * If a round has no match data yet (e.g. draw not released) it is marked
 * pending and neither open nor locked.
 */
export async function getDeadlines() {
  const fixtures = await fetchApiDraw();
  if (!fixtures || fixtures.length === 0) {
    // No live data — fall back to mock schedule based on Indian Wells dates.
    // R1 started Mar 5, R64 Mar 6, R32 Mar 8, R16 Mar 10, QF Mar 12, SF Mar 14, F Mar 16
    const ROUND_DATES = {
      R1:  '2026-03-05T11:00:00',
      R64: '2026-03-06T11:00:00',
      R32: '2026-03-08T11:00:00',
      R16: '2026-03-10T11:00:00',
      QF:  '2026-03-12T11:00:00',
      SF:  '2026-03-14T11:00:00',
      F:   '2026-03-16T11:00:00',
    };
    const now = new Date();
    return ROUNDS.map((round, i) => {
      const firstStart = ROUND_DATES[round] ? new Date(ROUND_DATES[round]) : null;
      const lockAtDate = firstStart ? new Date(firstStart.getTime() - 60 * 60 * 1000) : null;
      const lockAt    = lockAtDate ? lockAtDate.toISOString() : null;
      const isLocked  = lockAtDate ? now >= lockAtDate : false;

      let opensAt = null;
      if (i === 0) {
        opensAt = null; // R1 always open from the start
      } else {
        const prevFirstStart = ROUND_DATES[ROUNDS[i - 1]] ? new Date(ROUND_DATES[ROUNDS[i - 1]]) : null;
        opensAt = prevFirstStart
          ? new Date(prevFirstStart.getTime() + 12 * 60 * 60 * 1000).toISOString()
          : null;
      }
      const hasOpened = i === 0 || (opensAt && now >= new Date(opensAt));
      const isOpen    = hasOpened && !isLocked;

      return { round, opensAt, lockAt, isLocked, isOpen };
    });
  }

  const draw = buildDrawFromFixtures(fixtures);
  const matchesByRound = {};
  ROUNDS.forEach((r) => (matchesByRound[r] = []));
  (draw.matches || []).forEach((m) => {
    if (matchesByRound[m.round]) matchesByRound[m.round].push(m);
  });

  const now = new Date();
  return ROUNDS.map((round, index) => {
    const roundMatches = matchesByRound[round] || [];

    // First scheduled start time for this round
    const firstStart = roundMatches
      .map((m) => (m.startTime ? new Date(m.startTime) : null))
      .filter((d) => d && !Number.isNaN(d.getTime()))
      .sort((a, b) => a - b)[0] || null;

    const lockAtDate = firstStart ? new Date(firstStart.getTime() - 60 * 60 * 1000) : null;
    const lockAt     = lockAtDate ? lockAtDate.toISOString() : null;
    const isLocked   = lockAtDate ? now >= lockAtDate : false;

    // Window opens 12h after the first match of the nearest non-empty previous round starts.
    // This is tolerant of round overlap and doesn't require full completion.
    // We skip over empty rounds (e.g. R1 is empty when API folds it into R64).
    let opensAt = null;
    if (index > 0) {
      let prevFirstStart = null;
      for (let pi = index - 1; pi >= 0; pi--) {
        const prevMatches = matchesByRound[ROUNDS[pi]] || [];
        prevFirstStart = prevMatches
          .map((m) => (m.startTime ? new Date(m.startTime) : null))
          .filter((d) => d && !Number.isNaN(d.getTime()))
          .sort((a, b) => a - b)[0] || null;
        if (prevFirstStart) break; // found a non-empty previous round
      }
      if (prevFirstStart) {
        opensAt = new Date(prevFirstStart.getTime() + 12 * 60 * 60 * 1000).toISOString();
      }
    }

    const hasOpened = index === 0 || (opensAt && now >= new Date(opensAt));
    const isOpen    = hasOpened && !isLocked;

    return { round, opensAt, lockAt, isLocked, isOpen };
  });
}
