/**
 * GET /api/matchup/:player1Key/:player2Key
 *
 * Returns head-to-head data and recent form for two players.
 * Used by the matchup info modal on the draw/bracket view.
 *
 * Response shape:
 *   {
 *     player1: { name, country, logo, rank, clay: { won, lost }, recent: [...] },
 *     player2: { name, country, logo, rank, clay: { won, lost }, recent: [...] },
 *     h2h: { player1Wins, player2Wins, meetings: [...] }
 *   }
 *
 * Caching: responses are cached in-memory for 1 hour (H2H data doesn't change
 * during a tournament). Cache key is the sorted pair of player keys.
 */

import { Router } from 'express';
import nodeFetch from 'node-fetch';

export const matchupRouter = Router();

const API_BASE = 'https://api.api-tennis.com/tennis';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const matchupCache = new Map();

async function doFetch(url) {
  return typeof fetch !== 'undefined' ? fetch(url) : nodeFetch(url);
}

// ── Fetch H2H from API-Tennis ────────────────────────────────────────────────

async function fetchH2H(player1Key, player2Key) {
  const apiKey = process.env.TENNIS_API_KEY;
  if (!apiKey) return null;

  const url =
    `${API_BASE}/?method=get_H2H` +
    `&APIkey=${apiKey}` +
    `&first_player_key=${player1Key}` +
    `&second_player_key=${player2Key}`;

  const res = await doFetch(url);
  if (!res.ok) throw new Error(`H2H API HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.success || !data?.result) return null;
  return data.result;
}

// ── Fetch player profile from API-Tennis ──────────────────────────────────────

async function fetchPlayer(playerKey) {
  const apiKey = process.env.TENNIS_API_KEY;
  if (!apiKey) return null;

  const url =
    `${API_BASE}/?method=get_players` +
    `&APIkey=${apiKey}` +
    `&player_key=${playerKey}`;

  const res = await doFetch(url);
  if (!res.ok) throw new Error(`Player API HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.success || !Array.isArray(data?.result) || data.result.length === 0) return null;
  return data.result[0];
}

// ── Parse recent match results ───────────────────────────────────────────────

function parseRecentResults(matches, limit = 5) {
  if (!Array.isArray(matches)) return [];
  return matches
    .filter(m => m.event_status === 'Finished')
    .slice(0, limit)
    .map(m => ({
      date:       m.event_date,
      opponent:   m.event_first_player,  // will be swapped if needed by caller
      result:     m.event_final_result,
      won:        m.event_winner === 'First Player' || m.event_winner === 'Second Player',
      winner:     m.event_winner,
      tournament: m.tournament_name,
      round:      m.tournament_round || null,
      surface:    null, // API doesn't include surface per match in H2H
      scores:     m.scores || [],
    }));
}

// ── Parse player profile for season stats ────────────────────────────────────
//
// Strategy: use 2025 as the primary season for overall/clay stats because
// it's the most recent complete season with meaningful sample sizes.
// Early 2026 data is too sparse (1-3 matches) to be useful for comparison.
//
// Rank: always from the most recent season entry (current ranking).
// Clay: if the chosen season has empty clay stats, fall back to the most
// recent season that has clay data.

const PREFERRED_SEASON = '2025';

function parsePlayerStats(profile) {
  if (!profile) return { name: null, country: null, logo: null, rank: null, clay: { won: 0, lost: 0 }, overall: { won: 0, lost: 0 }, season: null };

  const singlesStats = (profile.stats || [])
    .filter(s => s.type === 'singles')
    .sort((a, b) => parseInt(b.season) - parseInt(a.season));

  if (singlesStats.length === 0) {
    return { name: profile.player_name || null, country: profile.player_country || null, logo: profile.player_logo || null, rank: null, clay: { won: 0, lost: 0 }, overall: { won: 0, lost: 0 }, season: null };
  }

  // Current rank from most recent entry
  const mostRecent = singlesStats[0];
  const rank = mostRecent.rank || null;

  // Use preferred season for overall stats; fall back to most recent if not available
  const preferred = singlesStats.find(s => s.season === PREFERRED_SEASON) || mostRecent;

  // Clay: use preferred season if it has data, otherwise find most recent with clay
  let claySeason = preferred;
  if (!parseInt(preferred.clay_won) && !parseInt(preferred.clay_lost)) {
    claySeason = singlesStats.find(s => parseInt(s.clay_won) || parseInt(s.clay_lost)) || preferred;
  }

  return {
    name:    profile.player_name || null,
    country: profile.player_country || null,
    logo:    profile.player_logo || null,
    rank,
    clay: {
      won:  parseInt(claySeason.clay_won) || 0,
      lost: parseInt(claySeason.clay_lost) || 0,
    },
    claySeason: claySeason.season !== preferred.season ? claySeason.season : null,
    overall: {
      won:  parseInt(preferred.matches_won) || 0,
      lost: parseInt(preferred.matches_lost) || 0,
    },
    season: preferred.season || null,
  };
}

