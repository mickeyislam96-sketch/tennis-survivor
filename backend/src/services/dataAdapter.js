/**
 * dataAdapter.js — Unified tennis data interface.
 *
 * Abstracts over multiple data sources (Goalserve, API-Tennis, Sofascore, mock)
 * so the rest of the app never deals with provider-specific formats.
 *
 * The active provider is selected by the TENNIS_DATA_PROVIDER env var:
 *   'goalserve'   — Goalserve API (preferred for Madrid 2026+)
 *   'api-tennis'  — API-Tennis (legacy, fallback)
 *   'sofascore'   — Sofascore scraping (free, unreliable on cloud IPs)
 *   'mock'        — Local mock data (development only)
 *
 * All providers must return data in the internal fixture format (see below).
 * If the primary provider fails, we fall through the chain automatically.
 */

import { TOURNAMENT } from '../config/activeTournament.js';

// ── Internal fixture format ──────────────────────────────────────────────────
// Every adapter converts its raw API response into an array of these objects.
// This is the ONLY format the rest of the codebase sees.
//
// {
//   matchId:       string,        // unique match identifier
//   round:         string,        // internal round key: 'R1', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'
//   player1Id:     string,
//   player1Name:   string,
//   player2Id:     string,
//   player2Name:   string,
//   winnerId:      string | null, // null if match not completed
//   winnerName:    string | null,
//   status:        string,        // 'scheduled' | 'live' | 'completed' | 'walkover' | 'retired' | 'cancelled'
//   startTime:     string | null, // ISO 8601 datetime (critical for R1 per-match lock)
//   score:         string | null, // e.g. "6-4, 7-5"
//   isWithdrawal:  boolean,       // true if a player withdrew before the match started
//   withdrawnPlayerId: string | null, // which player withdrew (if isWithdrawal)
// }

// ── Goalserve adapter ───────────────────────────────────────────────────────
// Goalserve REST API: https://www.goalserve.com/getfeed/{apiKey}/tennis/...
//
// Endpoints used:
//   /getfeed/{key}/tennis/fixtures?json=1     — scheduled fixtures with start times
//   /getfeed/{key}/tennis/livescore?json=1    — live + recently completed matches
//   /getfeed/{key}/tennis/results?json=1      — completed results
//
// Response shape (JSON):
//   { scores: { tournament: [ { name, id, matches: { match: [...] } } ] } }
//   or tournament can be a single object instead of an array.
//
// Match object fields:
//   id, status ("Fin.", "Walk Over", "Fin. (Ret)", "Susp.", "Postp.", set names),
//   date ("DD.MM.YYYY"), time ("HH:MM"), court,
//   player: [ { name, id, winner ("True"/"False"), set1..set5, sets_won } ]
//
// Round info is embedded in tournament name or match grouping.
// We parse it from the tournament/category structure.

const GOALSERVE_BASE = 'https://www.goalserve.com/getfeed';
const GOALSERVE_TIMEOUT = 12000;
const GOALSERVE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// In-memory cache for Goalserve responses
let goalserveCache = { fixtures: null, fetchedAt: 0 };

// Goalserve round name mapping.
// Goalserve uses various round labels in the match or tournament grouping.
// We normalise to our internal keys.
const GOALSERVE_ROUND_MAP = {
  // Common Goalserve round labels (case-insensitive matching applied)
  'first round':         'R1',
  '1st round':           'R1',
  'round 1':             'R1',
  'qualifying':          null, // skip qualifying
  'second round':        'R64',
  '2nd round':           'R64',
  'round 2':             'R64',
  'third round':         'R32',
  '3rd round':           'R32',
  'round 3':             'R32',
  'fourth round':        'R16',
  '4th round':           'R16',
  'round 4':             'R16',
  'round of 128':        null, // qualifying
  'round of 64':         'R1',  // 96-draw: "round of 64" = R1 (32 matches, non-seeds)
  'round of 32':         'R64', // 96-draw: "round of 32" = R64 (seeds enter)
  'round of 16':         'R32', // 96-draw: context-dependent
  '1/64-finals':         'R1',
  '1/32-finals':         'R64',
  '1/16-finals':         'R32',
  '1/8-finals':          'R16',
  '1/4-finals':          'QF',
  'quarter-final':       'QF',
  'quarter-finals':      'QF',
  'quarterfinal':        'QF',
  'quarterfinals':       'QF',
  'semi-final':          'SF',
  'semi-finals':         'SF',
  'semifinal':           'SF',
  'semifinals':          'SF',
  'final':               'F',
  'the final':           'F',
};

