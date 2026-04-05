/**
 * sofascoreAdapter.js
 * Fetches live ATP match data from Sofascore's public API.
 * No API key required — completely free.
 *
 * Used as the primary data source when TENNIS_API_KEY is not set.
 * Output shape matches what tennisData.js / buildDrawFromFixtures expects.
 */

import nodeFetch from 'node-fetch';

import { TOURNAMENT } from '../config/tournament.js';

// ── Tournament config ─────────────────────────────────────────────────────────
// Reads from active tournament config. Sofascore IDs must be set via env var
// (find IDs by browsing Sofascore and inspecting network requests).
const TOURNAMENT_ID        = parseInt(process.env.SOFASCORE_TOURNAMENT_ID || '0', 10);
const UNIQUE_TOURNAMENT_ID = TOURNAMENT.sofascoreUniqueTournamentId || 0;
const DATE_START           = process.env.SOFASCORE_DATE_START || TOURNAMENT.apiDateStart;
const DATE_END             = process.env.SOFASCORE_DATE_END   || TOURNAMENT.apiDateStop;

// Sofascore roundInfo.round → our internal round key.
// The round number = players remaining AFTER this round completes.
// Uses tournament config's fractionDenomMap when available (handles
// MC's 56-draw where round 32 = R1, not R64).
// Fallback works for 96-draw Masters (Miami, Indian Wells).
const DEFAULT_SOFASCORE_ROUND_MAP = {
  64: 'R1',
  32: 'R64',
  16: 'R32',
  8:  'R16',
  4:  'QF',
  2:  'SF',
  1:  'F',
};
// Build round map: prefer tournament config (fractionDenomMap), fall back to default
const SOFASCORE_ROUND_MAP = TOURNAMENT.fractionDenomMap
  ? { ...DEFAULT_SOFASCORE_ROUND_MAP, ...TOURNAMENT.fractionDenomMap }
  : DEFAULT_SOFASCORE_ROUND_MAP;

// ── Date helpers ──────────────────────────────────────────────────────────────
function getDatesInRange(startStr, endStr) {
  const dates = [];
  const d = new Date(startStr + 'T00:00:00Z');
  const end = new Date(endStr + 'T00:00:00Z');
  while (d <= end) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

// ── Per-date cache ────────────────────────────────────────────────────────────
// Past dates: results never change → cache forever.
// Today / future: re-fetch every 5 minutes.
const LIVE_TTL  = 5  * 60 * 1000;
const dateCache = {}; // { 'YYYY-MM-DD': { events: [...], fetchedAt: ms } }

async function fetchDateEvents(date) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const isPast   = date < todayStr;

  if (isPast && dateCache[date]) return dateCache[date].events;

  const cached = dateCache[date];
  if (cached && Date.now() - cached.fetchedAt < LIVE_TTL) return cached.events;

  try {
    const baseUrl = process.env.SOFASCORE_BASE_URL || 'https://api.sofascore.com';
    const res = await nodeFetch(
      `${baseUrl}/api/v1/sport/tennis/scheduled-events/${date}`,
      {
        headers: {
          'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept':          'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer':         'https://www.sofascore.com/',
          'Origin':          'https://www.sofascore.com',
          'sec-fetch-dest':  'empty',
          'sec-fetch-mode':  'cors',
          'sec-fetch-site':  'same-site',
        },
        timeout: 10000,
      }
    );
    if (!res.ok) {
      console.warn(`[Sofascore] ${date} → HTTP ${res.status} ${res.statusText}`);
      return [];
    }
    const data   = await res.json();
    const events = (data.events || []).filter(e =>
      (TOURNAMENT_ID && e.tournament?.id === TOURNAMENT_ID) ||
      (UNIQUE_TOURNAMENT_ID && e.tournament?.uniqueTournament?.id === UNIQUE_TOURNAMENT_ID)
    );
    dateCache[date] = { events, fetchedAt: Date.now() };
    return events;
  } catch (e) {
    console.warn(`Sofascore fetch failed for ${date}:`, e.message);
    return [];
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * Returns an array of fixture objects in the same shape as API-Tennis,
 * so the rest of tennisData.js works without modification.
 * Returns null if no events found (so the caller can fall back to mock data).
 */
export async function fetchSofascoreFixtures() {
  const dates    = getDatesInRange(DATE_START, DATE_END);
  const results  = await Promise.all(dates.map(fetchDateEvents));
  const allEvents = results.flat();

  if (allEvents.length === 0) return null;

  const fixtures = allEvents.map(e => {
    const roundNum = e.roundInfo?.round;
    const round    = SOFASCORE_ROUND_MAP[roundNum];
    if (!round) return null; // ignore unknown rounds (e.g. qualifying)

    const isFinished = e.status?.type === 'finished';
    const isLive     = e.status?.type === 'inprogress';

    // Map winnerCode (1=home/player1, 2=away/player2) to API-Tennis strings
    const winner = isFinished
      ? (e.winnerCode === 1 ? 'First Player' : 'Second Player')
      : null;

    const startTime = e.startTimestamp
      ? new Date(e.startTimestamp * 1000).toISOString()
      : null;

    return {
      // ── IDs ──
      event_key:          String(e.id),
      first_player_key:   String(e.homeTeam?.id  || `${e.id}-p1`),
      second_player_key:  String(e.awayTeam?.id  || `${e.id}-p2`),

      // ── Players ──
      event_first_player:  e.homeTeam?.name || 'TBD',
      event_second_player: e.awayTeam?.name || 'TBD',

      // ── Round ──
      tournament_round:    round,

      // ── Status / result ──
      event_status:        isFinished ? 'Finished' : isLive ? 'In Progress' : 'Not started',
      event_winner:        winner,

      // ── Time ──
      startTime,           // used by toFixtureDate() in tennisData.js

      // ── Scores (bonus — shown on match cards) ──
      score_home: e.homeScore?.display ?? null,
      score_away: e.awayScore?.display ?? null,

      // ── Exclude qualifying ──
      event_qualification: 'False',
    };
  }).filter(Boolean);

  return fixtures.length > 0 ? fixtures : null;
}
