import { useState } from 'react';
import { avatarColour, initials, getPlayerImageUrls } from '../utils/playerImage';
import './PlayerAvatar.css';

/**
 * Player headshot with automatic fallback chain.
 *
 * Tries each candidate URL in order (Goalserve ID → name slug).
 * If all fail, renders a coloured circle with the player's initials.
 */
export default function PlayerAvatar({ playerId, playerName, size = 32 }) {
  const urls = getPlayerImageUrls(playerId, playerName);
  const [urlIndex, setUrlIndex] = useState(0);

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

  const currentUrl = urls[urlIndex];

  // Show initials fallback if we've exhausted all URLs
  if (!currentUrl) {
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

  return (
    <img
      className="player-avatar player-avatar--photo"
      src={currentUrl}
      alt={playerName || 'Player'}
      width={size}
      height={size}
      style={circleStyle}
      loading="lazy"
      onError={() => setUrlIndex((i) => i + 1)}
    />
  );
}
