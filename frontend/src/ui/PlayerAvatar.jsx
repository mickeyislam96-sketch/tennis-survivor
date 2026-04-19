import { useState } from 'react';
import { avatarColour, initials, getPlayerImageUrl } from '../utils/playerImage';
import './PlayerAvatar.css';

/**
 * Player headshot with automatic initials fallback.
 *
 * Props:
 *   playerId   – Goalserve player ID (preferred for image lookup)
 *   playerName – full name (used for initials + slug-based fallback)
 *   size       – pixel diameter (default 32)
 *
 * Renders a circular <img> when a headshot exists at /players/{id}.jpg.
 * On 404 or missing ID, shows a coloured circle with the player's initials.
 */
export default function PlayerAvatar({ playerId, playerName, size = 32 }) {
  const [imgFailed, setImgFailed] = useState(false);
  const url = getPlayerImageUrl(playerId, playerName);

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

  // Show initials fallback if no URL or image failed to load
  if (!url || imgFailed) {
    const ini = initials(playerName);
    const bg  = avatarColour(playerName);
    // Scale font to ~40% of circle diameter
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

  return (
    <img
      className="player-avatar player-avatar--photo"
      src={url}
      alt={playerName || 'Player'}
      width={size}
      height={size}
      style={circleStyle}
      loading="lazy"
      onError={() => setImgFailed(true)}
    />
  );
}
