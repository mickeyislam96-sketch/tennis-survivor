import './Stat.css';

/**
 * Stat — mono numeric value paired with an uppercase label.
 * Used for "PRIZE POOL", "ALIVE", "ROUND", etc.
 *
 * size: 'sm' | 'md' (default) | 'lg' | 'xl'
 * tone: 'default' | 'primary' | 'accent' | 'gold' | 'danger'
 * layout: 'stack' (default, label above) | 'label-below' | 'inline'
 */
export function Stat({
  label,
  value,
  hint,
  size = 'md',
  tone = 'default',
  layout = 'stack',
  className = '',
  ...rest
}) {
  const classes = [
    'ui-stat',
    `ui-stat--${size}`,
    tone !== 'default' ? `ui-stat--${tone}` : '',
    layout === 'label-below' ? 'ui-stat--label-below' : '',
    layout === 'inline' ? 'ui-stat--inline' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <div className={classes} {...rest}>
      {label && <span className="ui-stat__label">{label}</span>}
      <span className="ui-stat__value">{value}</span>
      {hint && <span className="ui-stat__hint">{hint}</span>}
    </div>
  );
}
