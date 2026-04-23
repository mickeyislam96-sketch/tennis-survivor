/**
 * Seed Draw Overlay — merges live fixture data onto seed draw structure.
 *
 * The seed draw defines WHO plays WHO (bracket structure).
 * Live data (from FlashScore scraper) defines WHAT HAPPENED (scores, statuses, start times).
 *
 * This module matches players by normalised name (2-pass: exact + fuzzy)
 * and overlays fixture data onto the seed draw matches.
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
 * Build a lookup from normalised name → fixture(s) for a player.
 * Pre-computing this avoids O(n²) matching.
 */
function buildFixtureLookup(fixtures) {
  const byNorm = {};   // normalised name → [{ fixture, side: 'p1'|'p2' }]
  const byId = {};     // player ID → [{ fixture, side }]

  for (const fix of fixtures) {
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
 * Extract "surname parts" from a name — parts with 3+ characters, lowercased, deaccented.
 * Strips initials and short particles so "Atmane T." → ["atmane"]
 * and "Terence Atmane" → ["terence", "atmane"].
 *
 * Used by Pass 3 (surname matching) for FlashScore abbreviated names.
 */
function surnameParts(name) {
  if (!name) return [];
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[\s,.\-']+/)
    .filter(p => p.length >= 3);
}

/**
 * Check if all parts of `shorter` appear in `longer`.
 * "Atmane" ⊂ ["terence", "atmane"] → true
 * Used for matching abbreviated FlashScore names to full seed draw names.
 */
function surnameSubsetMatch(partsA, partsB) {
  if (partsA.length === 0 || partsB.length === 0) return false;
  const shorter = partsA.length <= partsB.length ? partsA : partsB;
  const longer = partsA.length <= partsB.length ? partsB : partsA;
  const longerSet = new Set(longer);
  return shorter.every(p => longerSet.has(p));
}

/**
 * Find the fixture that matches a seed draw match.
 * Uses the seed draw's player names to find the corresponding fixture.
 *
 * 3-pass matching:
 *   1. Exact normalised name match (handles name order, accents)
 *   2. Fuzzy match (Levenshtein > 0.85, for minor spelling differences)
 *   3. Surname subset match (handles FlashScore abbreviated names like "Sinner J."
 *      matching seed draw "Jannik Sinner" — checks if surname parts from one side
 *      are a subset of the other)
 */
function findFixtureMatch(seedMatch, lookup, fixtures) {
  const { byNorm, byId } = lookup;

  // We need BOTH players to match the same fixture
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
    for (const fix of fixtures) {
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

  // Pass 3: Surname subset match — handles FlashScore abbreviated names.
  // FlashScore sends "Sinner J." while seed draw has "Jannik Sinner".
  // After stripping initials (parts < 3 chars), we check if the remaining
  // surname parts from one name are a subset of the other.
  // Both seed draw players must match different sides of the same fixture.
  const sdP1Parts = surnameParts(seedMatch.player1Name);
  const sdP2Parts = surnameParts(seedMatch.player2Name);

  if (sdP1Parts.length > 0 && sdP2Parts.length > 0) {
    for (const fix of fixtures) {
      const fxP1Parts = surnameParts(fix.player1Name);
      const fxP2Parts = surnameParts(fix.player2Name);

      // Try: seed p1 → fixture p1, seed p2 → fixture p2
      const p1to1 = surnameSubsetMatch(sdP1Parts, fxP1Parts);
      const p2to2 = surnameSubsetMatch(sdP2Parts, fxP2Parts);
      if (p1to1 && p2to2) return fix;

      // Try: seed p1 → fixture p2, seed p2 → fixture p1
      const p1to2 = surnameSubsetMatch(sdP1Parts, fxP2Parts);
      const p2to1 = surnameSubsetMatch(sdP2Parts, fxP1Parts);
      if (p1to2 && p2to1) return fix;
    }
  }

  return null;
}

// ── Main overlay function ───────────────────────────────────────────────────

/**
 * Overlay live fixture data onto a seed draw.
 *
 * @param {object} seedDraw — output from loadSeedDraw() (players + matches)
 * @param {object[]} fixtures — internal fixture format (from FlashScore scraper or any provider)
 * @returns {object} — updated seed draw with live statuses, scores, and start times
 */
export function overlayFixtures(seedDraw, fixtures) {
  if (!fixtures?.length) return seedDraw;

  const lookup = buildFixtureLookup(fixtures);
  let matched = 0;
  let unmatched = 0;
  const unmatchedMatches = [];

  // Clone matches to avoid mutating the cached seed draw
  const updatedMatches = seedDraw.matches.map(m => ({ ...m }));

  for (const match of updatedMatches) {
    if (match.bye) continue;
    if (!match.player1Name || !match.player2Name) continue; // TBD future rounds

    const gsFixture = findFixtureMatch(match, lookup, fixtures);

    if (gsFixture) {
      matched++;

      // Overlay live data
      if (gsFixture.status && gsFixture.status !== 'scheduled') {
        match.status = gsFixture.status;
      }
      if (gsFixture.winnerId || gsFixture.winnerName) {
        // Match the scraper winner to our seed draw player IDs.
        // 3 strategies: exact normalised, fuzzy Levenshtein, surname subset.
        const winnerNorm = normaliseName(gsFixture.winnerName);
        const p1Norm = normaliseName(match.player1Name);
        const p2Norm = normaliseName(match.player2Name);
        const winnerSP = surnameParts(gsFixture.winnerName);
        const p1SP = surnameParts(match.player1Name);
        const p2SP = surnameParts(match.player2Name);

        const p1Match = winnerNorm === p1Norm
          || levenshteinSimilarity(winnerNorm, p1Norm) > 0.85
          || surnameSubsetMatch(winnerSP, p1SP);
        const p2Match = winnerNorm === p2Norm
          || levenshteinSimilarity(winnerNorm, p2Norm) > 0.85
          || surnameSubsetMatch(winnerSP, p2SP);

        if (p1Match && !p2Match) {
          match.winnerId = match.player1Id;
          match.winnerName = match.player1Name;
        } else if (p2Match && !p1Match) {
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
        const withdrawnName = gsFixture.withdrawnPlayerId === gsFixture.player1Id
          ? gsFixture.player1Name
          : gsFixture.player2Name;
        const withdrawnNorm = normaliseName(withdrawnName);
        const withdrawnSP = surnameParts(withdrawnName);
        const p1Norm = normaliseName(match.player1Name);
        const p1SP = surnameParts(match.player1Name);
        const isP1 = withdrawnNorm === p1Norm
          || levenshteinSimilarity(withdrawnNorm, p1Norm) > 0.85
          || surnameSubsetMatch(withdrawnSP, p1SP);
        match.withdrawnPlayerId = isP1 ? match.player1Id : match.player2Id;
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
    console.log(`[seedDrawOverlay] Successfully matched ${matched} fixtures`);
  }

  // ── Propagate winners into subsequent round slots ────────────────────────
  // After overlaying results, winners of completed (or bye) matches should
  // fill the appropriate player slot in the next round's match.
  // Match IDs follow `m-{round}-{index}`.  Feeder pairing:
  //   prevRound[i*2] + prevRound[i*2+1]  →  nextRound[i]
  //   prevRound[i*2] winner  →  nextRound[i].player1
  //   prevRound[i*2+1] winner →  nextRound[i].player2

  const rounds = seedDraw.rounds || [];
  if (rounds.length > 1) {
    // Group matches by round, preserving matchOrder within each round
    const matchesByRound = {};
    for (const m of updatedMatches) {
      if (!matchesByRound[m.round]) matchesByRound[m.round] = [];
      matchesByRound[m.round].push(m);
    }
    // Sort each round's matches by matchOrder so feeder indexing works
    for (const round of rounds) {
      if (matchesByRound[round]) {
        matchesByRound[round].sort((a, b) => a.matchOrder - b.matchOrder);
      }
    }

    let propagated = 0;
    for (let ri = 0; ri < rounds.length - 1; ri++) {
      const currentRound = rounds[ri];
      const nextRound = rounds[ri + 1];
      const currentMatches = matchesByRound[currentRound] || [];
      const nextMatches = matchesByRound[nextRound] || [];

      for (let i = 0; i < nextMatches.length; i++) {
        const feeder1 = currentMatches[i * 2];
        const feeder2 = currentMatches[i * 2 + 1];
        const nextMatch = nextMatches[i];

        // Feeder 1 winner → nextMatch.player1
        if (feeder1?.winnerId && !nextMatch.player1Id) {
          nextMatch.player1Id = feeder1.winnerId;
          nextMatch.player1Name = feeder1.winnerName;
          propagated++;
        }
        // Feeder 2 winner → nextMatch.player2
        if (feeder2?.winnerId && !nextMatch.player2Id) {
          nextMatch.player2Id = feeder2.winnerId;
          nextMatch.player2Name = feeder2.winnerName;
          propagated++;
        }
      }
    }

    if (propagated > 0) {
      console.log(`[seedDrawOverlay] Propagated ${propagated} winner(s) into subsequent round slots`);
    }
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
    dataSource: `seed_draw+scraper(${matched})`,
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
