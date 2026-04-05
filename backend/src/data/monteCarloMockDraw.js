/**
 * Monte Carlo Masters 2026 — real draw.
 *
 * 64-player draw with 8 byes for top 8 seeds.
 * Layout:
 *   - 24 R1 matches among 48 unseeded/qualifier players
 *   - 16 R32 matches (8 seeds with byes + 8 R1 winner pairs)
 *   - R16/QF/SF/F bracket from R32 winners
 *
 * Seeds: Alcaraz(1), Sinner(2), Zverev(3), Musetti(4), de Minaur(5),
 *        Auger-Aliassime(6), Medvedev(7), Bublik(8)
 *
 * Rounds: R1 (24) → R32 (16) → R16 (8) → QF (4) → SF (2) → F (1)
 *
 * Seeding rule: seeds are placed as player1 in their matches so they win in mock mode.
 */

import { ROUNDS, MATCHES_PER_ROUND } from '../config/tournament.js';

// ── API-Tennis player key lookup ─────────────────────────────────────────────
// Maps mock draw IDs (mc-*) to real API-Tennis player_key values.
// Used by the matchup modal to fetch H2H data from API-Tennis.
const API_KEY_MAP = {
  // Seeds (verified via global fixture search 2026-03-20 to 2026-04-03)
  'mc-s1': '2382',   // Alcaraz
  'mc-s2': '2072',   // Sinner
  'mc-s3': '1980',   // Zverev
  'mc-s4': '2849',   // Musetti
  'mc-s5': '1106',   // de Minaur
  'mc-s6': '2073',   // Auger-Aliassime
  'mc-s7': '1093',   // Medvedev
  'mc-s8': '1895',   // Bublik
  // Non-seeds (verified via MC 2026 fixture data + global search)
  'mc-p9':  '1101',  // Baez
  'mc-p10': '2168',  // Wawrinka
  'mc-p11': '1777',  // Etcheverry
  'mc-p12': '2384',  // Dimitrov
  'mc-p13': '13091', // Atmane
  'mc-p14': null,     // Quinn (LL, replacing Tiafoe — key TBD)
  'mc-p15': '2959',  // Lehecka
  'mc-p17': '2833',  // Fucsovics
  'mc-p18': '2982',  // Tabilo
  'mc-p19': '2845',  // Monfils
  'mc-p20': '427',   // Griekspoor
  'mc-p21': '1852',  // Vacherot
  'mc-p22': null,     // J.M. Cerundolo (replacing Majchrzak — key TBD)
  'mc-p23': '902',   // Mensik
  'mc-p24': '10148', // Marozsan
  'mc-p25': '2841',  // Hurkacz
  'mc-p26': '8781',  // Darderi
  'mc-p27': '372',   // Cobolli
  'mc-p29': '431',   // Shapovalov
  'mc-p31': '1103',  // Norrie
  'mc-p32': '2848',  // Kecmanovic
  'mc-p34': '2844',  // Berrettini
  'mc-p35': '40058', // Fonseca
  'mc-p36': '9909',  // Diallo
  'mc-p37': '1902',  // Rinderknech
  'mc-p38': '435',   // Khachanov
  'mc-p39': '2847',  // Rublev
  'mc-p40': '358',   // Borges
  'mc-p41': '1064',  // Bergs
  'mc-p42': '438',   // Mannarino
  'mc-p44': null,     // Garin (LL, replacing Mpetshi Perricard — key TBD)
  'mc-p45': '2167',  // Cilic
  'mc-p47': '2674',  // Moutet
  'mc-p49': '1926',  // Popyrin
  'mc-p50': '430',   // Ruud
  'mc-p51': '1104',  // F. Cerundolo
  'mc-p52': '1906',  // Tsitsipas
  'mc-p53': '1099',  // Altmaier
  'mc-p54': '2981',  // Machac
  'mc-p55': '68751', // Kouame
  'mc-p56': '1105',  // Humbert
  // Qualifiers / late replacements (keys TBD — not yet in API-Tennis fixtures)
  'mc-q1':  null,     // Nava
  'mc-q2':  null,     // Comesana
  'mc-q3':  null,     // Blockx
  'mc-q4':  null,     // Bautista Agut
  'mc-q5':  null,     // Arnaldi
  'mc-q6':  null,     // Shevchenko
  'mc-q7':  null,     // Muller
};

// ── Players ───────────────────────────────────────────────────────────────────