// For 96-draw Masters, Goalserve may label rounds by number of remaining players.
// This maps those numeric round indicators.
const GOALSERVE_NUMERIC_ROUND_MAP = {
  64: 'R1',   // 96-draw: 64 players in first round = R1 (32 matches between non-seeds)
  32: 'R64',  // 96-draw: 32 matches with seeds entering
  16: 'R32',
  8:  'R16',
  4:  'QF',
  2:  'SF',
  1:  'F',
};

/**
 * Normalise a Goalserve round string to our internal key.
 * Handles the 96-draw mapping where Goalserve may use different labelling.
 */
function normalizeGoalserveRound(raw, config) {
  if (!raw) return null;
  const str = String(raw).toLowerCase().trim();

  // Check config-level overrides first (set once we see actual API output)
  if (config?.roundNameOverrides) {
    for (const [pattern, round] of Object.entries(config.roundNameOverrides)) {
      if (str.includes(pattern.toLowerCase())) return round;
    }
  }

  // Direct match in our map
  if (GOALSERVE_ROUND_MAP[str] !== undefined) return GOALSERVE_ROUND_MAP[str];

  // Partial match (Goalserve sometimes prefixes with tournament name)
  for (const [label, round] of Object.entries(GOALSERVE_ROUND_MAP)) {
    if (str.includes(label)) return round;
  }

  // Try numeric extraction (e.g. "Round of 32" -> 32)
  const numMatch = str.match(/round\s+of\s+(\d+)/i) || str.match(/(\d+)(?:th|st|nd|rd)?\s*round/i);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (GOALSERVE_NUMERIC_ROUND_MAP[num] !== undefined) return GOALSERVE_NUMERIC_ROUND_MAP[num];
  }

  console.warn(`[Goalserve] Unknown round label: "${raw}"`);
  return null;
}

/**
 * Map Goalserve match status to our internal status enum.
 * Goalserve uses abbreviated strings in the status field.
 */
function normalizeGoalserveStatus(rawStatus) {
  if (!rawStatus) return 'scheduled';
  const s = String(rawStatus).toLowerCase().trim();

  if (s === 'fin.' || s === 'finished' || s === 'ended' || s === 'fin') return 'completed';
  if (s.includes('ret') || s === 'fin. (ret)' || s === 'retired') return 'retired';
  if (s === 'walk over' || s === 'walkover' || s === 'w/o' || s === 'w.o.') return 'walkover';
  if (s === 'cancelled' || s === 'canceled' || s === 'canc.') return 'cancelled';
  if (s === 'susp.' || s === 'suspended') return 'live'; // suspended = was live
  if (s === 'postp.' || s === 'postponed') return 'scheduled';
  if (s === 'not started' || s === '' || s === 'upcoming') return 'scheduled';

  // Active set indicators = live match
  if (s.includes('set') || s.includes('tie') || s === 'in progress' || s === 'live') return 'live';

  // Default: if we don't recognise it, assume scheduled (safer than marking completed)
  return 'scheduled';
}

/**
 * Parse Goalserve date+time into ISO 8601.
 * Goalserve uses "DD.MM.YYYY" and "HH:MM" (UTC).
 */
function parseGoalserveDateTime(dateStr, timeStr) {
  if (!dateStr) return null;

  // Handle DD.MM.YYYY format
  const dateParts = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dateParts) {
    const [, day, month, year] = dateParts;
    const time = timeStr || '00:00';
    const iso = `${year}-${month}-${day}T${time}:00Z`;
    const dt = new Date(iso);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString();
  }

  // Handle YYYY-MM-DD format (in case Goalserve uses it in some contexts)
  const altParts = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (altParts) {
    const time = timeStr || '00:00';
    const iso = `${dateStr}T${time}:00Z`;
    const dt = new Date(iso);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString();
  }

  return null;
}

/**
 * Build score string from set data.
 * Goalserve provides set1..set5 fields on each player.
 */
function buildScoreString(player1, player2) {
  const sets = [];
  for (let i = 1; i <= 5; i++) {
    const s1 = player1[`set${i}`];
    const s2 = player2[`set${i}`];
    if (s1 != null && s2 != null && (s1 !== '' || s2 !== '')) {
      sets.push(`${s1}-${s2}`);
    }
  }
  return sets.length > 0 ? sets.join(', ') : null;
}

