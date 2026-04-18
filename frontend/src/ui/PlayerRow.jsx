import './PlayerRow.css';

/**
 * PlayerRow — single-line row used in leaderboard, draw tree, and pick screens.
 *
 * Props:
 *  rank         — number or string shown on the left (optional)
 *  seed         — e.g. "[3]" for tennis seed
 *  name         — required; can contain <em> for italic accent
 *  sub          — secondary meta line (country, round eliminated, etc.)
 *  right        — right-hand content (pick count, status badge, button, etc.)
 *  eliminated   — strike-through danger styling
 *  me           — soft emerald background highlight
 *  winner       — gold background highlight
 */
export function PlayerRow({
  rank,
  seed,
  name,
  sub,
  right,
  eliminated = false,
  me = false,
  winner = false,
  className = '',
  as = 'div',
  ...rest
}) {
  const Tag = as;
  const classes = [
    'ui-player-row',
    eliminated ? 'ui-player-row--eliminated' : '',
    me ? 'ui-player-row--me' : '',
    winner ? 'ui-player-row--winner' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <Tag className={classes} {...rest}>
      <div className="ui-player-row__rank">
        {rank != null && <span>{rank}</span>}
        {seed != null && <span className="ui-player-row__seed">{seed}</span>}
      </div>
      <div className="ui-player-row__body">
        <span className="ui-player-row__name">{name}</span>
        {sub && <span className="ui-player-row__sub">{sub}</span>}
      </div>
      <div className="ui-player-row__right">{right}</div>
    </Tag>
  );
}