const MC_PLAYERS = [
  // ── Seeds (8 seeds with R1 byes, enter at R32) ───────────────────────────
  { id: 'mc-s1',   name: 'Carlos Alcaraz',              seed: 1,  country: 'ESP' },
  { id: 'mc-s2',   name: 'Jannik Sinner',               seed: 2,  country: 'ITA' },
  { id: 'mc-s3',   name: 'Alexander Zverev',            seed: 3,  country: 'GER' },
  { id: 'mc-s4',   name: 'Lorenzo Musetti',             seed: 4,  country: 'ITA' },
  { id: 'mc-s5',   name: 'Alex de Minaur',              seed: 5,  country: 'AUS' },
  { id: 'mc-s6',   name: 'Felix Auger-Aliassime',       seed: 6,  country: 'CAN' },
  { id: 'mc-s7',   name: 'Daniil Medvedev',             seed: 7,  country: 'RUS' },
  { id: 'mc-s8',   name: 'Alexander Bublik',            seed: 8,  country: 'KAZ' },

  // ── R1 Non-seeds & Qualifiers (24 matches = 48 players) ─────────────────
  // Match M0: Baez vs Wawrinka
  { id: 'mc-p9',   name: 'Sebastian Baez',              country: 'ARG' },
  { id: 'mc-p10',  name: 'Stan Wawrinka',               seed: 'WC', country: 'SUI' },

  // Match M1: Etcheverry vs Dimitrov
  { id: 'mc-p11',  name: 'Tomas Martin Etcheverry',     country: 'ARG' },
  { id: 'mc-p12',  name: 'Grigor Dimitrov',             country: 'BUL' },

  // Match M2: Atmane vs Quinn [LL]
  { id: 'mc-p13',  name: 'Terence Atmane',              country: 'FRA' },
  { id: 'mc-p14',  name: 'Ethan Quinn',                 country: 'USA' },

  // Match M3: Lehecka [11] vs Nava
  { id: 'mc-p15',  name: 'Jiri Lehecka',                seed: 11, country: 'CZE' },
  { id: 'mc-q1',   name: 'Emilio Nava',                 country: 'USA' },

  // Match M4: Fucsovics vs Tabilo
  { id: 'mc-p17',  name: 'Marton Fucsovics',            country: 'HUN' },
  { id: 'mc-p18',  name: 'Alejandro Tabilo',            country: 'CHI' },

  // Match M5: Monfils vs Griekspoor
  { id: 'mc-p19',  name: 'Gael Monfils',                seed: 'WC', country: 'FRA' },
  { id: 'mc-p20',  name: 'Tallon Griekspoor',           country: 'NED' },

  // Match M6: Vacherot vs J.M. Cerundolo
  { id: 'mc-p21',  name: 'Valentin Vacherot',           country: 'MON' },
  { id: 'mc-p22',  name: 'Juan Manuel Cerundolo',       country: 'ARG' },

  // Match M7: Mensik vs Marozsan
  { id: 'mc-p23',  name: 'Jakub Mensik',                country: 'CZE' },
  { id: 'mc-p24',  name: 'Fabian Marozsan',             country: 'HUN' },

  // Match M8: Hurkacz vs Darderi [15]
  { id: 'mc-p25',  name: 'Hubert Hurkacz',              country: 'POL' },
  { id: 'mc-p26',  name: 'Luciano Darderi',             seed: 15, country: 'ITA' },

  // Match M9: Cobolli [10] vs Comesaña
  { id: 'mc-p27',  name: 'Flavio Cobolli',              seed: 10, country: 'ITA' },
  { id: 'mc-q2',   name: 'Francisco Comesana',          country: 'ARG' },

  // Match M10: Shapovalov vs Blockx
  { id: 'mc-p29',  name: 'Denis Shapovalov',            country: 'CAN' },
  { id: 'mc-q3',   name: 'Alexander Blockx',            country: 'BEL' },

  // Match M11: Norrie vs Kecmanovic
  { id: 'mc-p31',  name: 'Cameron Norrie',              country: 'GBR' },
  { id: 'mc-p32',  name: 'Miomir Kecmanovic',           country: 'SRB' },

  // Match M12: Bautista Agut vs Berrettini [WC]
  { id: 'mc-q4',   name: 'Roberto Bautista Agut',       country: 'ESP' },
  { id: 'mc-p34',  name: 'Matteo Berrettini',           seed: 'WC', country: 'ITA' },

  // Match M13: Fonseca vs Diallo
  { id: 'mc-p35',  name: 'Joao Fonseca',                country: 'BRA' },
  { id: 'mc-p36',  name: 'Gabriel Diallo',              country: 'CAN' },

  // Match M14: Rinderknech vs Khachanov [12]
  { id: 'mc-p37',  name: 'Arthur Rinderknech',          country: 'FRA' },
  { id: 'mc-p38',  name: 'Karen Khachanov',             seed: 12, country: 'RUS' },

  // Match M15: Rublev [13] vs Borges
  { id: 'mc-p39',  name: 'Andrey Rublev',               seed: 13, country: 'RUS' },
  { id: 'mc-p40',  name: 'Nuno Borges',                 country: 'POR' },

  // Match M16: Bergs vs Mannarino
  { id: 'mc-p41',  name: 'Zizou Bergs',                 country: 'BEL' },
  { id: 'mc-p42',  name: 'Adrian Mannarino',            country: 'FRA' },

  // Match M17: Arnaldi vs Garin [LL]
  { id: 'mc-q5',   name: 'Matteo Arnaldi',              country: 'ITA' },
  { id: 'mc-p44',  name: 'Cristian Garin',              country: 'CHI' },

  // Match M18: Cilic vs Shevchenko
  { id: 'mc-p45',  name: 'Marin Cilic',                 country: 'CRO' },
  { id: 'mc-q6',   name: 'Alexander Shevchenko',        country: 'KAZ' },

  // Match M19: Moutet vs Muller
  { id: 'mc-p47',  name: 'Corentin Moutet',             country: 'FRA' },
  { id: 'mc-q7',   name: 'Alexandre Muller',            country: 'FRA' },

  // Match M20: Popyrin vs Ruud [9]
  { id: 'mc-p49',  name: 'Alexei Popyrin',              country: 'AUS' },
  { id: 'mc-p50',  name: 'Casper Ruud',                 seed: 9,  country: 'NOR' },

  // Match M21: Cerundolo [16] vs Tsitsipas
  { id: 'mc-p51',  name: 'Francisco Cerundolo',         seed: 16, country: 'ARG' },
  { id: 'mc-p52',  name: 'Stefanos Tsitsipas',          country: 'GRE' },

  // Match M22: Altmaier vs Machac
  { id: 'mc-p53',  name: 'Daniel Altmaier',             country: 'GER' },
  { id: 'mc-p54',  name: 'Tomas Machac',                country: 'CZE' },

  // Match M23: Kouame vs Humbert
  { id: 'mc-p55',  name: 'Moise Kouame',                seed: 'WC', country: 'FRA' },
  { id: 'mc-p56',  name: 'Ugo Humbert',                 country: 'FRA' },
];

