/**
 * livetennisAdapter.js — optional Live Tennis API provider.
 *
 * Off unless LIVETENNIS_API_KEY is set. With no key the fetch returns null
 * immediately, so dataAdapter's chain behaves exactly as it did before.
 *
 * Exists so a quota exhaustion or outage on the scraper / API-Tennis /
 * Sofascore path is not the end of the round: one more independent source
 * can answer while the primary recovers.
 *
 * Output is the internal fixture format documented at the top of
 * dataAdapter.js — the rest of the codebase never sees provider fields.
 *
 * API: https://docs.livetennisapi.com  ·  spec: github.com/livetennisapi/openapi
 * Only GET /matches is used, which is on the provider's free tier.
 */

import nodeFetch from 'node-fetch';

import { TOURNAMENT } from '../config/activeTournament.js';

const fetchImpl = typeof fetch !== 'undefined' ? fetch : nodeFetch;

const API_BASE = process.env.LIVETENNIS_API_BASE || 'https://api.livetennisapi.com/api/public/v1';

// Provider caps `limit` at 200; page until meta.has_more clears.
const PAGE_LIMIT = 200;
const MAX_PAGES = 10;

// The survivor pool is an ATP singles draw. Overridable for a WTA pool.
const TOUR = (process.env.LIVETENNIS_TOUR || 'atp').toLowerCase();

// GET /matches takes one lifecycle status at a time, so a full picture of the
// draw needs all three. Order matters only for readability.
const STATUSES = ['upcoming', 'live', 'completed'];

// ── Round normalisation ──────────────────────────────────────────────────────
// The provider returns `round` as a free-form string (its OpenAPI spec declares
// no enum), so it is normalised against the vocabularies this codebase already
// handles. Anything that does not map is DROPPED, never guessed — a fixture
// filed under the wrong round would corrupt the bracket.
const DEFAULT_ROUND_MAP = {
  '1/64-finals': 'R1', '1/32-finals': 'R64', '1/16-finals': 'R32',
  '1/8-finals': 'R16', '1/4-finals': 'QF', '1/2-finals': 'SF',
  'final': 'F', 'the final': 'F',
  'first round': 'R1', '1st round': 'R1', 'round 1': 'R1', 'round of 96': 'R1',
  'round of 64': 'R64', '2nd round': 'R64', 'round 2': 'R64',
  'round of 32': 'R32', '3rd round': 'R32', 'round 3': 'R32',
  'round of 16': 'R16', '4th round': 'R16', 'round 4': 'R16',
  'quarter-final': 'QF', 'quarter-final(s)': 'QF', 'quarterfinal': 'QF',
  'quarterfinals': 'QF', 'quarter finals': 'QF',
  'semi-final': 'SF', 'semi-final(s)': 'SF', 'semifinal': 'SF',
  'semifinals': 'SF', 'semi finals': 'SF',
};

// "1/N-finals" denominators. The active tournament config wins where it sets
// them (Monte Carlo's 56-draw maps 32 -> R1, not R64) — the same precedence
// rule sofascoreAdapter.js uses.
const DEFAULT_FRACTION_DENOMS = { 64: 'R1', 32: 'R64', 16: 'R32', 8: 'R16', 4: 'QF', 2: 'SF' };

const FRACTION_DENOMS = TOURNAMENT.fractionDenomMap
  ? { ...DEFAULT_FRACTION_DENOMS, ...TOURNAMENT.fractionDenomMap }
  : DEFAULT_FRACTION_DENOMS;

const ROUND_MAP = TOURNAMENT.roundNameOverrides
  ? { ...DEFAULT_ROUND_MAP, ...TOURNAMENT.roundNameOverrides }
  : DEFAULT_ROUND_MAP;

export function normalizeLiveTennisRound(raw) {
  if (!raw) return null;
  const str = String(raw).toLowerCase().trim();

  if (ROUND_MAP[str]) return ROUND_MAP[str];

  // Already an internal key ("R32", "QF").
  const upper = str.toUpperCase();
  if (TOURNAMENT.rounds?.includes(upper)) return upper;

  // Strip a "<Tournament> - " prefix, e.g. "ATP Monte-Carlo - 1/8-finals".
  const bare = str.replace(/^.+?\s+-\s+/, '').trim();
  if (ROUND_MAP[bare]) return ROUND_MAP[bare];

  const frac = bare.match(/^1\/(\d+)-finals?$/);
  if (frac) return FRACTION_DENOMS[parseInt(frac[1], 10)] || null;

  return null;
}

// ── Status normalisation ─────────────────────────────────────────────────────
// `status` is a documented enum (upcoming|live|completed|cancelled) and is the
// authority. `event_status` is a free-form provider string, used only to
// refine a match into walkover/retired — the same best-effort read the
// API-Tennis bridge does on its equivalent field.
const STATUS_MAP = {
  upcoming: 'scheduled',
  live: 'live',
  completed: 'completed',
  cancelled: 'cancelled',
};

export function normalizeLiveTennisStatus(status, eventStatus) {
  const base = STATUS_MAP[String(status || '').toLowerCase()] || 'scheduled';
  const detail = String(eventStatus || '').toLowerCase();

  if (detail.includes('walkover')) return 'walkover';
  if (detail.includes('retired')) return 'retired';

  return base;
}

