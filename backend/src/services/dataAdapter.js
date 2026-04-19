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
// Official docs: "Tennis Data Feed.pdf" from Goalserve support.
//
// Base URL: https://www.goalserve.com/getfeed/{apiKey}/tennis_scores/...
// Add ?json=1 to any URL for JSON format (default is XML).
// All times are UTC.
//
// Endpoints we use:
//   1. Leagues list:         /tennis_scores/leagues
//      → lists all tournaments with IDs. Use to find Madrid's tournament ID.
//
//   2. Fixtures/Results:     /tennis_scores/{tournamentId}
//      → current season schedules/results for a tournament.
//      → refresh: every 1 hour.
//      → structure: tournament > week[] > match[] > player[2]
//      → week.number = round name (e.g. "ATP Madrid – First Round")
//      → week.qualification = "True" for qualifying (skip these)
//
//   3. Tournament Draw:      /tennis_scores/{tournamentId}-draw
//      → complete draw with bracket connections.
//      → structure: tournament > stage[] > round[] > match[] > player[2]
//      → stage.qualification = "True" for qualifying (skip)
//      → round.name = round label (e.g. "First Round", "Semi-finals", "Final")
//      → match has match_number + next for bracket links
//      → player has seed field ("1", "Alt", "WC", "Bye")
//
//   4. Livescore:            /tennis_scores/home (today) or /tennis_scores/home?cat={tournamentId}
//      → refresh: every 5 seconds.
//      → structure: category[] > match[] > player[2]
//      → category.name includes tournament info, category.id = tournament ID
//
// Match status values (official, case-sensitive in XML, may vary in JSON):
//   "Not Started", "Finished", "Retired", "Cancelled", "Suspended",
//   "Awarded" (technical loss), "Walk over" (technical loss),
//   "Postponed", "Abandoned", "Interrupted",
//   "Set 1" .. "Set 5" (live set indicators)
//
// Player fields:
//   name (string), id (int), winner ("True"/"False"),
//   s1..s5 (set scores, can include tiebreak as "6.5"),
//   totalscore (int, sets won), serve ("True"/"False", livescore only),
//   game_score (string, livescore only), seed (draw endpoint only)

const GOALSERVE_BASE = 'https://www.goalserve.com/getfeed';
const GOALSERVE_TIMEOUT = 30000;
const GOALSERVE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// In-memory cache
let goalserveCache = { fixtures: null, fetchedAt: 0 };

// ── Round name mapping ──────────────────────────────────────────────────────
// Goalserve's round labels vary by endpoint:
//   - Fixtures feed: week.number = "ATP Madrid – Semi-finals" (prefixed with tournament)
//   - Draw feed:     round.name  = "Final", "Semi-finals", "First Round" etc.
//   - Livescore:     no round info (matched by matchId from fixtures/draw)
//
// We strip the tournament prefix and match the round portion.
const GOALSERVE_ROUND_MAP = {
  'first round':         'R1',
  '1st round':           'R1',
  'round 1':             'R1',
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
  'round of 64':         'R1',  // 96-draw Masters: "round of 64" = R1
  'round of 32':         'R64', // 96-draw Masters: "round of 32" = R64 (seeds enter)
  'round of 16':         'R16',
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
  'qualifying':          null,
};

/**
 * Normalise a Goalserve round string to our internal key.
 * Handles tournament-prefixed labels like "ATP Madrid – Semi-finals".
 */
function normalizeGoalserveRound(raw, config) {
  if (!raw) return null;
  let str = String(raw).toLowerCase().trim();

  // Config-level overrides (populated once we see actual API output)
  if (config?.roundNameOverrides) {
    for (const [pattern, round] of Object.entries(config.roundNameOverrides)) {
      if (str.includes(pattern.toLowerCase())) return round;
    }
  }

  // Strip tournament prefix: "ATP Madrid – Semi-finals" → "semi-finals"
  const dashIdx = str.lastIndexOf('–');
  const hyphenIdx = str.lastIndexOf('-');
  // Use the last separator that has text after it
  const sepIdx = dashIdx > 0 ? dashIdx : hyphenIdx > 0 ? hyphenIdx : -1;
  if (sepIdx > 0) {
    const afterSep = str.slice(sepIdx + 1).trim();
    // Only use the suffix if it looks like a round name (not just a number)
    if (afterSep.length > 2 && /[a-z]/.test(afterSep)) {
      str = afterSep;
    }
  }

  // Direct match
  if (GOALSERVE_ROUND_MAP[str] !== undefined) return GOALSERVE_ROUND_MAP[str];

  // Partial match
  for (const [label, round] of Object.entries(GOALSERVE_ROUND_MAP)) {
    if (str.includes(label)) return round;
  }

  // Numeric extraction: "Round of 32" → 32
  const numMatch = str.match(/round\s+of\s+(\d+)/i);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    const map = { 64: 'R1', 32: 'R64', 16: 'R32', 8: 'R16', 4: 'QF', 2: 'SF', 1: 'F' };
    if (map[n] !== undefined) return map[n];
  }

  console.warn(`[Goalserve] Unknown round label: "${raw}"`);
  return null;
}