// Round start times (UTC). Monte Carlo is CEST = UTC+2 in April. UK is BST = UTC+1.
// Main draw confirmed: Sunday 5 Apr, first match 10:00 BST (11:00 CEST / 09:00 UTC).
const ROUND_START_TIMES = {
  R1:  '2026-04-05T09:00:00Z', // Sun 5 Apr, 10:00 BST / 11:00 CEST
  R32: '2026-04-07T09:00:00Z', // Tue 7 Apr, 10:00 BST / 11:00 CEST
  R16: '2026-04-08T09:00:00Z', // Wed 8 Apr, 10:00 BST / 11:00 CEST
  QF:  '2026-04-10T09:00:00Z', // Fri 10 Apr, 10:00 BST / 11:00 CEST
  SF:  '2026-04-11T10:00:00Z', // Sat 11 Apr, 11:00 BST / 12:00 CEST
  F:   '2026-04-12T12:00:00Z', // Sun 12 Apr, 13:00 BST / 14:00 CEST
};

// R32 bracket structure: defines how R1 matches and seed byes feed into R32.
// 'seed' = seed has a bye (enters at R32), paired with one R1 match.
// 'r1r1' = two R1 matches feed into this R32 slot.
const R32_BRACKET = [
  { type: 'seed', seedIdx: 0, r1Idx: 0 },    // Alcaraz [1] vs M0
  { type: 'r1r1', r1Idx1: 1, r1Idx2: 2 },    // M1 vs M2
  { type: 'r1r1', r1Idx1: 3, r1Idx2: 4 },    // M3 vs M4
  { type: 'seed', seedIdx: 7, r1Idx: 5 },     // Bublik [8] vs M5
  { type: 'seed', seedIdx: 3, r1Idx: 6 },     // Musetti [4] vs M6
  { type: 'r1r1', r1Idx1: 7, r1Idx2: 8 },    // M7 vs M8
  { type: 'r1r1', r1Idx1: 9, r1Idx2: 10 },   // M9 vs M10
  { type: 'seed', seedIdx: 4, r1Idx: 11 },    // de Minaur [5] vs M11
  { type: 'seed', seedIdx: 6, r1Idx: 12 },    // Medvedev [7] vs M12
  { type: 'r1r1', r1Idx1: 13, r1Idx2: 14 },  // M13 vs M14
  { type: 'r1r1', r1Idx1: 15, r1Idx2: 16 },  // M15 vs M16
  { type: 'seed', seedIdx: 2, r1Idx: 17 },    // Zverev [3] vs M17
  { type: 'seed', seedIdx: 5, r1Idx: 18 },    // FAA [6] vs M18
  { type: 'r1r1', r1Idx1: 19, r1Idx2: 20 },  // M19 vs M20
  { type: 'r1r1', r1Idx1: 21, r1Idx2: 22 },  // M21 vs M22
  { type: 'seed', seedIdx: 1, r1Idx: 23 },    // Sinner [2] vs M23
];

