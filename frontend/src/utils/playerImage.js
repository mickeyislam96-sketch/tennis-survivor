// ── Player avatar helpers ─────────────────────────────────────
// Extracted from Layout.jsx so they can be shared across
// PlayerAvatar, Leaderboard, and any future component.

const AVATAR_COLOURS = [
  '#0F4A23', '#1E7A3E', '#C1572E', '#A84620',
  '#1F5580', '#7C3AED', '#B67300', '#0891B2',
];

/**
 * Deterministic colour for a player/user name.
 * Same name always returns the same colour.
 */
export function avatarColour(name) {
  let hash = 0;
  for (const c of (name || '')) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLOURS[hash % AVATAR_COLOURS.length];
}

/**
 * First + Last initials from a name string.
 * Handles both "Carlos Alcaraz" → "CA" and "Alcaraz, Carlos" → "AC"
 */
export function initials(name) {
  if (!name) return '?';
  // Handle "Surname, Firstname" format
  const normalised = name.includes(', ')
    ? name.split(', ').reverse().join(' ')
    : name;
  return normalised
    .split(' ')
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Surname-first display name.
 *
 * Handles two input formats:
 *  - "Surname, Firstname" (canonical seed-draw format) — most common
 *  - "Firstname Lastname" (legacy / API format)
 *
 * Output is always "Surname, F." for a single first name, or
 * "Surname, F.M." for multi-name first names. Multi-word surnames
 * (Carreno Busta, Davidovich Fokina, Mpetshi Perricard) are preserved
 * verbatim. Hyphenated first names (Jan-Lennard) are split on hyphens
 * so each component gets an initial: "Struff, J.-L.".
 *
 * Examples:
 *   "Sinner, Jannik"               → "Sinner, J."
 *   "Cerundolo, Juan Manuel"       → "Cerundolo, J.M."
 *   "Carreno Busta, Pablo"         → "Carreno Busta, P."
 *   "Mpetshi Perricard, Giovanni"  → "Mpetshi Perricard, G."
 *   "Struff, Jan-Lennard"          → "Struff, J.-L."
 *   "Auger-Aliassime, Felix"       → "Auger-Aliassime, F."
 *   "Carlos Alcaraz"               → "Alcaraz, C."         (legacy)
 *   "Carlos Alcaraz Garfia"        → "Alcaraz Garfia, C."  (legacy)
 *   "TBD" / "Qualifier 13" / null  → returned as-is or "—"
 */
export function shortName(name) {
  if (!name) return '—';
  const trimmed = name.trim();
  if (!trimmed) return '—';

  // Single token (e.g. "TBD", "Qualifier 13" with one word, etc.)
  if (!/\s/.test(trimmed) && !trimmed.includes(',')) return trimmed;

  // Build initials for first names. Hyphens are treated as separators
  // so "Jan-Lennard" becomes ["Jan","Lennard"] → "J.-L.".
  const buildInitials = (firstNames) => firstNames
    .split(/\s+/)
    .map((part) => part
      .split('-')
      .filter(Boolean)
      .map((sub) => `${sub[0].toUpperCase()}.`)
      .join('-')
    )
    .filter(Boolean)
    .join('');

  if (trimmed.includes(',')) {
    // Canonical "Surname, Firstname[s]" format.
    const [surnameRaw, firstNamesRaw = ''] = trimmed.split(',', 2);
    const surname = surnameRaw.trim();
    const firstNames = firstNamesRaw.trim();
    if (!surname) return trimmed;
    if (!firstNames) return surname;
    const inits = buildInitials(firstNames);
    return inits ? `${surname}, ${inits}` : surname;
  }

  // Legacy "Firstname [Middle...] Lastname [Lastname2]" format.
  // Heuristic: first word = first name, remaining = surname (preserves
  // multi-word surnames like "Alcaraz Garfia").
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return trimmed;
  // Guard: placeholder strings like "Qualifier 13", "TBD 1" — anything
  // where a token is purely numeric — should be left as-is rather than
  // mangled into "13, Q.".
  if (parts.some((part) => /^\d+$/.test(part))) return trimmed;
  const firstName = parts[0];
  const surname = parts.slice(1).join(' ');
  return `${surname}, ${firstName[0].toUpperCase()}.`;
}

/**
 * Build a slug from a player name for image filename lookup.
 * "Carlos Alcaraz" → "carlos-alcaraz"
 * "Alcaraz, Carlos" → "carlos-alcaraz"  (handles seed draw format)
 * Strips accents so "Holger Rune" and accented variants both resolve.
 */
export function nameSlug(name) {
  if (!name) return '';
  // Handle "Surname, Firstname" format — headshots are stored firstname-lastname
  const normalised = name.includes(', ')
    ? name.split(', ').reverse().join(' ')
    : name;
  return normalised
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')       // non-alphanum → hyphens
    .replace(/^-|-$/g, '');             // trim leading/trailing
}

/**
 * Is this a synthetic draw ID (not a real data-provider ID)?
 * Catches: p3, mc-p5, rome-p3, rome-s1, madrid-p7, rg-q2, etc.
 * These IDs have no matching headshot file — skip straight to name slug.
 */
function isMockId(id) {
  return !id || /^([a-z]+-)?[ps]\d+$/i.test(id);
}

/**
 * Returns an ordered list of image URLs to try for a player.
 *
 * Resolution order:
 * 1. Real data-provider ID → /players/{id}.jpg  (skipped for synthetic IDs)
 * 2. Name slug fallback    → /players/{slug}.jpg
 *
 * PlayerAvatar walks this list: try the first URL, on 404 try the next,
 * then fall back to initials.
 */
export function getPlayerImageUrls(playerId, playerName) {
  const urls = [];
  if (playerId && !isMockId(playerId)) {
    urls.push(`/players/${playerId}.jpg`);
  }
  if (playerName) {
    urls.push(`/players/${nameSlug(playerName)}.jpg`);
  }
  return urls;
}

/** Convenience — returns the first URL to try, or null. */
export function getPlayerImageUrl(playerId, playerName) {
  const urls = getPlayerImageUrls(playerId, playerName);
  return urls.length > 0 ? urls[0] : null;
}
