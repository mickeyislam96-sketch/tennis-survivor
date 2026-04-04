/**
 * Tennis draw & results service.
 *
 * Data priority:
 *   1. API-Tennis (paid, configured via TENNIS_API_KEY + tournament-specific key)
 *   2. Sofascore adapter (free, unofficial — often 403-blocked on cloud IPs)
 *   3. Mock draw (local fallback — always correct structure, no real results)
 *
 * All API calls are cached in-memory (TTL: 2 minutes).
 * A single shared cache means all request handlers reuse the same data,
 * preventing rate-limit hammering even with many concurrent users.
 */

import { TOURNAMENT, ROUNDS, MATCHES_PER_ROUND } from '../config/tournament.js';
import { getMockDraw } from '../data/mockDraw.js';
import nodeFetch from 'node-fetch';
import { fetchSofascoreFixtures } from './sofascoreAdapter.js';

const API_BASE = 'https://api.api-tennis.com/tennis';

// ── Global round name map (tournament-agnostic) ───────────────────────────────
const GLOBAL_ROUND_MAP = {
  'first round':      'R1',
  'round of 96':      'R1',
  '1st round':        'R1',
  'round 1':          'R1',
  'round of 64':      'R64',
  '2nd round':        'R32',
  'round 2':          'R32',
  'round of 32':      'R32',
  '3rd round':        'R16',
  'round 3':          'R16',
  'round of 16':      'R16',
  '4th round':        'QF',
  'round 4':          'QF',
  'quarter-final':    'QF',
  'quarter-final(s)': 'QF',
  'quarterfinal':     'QF',
  'quarterfinals':    'QF',
  'quarter finals':   'QF',
  'semi-final':       'SF',
  'semi-final(s)':    'SF',
  'semifinal':        'SF',
  'semifinals':       'SF',
  'semi finals':      'SF',
  'final':            'F',
  'the final':        'F',
};

// Merge tournament-specific overrides (lower-case keys)
const ROUND_MAP = { ...GLOBAL_ROUND_MAP };
if (TOURNAMENT.roundNameOverrides) {
  for (const [k, v] of Object.entries(TOURNAMENT.roundNameOverrides)) {
    ROUND_MAP[k.toLowerCase()] = v;
  }
}

// Fraction-notation denominator → round key.
// Derived from ROUNDS array: first round gets the largest denominator (2^(n-1)).
// Miami  7 rounds (R1,R64,R32,R16,QF,SF,F): 64→R1, 32→R64, 16→R32, 8→R16, 4→QF, 2→SF
// MC     6 rounds (R1,R32,R16,QF,SF,F):     32→R1, 16→R32,  8→R16, 4→QF, 2→SF
function buildFractionMap(rounds) {
  const map = {};
  const n = rounds.length;
  for (let i = 0; i < n - 1; i++) {
    const denom = Math.pow(2, n - 1 - i);
    map[denom] = rounds[i];
  }
  return map;
}
const FRACTION_MAP = buildFractionMap(ROUNDS);

function normalizeRound(apiRound) {
  if (apiRound === null || apiRound === undefined || apiRound === '') return null;
  const str = String(apiRound).toLowerCase().trim();

  if (ROUND_MAP[str]) return ROUND_MAP[str];
  if (ROUNDS.includes(str.toUpperCase())) return str.toUpperCase();

  const roundPart = str.replace(/^atp\s+.+?\s+-\s+/, '').trim();
  if (ROUND_MAP[roundPart]) return ROUND_MAP[roundPart];

  const fracMatch = roundPart.match(/^1\/(\d+)-finals?$/);
  if (fracMatch) {
    const denom = parseInt(fracMatch[1], 10);
    if (FRACTION_MAP[denom]) return FRACTION_MAP[denom];
  }

  const num = parseInt(str, 10);
  if (!Number.isNaN(num) && num >= 1 && num <= ROUNDS.length) {
    return ROUNDS[num - 1];
  }

  return null;
}

// ── In-memory API cache ───────────────────────────────────────────────────────

const cache = {
  fixtures:  null,   // null | Array
  fetchedAt: 0,
  error:     null,
  pending:   null,   // Promise | null — deduplicates concurrent fetches
};

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