/**
 * Coerce Goalserve tournament/match arrays.
 * Goalserve may return a single object or an array depending on count.
 */
function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

/**
 * Extract match fixtures from a Goalserve JSON response.
 * Handles multiple response shapes (the API is inconsistent).
 */
function extractMatches(data, config) {
  const fixtures = [];

  // Navigate to tournament data — shape varies by endpoint
  const scores = data?.scores || data;
  const tournaments = toArray(
    scores?.tournament || scores?.tournaments?.tournament || scores?.category?.tournament
  );

  // Filter to our tournament if we have an ID
  const targetId = config?.goalserveTournamentId;
  const targetName = config?.name?.toLowerCase() || '';
  const relevantTournaments = tournaments.filter(t => {
    if (!t) return false;
    if (targetId && String(t.id) === String(targetId)) return true;
    if (targetName && (t.name || '').toLowerCase().includes(targetName)) return true;
    if (targetName && (t.name || '').toLowerCase().includes('madrid')) return true;
    // If no ID set yet, return all ATP tournaments (we'll filter by name)
    if (!targetId) return true;
    return false;
  });

  if (relevantTournaments.length === 0) {
    console.warn('[Goalserve] No matching tournament found in response.',
      `Looking for: id=${targetId}, name contains "${targetName}".`,
      `Available: ${tournaments.map(t => `${t?.name} (${t?.id})`).join(', ') || 'none'}`);
    return [];
  }

  for (const tournament of relevantTournaments) {
    // Log tournament discovery for first-time setup
    if (!targetId && tournament.id) {
      console.log(`[Goalserve] Found tournament: "${tournament.name}" (id: ${tournament.id}). ` +
        `Set goalserveTournamentId in activeTournament.js to lock to this tournament.`);
    }

    // Matches can be nested in various ways
    const matchGroups = toArray(tournament.matches || tournament.match);

    for (const group of matchGroups) {
      // group might be { date, time, match: [...] } or the match itself
      const matches = group.match ? toArray(group.match) : [group];
      const groupDate = group.date || tournament.date;

      for (const m of matches) {
        if (!m || !m.id) continue;

        const players = toArray(m.player || m.players?.player);
        if (players.length < 2) continue;

        const p1 = players[0];
        const p2 = players[1];

        // Determine round from match or tournament grouping
        const roundRaw = m.round || group.round || tournament.round || null;
        const round = normalizeGoalserveRound(roundRaw, config);
        // Skip unknown rounds (likely qualifying or doubles)
        if (round === null) continue;

        const status = normalizeGoalserveStatus(m.status);
        const startTime = parseGoalserveDateTime(m.date || groupDate, m.time);
        const score = buildScoreString(p1, p2);

        // Winner detection
        let winnerId = null;
        let winnerName = null;
        const p1Won = String(p1.winner || '').toLowerCase() === 'true';
        const p2Won = String(p2.winner || '').toLowerCase() === 'true';
        if (p1Won) { winnerId = String(p1.id); winnerName = p1.name; }
        else if (p2Won) { winnerId = String(p2.id); winnerName = p2.name; }

        // Withdrawal/walkover detection
        const isWalkover = status === 'walkover';
        const isRetired = status === 'retired';
        const isCancelled = status === 'cancelled';
        const isWithdrawal = isWalkover || isCancelled;

        // Try to identify the withdrawn player:
        // In a walkover, the winner advances without playing.
        // The loser is the one who withdrew.
        let withdrawnPlayerId = null;
        if (isWalkover && winnerId) {
          withdrawnPlayerId = winnerId === String(p1.id) ? String(p2.id) : String(p1.id);
        }

        fixtures.push({
          matchId: String(m.id),
          round,
          player1Id: String(p1.id || `${m.id}-p1`),
          player1Name: p1.name || 'TBD',
          player2Id: String(p2.id || `${m.id}-p2`),
          player2Name: p2.name || 'TBD',
          winnerId,
          winnerName,
          status: isRetired ? 'retired' : status,
          startTime,
          score,
          isWithdrawal,
          withdrawnPlayerId,
        });
      }
    }
  }

  return fixtures;
}

/**
 * Fetch a single Goalserve endpoint with timeout + error handling.
 */
