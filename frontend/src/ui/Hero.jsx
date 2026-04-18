import './Hero.css';
import { CourtBackdrop } from './CourtBackdrop.jsx';

/**
 * Hero — page banner with optional eyebrow, title, lede, actions, and meta row.
 * tone: 'ink' (default) | 'primary' | 'canvas' | 'gold'
 * compact: shrink padding + title size for internal pages
 * showCourt: render CourtBackdrop behind the content
 */
export function Hero({
  eyebrow,
  title,
  lede,
  actions,
  meta,
  tone = 'ink',
  compact = false,
  showCourt = true,
  courtOpacity,
  className = '',
  children,
  ...rest
}) {
  const classes = [
    'ui-hero',
    `ui-hero--${tone}`,
    compact ? 'ui-hero--compact' : '',
    className,
  ].filter(Boolean).join(' ');

  // Sensible default opacities per tone
  const defaultCourtOpacity =
    courtOpacity ??
    (tone === 'ink' ? 0.08 : tone === 'primary' ? 0.18 : tone === 'gold' ? 0.18 : 0.06);

  return (
    <section className={classes} {...rest}>
      {showCourt && <CourtBackdrop opacity={defaultCourtOpacity} />}
      <div className="ui-hero__inner">
        {eyebrow && <span className="ui-hero__eyebrow">{eyebrow}</span>}
        {title && <h1 className="ui-hero__title">{title}</h1>}
        {lede && <p className="ui-hero__lede">{lede}</p>}
        {actions && <div className="ui-hero__actions">{actions}</div>}
        {children}
        {meta && <div className="ui-hero__meta">{meta}</div>}
      </div>
    </section>
  );
}