/**
 * Map Goalserve match status to our internal enum.
 * Official values from docs: Not Started, Finished, Retired, Cancelled,
 * Suspended, Awarded, Walk over, Postponed, Abandoned, Interrupted,
 * Set 1..Set 5 (live).
 */
function normalizeGoalserveStatus(rawStatus) {
  if (!rawStatus) return 'scheduled';
  const s = String(rawStatus).toLowerCase().trim();

  if (s === 'finished') return 'completed';
  if (s === 'retired') return 'retired';
  if (s === 'walk over' || s === 'walkover' || s === 'awarded') return 'walkover';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  if (s === 'abandoned') return 'cancelled';
  if (s === 'suspended' || s === 'interrupted') return 'live'; // was live, temporarily stopped
  if (s === 'postponed') return 'scheduled';
  if (s === 'not started' || s === '') return 'scheduled';

  // "Set 1" through "Set 5" = live match
  if (/^set\s*\d/.test(s)) return 'live';

  return 'scheduled';
}

/**
 * Parse Goalserve date+time into ISO 8601.
 * Docs: date = DD.MM.YYYY, time = HH:MM, timezone = UTC.
 */
function parseGoalserveDateTime(dateStr, timeStr) {
  if (!dateStr) return null;

  // DD.MM.YYYY format
  const dotParts = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dotParts) {
    const [, day, month, year] = dotParts;
    const time = timeStr || '00:00';
    const iso = `${year}-${month}-${day}T${time}:00Z`;
    const dt = new Date(iso);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString();
  }

  // YYYY-MM-DD fallback
  const isoParts = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoParts) {
    const time = timeStr || '00:00';
    const dt = new Date(`${dateStr}T${time}:00Z`);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString();
  }

  return null;
}

/**
 * Build score string from set data.
 * Docs: s1..s5 fields on each player. "6.5" means tiebreak (6 set score, 5 TB score).
 */
function buildScoreString(p1, p2) {
  const sets = [];
  for (let i = 1; i <= 5; i++) {
    const a = p1[`s${i}`] ?? p1[`set${i}`];
    const b = p2[`s${i}`] ?? p2[`set${i}`];
    if (a != null && b != null && (String(a) !== '' || String(b) !== '')) {
      sets.push(`${a}-${b}`);
    }
  }
  return sets.length > 0 ? sets.join(', ') : null;
}

/** Coerce a single object or array to an array. Goalserve returns single-item as object. */
function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

/**
 * Check if a player element represents a BYE.
 * Docs: BYE player has seed="Bye" and empty name.
 */
function isByePlayer(p) {
  if (!p) return true;
  const seed = String(p.seed || '').toLowerCase();
  const name = String(p.name || '').trim();
  return seed === 'bye' || name === '' || name.toLowerCase() === 'bye';
}

// ── Fixtures/Results endpoint parser ────────────────────────────────────────
// URL: /tennis_scores/{tournamentId}
// Structure: { tournament: { week: [ { number, qualification, match: [...] } ] } }

