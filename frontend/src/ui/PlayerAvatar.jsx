import { avatarColour, initials, nameSlug } from '../utils/playerImage';
import playerManifest from '../data/playerManifest.json';
import './PlayerAvatar.css';

const CELL = 80; // sprite cell size (px)

/**
 * Player headshot using a single CSS sprite sheet.
 *
 * One 205 KB sprite replaces 170 individual HTTP requests (6.4 MB).
 * If the player isn't in the sprite, renders a coloured initials circle.
 */
export default function PlayerAvatar({ playerId, playerName, size = 32 }) {
  const slug = nameSlug(playerName);
  const entry = slug ? playerManifest[slug] : null;

  const circleStyle = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  };

  // Sprite hit — show headshot via background-position
  // The sprite cells are top-aligned headshots (hair → chin). To centre
  // on the face in a circle crop, we shift up by ~10% of cell height so
  // the eyes/nose sit in the middle of the circle, not the forehead.
  if (entry) {
    const scale = size / CELL;
    const faceOffset = Math.round(CELL * 0.10 * scale); // 10% downward shift
    return (
      <span
        className="player-avatar player-avatar--photo"
        style={{
          ...circleStyle,
          backgroundImage: 'url(/player-sprite.webp)',
          backgroundSize: `${1280 * scale}px ${880 * scale}px`,
          backgroundPosition: `-${entry.x * scale}px -${entry.y * scale + faceOffset}px`,
          backgroundRepeat: 'no-repeat',
        }}
        role="img"
        aria-label={playerName || 'Player'}
      />
    );
  }

  // Initials fallback
  const ini = initials(playerName);
  const bg  = avatarColour(playerName);
  const fontSize = Math.max(10, Math.round(size * 0.4));

  return (
    <span
      className="player-avatar player-avatar--initials"
      style={{
        ...circleStyle,
        background: bg,
        color: '#fff',
        fontSize,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }}
      aria-label={playerName || 'Unknown player'}
    >
      {ini}
    </span>
  );
}
