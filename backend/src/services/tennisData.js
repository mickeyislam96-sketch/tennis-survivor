/**
 * Tennis draw & results: API-Tennis when configured, else Indian Wells mock.
 * Active tournament: Miami Open 2026 — 96-player draw, same R1/R64/.../F structure.
 * Ensure INDIAN_WELLS_TOURNAMENT_KEY on Railway is set to the Miami tournament key.
 */

import { ROUNDS, MATCHES_PER_ROUND } from '../config/tournament.js';
import { getMiamiMockDraw } from '../data/miamiDraw.js';
import nodeFetch from 'node-fetch';
import { fetchSofascoreFixtures } from './sofascoreAdapter.js';

const API_BASE = 'https://api.api-tennis.com/tennis';

// Map API round names to our internal round keys (R1, R64, R32, R16, QF, SF, F).
// Indian Wells is a 96-draw: round 1 = R1 (byes), round 2 = R64, round 3 = R32, etc.
const ROUND_MAP = {
  // Text nam
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
 * Fetch fixtures from API-Tennis for the active tournament (Miami Open 2026).
 * Requires TENNIS_API_KEY and MIAMI_TOURNAMENT_KEY (or legacy INDIAN_WELLS_TOURNAMENT_KEY).
 * Update MIAMI_TOURNAMENT_KEY in Railway to the Miami Open tournament key from API-Tennis.
 */
const fetchImpl = typeof fetch !== 'undefined' ? fetch : nodeFetch;

async function fetchApiDraw() {
  const apiKey = process.env.TENNIS_API_KEY;
  // MIAMI_TOURNAMENT_KEY is the canonical name going forward.
  // INDIAN_WELLS_TOURNAMENT_KEY kept for backwards compatibility — remove after Miami.
  const tournamentKey =
    process.env.MIAMI_TOURNAMENT_KEY ||
    process.env.INDIAN_WELLS_TOURNAMENT_KEY ||
    process.env.TOURNAMENT_KEY;
  if (!apiKey || !tournamentKey) return null;

  // Miami Open 2026: draw March 16, tournament March 19–30
  const dateStart = '2026-03-16';
  const dateStop  = '2026-03-30';
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

  // Filter out explicit qualification matches and doubles/mixed doubles
  const mainFixtures = fixtures.filter((f) => {
    const q = String(f.event_qualification ?? '').toLowerCase();
    if (q === 'true' || q === '1') return false;

    // Exclude doubles and mixed doubles events
    const eventType = String(f.event_type_type ?? f.event_type ?? '').toLowerCase();
    if (eventType.includes('double') || eventType.includes('mixed')) return false;

    // Fallback: player names with " / " are doubles pairings
    const p1 = String(f.event_first_player ?? '');
    const p2 = String(f.event_second_player ?? '');
    if (p1.includes(' / ') || p2.includes(' / ')) return false;

    return true;
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
      score: f.event_final_result || null,
    };
  }

  if (hasRoundField) {
    // ── Path 1: use API round names ──────────────────────────────────────────
    const unknownRounds = new Map(); // raw name → count (log once per name)
    for (const f of mainFixtures) {
      const raw = f.tournament_round || f.event_round || '';
      const round = normalizeRound(raw);
      if (!round || !matchesByRound[round]) {
        if (raw) unknownRounds.set(raw, (unknownRounds.get(raw) ?? 0) + 1);
        continue;
      }
      matchesByRound[round].push(buildMatch(f, round));
    }
    if (unknownRounds.size > 0) {
      const summary = [...unknownRounds.entries()]
        .map(([name, count]) => `"${name}" ×${count}`)
        .join(', ');
      console.warn(`[tennisData] Skipped fixtures with unmapped round names: ${summary}`);
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
  // Priority: 1) API-Tennis (paid, configured via TENNIS_API_KEY)
  //           2) Sofascore (free, unofficial, no key required)
  //           3) Mock draw (local fallback)
  let fixtures = await fetchApiDraw();
  if (!fixtures || fixtures.length === 0) {
    fixtures = await fetchSofascoreFixtures();
  }
  if (fixtures && fixtures.length > 0) {
    const draw = buildDrawFromFixtures(fixtures);
    const currentRound = roundFilter || ROUNDS[ROUNDS.length - 1];
    return { ...draw, currentRound };
  }
  return getMiamiMockDraw(roundFilter || 'R1');
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
  return (await fetchApiDraw()) ?? fetchSofascoreFixtures();
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
const LOCKTIME_OVERRIDES = {
  R1:  '2026-03-19T13:00:00Z',
  R32: '2026-03-22T18:00:00Z', // Lock 1h before first R32 match (Sun 22 Mar, 2PM EDT / 18:00 UTC)
};

export async function getDeadlines() {
  const fixtures = await fetchApiDraw();
  if (!fixtures || fixtures.length === 0) {
    // No live data — fall back to static schedule for Miami Open 2026.
    // R1 = non-seeds, R64 = seeds enter (Fri 21). All times UTC (11:00 ≈ 7am ET).
    const ROUND_DATES = {
      R1:  '2026-03-19T13:00:00Z',
      R64: '2026-03-21T11:00:00Z',
      R32: '2026-03-22T19:00:00Z', // Sun 22 Mar, 3PM EDT / 19:00 UTC
      R16: '2026-03-25T11:00:00Z',
      QF:  '2026-03-26T11:00:00Z',
      SF:  '2026-03-28T11:00:00Z',
      F:   '2026-03-30T11:00:00Z',
    };
    const now = new Date();
    return ROUNDS.map((round, i) => {
      const firstStart = ROUND_DATES[round] ? new Date(ROUND_DATES[round]) : null;
      let lockAtDate = firstStart ? new Date(firstStart.getTime() - 60 * 60 * 1000) : null;
      if (LOCKTIME_OVERRIDES[round]) lockAtDate = new Date(LOCKTIME_OVERRIDES[round]);
      let lockAt    = lockAtDate ? lockAtDate.toISOString() : null;
      let isLocked  = lockAtDate ? now >= lockAtDate : false;

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

  // Fallback schedule used when the live API hasn't published start times yet
  // (common for QF/SF/F early in the tournament week). All times UTC.
  const ROUND_DATE_FALLBACK = {
    R1:  '2026-03-19T13:00:00Z',
    R64: '2026-03-21T11:00:00Z',
    R32: '2026-03-22T19:00:00Z', // Sun 22 Mar, 3PM EDT / 19:00 UTC
    R16: '2026-03-25T11:00:00Z',
    QF:  '2026-03-26T11:00:00Z',
    SF:  '2026-03-28T11:00:00Z',
    F:   '2026-03-30T11:00:00Z',
  };

  const draw = buildDrawFromFixtures(fixtures);
  const matchesByRound = {};
  ROUNDS.forEach((r) => (matchesByRound[r] = []));
  (draw.matches || []).forEach((m) => {
    if (matchesByRound[m.round]) matchesByRound[m.round].push(m);
  });

  const now = new Date();
  return ROUNDS.map((round, index) => {
    const roundMatches = matchesByRound[round] || [];

    // First scheduled start time for this round — fall back to known schedule
    // when the API hasn't published times yet (e.g. QF/SF/F early in the week).
    const apiFirstStart = roundMatches
      .map((m) => (m.startTime ? new Date(m.startTime) : null))
      .filter((d) => d && !Number.isNaN(d.getTime()))
      .sort((a, b) => a - b)[0] || null;

    const fallbackDate = ROUND_DATE_FALLBACK[round] ? new Date(ROUND_DATE_FALLBACK[round]) : null;
    const firstStart   = apiFirstStart || fallbackDate;

    let lockAtDate = firstStart ? new Date(firstStart.getTime() - 60 * 60 * 1000) : null;
    if (LOCKTIME_OVERRIDES[round]) lockAtDate = new Date(LOCKTIME_OVERRIDES[round]);
    let lockAt     = lockAtDate ? lockAtDate.toISOString() : null;
    let isLocked   = lockAtDate ? now >= lockAtDate : false;

    // Window opens 12h after the first match of the nearest non-empty previous round starts.
    // Falls back to the known schedule date for that round when the API has no times yet.
    let opensAt = null;
    if (index > 0) {
      let prevFirstStart = null;
      for (let pi = index - 1; pi >= 0; pi--) {
        const prevRound = ROUNDS[pi];
        const prevMatches = matchesByRound[prevRound] || [];
        const apiPrevStart = prevMatches
          .map((m) => (m.startTime ? new Date(m.startTime) : null))
          .filter((d) => d && !Number.isNaN(d.getTime()))
          .sort((a, b) => a - b)[0] || null;
        const fallbackPrevDate = ROUND_DATE_FALLBACK[prevRound]
          ? new Date(ROUND_DATE_FALLBACK[prevRound]) : null;
        prevFirstStart = apiPrevStart || fallbackPrevDate;
        if (prevFirstStart) break;
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