// ── Score rendering ──────────────────────────────────────────────────────────
// Score.games is player-major: [[6,3],[4,4]] reads 6-4, 3-4. Rendered only
// when both lists are present and agree on length; otherwise null rather than
// a partial line.
export function renderLiveTennisScore(score) {
  const games = score?.games;
  if (!Array.isArray(games) || games.length !== 2) return null;

  const [p1, p2] = games;
  if (!Array.isArray(p1) || !Array.isArray(p2) || p1.length === 0) return null;
  if (p1.length !== p2.length) return null;

  return p1.map((g, i) => `${g}-${p2[i]}`).join(', ');
}

// ── Tournament matching ──────────────────────────────────────────────────────
// GET /matches spans every tournament on tour, so the active one has to be
// picked out by name. LIVETENNIS_TOURNAMENT overrides when the provider's
// name for the event differs from ours.
function tournamentNeedles() {
  const override = process.env.LIVETENNIS_TOURNAMENT;
  if (override) return [override.toLowerCase()];

  return [TOURNAMENT.name, TOURNAMENT.shortName]
    .filter(Boolean)
    .map(n => String(n).toLowerCase());
}

function matchesActiveTournament(name) {
  if (!name) return false;
  const haystack = String(name).toLowerCase();
  return tournamentNeedles().some(n => haystack.includes(n) || n.includes(haystack));
}

// ── Fetching ─────────────────────────────────────────────────────────────────
async function fetchPage(apiKey, status, offset) {
  const url = `${API_BASE}/matches?status=${status}&tour=${encodeURIComponent(TOUR)}`
    + `&limit=${PAGE_LIMIT}&offset=${offset}`;

  // Key travels in a header, never the query string — a URL ends up in logs.
  const res = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`GET /matches?status=${status} returned ${res.status}`);
  }

  return res.json();
}

async function fetchStatus(apiKey, status) {
  const matches = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await fetchPage(apiKey, status, page * PAGE_LIMIT);
    const data = Array.isArray(body?.data) ? body.data : [];
    matches.push(...data);

    if (!body?.meta?.has_more || data.length === 0) break;
  }

  return matches;
}

/**
 * Convert one provider match into the internal fixture format.
 * Returns null when the match is not part of the active singles draw, or when
 * its round cannot be identified.
 */
export function toInternalFixture(m) {
  if (!m || m.is_doubles) return null;
  if (!matchesActiveTournament(m.tournament)) return null;

  const round = normalizeLiveTennisRound(m.round);
  if (!round) return null;

  const p1 = m.players?.p1 || {};
  const p2 = m.players?.p2 || {};
  const player1Id = String(p1.id ?? `${m.id}-p1`);
  const player2Id = String(p2.id ?? `${m.id}-p2`);

  const status = normalizeLiveTennisStatus(m.status, m.event_status);

  // `winner` is 1 or 2 (player-major, completed matches only). Anything else
  // is left unresolved rather than defaulted to a player.
  let winnerId = null;
  let winnerName = null;
  if (m.winner === 1) {
    winnerId = player1Id;
    winnerName = p1.name || 'TBD';
  } else if (m.winner === 2) {
    winnerId = player2Id;
    winnerName = p2.name || 'TBD';
  }

  const dt = m.scheduled_time ? new Date(m.scheduled_time) : null;

  return {
    matchId: String(m.id),
    round,
    player1Id,
    player1Name: p1.name || 'TBD',
    player2Id,
    player2Name: p2.name || 'TBD',
    winnerId,
    winnerName,
    status,
    startTime: dt && !Number.isNaN(dt.getTime()) ? dt.toISOString() : null,
    score: renderLiveTennisScore(m.score),
    isWithdrawal: status === 'walkover' || status === 'cancelled',
    // The API reports that a match was a walkover, not which player withdrew,
    // so this stays null rather than being guessed.
    withdrawnPlayerId: null,
  };
}

/**
 * Fetch the active tournament's fixtures from the Live Tennis API.
 * Returns null when the provider is not configured or has nothing to say,
 * which lets dataAdapter fall through to the next provider.
 */
export async function fetchLiveTennisFixtures() {
  const apiKey = process.env.LIVETENNIS_API_KEY;
  if (!apiKey) return null;

  const byMatchId = new Map();

  for (const status of STATUSES) {
    let raw;
    try {
      raw = await fetchStatus(apiKey, status);
    } catch (e) {
      // One status failing (rate limit, transient 5xx) should not discard the
      // statuses that did answer.
      console.warn(`[livetennis] ${status} fetch failed:`, e.message);
      continue;
    }

    for (const m of raw) {
      const fixture = toInternalFixture(m);
      // Later statuses win: a match listed as both upcoming and completed is
      // completed, and STATUSES is ordered accordingly.
      if (fixture) byMatchId.set(fixture.matchId, fixture);
    }
  }

  const fixtures = [...byMatchId.values()];
  if (fixtures.length === 0) return null;

  console.log(`[livetennis] ${fixtures.length} fixtures for ${TOURNAMENT.shortName}`);
  return fixtures;
}
