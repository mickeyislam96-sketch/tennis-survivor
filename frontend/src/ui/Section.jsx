import './Section.css';

/**
 * Section — full-width horizontal band with constrained inner container.
 * tone: 'canvas' | 'surface' | 'muted' | 'sunken' | 'ink' | 'primary' | 'gold'
 * size: 'sm' | 'md' (default) | 'lg'
 * read: narrow container for long-form text (680px)
 */
export function Section({
  children,
  tone = 'canvas',
  size = 'md',
  read = false,
  className = '',
  innerClassName = '',
  as = 'section',
  ...rest
}) {
  const Tag = as;
  const sectionClasses = [
    'ui-section',
    `ui-section--${tone}`,
    size === 'sm' ? 'ui-section--sm' : '',
    size === 'lg' ? 'ui-section--lg' : '',
    read ? 'ui-section--read' : '',
    className,
  ].filter(Boolean).join(' ');
  const innerClasses = ['ui-section__inner', innerClassName].filter(Boolean).join(' ');
  return (
    <Tag className={sectionClasses} {...rest}>
      <div className={innerClasses}>{children}</div>
    </Tag>
  );
}

/**
 * SectionHeader — eyebrow + title + kicker lockup.
 * Wrap italic accent words in <em>…</em>.
 */
export function SectionHeader({
  eyebrow,
  title,
  kicker,
  center = false,
  className = '',
  ...rest
}) {
  const classes = [
    'ui-section-header',
    center ? 'ui-section-header--center' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <header className={classes} {...rest}>
      {eyebrow && <span className="ui-section-header__eyebrow">{eyebrow}</span>}
      {title && <h2 className="ui-section-header__title">{title}</h2>}
      {kicker && <p className="ui-section-header__kicker">{kicker}</p>}
    </header>
  );
}

/**
 * Eyebrow — small uppercase mono label used as a standalone element
 * (e.g. above a standalone heading that isn't in a SectionHeader).
 */
export function Eyebrow({ children, className = '', ...rest }) {
  return (
    <span className={['ui-eyebrow', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </span>
  );
}
