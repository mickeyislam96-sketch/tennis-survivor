import './Badge.css';

/**
 * Badge — small status indicator.
 * tone: 'neutral' | 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'gold' | 'accent'
 * size: 'sm' | 'md'
 */
export function Badge({ children, tone = 'neutral', size = 'md', dot = false, className = '', ...rest }) {
  const classes = [
    'ui-badge',
    `ui-badge--${tone}`,
    `ui-badge--${size}`,
    className,
  ].filter(Boolean).join(' ');
  return (
    <span className={classes} {...rest}>
      {dot && <span className="ui-badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

/**
 * Pill — numbered or lettered round chip (used in How-It-Works steps and round markers).
 * tone: same as Badge
 */
export function Pill({ children, tone = 'primary', size = 'md', className = '', ...rest }) {
  const classes = [
    'ui-pill',
    `ui-pill--${tone}`,
    `ui-pill--${size}`,
    className,
  ].filter(Boolean).join(' ');
  return <span className={classes} {...rest}>{children}</span>;
}
