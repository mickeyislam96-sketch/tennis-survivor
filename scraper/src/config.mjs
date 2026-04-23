/**
 * Scraper configuration — tournament-specific settings.
 *
 * Update this file when switching tournaments.
 * Everything else (scrape logic, DOM extraction, score parsing) stays the same.
 */

// ── Tournament-specific ─────────────────────────────────────────────────────

/** FlashScore URL for the current tournament's live/upcoming page */
export const FLASHSCORE_URL =
  process.env.FLASHSCORE_URL ||
  'https://www.flashscore.co.uk/tennis/atp-singles/madrid/';

/** FlashScore URL for the results page (completed matches) */
export const RESULTS_URL =
  process.env.RESULTS_URL ||
  'https://www.flashscore.co.uk/tennis/atp-singles/madrid/results/';

/**
 * Round name mapping: FlashScore labels → internal round keys.
 *
 * Madrid is a 96-draw Masters 1000:
 *   "1st Round" = R1 (32 non-seeded matches)
 *   "2nd Round" = R64 (seeds enter)
 *   "3rd Round" = R32
 *   "Round of 16" = R16
 *   "Quarter-finals" = QF
 *   "Semi-finals" = SF
 *   "Final" = F
 *
 * For Grand Slams (128-draw), adjust this map — e.g. "1st Round" = R1 with
 * 64 matches, "2nd Round" = R2, etc.
 */
/**
 * FlashScore uses "1/X-finals" notation where X = number of players remaining.
 *
 * For a 96-draw Masters 1000:
 *   R1  (first round, non-seeds):  32 matches, 64 players → no FlashScore label or "1st Round"
 *   R64 (second round, seeds in):  32 matches, 64 players → "1/64-finals" on FlashScore (confusingly)
 *   R32 (third round):             16 matches, 32 players → "1/32-finals"
 *   R16:                            8 matches, 16 players → "1/16-finals"
 *   QF:                             4 matches,  8 players → "1/8-finals" or "Quarter-finals"
 *   SF:                             2 matches              → "Semi-finals"
 *   F:                              1 match                → "Final"
 *
 * NOTE: R1 matches sometimes appear WITHOUT a round header on the live page
 * (they sit at the top before any round label). The scraper handles this via
 * defaultRound logic in extractMatches.
 *
 * IMPORTANT: "1/64-finals" maps to R64, NOT R1. This is counterintuitive but
 * correct — FlashScore counts remaining players, not round number.
 */
export const ROUND_MAP = {
  // FlashScore's actual labels (as of April 2026)
  '1/64-finals':      'R64',  // 32 matches, seeds enter (round 2)
  '1/32-finals':      'R32',  // 16 matches (round 3)
  '1/16-finals':      'R16',  // 8 matches
  '1/8-finals':       'QF',   // 4 matches (quarter-finals)
  'quarter-finals':   'QF',
  'semi-finals':      'SF',
  'final':            'F',

  // Alternative labels (FlashScore sometimes varies by tournament)
  '1st round':        'R1',
  'first round':      'R1',
  '2nd round':        'R64',
  'second round':     'R64',
  '3rd round':        'R32',
  'third round':      'R32',
  'round of 16':      'R16',
  'quarter-final':    'QF',
  'quarterfinals':    'QF',
  'semi-final':       'SF',
  'semifinals':       'SF',
  'the final':        'F',
};

/**
 * UTC offset for the tournament host city.
 * Used to convert FlashScore's displayed match times to UTC.
 * Madrid during CEST (April-May) = UTC+2.
 * Rome during CEST = UTC+2.
 * Paris during CEST = UTC+2.
 * London during BST = UTC+1.
 */
export const TIMEZONE_OFFSET_HOURS = parseInt(process.env.TIMEZONE_OFFSET || '2', 10);

// ── Infrastructure ──────────────────────────────────────────────────────────

export const BACKEND_URL =
  process.env.BACKEND_URL ||
  'https://tennis-survivor-production.up.railway.app';

export const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

/**
 * Default round label for matches that appear on the live page without a
 * round header above them. On FlashScore, today's active round often appears
 * at the top of the page with no header.
 *
 * Set this to the current active round of the tournament.
 * Update it as the tournament progresses (R1 → R64 → R32 → ...).
 */
export const DEFAULT_ROUND_LABEL = process.env.DEFAULT_ROUND || 'R1';

// ── Runtime flags ───────────────────────────────────────────────────────────

export const DRY_RUN = process.argv.includes('--dry-run');