function parseFixturesResponse(data, config) {
  const fixtures = [];
  const tournament = data?.tournament;
  if (!tournament) return fixtures;

  // Log discovered tournament ID
  if (tournament.id) {
    console.log(`[Goalserve fixtures] Tournament: "${tournament.league}" (id: ${tournament.id}, season: ${tournament.season})`);
  }

  const weeks = toArray(tournament.week);

  for (const week of weeks) {
    // Skip qualifying rounds
    if (String(week.qualification || '').toLowerCase() === 'true') continue;

    // week.number = round name (e.g. "ATP Madrid – First Round")
    const round = normalizeGoalserveRound(week.number, config);
    if (round === null) continue;

    const matches = toArray(week.match);
    for (const m of matches) {
      if (!m || !m.id) continue;

      const players = toArray(m.player);
      if (players.length < 2) continue;

      const p1 = players[0];
      const p2 = players[1];

      // Skip BYE matches
      if (isByePlayer(p1) || isByePlayer(p2)) continue;

      const status = normalizeGoalserveStatus(m.status);
      const startTime = parseGoalserveDateTime(m.date, m.time);
      const score = buildScoreString(p1, p2);

      // Winner detection: player.winner = "True" / "False"
      let winnerId = null;
      let winnerName = null;
      if (String(p1.winner || '').toLowerCase() === 'true') {
        winnerId = String(p1.id); winnerName = p1.name;
      } else if (String(p2.winner || '').toLowerCase() === 'true') {
        winnerId = String(p2.id); winnerName = p2.name;
      }

      // Withdrawal/walkover detection
      const isWalkover = status === 'walkover';
      const isCancelled = status === 'cancelled';
      const isWithdrawal = isWalkover || isCancelled;
      let withdrawnPlayerId = null;
      if (isWalkover && winnerId) {
        // The loser withdrew (winner advances without playing)
        withdrawnPlayerId = winnerId === String(p1.id) ? String(p2.id) : String(p1.id);
      }

      fixtures.push({
        matchId: String(m.id),
        round,
        player1Id: String(p1.id || `${m.id}-p1`),
        player1Name: p1.name || 'TBD',
        player2Id: String(p2.id || `${m.id}-p2`),
        player2Name: p2.name || 'TBD',
        winnerId, winnerName,
        status: status === 'retired' ? 'retired' : status,
        startTime,
        score,
        isWithdrawal,
        withdrawnPlayerId,
      });
    }
  }

  return fixtures;
}

// ── Draw endpoint parser ────────────────────────────────────────────────────
// URL: /tennis_scores/{tournamentId}-draw
// Structure: { tournament: { stage: [ { name, qualification, round: [ { name, match: [...] } ] } ] } }
// The draw has bracket connections (match_number, next) and seed info.

