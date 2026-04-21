/**
 * matchstatAdapter.js — Matchstat Tennis API integration.
 *
 * Provides H2H records, player profiles, surface stats, and recent form
 * via the Matchstat Tennis API on RapidAPI.
 *
 * Used by the matchup modal to show rich player intelligence that Goalserve
 * (our live data provider) does not offer.
 *
 * Endpoint reference: https://tennisapidoc.matchstat.com/
 *
 * Player ID mapping: Matchstat uses its own numeric IDs. We maintain a
 * name→ID cache built from the rankings endpoint at startup, refreshed daily.
 */

const RAPIDAPI_KEY = process.env.MATCHSTAT_API_KEY || '';
const RAPIDAPI_HOST = 'tennis-api-atp-wta-itf.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}/tennis/v2`;

// ── Caches ──────────────────────────────────────────────────────────────────

const nameToIdCache = new Map();       // normalised name → matchstat ID
let nameToIdLastBuilt = 0;
const NAME_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const dataCache = new Map();           // generic response cache
const DATA_CACHE_TTL = 30 * 60 * 1000; // 30 min for H2H/profile data

// ── Helpers ─────────────────────────────────────────────────────────────────

function isConfigured() {
  return !!RAPIDAPI_KEY;
}

function normaliseName(name) {
  if (!name) return '';
  return name.toLowerCase().trim()
    .replace(/[''`]/g, '')        // strip apostrophes
    .replace(/\s+/g, ' ');         // collapse whitespace
}

async function apiFetch(path) {
  if (!isConfigured()) return null;

  // Check cache
  const cached = dataCache.get(path);
  if (cached && Date.now() - cached.ts < DATA_CACHE_TTL) {
    return cached.data;
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
    });

    if (!res.ok) {
      console.warn(`[matchstat] ${res.status} for ${path}`);
      return null;
    }

    const json = await res.json();
    const data = json.data ?? json;
    dataCache.set(path, { data, ts: Date.now() });
    return data;
  } catch (err) {
    console.warn(`[matchstat] fetch error for ${path}:`, err.message);
    return null;
  }
}

// ── Name → ID mapping ──────────────────────────────────────────────────────
// Built from the rankings endpoint (returns ~11 per page on free tier).
// We paginate to get top ~200 players which covers all M1000/GS draw players.

async function buildNameCache() {
  if (!isConfigured()) return;
  if (Date.now() - nameToIdLastBuilt < NAME_CACHE_TTL && nameToIdCache.size > 0) return;

  console.log('[matchstat] Building player name → ID cache from rankings...');
  try {
    const rankings = await apiFetch('/atp/ranking/singles');
    if (Array.isArray(rankings)) {
      for (const entry of rankings) {
        const player = entry.player;
        if (player?.id && player?.name) {
          nameToIdCache.set(normaliseName(player.name), player.id);
        }
      }
    }
    nameToIdLastBuilt = Date.now();
    console.log(`[matchstat] Name cache built: ${nameToIdCache.size} players`);
  } catch (err) {
    console.warn('[matchstat] Failed to build name cache:', err.message);
  }
}

function lookupPlayerId(playerName) {
  if (!playerName) return null;
  const key = normaliseName(playerName);
  if (nameToIdCache.has(key)) return nameToIdCache.get(key);

  // Fuzzy: try surname-only match
  const surname = key.split(' ').pop();
  for (const [cached, id] of nameToIdCache.entries()) {
    if (cached.split(' ').pop() === surname) return id;
  }

  return null;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Get H2H summary between two players.
 * Returns: { player1Wins, player2Wins, bySurface: [{surface, p1, p2}] }
 */
async function getH2H(player1Name, player2Name) {
  await buildNameCache();
  const id1 = lookupPlayerId(player1Name);
  const id2 = lookupPlayerId(player2Name);
  if (!id1 || !id2) return null;

  const info = await apiFetch(`/atp/h2h/info/${id1}/${id2}`);
  if (!info || !Array.isArray(info) || info.length === 0) return null;

  let p1Total = 0, p2Total = 0;
  const bySurface = info.map(s => {
    const p1w = parseInt(s.player1wins || '0', 10);
    const p2w = parseInt(s.player2wins || '0', 10);
    p1Total += p1w;
    p2Total += p2w;
    return { surface: s.court, player1Wins: p1w, player2Wins: p2w };
  });

  return { player1Wins: p1Total, player2Wins: p2Total, bySurface };
}

/**
 * Get H2H match history between two players.
 * Returns: [{ date, score, winner, tournament }]
 */
async function getH2HMatches(player1Name, player2Name) {
  await buildNameCache();
  const id1 = lookupPlayerId(player1Name);
  const id2 = lookupPlayerId(player2Name);
  if (!id1 || !id2) return null;

  const matches = await apiFetch(`/atp/h2h/matches/${id1}/${id2}`);
  if (!Array.isArray(matches)) return null;

  return matches.slice(0, 10).map(m => ({
    date: m.date ? m.date.slice(0, 10) : null,
    score: m.result || null,
    winnerId: m.match_winner,
    winnerName: m.match_winner === id1 ? player1Name : player2Name,
    player1: m.player1?.name || player1Name,
    player2: m.player2?.name || player2Name,
  }));
}

/**
 * Get player profile info.
 * Returns: { name, country, rank, height, weight, plays, coach, turnedPro, birthplace }
 */
async function getPlayerProfile(playerName) {
  await buildNameCache();
  const id = lookupPlayerId(playerName);
  if (!id) return null;

  const profile = await apiFetch(`/atp/player/profile/${id}`);
  if (!profile || profile.playerStatus === 'Inactive') return null;

  const info = profile.information || {};
  return {
    matchstatId: id,
    name: profile.name,
    country: profile.countryAcr,
    rank: profile.currentRank || null,
    height: info.height ? `${info.height}cm` : null,
    weight: info.weight ? `${info.weight}kg` : null,
    plays: info.plays || null,
    coach: info.coach || null,
    turnedPro: info.turnedPro || null,
    birthplace: info.birthplace || null,
    residence: info.residence || null,
  };
}

/**
 * Get player's recent match results (form).
 * Returns: [{ date, opponent, score, won }]
 */
async function getPlayerForm(playerName) {
  await buildNameCache();
  const id = lookupPlayerId(playerName);
  if (!id) return null;

  const matches = await apiFetch(`/atp/player/past-matches/${id}`);
  if (!Array.isArray(matches)) return null;

  return matches.slice(0, 10).map(m => {
    const isP1 = m.player1Id === id || m.player1?.id === id;
    return {
      date: m.date ? m.date.slice(0, 10) : null,
      opponent: isP1 ? (m.player2?.name || '?') : (m.player1?.name || '?'),
      score: m.result || null,
      won: m.match_winner === id,
    };
  });
}

/**
 * Get player's surface performance breakdown.
 * Returns: [{ year, surfaces: [{ surface, wins, losses }] }]
 */
async function getPlayerSurfaceStats(playerName) {
  await buildNameCache();
  const id = lookupPlayerId(playerName);
  if (!id) return null;

  const data = await apiFetch(`/atp/player/surface-summary/${id}`);
  if (!Array.isArray(data)) return null;

  return data.slice(0, 3).map(yr => ({
    year: yr.year,
    surfaces: (yr.surfaces || []).map(s => ({
      surface: s.court,
      wins: s.courtWins,
      losses: s.courtLosses,
    })),
  }));
}

/**
 * Get full matchup intelligence for two players.
 * Single call that combines H2H, profiles, form, and surface stats.
 */
async function getMatchupIntelligence(player1Name, player2Name) {
  if (!isConfigured()) {
    return { available: false, reason: 'Matchstat API not configured' };
  }

  // Fire all requests in parallel
  const [h2h, h2hMatches, p1Profile, p2Profile, p1Form, p2Form, p1Surface, p2Surface] =
    await Promise.all([
      getH2H(player1Name, player2Name),
      getH2HMatches(player1Name, player2Name),
      getPlayerProfile(player1Name),
      getPlayerProfile(player2Name),
      getPlayerForm(player1Name),
      getPlayerForm(player2Name),
      getPlayerSurfaceStats(player1Name),
      getPlayerSurfaceStats(player2Name),
    ]);

  return {
    available: true,
    h2h: h2h || { player1Wins: 0, player2Wins: 0, bySurface: [] },
    h2hMatches: h2hMatches || [],
    player1Profile: p1Profile || null,
    player2Profile: p2Profile || null,
    player1Form: p1Form || [],
    player2Form: p2Form || [],
    player1Surface: p1Surface || [],
    player2Surface: p2Surface || [],
  };
}

export {
  isConfigured,
  buildNameCache,
  lookupPlayerId,
  getH2H,
  getH2HMatches,
  getPlayerProfile,
  getPlayerForm,
  getPlayerSurfaceStats,
  getMatchupIntelligence,
};