async function doFetch(url) {
  return typeof fetch !== 'undefined' ? fetch(url) : nodeFetch(url);
}

async function fetchApiDraw() {
  const apiKey       = process.env.TENNIS_API_KEY;
  const tournamentKey = TOURNAMENT.apiTournamentKey;
  if (!apiKey || !tournamentKey) return null;

  const now = Date.now();
  if (cache.fixtures !== null && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.fixtures;
  }

  // Deduplicate — return the in-flight promise if one exists
  if (cache.pending) return cache.pending;

  cache.pending = (async () => {
    const url =
      `${API_BASE}/?method=get_fixtures` +
      `&APIkey=${apiKey}` +
      `&tournament_key=${tournamentKey}` +
      `&tournament_season=${TOURNAMENT.apiSeason}` +
      `&date_start=${TOURNAMENT.apiDateStart}` +
      `&date_stop=${TOURNAMENT.apiDateStop}`;

    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        let res;
        try {
          res = await doFetch(url, { signal: controller.signal });
        } finally {
          clearTimeout(timer);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const data = await res.json();
        if (!data?.success || !Array.isArray(data.result)) {
          throw new Error(`Bad API response: ${JSON.stringify(data).slice(0, 200)}`);
        }
        cache.fixtures  = data.result;
        cache.fetchedAt = Date.now();
        cache.error     = null;
        console.log(`[tennisData] API OK: ${data.result.length} fixtures (attempt ${attempt})`);
        return data.result;
      } catch (e) {
        lastError = e;
        if (attempt < 3) {
          const delay = 500 * attempt;
          console.warn(`[tennisData] Attempt ${attempt} failed: ${e.message}. Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    cache.error = lastError?.message ?? 'Unknown error';
    console.error(`[tennisData] All API fetch attempts failed: ${cache.error}`);

    // Return stale cache rather than nothing
    if (cache.fixtures !== null) {
      console.warn(`[tennisData] Returning stale cache (age: ${Math.round((Date.now() - cache.fetchedAt) / 1000)}s)`);
      return cache.fixtures;
    }
    return null;
  })().finally(() => { cache.pending = null; });

  return cache.pending;
}

export function invalidateCache() {
  cache.fixtures  = null;
  cache.fetchedAt = 0;
  cache.error     = null;
  console.log('[tennisData] Cache invalidated.');
}

export function getCacheStatus() {
  return {
    hasCachedData: cache.fixtures !== null,
    fixtureCount:  cache.fixtures?.length ?? 0,
    ageSeconds:    cache.fixtures ? Math.round((Date.now() - cache.fetchedAt) / 1000) : null,
    ttlSeconds:    Math.round(CACHE_TTL_MS / 1000),
    lastError:     cache.error,
  };
}

// ── Fixture parsing ───────────────────────────────────────────────────────────

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

function buildDrawFromFixtures(fixtures) {
  const playersMap     = new Map();
  const matchesByRound = {};
  ROUNDS.forEach((r) => (matchesByRound[r] = []));

  const mainFixtures = fixtures.filter((f) => {
    const q = String(f.event_qualification ?? '').toLowerCase();
    if (q === 'true' || q === '1') return false;
    const eventType = String(f.event_type_type ?? f.event_type ?? '').toLowerCase();
    if (eventType.includes('double') || eventType.includes('mixed')) return false;
    const p1 = String(f.event_first_player ?? '');
    const p2 = String(f.event_second_player ?? '');
    if (p1.includes(' / ') || p2.includes(' / ')) return false;
    return true;
  });

  const hasRoundField = mainFixtures.some((f) => {
    const raw = f.tournament_round || f.event_round || '';
    return raw && normalizeRound(raw);
  });

  function buildMatch(f, round) {
    const player1 = { id: String(f.first_player_key  ?? `${f.event_key}-p1`), name: f.event_first_player  || 'TBD' };
    const player2 = { id: String(f.second_player_key ?? `${f.event_key}-p2`), name: f.event_second_player || 'TBD' };
    playersMap.set(player1.id, playersMap.get(player1.id) ?? { ...player1, roundEliminated: null });
    playersMap.set(player2.id, playersMap.get(player2.id) ?? { ...player2, roundEliminated: null });

    const dt        = toFixtureDate(f);
    const startTime = dt ? dt.toISOString() : null;

    let winnerId = null, winnerName = null;
    let status = (f.event_status || '').toLowerCase().includes('finish') ? 'completed' : 'scheduled';
    if (f.event_winner === 'First Player')       { winnerId = player1.id; winnerName = player1.name; }
    else if (f.event_winner === 'Second Player') { winnerId = player2.id; winnerName = player2.name; }
    if (winnerId) status = 'completed';

    return {
      id: `m-${round}-${f.event_key}`,
      round, matchOrder: (matchesByRound[round] || []).length,
      player1Id: player1.id, player1Name: player1.name,
      player2Id: player2.id, player2Name: player2.name,
      winnerId, winnerName, status, startTime,
      score: f.event_final_result || null,
    };
  }

  if (hasRoundField) {
    const unknownRounds = new Map();
    for (const f of mainFixtures) {
      const raw   = f.tournament_round || f.event_round || '';
      const round = normalizeRound(raw);
      if (!round || !matchesByRound[round]) {
        if (raw) unknownRounds.set(raw, (unknownRounds.get(raw) ?? 0) + 1);
        continue;
      }
      matchesByRound[round].push(buildMatch(f, round));
    }
    if (unknownRounds.size > 0) {
      const summary = [...unknownRounds.entries()].map(([n, c]) => `"${n}" x${c}`).join(', ');
      console.warn(`[tennisData] Unmapped round names (add to roundNameOverrides): ${summary}`);
    }
  } else {
    const sorted = [...mainFixtures].sort((a, b) => {
      const da = toFixtureDate(a), db = toFixtureDate(b);
      if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
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

  // Compute roundEliminated
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

// ── Runtime lock overrides (admin-settable without a redeploy) ────────────────
// Set via POST /api/admin/set-lock-override.
// Cleared on server restart — intended for emergency corrections only.
const runtimeLockOverrides = {};

export function setRuntimeLockOverride(round, lockAt) {
  if (!ROUNDS.includes(round)) throw new Error(`Unknown round: ${round}`);
  runtimeLockOverrides[round] = lockAt;
  console.log(`[tennisData] Runtime lock override: ${round} → ${lockAt}`);
}

export function clearRuntimeLockOverride(round) {
  delete runtimeLockOverrides[round];
  console.log(`[tennisData] Runtime lock override cleared: ${round}`);
}

export function getRuntimeLockOverrides() {
  return { ...runtimeLockOverrides };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getDraw(roundFilter = null) {
  let fixtures = await fetchApiDraw();
  if (!fixtures || fixtures.length === 0) {
    fixtures = await fetchSofascoreFixtures();
  }
  if (fixtures && fixtures.length > 0) {
    const draw = buildDrawFromFixtures(fixtures);

    // Only switch to live data if it covers more than just the first round.
    // Early in a tournament the API may only have R1 fixtures — no seeds,
    // no byes, no later-round structure. Using that partial data destroys
    // the bracket (the mock draw has the full 56-player structure).
    // Once R32+ matches appear in the API, we switch over seamlessly.
    const hasLaterRounds = draw.matches.some(m => m.round !== ROUNDS[0]);
    if (hasLaterRounds) {
      return { ...draw, currentRound: roundFilter || ROUNDS[ROUNDS.length - 1], dataSource: 'live_api' };
    }
    console.warn(
      `[tennisData] Live data has ${draw.matches.length} matches but only in ${ROUNDS[0]} — ` +
      `using mock draw for full bracket structure until later rounds appear`
    );
  }
  // Mock fallback: determine current round from the tournament schedule, NOT
  // from the frontend's roundFilter (which is just "how much of the bracket to
  // show"). Passing roundFilter here was causing the mock to mark all earlier
  // rounds as completed when the frontend requested ?round=F.
  const currentRound = getCurrentRoundFromSchedule();
  const mockDraw = getMockDraw(currentRound);
  return { ...mockDraw, dataSource: 'mock' };
}

/**
 * Determine which round is "current" based on the tournament schedule dates.
 * Returns the latest round whose start date has passed, or null if the
 * tournament hasn't started yet.
 */
function getCurrentRoundFromSchedule() {
  const now = new Date();
  const roundDates = TOURNAMENT.roundDates || {};
  let current = null;
  for (const round of ROUNDS) {
    const startDate = roundDates[round];
    if (startDate && now >= new Date(startDate)) {
      current = round;
    }
  }
  return current;
}

export function getRounds() { return [...ROUNDS]; }

export async function getRawFixtures() {
  const api = await fetchApiDraw();
  if (api) return api;
  return fetchSofascoreFixtures();
}

export async function getDeadlines() {
  const fixtures    = await fetchApiDraw();
  const now         = new Date();
  const lockOverrides = TOURNAMENT.lockTimeOverrides  || {};
  const roundDates    = TOURNAMENT.roundDates          || {};
  const roundFallback = TOURNAMENT.roundDateFallback   || {};

  if (!fixtures || fixtures.length === 0) {
    return ROUNDS.map((round, i) => {
      const firstStart = roundDates[round] ? new Date(roundDates[round]) : null;
      let lockAtDate   = firstStart ? new Date(firstStart.getTime() - 60 * 60 * 1000) : null;
      if (runtimeLockOverrides[round])  lockAtDate = new Date(runtimeLockOverrides[round]);
      else if (lockOverrides[round])    lockAtDate = new Date(lockOverrides[round]);
      const lockAt   = lockAtDate ? lockAtDate.toISOString() : null;
      const isLocked = lockAtDate ? now >= lockAtDate : false;
      let opensAt = null;
      if (i > 0) {
        const prevDate = roundDates[ROUNDS[i - 1]] ? new Date(roundDates[ROUNDS[i - 1]]) : null;
        if (prevDate) opensAt = new Date(prevDate.getTime() + 12 * 60 * 60 * 1000).toISOString();
      }
      const hasOpened = i === 0 || (opensAt && now >= new Date(opensAt));
      const isOpen    = hasOpened && !isLocked;
      return { round, opensAt, lockAt, isLocked, isOpen };
    });
  }

  const draw = buildDrawFromFixtures(fixtures);
  const matchesByRnd = {};
  ROUNDS.forEach((r) => (matchesByRnd[r] = []));
  (draw.matches || []).forEach((m) => { if (matchesByRnd[m.round]) matchesByRnd[m.round].push(m); });

  return ROUNDS.map((round, index) => {
    const roundMatches   = matchesByRnd[round] || [];
    const apiFirstStart  = roundMatches
      .map((m) => (m.startTime ? new Date(m.startTime) : null))
      .filter((d) => d && !Number.isNaN(d.getTime()))
      .sort((a, b) => a - b)[0] || null;
    const fallbackDate = roundFallback[round] ? new Date(roundFallback[round]) : null;
    const firstStart   = apiFirstStart || fallbackDate;

    let lockAtDate = firstStart ? new Date(firstStart.getTime() - 60 * 60 * 1000) : null;
    if (runtimeLockOverrides[round]) lockAtDate = new Date(runtimeLockOverrides[round]);
    else if (lockOverrides[round])   lockAtDate = new Date(lockOverrides[round]);

    const lockAt   = lockAtDate ? lockAtDate.toISOString() : null;
    const isLocked = lockAtDate ? now >= lockAtDate : false;

    let opensAt = null;
    if (index > 0) {
      let prevFirstStart = null;
      for (let pi = index - 1; pi >= 0; pi--) {
        const prevRound   = ROUNDS[pi];
        const prevMatches = matchesByRnd[prevRound] || [];
        const apiPrev     = prevMatches
          .map((m) => (m.startTime ? new Date(m.startTime) : null))
          .filter((d) => d && !Number.isNaN(d.getTime()))
          .sort((a, b) => a - b)[0] || null;
        const fallbackPrev = roundFallback[prevRound] ? new Date(roundFallback[prevRound]) : null;
        prevFirstStart = apiPrev || fallbackPrev;
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
