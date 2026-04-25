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
 * FlashScore round labels → internal round keys for 96-draw Masters 1000.
 *
 * FlashScore uses 128-draw-style fraction labels regardless of actual draw
 * size. For a 96-draw (Madrid, Rome, etc.), this shifts the mapping:
 *
 *   OUR round  │ FlashScore fraction (results page) │ FlashScore ordinal (live page)
 *   ───────────┼────────────────────────────────────┼────────────────────────────────
 *   R1         │ "1/64-finals"  (32 non-seed matches)│  (no ordinal — uses DEFAULT_ROUND or no header)
 *   R64        │ "1/32-finals"  (seeds enter, 32 matches)│ "1st Round"
 *   R32        │ "1/16-finals"  (16 matches)         │ "2nd Round"
 *   R16        │ "1/8-finals"   (8 matches)          │ "3rd Round"
 *   QF         │ "Quarter-finals"                    │ "Quarter-finals"
 *   SF         │ "Semi-finals"                       │ "Semi-finals"
 *   F          │ "Final"                             │ "Final"
 *
 * For Grand Slams (128-draw), the fraction labels align 1:1 with our rounds
 * and this map would need adjusting back.
 */
export const ROUND_MAP = {
  // Fraction labels (FlashScore results page)
  '1/64-finals':      'R1',   // 32 non-seeded matches (preliminary round)
  '1/32-finals':      'R64',  // Seeds enter, 32 matches
  '1/16-finals':      'R32',  // 16 matches
  '1/8-finals':       'R16',  // 8 matches (round of 16)
  'quarter-finals':   'QF',
  'semi-finals':      'SF',
  'final':            'F',

  // Ordinal labels (FlashScore live page — "1st Round" = seeds' first match)
  '1st round':        'R64',
  'first round':      'R64',
  '2nd round':        'R32',
  'second round':     'R32',
  '3rd round':        'R16',
  'third round':      'R16',
  'round of 16':      'R16',  // Named round — always R16 regardless of draw size
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
