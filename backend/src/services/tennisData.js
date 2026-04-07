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
import { MC_PLAYERS, API_KEY_MAP as STATIC_API_KEY_MAP } from '../data/monteCarloMockDraw.js';
import nodeFetch from 'node-fetch';
import { fetchSofascoreFixtures } from './sofascoreAdapter.js';

const API_BASE = 'https://api.api-tennis.com/tennis';

// ── Dynamic API key discovery ────────────────────────────────────────────────
// Auto-builds the mock-ID → API-key map from live fixture data by matching
// player names. No more manual key lookups for qualifiers or replacements.
const dynamicKeyMap = new Map(); // mock ID → API key (string)
let keyMapBuilt = false;

const normForMatch = (n) =>
  (n || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function buildDynamicKeyMap(fixtures) {
  if (!fixtures || fixtures.length === 0) return;

  // Index mock players by normalised surname for fast lookup
  const bySurname = new Map(); // surname → [{ id, fullNorm }]
  for (const p of MC_PLAYERS) {
    const norm = normForMatch(p.name);
    const parts = norm.split(/\s+/);
    const surname = parts[parts.length - 1];
    if (!bySurname.has(surname)) bySurname.set(surname, []);
    bySurname.get(surname).push({ id: p.id, fullNorm: norm });
  }

  // For each fixture player, try to match to a mock player and capture the API key
  for (const f of fixtures) {
    const pairs = [
      { name: f.event_first_player, key: f.first_player_key },
      { name: f.event_second_player, key: f.second_player_key },
    ];
    for (const { name, key } of pairs) {
      if (!name || !key) continue;
      const norm = normForMatch(name);
      const parts = norm.split(/\s+/);
      const surname = parts[parts.length - 1];
      const candidates = bySurname.get(surname);
      if (!candidates) continue;
      // Prefer exact full-name match, fall back to surname-only if unique
      const exact = candidates.find(c => c.fullNorm === norm);
      const match = exact || (candidates.length === 1 ? candidates[0] : null);
      if (match && !dynamicKeyMap.has(match.id)) {
        dynamicKeyMap.set(match.id, String(key));
      }
    }
  }

  if (dynamicKeyMap.size > 0) {
    const newKeys = [...dynamicKeyMap.entries()]
      .filter(([id]) => !STATIC_API_KEY_MAP[id])
      .map(([id, k]) => `${id}=${k}`);
    if (newKeys.length > 0) {
      console.log(`[tennisData] Auto-discovered ${newKeys.length} new API keys: ${newKeys.join(', ')}`);
    }
    keyMapBuilt = true;
  }
}

/**
 * Get the merged API key map: static (hardcoded) + dynamic (auto-discovered).
 * Consumers should call this instead of importing API_KEY_MAP directly.
 */
export function getApiKeyMap() {
  const merged = { ...STATIC_API_KEY_MAP };
  for (const [id, key] of dynamicKeyMap) {
    if (!merged[id] || merged[id] == null) {
      merged[id] = key;
    }
  }
  return merged;
}

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
// Tournament config can provide an explicit fractionDenomMap (e.g. MC 56-draw
// where 1/32-finals = R32 not R1). Falls back to power-of-2 auto-derivation
// which works for standard 96/128-draw tournaments.
function buildFractionMap(rounds, tournament) {
  // Prefer explicit map from tournament config if provided
  if (tournament.fractionDenomMap) return { ...tournament.fractionDenomMap };
  // Auto-derive: first round gets the largest denominator (2^(n-1))
  const map = {};
  const n = rounds.length;
  for (let i = 0; i < n - 1; i++) {
    const denom = Math.pow(2, n - 1 - i);
    map[denom] = rounds[i];
  }
  return map;
}
const FRACTION_MAP = buildFractionMap(ROUNDS, TOURNAMENT);

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
      (TOURNAMENT.apiSeason ? `&tournament_season=${TOURNAMENT.apiSeason}` : '') +
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
        // Auto-discover API keys from fixture data
        if (!keyMapBuilt) buildDynamicKeyMap(data.result);
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
  // Use the schedule-derived current round so mock draw shows correct
  // structure (completed rounds, in-progress, future TBDs).
  const scheduleRound = getCurrentRoundFromSchedule();

  // Fetch live fixtures FIRST so we can auto-discover API keys before
  // building the mock draw (which needs keys for overlay matching).
  // API-Tennis is primary; Sofascore supplements any gaps (e.g. qualifier
  // fixtures that API-Tennis hasn't indexed yet).
  let fixtures = await fetchApiDraw();
  const sofascoreFixtures = await fetchSofascoreFixtures();
  if (!fixtures || fixtures.length === 0) {
    fixtures = sofascoreFixtures;
  } else if (sofascoreFixtures && sofascoreFixtures.length > 0) {
    // Merge: add Sofascore fixtures whose player pairs aren't in API-Tennis.
    // This fills the gap for qualifier/LL matches missing from API-Tennis.
    const apiPairs = new Set();
    for (const f of fixtures) {
      const k = [String(f.first_player_key || ''), String(f.second_player_key || '')].sort().join('|');
      apiPairs.add(k);
    }
    let merged = 0;
    for (const sf of sofascoreFixtures) {
      const k = [String(sf.first_player_key || ''), String(sf.second_player_key || '')].sort().join('|');
      if (!apiPairs.has(k)) {
        fixtures.push(sf);
        merged++;
      }
    }
    if (merged > 0) {
      console.log(`[tennisData] Merged ${merged} Sofascore fixtures not in API-Tennis`);
    }
  }
  // Auto-discover API keys from all available fixtures (API-Tennis + Sofascore)
  if (fixtures && fixtures.length > 0) buildDynamicKeyMap(fixtures);

  // Build mock draw with dynamic key map so all players have API keys
  const mockDraw = getMockDraw(scheduleRound, getApiKeyMap());

  if (fixtures && fixtures.length > 0) {
    const liveDraw = buildDrawFromFixtures(fixtures);
    if (liveDraw.matches.length > 0) {
      // Build lookups: sorted pair of API player IDs → live match,
      // plus a name-based fallback for players missing API keys (qualifiers/LLs).
      const liveByPlayers = new Map();
      const liveByNames   = new Map();
      const normName = (n) => (n || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      for (const lm of liveDraw.matches) {
        if (!lm.player1Id || !lm.player2Id) continue;
        const key = [String(lm.player1Id), String(lm.player2Id)].sort().join('|');
        liveByPlayers.set(key, lm);
        // Name-based fallback key (sorted normalised surnames)
        const surname = (full) => { const parts = normName(full).split(/\s+/); return parts[parts.length - 1]; };
        const nameKey = [surname(lm.player1Name), surname(lm.player2Name)].sort().join('|');
        liveByNames.set(nameKey, lm);
      }

      for (const mm of mockDraw.matches) {
        if (mm.bye) continue;
        const k1 = mm.player1ApiKey || mm.player1Id;
        const k2 = mm.player2ApiKey || mm.player2Id;
        if (!k1 || !k2) continue;
        const key = [String(k1), String(k2)].sort().join('|');
        let lm = liveByPlayers.get(key);

        // Fallback: match by normalised surname when API key lookup fails
        // (handles qualifiers/LLs whose API keys aren't in API_KEY_MAP yet)
        if (!lm) {
          const surname = (full) => { const parts = normName(full).split(/\s+/); return parts[parts.length - 1]; };
          const nameKey = [surname(mm.player1Name), surname(mm.player2Name)].sort().join('|');
          lm = liveByNames.get(nameKey);
          // Back-fill discovered API keys so downstream code (propagation, H2H) can use them
          if (lm) {
            const lmN1 = normName(lm.player1Name), mmN1 = normName(mm.player1Name);
            const sameOrder = lmN1.includes(normName(mm.player1Name).split(/\s+/).pop());
            if (sameOrder) {
              if (!mm.player1ApiKey) mm.player1ApiKey = String(lm.player1Id);
              if (!mm.player2ApiKey) mm.player2ApiKey = String(lm.player2Id);
            } else {
              if (!mm.player1ApiKey) mm.player1ApiKey = String(lm.player2Id);
              if (!mm.player2ApiKey) mm.player2ApiKey = String(lm.player1Id);
            }
          }
        }
        if (!lm) continue;

        // Overlay live data onto mock match
        // Determine which live player maps to mock player1 using API keys
        const p1Key = mm.player1ApiKey || k1;
        const winnerIsMockP1 = lm.winnerId
          ? String(lm.winnerId) === String(p1Key)
          : false;
        if (lm.winnerId) {
          mm.status = 'completed';
          mm.winnerId = winnerIsMockP1 ? mm.player1Id : mm.player2Id;
          mm.winnerName = winnerIsMockP1 ? mm.player1Name : mm.player2Name;
        } else if (lm.status && lm.status !== 'scheduled') {
          mm.status = lm.status;
        }
        if (lm.score) mm.score = lm.score;
        if (lm.startTime) mm.startTime = lm.startTime;
      }

      // ── Manual result overrides ───────────────────────────────────────
      // For matches that API-Tennis doesn't index (e.g. qualifier fixtures).
      // Defined in tournament config as { winnerId, winnerName, loserId, round }.
      if (TOURNAMENT.manualResults) {
        for (const ovr of TOURNAMENT.manualResults) {
          const mm = mockDraw.matches.find(
            m => m.round === ovr.round && !m.bye &&
              ((m.player1Id === ovr.winnerId && m.player2Id === ovr.loserId) ||
               (m.player1Id === ovr.loserId && m.player2Id === ovr.winnerId))
          );
          if (mm) {
            mm.status = 'completed';
            mm.winnerId = ovr.winnerId;
            mm.winnerName = ovr.winnerName;
            console.log(`[tennisData] Manual override applied: ${ovr.winnerName} beats ${ovr.loserId} in ${ovr.round}`);
          }
        }
      }

      // Clear misleading 'in_progress' from mock. The mock sets all
      // current-round matches to in_progress based on the schedule, but
      // unmatched matches (e.g. qualifier slots) keep that status and show
      // a red dot on the draw page. Reset to 'scheduled' — only 'completed'
      // (from live results) should be a definitive status.
      for (const mm of mockDraw.matches) {
        if (mm.status === 'in_progress') mm.status = 'scheduled';
      }

      // Propagate winners forward into next-round bracket slots.
      // The mock draw's Step 2 clears future-round names to TBD. Use the
      // standard binary bracket pairing: every 2 consecutive matches in
      // round N feed 1 match in round N+1 (slot i gets matches 2i and 2i+1).
      for (let ri = 0; ri < ROUNDS.length - 1; ri++) {
        const thisRound = ROUNDS[ri];
        const nextRound = ROUNDS[ri + 1];
        // Get matches sorted by matchOrder (includes byes for R1)
        const thisMatches = mockDraw.matches
          .filter(m => m.round === thisRound)
          .sort((a, b) => a.matchOrder - b.matchOrder);
        const nextMatches = mockDraw.matches
          .filter(m => m.round === nextRound && !m.bye)
          .sort((a, b) => a.matchOrder - b.matchOrder);

        for (let i = 0; i < nextMatches.length; i++) {
          const nm = nextMatches[i];
          const feeder1 = thisMatches[i * 2];
          const feeder2 = thisMatches[i * 2 + 1];
          // Fill player1 slot from feeder1's winner.
          // Always overwrite when feeder has a winner — the mock pre-fills
          // slots with assumed winners (player1 always wins) which may be
          // wrong after live overlay or manual overrides correct the result.
          if (feeder1?.winnerId) {
            nm.player1Id = feeder1.winnerId;
            nm.player1Name = feeder1.winnerName;
            const winSide = feeder1.winnerId === feeder1.player1Id ? 'player1' : 'player2';
            nm.player1ApiKey = feeder1[`${winSide}ApiKey`] || null;
          }
          // Fill player2 slot from feeder2's winner
          if (feeder2?.winnerId) {
            nm.player2Id = feeder2.winnerId;
            nm.player2Name = feeder2.winnerName;
            const winSide = feeder2.winnerId === feeder2.player1Id ? 'player1' : 'player2';
            nm.player2ApiKey = feeder2[`${winSide}ApiKey`] || null;
          }
        }
      }

      // Re-derive roundEliminated from overlaid results
      const eliminated = new Set();
      for (const round of ROUNDS) {
        for (const m of mockDraw.matches.filter(x => x.round === round)) {
          if (m.status !== 'completed' || !m.winnerId) continue;
          const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
          if (loserId) eliminated.add(loserId);
        }
      }
      for (const p of mockDraw.players) {
        if (!eliminated.has(p.id)) continue;
        const lostMatch = mockDraw.matches.find(
          m => m.status === 'completed' && (m.player1Id === p.id || m.player2Id === p.id) && m.winnerId !== p.id
        );
        if (lostMatch) p.roundEliminated = lostMatch.round;
      }

      return { ...mockDraw, dataSource: 'live_overlay' };
    }
  }

  return { ...mockDraw, dataSource: 'mock' };
}

/**
 * Fetch live draw from API-Tennis for results processing.
 * Returns real match statuses, winners, and scores.
 * Used by resultsProcessor and picks endpoint.
 */
export async function getLiveDraw(roundFilter = null) {
  let fixtures = await fetchApiDraw();
  const sofascoreFixtures = await fetchSofascoreFixtures();
  if (!fixtures || fixtures.length === 0) {
    fixtures = sofascoreFixtures;
  } else if (sofascoreFixtures && sofascoreFixtures.length > 0) {
    // Merge Sofascore supplements (same logic as getDraw)
    const apiPairs = new Set();
    for (const f of fixtures) {
      const k = [String(f.first_player_key || ''), String(f.second_player_key || '')].sort().join('|');
      apiPairs.add(k);
    }
    for (const sf of sofascoreFixtures) {
      const k = [String(sf.first_player_key || ''), String(sf.second_player_key || '')].sort().join('|');
      if (!apiPairs.has(k)) fixtures.push(sf);
    }
  }
  if (fixtures && fixtures.length > 0) {
    const draw = buildDrawFromFixtures(fixtures);
    if (draw.matches.length > 0) {
      return { ...draw, currentRound: roundFilter || ROUNDS[ROUNDS.length - 1], dataSource: 'live_api' };
    }
  }
  // No live data — return empty so results processor knows not to grade anything
  return { matches: [], rounds: ROUNDS, players: [], dataSource: 'no_live_data' };
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
  const lockOverrides   = TOURNAMENT.lockTimeOverrides   || {};
  const windowOverrides = TOURNAMENT.windowOpensOverrides || {};
  const roundDates      = TOURNAMENT.roundDates           || {};
  const roundFallback   = TOURNAMENT.roundDateFallback    || {};

  // Buffer between previous round locking and next round's pick window opening.
  // Gives admins time to review results before players can submit new picks.
  const bufferMs = (TOURNAMENT.pickWindowBufferHours || 0) * 60 * 60 * 1000;

  if (!fixtures || fixtures.length === 0) {
    return ROUNDS.map((round, i) => {
      const firstStart = roundDates[round] ? new Date(roundDates[round]) : null;
      let lockAtDate   = firstStart ? new Date(firstStart.getTime() - 60 * 60 * 1000) : null;
      if (runtimeLockOverrides[round])  lockAtDate = new Date(runtimeLockOverrides[round]);
      else if (lockOverrides[round])    lockAtDate = new Date(lockOverrides[round]);
      const lockAt   = lockAtDate ? lockAtDate.toISOString() : null;
      const isLocked = lockAtDate ? now >= lockAtDate : false;
      // Each round opens [bufferMs] after the previous round locks (or at windowOpensOverride)
      let opensAt = null;
      if (windowOverrides[round]) {
        opensAt = new Date(windowOverrides[round]).toISOString();
      } else if (i > 0) {
        const prevRound = ROUNDS[i - 1];
        let prevLockAt = null;
        if (runtimeLockOverrides[prevRound])     prevLockAt = new Date(runtimeLockOverrides[prevRound]);
        else if (lockOverrides[prevRound])        prevLockAt = new Date(lockOverrides[prevRound]);
        else {
          const prevDate = roundDates[prevRound] ? new Date(roundDates[prevRound]) : null;
          if (prevDate) prevLockAt = new Date(prevDate.getTime() - 60 * 60 * 1000);
        }
        if (prevLockAt) opensAt = new Date(prevLockAt.getTime() + bufferMs).toISOString();
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

    // Each round opens when the previous round locks (or at windowOpensOverride)
    let opensAt = null;
    if (windowOverrides[round]) {
      opensAt = new Date(windowOverrides[round]).toISOString();
    } else if (index > 0) {
      const prevRound = ROUNDS[index - 1];
      let prevLockAt = null;
      if (runtimeLockOverrides[prevRound]) {
        prevLockAt = new Date(runtimeLockOverrides[prevRound]);
      } else if (lockOverrides[prevRound]) {
        prevLockAt = new Date(lockOverrides[prevRound]);
      } else {
        const prevMatches = matchesByRnd[prevRound] || [];
        const apiPrev = prevMatches
          .map((m) => (m.startTime ? new Date(m.startTime) : null))
          .filter((d) => d && !Number.isNaN(d.getTime()))
          .sort((a, b) => a - b)[0] || null;
        const fallbackPrev = roundFallback[prevRound] ? new Date(roundFallback[prevRound]) : null;
        const prevFirstStart = apiPrev || fallbackPrev;
        if (prevFirstStart) prevLockAt = new Date(prevFirstStart.getTime() - 60 * 60 * 1000);
      }
      if (prevLockAt) {
        opensAt = new Date(prevLockAt.getTime() + bufferMs).toISOString();
      }
    }

    const hasOpened = index === 0 || (opensAt && now >= new Date(opensAt));
    const isOpen    = hasOpened && !isLocked;
    return { round, opensAt, lockAt, isLocked, isOpen };
  });
}
