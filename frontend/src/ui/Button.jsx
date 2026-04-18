import './Button.css';

/**
 * Direction A button.
 *
 * variant: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'
 * size:    'sm' | 'md' | 'lg'
 * as:      'button' | 'a'
 *
 * Keyboard focus ring comes from .ds-focusable in tokens.css.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  as = 'button',
  type = 'button',
  fullWidth = false,
  loading = false,
  disabled,
  className = '',
  leading,
  trailing,
  ...rest
}) {
  const Tag = as;
  const classes = [
    'ui-btn',
    `ui-btn--${variant}`,
    `ui-btn--${size}`,
    fullWidth ? 'ui-btn--block' : '',
    loading ? 'ui-btn--loading' : '',
    'ds-focusable',
    className,
  ].filter(Boolean).join(' ');

  const content = (
    <>
      {leading && <span className="ui-btn__icon ui-btn__icon--lead">{leading}</span>}
      <span className="ui-btn__label">{children}</span>
      {trailing && <span className="ui-btn__icon ui-btn__icon--trail">{trailing}</span>}
    </>
  );

  if (Tag === 'button') {
    return (
      <button type={type} className={classes} disabled={disabled || loading} {...rest}>
        {content}
      </button>
    );
  }
  return <Tag className={classes} aria-disabled={disabled || loading || undefined} {...rest}>{content}</Tag>;
}
