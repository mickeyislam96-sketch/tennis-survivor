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

// ── Provider registry ────────────────────────────────────────────────────────
// Each provider exports a function: async (tournamentConfig) => InternalFixture[] | null

async function fetchGoalserve(config) {
  // STUB — implement on 17 Apr when Goalserve trial is activated.
  // Will be wired to: https://www.goalserve.com/en/sport-data-feeds/tennis-api
  //
  // Implementation checklist:
  // 1. Sign up at goalserve.com, get API key
  // 2. Set GOALSERVE_API_KEY env var in Railway
  // 3. Find Madrid tournament ID in their system
  // 4. Map their fixture format to our internal format above
  // 5. Map their match status strings to our status enum
  // 6. Verify withdrawal/walkover detection (key for R1 per-match lock)
  // 7. Set up 5-minute polling cache (same pattern as sofascoreAdapter.js)
  //
  // Expected Goalserve endpoints:
  //   GET /tennis/fixtures?APIkey=KEY&cat=ATP&league=TOURNAMENT_ID
  //   GET /tennis/livescores?APIkey=KEY
  //
  // Key fields to map:
  //   - Match start time → startTime
  //   - Match status (not started / live / finished / walkover / retired) → status
  //   - Player withdrawal → isWithdrawal + withdrawnPlayerId
  //   - Round name → round (via round mapping table)

  const apiKey = process.env.GOALSERVE_API_KEY;
  if (!apiKey) return null;

  // TODO: implement actual Goalserve API calls here
  console.warn('[dataAdapter] Goalserve adapter not yet implemented — falling through');
  return null;
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
