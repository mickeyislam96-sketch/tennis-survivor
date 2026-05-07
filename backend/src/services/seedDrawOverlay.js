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
// Statuses that indicate a match has a winner (normal completion, retirement, walkover)
const DECIDED_STATUSES = new Set(['completed', 'retired', 'walkover']);
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
 * Looser match: any shared surname token between the two sides.
 * Handles double-barrel surnames where one source has only one half:
 *   seed "Merida, Daniel"           parts: ["merida","daniel"]
 *   scraper "Merida Aguilar D."     parts: ["merida","aguilar"]
 *   subset fails (each side has 2 tokens, neither is a subset of the
 *   other) but they share "merida" — same player.
 *
 * Looser than subsetMatch but still safe inside Pass 3 of matchOneFixture
 * because Pass 3 requires BOTH sides of the fixture to match. A two-of-two
 * confidence requirement combined with the round filter makes a false
 * positive extremely unlikely (it would need two unrelated players who
 * each share a surname token with the wrong side and play each other in
 * the same round).
 */
function surnameAnyOverlap(partsA, partsB) {
  if (partsA.length === 0 || partsB.length === 0) return false;
  const setB = new Set(partsB);
  return partsA.some(p => setB.has(p));
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
    // Pass 3a: strict subset on both sides (clean cases like
    //          seed "Sinner, Jannik" ↔ scraper "Sinner J.")
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

    // Pass 3b: looser shared-token match on both sides. Handles double-
    // barrel surnames where seed and scraper disagree on which half is
    // recorded (e.g. "Merida, Daniel" ↔ "Merida Aguilar D."). Still
    // requires both sides of the fixture to match — round filter +
    // both-sides constraint keep false positives away.
    for (const fix of fixtures) {
      const fxP1Parts = surnameParts(fix.player1Name);
      const fxP2Parts = surnameParts(fix.player2Name);

      const p1to1 = surnameAnyOverlap(sdP1Parts, fxP1Parts);
      const p2to2 = surnameAnyOverlap(sdP2Parts, fxP2Parts);
      if (p1to1 && p2to2) return fix;

      const p1to2 = surnameAnyOverlap(sdP1Parts, fxP2Parts);
      const p2to1 = surnameAnyOverlap(sdP2Parts, fxP1Parts);
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

  // ── Pre-pass: Detect withdrawal replacements (lucky losers) ──────────
  // When a player withdraws before their match, FlashScore shows:
  //   1. A "cancelled" fixture with the original player
  //   2. A new fixture with the replacement player (lucky loser)
  //
  // We detect this by finding fixtures where one player matches the seed
  // draw but the other doesn't. If the non-matching player has a cancelled
  // fixture at the same draw slot, it's a withdrawal replacement.
  //
  // We update the seed draw in-memory so the main overlay loop can match
  // the replacement fixture normally.

  const updatedPlayers = seedDraw.players.map(p => ({ ...p }));
  const updatedDrawPositions = seedDraw.drawPositions
    ? seedDraw.drawPositions.map(dp => ({ ...dp }))
    : null;

  // Build a set of cancelled fixtures for quick lookup
  const cancelledFixtures = fixtures.filter(f => f.status === 'cancelled');

  // Build a set of all known seed draw player surnames for matching
  const sdPlayersBySurname = {};
  for (const p of updatedPlayers) {
    for (const sp of surnameParts(p.name)) {
      if (!sdPlayersBySurname[sp]) sdPlayersBySurname[sp] = [];
      sdPlayersBySurname[sp].push(p);
    }
  }

  // Find non-cancelled fixtures with a player not in the seed draw
  const activeFixtures = fixtures.filter(f => f.status !== 'cancelled');
  const replacements = [];

  for (const fix of activeFixtures) {
    const p1Parts = surnameParts(fix.player1Name);
    const p2Parts = surnameParts(fix.player2Name);

    // Check if player 1 is known in seed draw
    const p1Known = updatedPlayers.some(p => {
      const pParts = surnameParts(p.name);
      return surnameSubsetMatch(p1Parts, pParts);
    });
    // Check if player 2 is known in seed draw
    const p2Known = updatedPlayers.some(p => {
      const pParts = surnameParts(p.name);
      return surnameSubsetMatch(p2Parts, pParts);
    });

    // If one player is known and one isn't, the unknown one might be a replacement
    if (p1Known && !p2Known) {
      // p2 is unknown — is there a cancelled fixture involving p1's opponent in the seed draw?
      const knownPlayer = updatedPlayers.find(p => surnameSubsetMatch(p1Parts, surnameParts(p.name)));
      if (knownPlayer) {
        replacements.push({
          knownPlayerId: knownPlayer.id,
          knownPlayerName: knownPlayer.name,
          unknownPlayerName: fix.player2Name,
          fixture: fix,
          side: 'p2',
        });
      }
    } else if (p2Known && !p1Known) {
      const knownPlayer = updatedPlayers.find(p => surnameSubsetMatch(p2Parts, surnameParts(p.name)));
      if (knownPlayer) {
        replacements.push({
          knownPlayerId: knownPlayer.id,
          knownPlayerName: knownPlayer.name,
          unknownPlayerName: fix.player1Name,
          fixture: fix,
          side: 'p1',
        });
      }
    }
  }

  // Process detected replacements
  for (const rep of replacements) {
    // Find the seed draw match containing the known player in R1
    // The opponent in the seed draw is the withdrawn player
    const seedMatch = seedDraw.matches.find(m =>
      m.round === seedDraw.rounds[0] && !m.bye &&
      (m.player1Id === rep.knownPlayerId || m.player2Id === rep.knownPlayerId)
    );
    if (!seedMatch) continue;

    // The withdrawn player is the OTHER player in this seed draw match
    const withdrawnId = seedMatch.player1Id === rep.knownPlayerId
      ? seedMatch.player2Id
      : seedMatch.player1Id;
    const withdrawnPlayer = updatedPlayers.find(p => p.id === withdrawnId);
    if (!withdrawnPlayer) continue;

    // Verify there's a cancelled fixture for the original matchup
    const hasCancelled = cancelledFixtures.some(cf => {
      const cf1Parts = surnameParts(cf.player1Name);
      const cf2Parts = surnameParts(cf.player2Name);
      const matchesWithdrawn = surnameSubsetMatch(surnameParts(withdrawnPlayer.name), cf1Parts)
        || surnameSubsetMatch(surnameParts(withdrawnPlayer.name), cf2Parts);
      return matchesWithdrawn;
    });

    if (!hasCancelled) continue; // No cancelled fixture = not a withdrawal replacement

    // Perform the swap: replace withdrawn player with the replacement
    const replacementName = rep.unknownPlayerName;
    const oldName = withdrawnPlayer.name;
    withdrawnPlayer.name = replacementName;
    withdrawnPlayer.seed = 'LL'; // Mark as Lucky Loser

    console.log(`[seedDrawOverlay] Auto-replacement: "${oldName}" → "${replacementName}" (LL) at ID ${withdrawnPlayer.id}`);
  }

  // Rebuild the seed draw with updated players
  const patchedSeedDraw = {
    ...seedDraw,
    players: updatedPlayers,
  };
  // Update player names in seed draw matches too
  const playerNameById = {};
  for (const p of updatedPlayers) playerNameById[p.id] = p.name;
  patchedSeedDraw.matches = seedDraw.matches.map(m => {
    const patched = { ...m };
    if (m.player1Id && playerNameById[m.player1Id]) patched.player1Name = playerNameById[m.player1Id];
    if (m.player2Id && playerNameById[m.player2Id]) patched.player2Name = playerNameById[m.player2Id];
    return patched;
  });

  let matched = 0;
  let unmatched = 0;
  const unmatchedMatches = [];

  // Clone matches to avoid mutating the cached seed draw
  const updatedMatches = patchedSeedDraw.matches.map(m => ({ ...m }));

  // ── Round-by-round matching + propagation ──────────────────────────────
  // CRITICAL FIX: The seed draw only pre-populates R64 slots with bye winners.
  // R1 match winners are left as null in the raw seed draw because their
  // results aren't known until the overlay runs. This means R64 matches
  // have null player names and can't be matched to scraper fixtures.
  //
  // Solution: process each round sequentially — match fixtures, overlay
  // results, then propagate winners into the NEXT round's slots before
  // attempting to match that round. This ensures every round has both
  // player names filled in before fixture matching runs.

  const rounds = patchedSeedDraw.rounds || [];

  // Group matches by round for round-by-round processing
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


  for (let ri = 0; ri < rounds.length; ri++) {
    const round = rounds[ri];
    const roundMatches = matchesByRound[round] || [];

    // ── Step 1: Match fixtures for this round ──────────────────────────
    // CRITICAL: Only match against fixtures from the SAME round.
    // Without this filter, surname-subset matching (Pass 3) can confuse
    // players with shared surnames across rounds (e.g. Cerundolo brothers:
    // JM Cerundolo's R64 result was bleeding into F. Cerundolo's R32 match).
    const roundFixtures = fixtures.filter(f => f.round === round);
    const roundLookup = buildFixtureLookup(roundFixtures);

    for (const match of roundMatches) {
      if (match.bye) continue;
      if (!match.player1Name || !match.player2Name) continue; // Still TBD

      const gsFixture = findFixtureMatch(match, roundLookup, roundFixtures);

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
        // Count as unmatched if this round's match has both names but no fixture
        if (match.player1Name && match.player2Name) {
          unmatched++;
          unmatchedMatches.push(`${match.player1Name} vs ${match.player2Name} (${match.round})`);
        }
      }
    }

    // ── Step 2: Propagate this round's winners into NEXT round ────────
    // This fills in player names for the next round BEFORE we try to
    // match fixtures for it.
    if (ri < rounds.length - 1) {
      const nextRound = rounds[ri + 1];
      const nextMatches = matchesByRound[nextRound] || [];

      for (let i = 0; i < nextMatches.length; i++) {
        const feeder1 = roundMatches[i * 2];
        const feeder2 = roundMatches[i * 2 + 1];
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
  }

  if (unmatched > 0) {
    console.warn(`[seedDrawOverlay] ${matched} matched, ${unmatched} unmatched fixtures:`,
      unmatchedMatches.slice(0, 10).join(', '));
  } else if (matched > 0) {
    console.log(`[seedDrawOverlay] Successfully matched ${matched} fixtures (propagated ${propagated} winners)`);
  }

  // Update player elimination status from live results
  const finalPlayers = patchedSeedDraw.players.map(p => ({ ...p }));
  const eliminatedIds = new Set();

  for (const m of updatedMatches) {
    if (DECIDED_STATUSES.has(m.status) && m.winnerId) {
      const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
      if (loserId) eliminatedIds.add(loserId);
    }
  }

  for (const p of finalPlayers) {
    if (eliminatedIds.has(p.id)) {
      // Find which round they were eliminated in
      const losingMatch = updatedMatches.find(m =>
        DECIDED_STATUSES.has(m.status) && m.winnerId &&
        (m.player1Id === p.id || m.player2Id === p.id) &&
        m.winnerId !== p.id
      );
      p.roundEliminated = losingMatch?.round || 'unknown';
    }
  }

  return {
    ...patchedSeedDraw,
    players: finalPlayers,
    matches: updatedMatches,
    dataSource: `seed_draw+scraper(${matched})`,
    replacements: replacements.length > 0
      ? replacements.map(r => ({ replacement: r.unknownPlayerName, opposedBy: r.knownPlayerName }))
      : undefined,
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
