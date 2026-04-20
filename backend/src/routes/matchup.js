/**
 * GET /api/matchup/:player1Key/:player2Key
 *
 * Returns player info and tournament form for two players.
 * Data sources: seed draw JSON (names, seeds, countries) + Goalserve fixtures
 * (tournament results). No external API calls — instant responses.
 *
 * Response shape:
 *   {
 *     player1: { name, country, seed, tournamentForm: [...] },
 *     player2: { name, country, seed, tournamentForm: [...] },
 *     h2h: { available: false }
 *   }
 *
 * Caching: responses are cached for 5 minutes (tied to Goalserve cache TTL).
 */

import { Router } from 'express';
import { TOURNAMENT } from '../config/activeTournament.js';
import { hasSeedDraw, loadSeedDraw } from '../data/seedDrawLoader.js';
import { fetchGoalserveOnly } from '../services/dataAdapter.js';

export const matchupRouter = Router();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min (matches Goalserve cache)
const matchupCache = new Map();

// ── Lookup player info from seed draw ──────────────────────────────────────

function findPlayerInDraw(draw, playerKey, playerName) {
  if (!draw || !draw.players) return null;

  // First try by ID
  if (playerKey) {
    const byId = draw.players.find(p => p.id === playerKey);
    if (byId) return byId;
  }

  // Then by name (case-insensitive)
  if (playerName) {
    const target = playerName.toLowerCase().trim();
    const byName = draw.players.find(p =>
      (p.name || '').toLowerCase().trim() === target
    );
    if (byName) return byName;
  }

  return null;
}

// ── Build tournament form from Goalserve fixtures ──────────────────────────
// Shows how each player has performed in THIS tournament so far.

function buildTournamentForm(fixtures, playerName) {
  if (!fixtures || !playerName) return [];

  const target = playerName.toLowerCase().trim();

  return fixtures
    .filter(f => {
      if (f.status !== 'completed' && f.status !== 'retired' && f.status !== 'walkover') return false;
      const p1Match = (f.player1Name || '').toLowerCase().trim() === target;
      const p2Match = (f.player2Name || '').toLowerCase().trim() === target;
      return p1Match || p2Match;
    })
    .map(f => {
      const isP1 = (f.player1Name || '').toLowerCase().trim() === target;
      const won = f.winnerId
        ? (isP1 ? f.winnerId === f.player1Id : f.winnerId === f.player2Id)
        : false;
      const opponent = isP1 ? f.player2Name : f.player1Name;

      return {
        round: f.round,
        opponent,
        score: f.score || null,
        won,
        status: f.status,
      };
    })
    // Sort by round progression
    .sort((a, b) => {
      const order = { R1: 0, R64: 1, R32: 2, R16: 3, QF: 4, SF: 5, F: 6 };
      return (order[a.round] ?? 99) - (order[b.round] ?? 99);
    });
}

// ── Route handler ────────────────────────────────────────────────────────────

matchupRouter.get('/:player1Key/:player2Key', async (req, res) => {
  const { player1Key: rawKey1, player2Key: rawKey2 } = req.params;
  const name1 = req.query.name1;
  const name2 = req.query.name2;

  if (!rawKey1 || !rawKey2) {
    return res.status(400).json({ error: 'Both player keys are required' });
  }

  // Cache check
  const cacheKey = [rawKey1, rawKey2].sort().join('-');
  const cached = matchupCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return res.json(cached.data);
  }

  try {
    const tournamentId = TOURNAMENT.id;

    // Load seed draw for player info (instant — cached in memory)
    let draw = null;
    if (hasSeedDraw(tournamentId)) {
      draw = loadSeedDraw(tournamentId);
    }

    // Look up both players in the draw
    const p1Draw = findPlayerInDraw(draw, rawKey1, name1);
    const p2Draw = findPlayerInDraw(draw, rawKey2, name2);

    // Load Goalserve fixtures for tournament form
    let fixtures = [];
    try {
      const result = await fetchGoalserveOnly();
      fixtures = result.fixtures || [];
    } catch {
      // No fixtures available — tournament form will be empty
    }

    // Build player profiles from seed draw + tournament form from fixtures
    const p1Name = p1Draw?.name || name1 || rawKey1;
    const p2Name = p2Draw?.name || name2 || rawKey2;

    const response = {
      player1: {
        key: rawKey1,
        name: p1Name,
        country: p1Draw?.country || null,
        seed: p1Draw?.seed || null,
        tournamentForm: buildTournamentForm(fixtures, p1Name),
      },
      player2: {
        key: rawKey2,
        name: p2Name,
        country: p2Draw?.country || null,
        seed: p2Draw?.seed || null,
        tournamentForm: buildTournamentForm(fixtures, p2Name),
      },
      h2h: { available: false, player1Wins: 0, player2Wins: 0, meetings: [] },
      tournament: TOURNAMENT.name || tournamentId,
      surface: TOURNAMENT.surface || null,
    };

    matchupCache.set(cacheKey, { data: response, fetchedAt: Date.now() });
    res.json(response);
  } catch (err) {
    console.error(`[matchup] Error for ${rawKey1} vs ${rawKey2}:`, err.message);
    res.status(500).json({ error: 'Failed to fetch matchup data' });
  }
});