// ── Parse H2H meetings ──────────────────────────────────────────────────────

function parseH2HMeetings(h2hMatches, player1Key, player2Key) {
  if (!Array.isArray(h2hMatches) || h2hMatches.length === 0) {
    return { player1Wins: 0, player2Wins: 0, meetings: [] };
  }

  let player1Wins = 0;
  let player2Wins = 0;

  const meetings = h2hMatches
    .filter(m => m.event_status === 'Finished')
    .map(m => {
      const p1IsFirst = String(m.first_player_key) === String(player1Key);
      const winnerIsFirst = m.event_winner === 'First Player';
      const p1Won = p1IsFirst ? winnerIsFirst : !winnerIsFirst;

      if (p1Won) player1Wins++;
      else player2Wins++;

      return {
        date:       m.event_date,
        tournament: m.tournament_name,
        round:      m.tournament_round || null,
        result:     m.event_final_result,
        p1Won,
        scores:     m.scores || [],
      };
    });

  return { player1Wins, player2Wins, meetings };
}

// ── Annotate recent results with correct won/lost from player's perspective ──

function annotateResults(matches, playerKey) {
  if (!Array.isArray(matches)) return [];
  return matches
    .filter(m => m.event_status === 'Finished')
    .slice(0, 5)
    .map(m => {
      const isFirstPlayer = String(m.first_player_key) === String(playerKey);
      const won = isFirstPlayer
        ? m.event_winner === 'First Player'
        : m.event_winner === 'Second Player';
      const opponent = isFirstPlayer ? m.event_second_player : m.event_first_player;

      return {
        date:       m.event_date,
        opponent,
        result:     m.event_final_result,
        won,
        tournament: m.tournament_name,
        round:      m.tournament_round || null,
        scores:     m.scores || [],
      };
    });
}

// ── Route handler ────────────────────────────────────────────────────────────

matchupRouter.get('/:player1Key/:player2Key', async (req, res) => {
  const { player1Key, player2Key } = req.params;

  if (!player1Key || !player2Key) {
    return res.status(400).json({ error: 'Both player keys are required' });
  }

  // Cache key: sorted so A-vs-B and B-vs-A share the same cache entry
  const cacheKey = [player1Key, player2Key].sort().join('-');
  const cached = matchupCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return res.json(cached.data);
  }

  try {
    // Fetch H2H and both player profiles in parallel
    const [h2hResult, profile1, profile2] = await Promise.all([
      fetchH2H(player1Key, player2Key),
      fetchPlayer(player1Key),
      fetchPlayer(player2Key),
    ]);

    const p1Stats = parsePlayerStats(profile1);
    const p2Stats = parsePlayerStats(profile2);

    const h2h = h2hResult
      ? parseH2HMeetings(h2hResult.H2H, player1Key, player2Key)
      : { player1Wins: 0, player2Wins: 0, meetings: [] };

    const p1Recent = h2hResult
      ? annotateResults(h2hResult.firstPlayerResults, player1Key)
      : [];
    const p2Recent = h2hResult
      ? annotateResults(h2hResult.secondPlayerResults, player2Key)
      : [];

    const response = {
      player1: { key: player1Key, ...p1Stats, recent: p1Recent },
      player2: { key: player2Key, ...p2Stats, recent: p2Recent },
      h2h,
    };

    matchupCache.set(cacheKey, { data: response, fetchedAt: Date.now() });
    res.json(response);
  } catch (err) {
    console.error(`[matchup] Error fetching H2H for ${player1Key} vs ${player2Key}:`, err.message);
    res.status(500).json({ error: 'Failed to fetch matchup data' });
  }
});