async function goalserveRequest(apiKey, endpoint) {
  const url = `${GOALSERVE_BASE}/${apiKey}/tennis/${endpoint}?json=1`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GOALSERVE_TIMEOUT);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Main Goalserve fetch function.
 * Calls fixtures + livescore endpoints, merges, deduplicates by matchId.
 * Uses 5-minute in-memory cache.
 */
async function fetchGoalserve(config) {
  const apiKey = process.env.GOALSERVE_API_KEY;
  if (!apiKey) return null;

  // Check cache
  if (goalserveCache.fixtures && (Date.now() - goalserveCache.fetchedAt < GOALSERVE_CACHE_TTL)) {
    console.log(`[Goalserve] Serving from cache (${goalserveCache.fixtures.length} fixtures, ` +
      `age: ${Math.round((Date.now() - goalserveCache.fetchedAt) / 1000)}s)`);
    return goalserveCache.fixtures;
  }

  console.log('[Goalserve] Fetching fresh data...');

  // Fetch from multiple endpoints to get the fullest picture:
  // - fixtures: scheduled/upcoming matches with start times (critical for R1 lock)
  // - livescore: in-progress matches with live scores
  // - results: completed matches (for winner/loser detection)
  // We merge all three and deduplicate by matchId, preferring live > results > fixtures.

  const allFixtures = new Map(); // matchId -> fixture (last write wins)

  // Priority order: fixtures first (base data), then results (completed), then live (freshest)
  const endpoints = ['fixtures', 'results', 'livescore'];

  for (const endpoint of endpoints) {
    try {
      const data = await goalserveRequest(apiKey, endpoint);
      const matches = extractMatches(data, config);
      for (const m of matches) {
        allFixtures.set(m.matchId, m);
      }
      console.log(`[Goalserve] ${endpoint}: ${matches.length} matches extracted`);
    } catch (err) {
      // livescore will 404 or be empty when no matches are live — that's fine
      if (endpoint === 'livescore') {
        console.log(`[Goalserve] livescore: no live matches (${err.message})`);
      } else {
        console.warn(`[Goalserve] ${endpoint} failed: ${err.message}`);
      }
    }
  }

  const fixtures = Array.from(allFixtures.values());

  if (fixtures.length === 0) {
    console.warn('[Goalserve] No fixtures extracted from any endpoint');
    return null;
  }

  // Update cache
  goalserveCache = { fixtures, fetchedAt: Date.now() };

  // Log summary for debugging
  const roundCounts = {};
  for (const f of fixtures) {
    roundCounts[f.round] = (roundCounts[f.round] || 0) + 1;
  }
  console.log(`[Goalserve] Total: ${fixtures.length} fixtures.`,
    `Rounds: ${JSON.stringify(roundCounts)}.`,
    `With startTime: ${fixtures.filter(f => f.startTime).length}.`,
    `Completed: ${fixtures.filter(f => f.status === 'completed').length}.`,
    `Walkovers: ${fixtures.filter(f => f.isWithdrawal).length}.`);

  return fixtures;
}

/**
 * Invalidate the Goalserve cache (e.g. after admin action).
 */
export function invalidateGoalserveCache() {
  goalserveCache = { fixtures: null, fetchedAt: 0 };
  console.log('[Goalserve] Cache invalidated');
}

