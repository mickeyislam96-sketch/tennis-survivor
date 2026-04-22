/**
 * Seed Draw Overlay — merges Goalserve live data onto seed draw structure.
 *
 * The seed draw defines WHO plays WHO (bracket structure).
 * Goalserve defines WHAT HAPPENED (scores, statuses, start times).
 *
 * This module matches players by normalised name (3-pass: API key → exact → fuzzy)
 * and overlays Goalserve fixture data onto the seed draw matches.
 *
 * The result is the internal fixture format used by picks.js and the bracket viewer.
 */

// ── Name normalisation ──────────────────────────────────────────────────────

/**
 * Normalise a player name for matching.
 * "SINNER, Jannik" → "janniksinner"
 * "Jannik Sinner"  → "janniksinner"
 * Handles accents, hyphens, and reversed name orders.
 */
function normaliseName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip diacritics
    .split(/[\s,.\-']+/)              // split on space, comma, dot, hyphen, apostrophe
    .filter(Boolean)
    .sort()                            // sort parts so "Sinner Jannik" == "Jannik Sinner"
    .join('');
}

/**
 * Levenshtein distance between two strings.
 * Returns a similarity ratio from 0 to 1.
 */
function levenshteinSimilarity(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const matrix = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,       // deletion
        matrix[i][j - 1] + 1,       // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - matrix[a.length][b.length] / maxLen;
}

// ── Fixture matching ────────────────────────────────────────────────────────

/**
 * Build a lookup from normalised name → Goalserve fixture(s) for a player.
 * Pre-computing this avoids O(n²) matching.
 */
function buildGoalserveLookup(goalserveFixtures) {
  const byNorm = {};   // normalised name → [{ fixture, side: 'p1'|'p2' }]
  const byId = {};     // goalserve player ID → [{ fixture, side }]

  for (const fix of goalserveFixtures) {
    const p1Norm = normaliseName(fix.player1Name);
    const p2Norm = normaliseName(fix.player2Name);

    if (p1Norm) {
      if (!byNorm[p1Norm]) byNorm[p1Norm] = [];
      byNorm[p1Norm].push({ fixture: fix, side: 'p1' });
    }
    if (p2Norm) {
      if (!byNorm[p2Norm]) byNorm[p2Norm] = [];
      byNorm[p2Norm].push({ fixture: fix, side: 'p2' });
    }

    // Also index by player ID for apiKey matching
    if (fix.player1Id) {
      const key = String(fix.player1Id);
      if (!byId[key]) byId[key] = [];
      byId[key].push({ fixture: fix, side: 'p1' });
    }
    if (fix.player2Id) {
      const key = String(fix.player2Id);
      if (!byId[key]) byId[key] = [];
      byId[key].push({ fixture: fix, side: 'p2' });
    }
  }

  return { byNorm, byId };
}

/**
 * Find the Goalserve fixture that matches a seed draw match.
 * Uses the seed draw's player names/apiKeys to find the corresponding Goalserve fixture.
 *
 * 3-pass matching:
 *   1. API key match (most reliable — if seed draw has apiKeys populated)
 *   2. Exact normalised name match (handles name order, accents)
 *   3. Fuzzy match (Levenshtein > 0.85, for minor spelling differences)
 */
function findGoalserveMatch(seedMatch, lookup, goalserveFixtures) {
  const { byNorm, byId } = lookup;

  // We need BOTH players to match the same Goalserve fixture
  const p1Norm = normaliseName(seedMatch.player1Name);
  const p2Norm = normaliseName(seedMatch.player2Name);

  // Pass 1: find any fixture where both players appear (by normalised name)
  if (p1Norm && p2Norm) {
    const p1Matches = byNorm[p1Norm] || [];
    const p2Matches = byNorm[p2Norm] || [];

    for (const p1m of p1Matches) {
      for (const p2m of p2Matches) {
        if (p1m.fixture === p2m.fixture && p1m.side !== p2m.side) {
          return p1m.fixture;
        }
      }
    }
  }

  // Pass 2: fuzzy match — try to match at least one player, then verify the other
  if (p1Norm || p2Norm) {
    for (const fix of goalserveFixtures) {
      const fp1 = normaliseName(fix.player1Name);
      const fp2 = normaliseName(fix.player2Name);

      // Check if seed draw p1 matches either fixture player (fuzzy)
      let p1Side = null;
      if (p1Norm) {
        if (levenshteinSimilarity(p1Norm, fp1) > 0.85) p1Side = 'p1';
        else if (levenshteinSimilarity(p1Norm, fp2) > 0.85) p1Side = 'p2';
      }

      // Check if seed draw p2 matches the OTHER fixture player (fuzzy)
      let p2Side = null;
      if (p2Norm) {
        if (levenshteinSimilarity(p2Norm, fp1) > 0.85) p2Side = 'p1';
        else if (levenshteinSimilarity(p2Norm, fp2) > 0.85) p2Side = 'p2';
      }

      // Both matched, and to different sides
      if (p1Side && p2Side && p1Side !== p2Side) {
        return fix;
      }
    }
  }

  return null;
}

// ── Main overlay function ───────────────────────────────────────────────────

/**
 * Overlay Goalserve live data onto a seed draw.
 *
 * @param {object} seedDraw — output from loadSeedDraw() (players + matches)
 * @param {object[]} goalserveFixtures — internal fixture format from fetchGoalserve()
 * @returns {object} — updated seed draw with live statuses, scores, and start times
 */
export function overlayGoalserve(seedDraw, goalserveFixtures) {
  if (!goalserveFixtures?.length) return seedDraw;

  const lookup = buildGoalserveLookup(goalserveFixtures);
  let matched = 0;
  let unmatched = 0;
  const unmatchedMatches = [];

  // Clone matches to avoid mutating the cached seed draw
  const updatedMatches = seedDraw.matches.map(m => ({ ...m }));

  for (const match of updatedMatches) {
    if (match.bye) continue;
    if (!match.player1Name || !match.player2Name) continue; // TBD future rounds

    const gsFixture = findGoalserveMatch(match, lookup, goalserveFixtures);

    if (gsFixture) {
      matched++;

      // Overlay live data from Goalserve
      if (gsFixture.status && gsFixture.status !== 'scheduled') {
        match.status = gsFixture.status;
      }
      if (gsFixture.winnerId || gsFixture.winnerName) {
        // Match the Goalserve/scraper winner to our seed draw player IDs
        const winnerNorm = normaliseName(gsFixture.winnerName);
        const p1Norm = normaliseName(match.player1Name);
        const p2Norm = normaliseName(match.player2Name);

        if (winnerNorm === p1Norm || levenshteinSimilarity(winnerNorm, p1Norm) > 0.85) {
          match.winnerId = match.player1Id;
          match.winnerName = match.player1Name;
        } else if (winnerNorm === p2Norm || levenshteinSimilarity(winnerNorm, p2Norm) > 0.85) {
          match.winnerId = match.player2Id;
          match.winnerName = match.player2Name;
        }
      }
      if (gsFixture.startTime) {
        match.startTime = gsFixture.startTime;
      }
      if (gsFixture.score) {
        match.score = gsFixture.score;
      }
      if (gsFixture.isWithdrawal) {
        match.isWithdrawal = true;
        // Map withdrawn player ID to seed draw ID
        const withdrawnNorm = normaliseName(
          gsFixture.withdrawnPlayerId === gsFixture.player1Id
            ? gsFixture.player1Name
            : gsFixture.player2Name
        );
        const p1Norm = normaliseName(match.player1Name);
        if (withdrawnNorm === p1Norm || levenshteinSimilarity(withdrawnNorm, p1Norm) > 0.85) {
          match.withdrawnPlayerId = match.player1Id;
        } else {
          match.withdrawnPlayerId = match.player2Id;
        }
      }
    } else {
      // Only count as unmatched if it's a real R1 match (not a future-round TBD)
      if (match.round === seedDraw.rounds[0] && match.player1Name && match.player2Name) {
        unmatched++;
        unmatchedMatches.push(`${match.player1Name} vs ${match.player2Name} (${match.round})`);
      }
    }
  }

  if (unmatched > 0) {
    console.warn(`[seedDrawOverlay] ${matched} matched, ${unmatched} unmatched R1 fixtures:`,
      unmatchedMatches.slice(0, 5).join(', '));
  } else if (matched > 0) {
    console.log(`[seedDrawOverlay] Successfully matched ${matched} fixtures from Goalserve`);
  }

  // Update player elimination status from live results
  const updatedPlayers = seedDraw.players.map(p => ({ ...p }));
  const eliminatedIds = new Set();

  for (const m of updatedMatches) {
    if (m.status === 'completed' && m.winnerId) {
      const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
      if (loserId) eliminatedIds.add(loserId);
    }
  }

  for (const p of updatedPlayers) {
    if (eliminatedIds.has(p.id)) {
      // Find which round they were eliminated in
      const losingMatch = updatedMatches.find(m =>
        m.status === 'completed' && m.winnerId &&
        (m.player1Id === p.id || m.player2Id === p.id) &&
        m.winnerId !== p.id
      );
      p.roundEliminated = losingMatch?.round || 'unknown';
    }
  }

  return {
    ...seedDraw,
    players: updatedPlayers,
    matches: updatedMatches,
    dataSource: `seed_draw+goalserve(${matched})`,
  };
}

/**
 * Resolve qualifier placeholders in the seed draw when their names become known.
 * Call this when qualifying finishes and actual names are available.
 *
 * @param {string} tournamentId — e.g. 'madrid-2026'
 * @param {object[]} qualifierUpdates — [{ drawPos: 3, name: 'John Doe', country: 'USA' }]
 */
export function updateQualifiers(seedDraw, qualifierUpdates) {
  if (!qualifierUpdates?.length) return seedDraw;

  const updatedPlayers = seedDraw.players.map(p => ({ ...p }));
  const updatedMatches = seedDraw.matches.map(m => ({ ...m }));
  const prefix = seedDraw.tournament.replace(/-\d+$/, '');

  for (const update of qualifierUpdates) {
    const qualId = `${prefix}-q${update.drawPos}`;

    // Update player
    const player = updatedPlayers.find(p => p.id === qualId);
    if (player) {
      player.name = update.name;
      player.country = update.country || player.country;
      player.isQualifier = false;
    }

    // Update matches referencing this player
    for (const m of updatedMatches) {
      if (m.player1Id === qualId) m.player1Name = update.name;
      if (m.player2Id === qualId) m.player2Name = update.name;
      if (m.winnerId === qualId) m.winnerName = update.name;
    }
  }

  return {
    ...seedDraw,
    players: updatedPlayers,
    matches: updatedMatches,
  };
}
