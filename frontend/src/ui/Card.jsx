import './Card.css';

/**
 * Direction A card surface.
 * tone: 'default' | 'muted' | 'sunken' | 'primary' | 'gold' | 'outline'
 * padding: 'sm' | 'md' | 'lg' | 'none'
 * interactive: adds hover lift when true (for clickable cards)
 */
export function Card({
  children,
  tone = 'default',
  padding = 'md',
  interactive = false,
  className = '',
  as = 'div',
  ...rest
}) {
  const Tag = as;
  const classes = [
    'ui-card',
    `ui-card--${tone}`,
    `ui-card--pad-${padding}`,
    interactive ? 'ui-card--interactive' : '',
    className,
  ].filter(Boolean).join(' ');
  return <Tag className={classes} {...rest}>{children}</Tag>;
}