async function fetchApiTennis(config) {
  // Delegate to existing tennisData.js fetchApiDraw + buildDrawFromFixtures
  // This is a bridge — keeps working as-is while we migrate.
  // Will be removed once Goalserve is validated.
  try {
    const { fetchApiDrawRaw } = await import('./tennisData.js');
    const fixtures = await fetchApiDrawRaw();
    if (!fixtures || fixtures.length === 0) return null;

    // Convert API-Tennis format → internal format
    return fixtures.map(f => {
      const round = normalizeApiTennisRound(f.tournament_round || f.event_round || '');
      if (!round) return null;

      let status = 'scheduled';
      const eventStatus = (f.event_status || '').toLowerCase();
      if (eventStatus.includes('finish')) status = 'completed';
      else if (eventStatus.includes('progress') || eventStatus.includes('live')) status = 'live';
      else if (eventStatus.includes('walkover')) status = 'walkover';
      else if (eventStatus.includes('retired')) status = 'retired';
      else if (eventStatus.includes('cancelled') || eventStatus.includes('canceled')) status = 'cancelled';

      let winnerId = null;
      let winnerName = null;
      if (f.event_winner === 'First Player') {
        winnerId = String(f.first_player_key ?? `${f.event_key}-p1`);
        winnerName = f.event_first_player || 'TBD';
      } else if (f.event_winner === 'Second Player') {
        winnerId = String(f.second_player_key ?? `${f.event_key}-p2`);
        winnerName = f.event_second_player || 'TBD';
      }

      const dt = f.startTime ? new Date(f.startTime)
        : f.event_date ? new Date(`${f.event_date}T${f.event_time || '00:00'}`) : null;

      return {
        matchId: String(f.event_key),
        round,
        player1Id: String(f.first_player_key ?? `${f.event_key}-p1`),
        player1Name: f.event_first_player || 'TBD',
        player2Id: String(f.second_player_key ?? `${f.event_key}-p2`),
        player2Name: f.event_second_player || 'TBD',
        winnerId,
        winnerName,
        status,
        startTime: dt && !Number.isNaN(dt.getTime()) ? dt.toISOString() : null,
        score: f.event_final_result || null,
        isWithdrawal: status === 'walkover' || status === 'cancelled',
        withdrawnPlayerId: null, // API-Tennis doesn't clearly indicate which player withdrew
      };
    }).filter(Boolean);
  } catch (e) {
    console.warn('[dataAdapter] API-Tennis adapter failed:', e.message);
    return null;
  }
}

async function fetchSofascore(config) {
  try {
    const { fetchSofascoreFixtures } = await import('./sofascoreAdapter.js');
    const fixtures = await fetchSofascoreFixtures();
    if (!fixtures || fixtures.length === 0) return null;

    // Sofascore adapter already outputs API-Tennis-like format
    // Convert to internal format
    return fixtures.map(f => ({
      matchId: String(f.event_key),
      round: f.tournament_round || null,
      player1Id: String(f.first_player_key),
      player1Name: f.event_first_player || 'TBD',
      player2Id: String(f.second_player_key),
      player2Name: f.event_second_player || 'TBD',
      winnerId: f.event_winner === 'First Player' ? String(f.first_player_key) : f.event_winner === 'Second Player' ? String(f.second_player_key) : null,
      winnerName: f.event_winner === 'First Player' ? f.event_first_player : f.event_winner === 'Second Player' ? f.event_second_player : null,
      status: (f.event_status || '').toLowerCase().includes('finish') ? 'completed' : (f.event_status || '').toLowerCase().includes('progress') ? 'live' : 'scheduled',
      startTime: f.startTime || null,
      score: null,
      isWithdrawal: false,
      withdrawnPlayerId: null,
    })).filter(f => f.round);
  } catch (e) {
    console.warn('[dataAdapter] Sofascore adapter failed:', e.message);
    return null;
  }
}

// ── Round normalisation (API-Tennis specific — kept for bridge adapter) ───────
const API_TENNIS_ROUND_MAP = {
  '1/64-finals': 'R1', '1/32-finals': 'R64', '1/16-finals': 'R32',
  '1/8-finals': 'R16', '1/4-finals': 'QF', '1/2-finals': 'SF',
  'final': 'F', 'the final': 'F',
  'first round': 'R1', 'round of 64': 'R64', 'round of 32': 'R32',
  'round of 16': 'R16', 'quarter-final': 'QF', 'quarter-final(s)': 'QF',
  'quarterfinal': 'QF', 'quarterfinals': 'QF', 'semi-final': 'SF',
  'semi-final(s)': 'SF', 'semifinal': 'SF', 'semifinals': 'SF',
};

function normalizeApiTennisRound(raw) {
  if (!raw) return null;
  const str = String(raw).toLowerCase().trim().replace(/^atp\s+.+?\s+-\s+/, '').trim();
  return API_TENNIS_ROUND_MAP[str] || null;
}

// ── Main fetch function ──────────────────────────────────────────────────────
// Tries providers in priority order. Returns internal fixture array or empty.
const PROVIDER_CHAIN = [
  { name: 'goalserve',  fn: fetchGoalserve },
  { name: 'api-tennis', fn: fetchApiTennis },
  { name: 'sofascore',  fn: fetchSofascore },
];

/**
 * Fetch fixtures from the best available provider.
 * Returns { provider: string, fixtures: InternalFixture[] }
 */