function parseDrawResponse(data, config) {
  const fixtures = [];
  const tournament = data?.tournament;
  if (!tournament) return fixtures;

  if (tournament.id) {
    console.log(`[Goalserve draw] Tournament: "${tournament.league}" (id: ${tournament.id})`);
  }

  const stages = toArray(tournament.stage);

  for (const stage of stages) {
    // Skip qualifying stages
    if (String(stage.qualification || '').toLowerCase() === 'true') continue;

    const rounds = toArray(stage.round);
    for (const roundObj of rounds) {
      // round.name = "Final", "Semi-finals", "First Round" etc.
      const round = normalizeGoalserveRound(roundObj.name, config);
      if (round === null) continue;

      const matches = toArray(roundObj.match);
      for (const m of matches) {
        if (!m || !m.id) continue;

        const players = toArray(m.player);
        if (players.length < 2) continue;

        const p1 = players[0];
        const p2 = players[1];
        if (isByePlayer(p1) || isByePlayer(p2)) continue;

        const status = normalizeGoalserveStatus(m.status);
        const startTime = parseGoalserveDateTime(m.date, m.time);
        const score = buildScoreString(p1, p2);

        let winnerId = null;
        let winnerName = null;
        if (String(p1.winner || '').toLowerCase() === 'true') {
          winnerId = String(p1.id); winnerName = p1.name;
        } else if (String(p2.winner || '').toLowerCase() === 'true') {
          winnerId = String(p2.id); winnerName = p2.name;
        }

        const isWalkover = status === 'walkover';
        const isCancelled = status === 'cancelled';
        const isWithdrawal = isWalkover || isCancelled;
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
          winnerId, winnerName, status,
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

// ── Livescore endpoint parser ───────────────────────────────────────────────
// URL: /tennis_scores/home?cat={tournamentId}
// Structure: { scores: { category: [ { name, id, match: [...] } ] } }
// No round info in livescore — we match by matchId to existing fixtures.

function parseLivescoreResponse(data, config) {
  const fixtures = [];
  const scores = data?.scores || data;
  const categories = toArray(scores?.category);

  // Filter to our tournament by ID or name
  const targetId = config?.goalserveTournamentId;
  const targetName = (config?.shortName || config?.name || '').toLowerCase();

  const relevant = categories.filter(c => {
    if (!c) return false;
    if (targetId && String(c.id) === String(targetId)) return true;
    const catName = (c.name || c.league || '').toLowerCase();
    if (targetName && catName.includes(targetName)) return true;
    if (catName.includes('madrid')) return true;
    return false;
  });

  for (const cat of relevant) {
    const matches = toArray(cat.match);
    for (const m of matches) {
      if (!m || !m.id) continue;

      const players = toArray(m.player);
      if (players.length < 2) continue;

      const p1 = players[0];
      const p2 = players[1];

      const status = normalizeGoalserveStatus(m.status);
      const startTime = parseGoalserveDateTime(m.date, m.time);
      const score = buildScoreString(p1, p2);

      let winnerId = null;
      let winnerName = null;
      if (String(p1.winner || '').toLowerCase() === 'true') {
        winnerId = String(p1.id); winnerName = p1.name;
      } else if (String(p2.winner || '').toLowerCase() === 'true') {
        winnerId = String(p2.id); winnerName = p2.name;
      }

      const isWalkover = status === 'walkover';
      const isWithdrawal = isWalkover || status === 'cancelled';
      let withdrawnPlayerId = null;
      if (isWalkover && winnerId) {
        withdrawnPlayerId = winnerId === String(p1.id) ? String(p2.id) : String(p1.id);
      }

      // No round info from livescore — will be filled in during merge
      fixtures.push({
        matchId: String(m.id),
        round: null,
        player1Id: String(p1.id || `${m.id}-p1`),
        player1Name: p1.name || 'TBD',
        player2Id: String(p2.id || `${m.id}-p2`),
        player2Name: p2.name || 'TBD',
        winnerId, winnerName, status,
        startTime,
        score,
        isWithdrawal,
        withdrawnPlayerId,
      });
    }
  }

  return fixtures;
}

/**
 * Fetch a single Goalserve endpoint with timeout + error handling.
 * @param {string} apiKey
 * @param {string} path — e.g. "tennis_scores/19174" or "tennis_scores/home"
 * @param {string} [queryParams] — e.g. "cat=19174"
 */
async function goalserveRequest(apiKey, path, queryParams) {
  let url = `${GOALSERVE_BASE}/${apiKey}/${path}?json=1`;
  if (queryParams) url += `&${queryParams}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GOALSERVE_TIMEOUT);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${path}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Discover the Goalserve tournament ID for Madrid from the leagues list.
 * Called when goalserveTournamentId is not set in config.
 */
// In-memory cache for the discovered tournament ID — survives across requests
// so we don't hammer the slow/flaky leagues endpoint repeatedly.
let cachedTournamentId = null;

async function discoverTournamentId(apiKey, config) {
  // Return cached ID if we already found it
  if (cachedTournamentId) return cachedTournamentId;

  const targetName = (config?.shortName || config?.name || 'Madrid').toLowerCase();

  // Strategy 1: Leagues list (comprehensive but slow/flaky)
  try {
    const data = await goalserveRequest(apiKey, 'tennis_scores/leagues');
    const leagues = toArray(data?.league || data?.leagues?.league);

    // Filter to ATP Singles only
    const atpLeagues = leagues.filter(l =>
      (l.country || '').toLowerCase() === 'atp-singles'
    );

    const match = atpLeagues.find(l =>
      (l.name || '').toLowerCase().includes(targetName) ||
      (l.name || '').toLowerCase().includes('madrid')
    );

    if (match) {
      cachedTournamentId = String(match.id);
      console.log(`[Goalserve] Discovered tournament ID from leagues: ${cachedTournamentId} ("${match.name}", season: ${match.season})`);
      return cachedTournamentId;
    }

    // Log what we found for debugging
    console.warn(`[Goalserve] Could not find "${targetName}" in leagues list. ATP tournaments found:`,
      atpLeagues.slice(0, 20).map(l => `${l.name} (${l.id})`).join(', '));
  } catch (err) {
    console.warn(`[Goalserve] Leagues discovery failed: ${err.message}`);
  }

  // Strategy 2: Scan livescore home for tournament category matching our name.
  // This is fast (~2s) but only works once the tournament has started.
  try {
    console.log(`[Goalserve] Trying home livescore scan for "${targetName}"...`);
    const data = await goalserveRequest(apiKey, 'tennis_scores/home');
    const categories = toArray(data?.scores?.category);
    const catMatch = categories.find(c => {
      const catName = (c?.['@name'] || c?.name || '').toLowerCase();
      return catName.includes(targetName) || catName.includes('madrid');
    });

    if (catMatch) {
      cachedTournamentId = String(catMatch['@id'] || catMatch.id);
      console.log(`[Goalserve] Discovered tournament ID from livescore: ${cachedTournamentId} ("${catMatch['@name'] || catMatch.name}")`);
      return cachedTournamentId;
    }
    console.log(`[Goalserve] "${targetName}" not in today's livescore (tournament may not have started)`);
  } catch (err) {
    console.warn(`[Goalserve] Home livescore scan failed: ${err.message}`);
  }

  return null;
}

/**
 * Main Goalserve fetch function.
 *
 * Strategy:
 * 1. Use tournament ID from config, or discover it from leagues list
 * 2. Fetch fixtures/results (has round info + start times)
 * 3. Fetch draw (has round info + seed info, good for pre-tournament)
 * 4. Fetch livescore (has live status updates, no round info)
 * 5. Merge: fixtures as base, draw fills gaps, livescore overrides status
 * 6. Cache for 5 minutes
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

  // Resolve tournament ID (config > cached > discover)
  let tournamentId = config?.goalserveTournamentId || cachedTournamentId;
  if (!tournamentId) {
    tournamentId = await discoverTournamentId(apiKey, config);
    if (tournamentId) {
      console.log(`[Goalserve] Using discovered tournament ID: ${tournamentId}. ` +
        `Hardcode goalserveTournamentId: '${tournamentId}' in activeTournament.js to skip discovery.`);
    }
  }

  if (!tournamentId) {
    console.warn('[Goalserve] No tournament ID available. Cannot fetch fixtures.');
    return null;
  }

  // matchId → fixture map. Later writes override earlier (livescore > draw > fixtures).
  const allFixtures = new Map();

  // 1. Fixtures/Results endpoint (base data with round info + start times)
  try {
    const data = await goalserveRequest(apiKey, `tennis_scores/${tournamentId}`);
    const matches = parseFixturesResponse(data, config);
    for (const m of matches) allFixtures.set(m.matchId, m);
    console.log(`[Goalserve] fixtures: ${matches.length} matches`);
  } catch (err) {
    console.warn(`[Goalserve] fixtures endpoint failed: ${err.message}`);
  }

  // 2. Draw endpoint (has round names, good before tournament starts)
  try {
    const data = await goalserveRequest(apiKey, `tennis_scores/${tournamentId}-draw`);
    const matches = parseDrawResponse(data, config);
    for (const m of matches) {
      const existing = allFixtures.get(m.matchId);
      if (existing) {
        // Draw has round info — fill in if fixtures didn't have it
        if (!existing.round && m.round) existing.round = m.round;
        // Draw may have start times if fixtures didn't
        if (!existing.startTime && m.startTime) existing.startTime = m.startTime;
      } else {
        allFixtures.set(m.matchId, m);
      }
    }
    console.log(`[Goalserve] draw: ${matches.length} matches`);
  } catch (err) {
    // Draw may not be available yet
    console.log(`[Goalserve] draw endpoint: ${err.message}`);
  }

  // 3. Livescore endpoint (freshest status, no round info)
  try {
    const data = await goalserveRequest(apiKey, 'tennis_scores/home', `cat=${tournamentId}`);
    const matches = parseLivescoreResponse(data, config);
    for (const m of matches) {
      const existing = allFixtures.get(m.matchId);
      if (existing) {
        // Livescore has the freshest status, score, and winner info
        existing.status = m.status;
        if (m.score) existing.score = m.score;
        if (m.winnerId) { existing.winnerId = m.winnerId; existing.winnerName = m.winnerName; }
        if (m.isWithdrawal) {
          existing.isWithdrawal = true;
          existing.withdrawnPlayerId = m.withdrawnPlayerId;
        }
      }
      // Don't add live-only matches (they lack round info)
    }
    console.log(`[Goalserve] livescore: ${matches.length} live matches`);
  } catch (err) {
    // No live matches is normal when tournament hasn't started
    console.log(`[Goalserve] livescore: ${err.message}`);
  }

  // Filter out fixtures with no round (couldn't be mapped)
  const fixtures = Array.from(allFixtures.values()).filter(f => f.round !== null);

  if (fixtures.length === 0) {
    console.warn('[Goalserve] No valid fixtures extracted');
    return null;
  }

  // Update cache
  goalserveCache = { fixtures, fetchedAt: Date.now() };

  // Log summary
  const roundCounts = {};
  for (const f of fixtures) { roundCounts[f.round] = (roundCounts[f.round] || 0) + 1; }
  console.log(`[Goalserve] Total: ${fixtures.length} fixtures.`,
    `Rounds: ${JSON.stringify(roundCounts)}.`,
    `With startTime: ${fixtures.filter(f => f.startTime).length}.`,
    `Completed: ${fixtures.filter(f => f.status === 'completed').length}.`,
    `Walkovers: ${fixtures.filter(f => f.isWithdrawal).length}.`);

  return fixtures;
}

/** Invalidate the Goalserve cache (e.g. after admin action). */
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
