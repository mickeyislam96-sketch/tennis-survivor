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
 * "Carlos Alcaraz" → "CA", "Novak" → "N"
 */
export function initials(name) {
  return (name || '?')
    .split(' ')
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Build a slug from a player name for image filename lookup.
 * "Carlos Alcaraz" → "carlos-alcaraz"
 * Strips accents so "Holger Rune" and accented variants both resolve.
 */
export function nameSlug(name) {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')       // non-alphanum → hyphens
    .replace(/^-|-$/g, '');             // trim leading/trailing
}

/**
 * Returns the URL for a player headshot, or null if we don't expect one.
 *
 * Resolution order:
 * 1. Goalserve player ID  → /players/{id}.jpg
 * 2. Name slug fallback   → /players/{slug}.jpg
 *
 * The <img> onError handler in PlayerAvatar swaps to the initials
 * circle if the file doesn't exist, so there's no need for a manifest.
 */
export function getPlayerImageUrl(playerId, playerName) {
  if (playerId) return `/players/${playerId}.jpg`;
  if (playerName) return `/players/${nameSlug(playerName)}.jpg`;
  return null;
}