export async function fetchFixtures() {
  const preferred = (process.env.TENNIS_DATA_PROVIDER || '').toLowerCase();

  // If a specific provider is set, try it first (then fall through)
  const chain = preferred
    ? [
        ...PROVIDER_CHAIN.filter(p => p.name === preferred),
        ...PROVIDER_CHAIN.filter(p => p.name !== preferred),
      ]
    : PROVIDER_CHAIN;

  for (const { name, fn } of chain) {
    try {
      const fixtures = await fn(TOURNAMENT);
      if (fixtures && fixtures.length > 0) {
        return { provider: name, fixtures };
      }
    } catch (e) {
      console.warn(`[dataAdapter] ${name} failed:`, e.message);
    }
  }

  return { provider: 'none', fixtures: [] };
}

// ── R1 per-match lock helpers ────────────────────────────────────────────────
// These are used by picks.js to implement the R1 per-match lock model.

/**
 * Get match start times for all R1 matches.
 * Returns Map<playerId, { matchId, startTime, opponentId, opponentName, status }>
 */
export function getR1MatchTimes(fixtures) {
  const r1Fixtures = fixtures.filter(f => f.round === 'R1');
  const playerMatchMap = new Map();

  for (const f of r1Fixtures) {
    const matchInfo = {
      matchId: f.matchId,
      startTime: f.startTime ? new Date(f.startTime) : null,
      status: f.status,
      isWithdrawal: f.isWithdrawal,
      withdrawnPlayerId: f.withdrawnPlayerId,
    };

    playerMatchMap.set(f.player1Id, {
      ...matchInfo,
      opponentId: f.player2Id,
      opponentName: f.player2Name,
    });
    playerMatchMap.set(f.player2Id, {
      ...matchInfo,
      opponentId: f.player1Id,
      opponentName: f.player1Name,
    });
  }

  return playerMatchMap;
}

/**
 * Check if a specific player's match has started (or is completed/live).
 * Used to determine if a player can still be picked in R1.
 */
export function hasMatchStarted(playerMatchInfo) {
  if (!playerMatchInfo) return false;

  const { startTime, status } = playerMatchInfo;

  // If status indicates the match is live, completed, or a walkover, it has started
  if (['live', 'completed', 'walkover', 'retired'].includes(status)) return true;

  // If we have a start time and it's in the past, the match has started
  if (startTime && new Date() >= startTime) return true;

  return false;
}

/**
 * Check if a player has withdrawn (before their match started).
 * Returns { withdrawn: boolean, playerId: string | null }
 */
export function checkWithdrawal(playerMatchInfo) {
  if (!playerMatchInfo) return { withdrawn: false, playerId: null };

  if (playerMatchInfo.isWithdrawal) {
    return {
      withdrawn: true,
      playerId: playerMatchInfo.withdrawnPlayerId,
    };
  }

  // Also check if the match is cancelled (common withdrawal indicator)
  if (playerMatchInfo.status === 'cancelled') {
    return { withdrawn: true, playerId: null };
  }

  return { withdrawn: false, playerId: null };
}

/**
 * Get all R1 players still available for picking.
 * Filters out players whose match has started.
 */
export function getAvailableR1Players(fixtures, allPlayers) {
  const matchTimes = getR1MatchTimes(fixtures);
  const now = new Date();

  return allPlayers
    .filter(p => {
      const matchInfo = matchTimes.get(p.id);
      if (!matchInfo) return false; // not in an R1 match (e.g. seed with bye)

      // Exclude if match has started
      if (hasMatchStarted(matchInfo)) return false;

      return true;
    })
    .map(p => {
      const matchInfo = matchTimes.get(p.id);
      return {
        ...p,
        matchStartTime: matchInfo?.startTime?.toISOString() || null,
        opponentId: matchInfo?.opponentId || null,
        opponentName: matchInfo?.opponentName || null,
      };
    });
}

/**
 * Check if the entire R1 is closed (all matches have started).
 */
export function isR1Closed(fixtures) {
  const r1Fixtures = fixtures.filter(f => f.round === 'R1');
  if (r1Fixtures.length === 0) return false; // no data yet, keep open

  return r1Fixtures.every(f => {
    const status = f.status;
    if (['live', 'completed', 'walkover', 'retired', 'cancelled'].includes(status)) return true;
    if (f.startTime && new Date() >= new Date(f.startTime)) return true;
    return false;
  });
}