function buildMonteCarloMatches() {
  const matches = [];
  const seeds = MC_PLAYERS.slice(0, 8);         // Seeds (indices 0-7)
  const r1Players = MC_PLAYERS.slice(8);        // All non-seeds (indices 8-55)

  // ── R1: build 24 real matches (no matchOrder yet — set from bracket below) ──
  const r1Real = [];
  for (let i = 0; i < MATCHES_PER_ROUND.R1; i++) {
    const p1 = r1Players[i * 2];
    const p2 = r1Players[i * 2 + 1];
    r1Real.push({
      id: `m-R1-${i}`,
      round: 'R1',
      matchOrder: 0, // overwritten below
      player1Id: p1.id, player1Name: p1.name,
      player2Id: p2.id, player2Name: p2.name,
      winnerId: null, winnerName: null,
      status: 'scheduled', bye: false,
    });
  }

  // ── R1 bracket ordering: 32 slots (24 real matches + 8 seed byes) ─────────
  // Each pair of R1 slots feeds into one R32 match. Seed bye slots are placed
  // so they align with the corresponding R32 seed-bye match in the bracket.
  let r1Order = 0;
  for (const slot of R32_BRACKET) {
    if (slot.type === 'seed') {
      // Bye entry for the seed — occupies one R1 bracket slot
      const seed = seeds[slot.seedIdx];
      matches.push({
        id: `bye-${seed.id}`,
        round: 'R1',
        matchOrder: r1Order++,
        player1Id: seed.id, player1Name: seed.name,
        player2Id: null, player2Name: 'BYE',
        winnerId: seed.id, winnerName: seed.name,
        status: 'bye', bye: true,
      });
      // The real R1 match that feeds the other side of this R32 slot
      r1Real[slot.r1Idx].matchOrder = r1Order++;
      matches.push(r1Real[slot.r1Idx]);
    } else {
      // Two real R1 matches feeding one R32 slot
      r1Real[slot.r1Idx1].matchOrder = r1Order++;
      matches.push(r1Real[slot.r1Idx1]);
      r1Real[slot.r1Idx2].matchOrder = r1Order++;
      matches.push(r1Real[slot.r1Idx2]);
    }
  }

  // ── R32: 16 matches ───────────────────────────────────────────────────────
  for (let i = 0; i < R32_BRACKET.length; i++) {
    const slot = R32_BRACKET[i];
    let p1, p2;

    if (slot.type === 'seed') {
      const seed = seeds[slot.seedIdx];
      const r1Match = r1Real[slot.r1Idx];
      p1 = { id: seed.id, name: seed.name };
      p2 = { id: r1Match.player1Id, name: r1Match.player1Name };
    } else {
      const m1 = r1Real[slot.r1Idx1];
      const m2 = r1Real[slot.r1Idx2];
      p1 = { id: m1.player1Id, name: m1.player1Name };
      p2 = { id: m2.player1Id, name: m2.player1Name };
    }

    matches.push({
      id: `m-R32-${i}`,
      round: 'R32',
      matchOrder: i,
      player1Id: p1.id, player1Name: p1.name,
      player2Id: p2.id, player2Name: p2.name,
      winnerId: null, winnerName: null,
      status: 'scheduled', bye: false,
    });
  }

  // ── R16 → QF → SF → F: pair consecutive winners ────────────────────────
  const laterRounds = ['R16', 'QF', 'SF', 'F'];
  const r32Matches = matches.filter(m => m.round === 'R32');
  let prevWinners = r32Matches.map(m => ({ id: m.player1Id, name: m.player1Name }));

  for (const round of laterRounds) {
    const count = MATCHES_PER_ROUND[round];
    const roundMatches = [];
    for (let i = 0; i < count; i++) {
      const p1 = prevWinners[i * 2];
      const p2 = prevWinners[i * 2 + 1];
      const m = {
        id: `m-${round}-${i}`,
        round,
        matchOrder: i,
        player1Id: p1.id, player1Name: p1.name,
        player2Id: p2.id, player2Name: p2.name,
        winnerId: null, winnerName: null,
        status: 'scheduled', bye: false,
      };
      matches.push(m);
      roundMatches.push(m);
    }
    prevWinners = roundMatches.map(m => ({ id: m.player1Id, name: m.player1Name }));
  }

  // API keys are injected by the caller (getMonteCarlMockDraw) using
  // the dynamic key map from tennisData.getApiKeyMap().
  return matches;
}

/**
 * Return the Monte Carlo mock draw.
 *
 * currentRound: the round treated as "in progress" (no winner yet), or
 *               null if the tournament hasn't started yet.
 *
 * Only KNOWN information is shown:
 *   - R1 matchups are always visible (they come from the official draw)
 *   - R32 seed bye slots show the seed name; opponent is TBD until R1 completes
 *   - All other future-round slots are TBD
 *   - Completed rounds show mock winners (player1 wins)
 *
 * Expected MATCHES_PER_ROUND:
 *   R1: 24, R32: 16, R16: 8, QF: 4, SF: 2, F: 1
 */
export function getMonteCarlMockDraw(currentRound = null, keyMap = null) {
  const keys = keyMap || API_KEY_MAP;
  const roundIndex = currentRound ? ROUNDS.indexOf(currentRound) : -1;
  const players = MC_PLAYERS.map(p => ({ ...p, roundEliminated: null, apiKey: keys[p.id] || null }));
  const matches = buildMonteCarloMatches();
  // Inject API keys from the (possibly dynamic) key map
  matches.forEach(m => {
    m.player1ApiKey = keys[m.player1Id] || null;
    m.player2ApiKey = keys[m.player2Id] || null;
  });
  const eliminated = new Set();
  const seedIds = new Set(MC_PLAYERS.slice(0, 8).map(p => p.id));

  // ── Step 1: set match statuses ──────────────────────────────────────────
  matches.forEach(m => {
    if (m.bye) return; // Bye entries keep their permanent status
    const r = ROUNDS.indexOf(m.round);
    m.startTime = ROUND_START_TIMES[m.round] || null;
    if (roundIndex >= 0 && r < roundIndex) {
      // Round completed: player1 wins (seeds/strong players dominate in mock)
      m.status = 'completed';
      m.winnerId = m.player1Id;
      m.winnerName = m.player1Name;
      eliminated.add(m.player2Id);
    } else if (roundIndex >= 0 && r === roundIndex) {
      m.status = 'in_progress';
    }
    // else: stays 'scheduled' (default from buildMonteCarloMatches)
  });

  // ── Step 2: clear player info for rounds whose matchups aren't known yet ─
  // R1 matchups are always known (from the official draw).
  // For rounds after the current round, only show confirmed information:
  //   - R32 seed bye slots: seed name is known, opponent is TBD
  //   - Everything else in future rounds: TBD
  matches.forEach(m => {
    if (m.round === 'R1') return; // R1 matchups always known

    const r = ROUNDS.indexOf(m.round);
    const isFutureRound = roundIndex < 0 || r > roundIndex;

    if (isFutureRound) {
      if (m.round === 'R32') {
        // Keep seed names (they have byes into R32), clear R1-winner placeholders
        if (!seedIds.has(m.player1Id)) { m.player1Id = null; m.player1Name = null; }
        if (!seedIds.has(m.player2Id)) { m.player2Id = null; m.player2Name = null; }
      } else {
        // R16+: all TBD
        m.player1Id = null; m.player1Name = null;
        m.player2Id = null; m.player2Name = null;
      }
      m.winnerId = null;
      m.winnerName = null;
    }
  });

  // ── Step 3: mark eliminated players ─────────────────────────────────────
  eliminated.forEach(id => {
    const p = players.find(x => x.id === id);
    if (!p) return;
    const lostMatch = matches.find(
      m => m.status === 'completed' && (m.player1Id === id || m.player2Id === id) && m.winnerId !== id
    );
    if (lostMatch) p.roundEliminated = lostMatch.round;
  });

  return {
    players,
    matches,
    rounds: ROUNDS,
    currentRound: currentRound || ROUNDS[0],
    tournament: 'Rolex Monte-Carlo Masters 2026',
    seedsWithByes: 8,
    dataSource: 'mock',
  };
}

export { MC_PLAYERS, API_KEY_MAP };
