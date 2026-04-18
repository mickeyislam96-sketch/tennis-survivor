import './PoolCard.css';
import { Card } from './Card.jsx';
import { Badge } from './Badge.jsx';

/**
 * PoolCard — the headline object on the homepage + group home.
 * Shows a tournament pool with status badge, meta stats, description, and CTA.
 *
 * Props:
 *  eyebrow      — small uppercase label (e.g. "MADRID · APR 22 - MAY 4")
 *  title        — pool title (can contain <em> for italic accent words)
 *  description  — short paragraph description
 *  status       — { label, tone } shown as Badge (tone: success | warning | info | danger | gold | primary | neutral)
 *  meta         — array of <Stat> elements
 *  footer       — extra footer content (e.g. player count) left of CTA
 *  cta          — <Button> element rendered on the right of the footer
 *  tone         — Card tone (passed through)
 */
export function PoolCard({
  eyebrow,
  title,
  description,
  status,
  meta,
  footer,
  cta,
  tone = 'default',
  padding = 'lg',
  interactive = false,
  className = '',
  ...rest
}) {
  return (
    <Card
      tone={tone}
      padding={padding}
      interactive={interactive}
      className={['ui-pool-card-wrap', className].filter(Boolean).join(' ')}
      {...rest}
    >
      <div className="ui-pool-card">
        <header className="ui-pool-card__header">
          <div className="ui-pool-card__titleblock">
            {eyebrow && <span className="ui-pool-card__eyebrow">{eyebrow}</span>}
            {title && <h3 className="ui-pool-card__title">{title}</h3>}
          </div>
          {status && (
            <Badge tone={status.tone || 'neutral'} size="sm" dot={status.dot}>
              {status.label}
            </Badge>
          )}
        </header>

        {meta && meta.length > 0 && (
          <div className="ui-pool-card__meta">
            {meta.map((item, i) => (
              <div key={i}>{item}</div>
            ))}
          </div>
        )}

        {description && <p className="ui-pool-card__description">{description}</p>}

        {(footer || cta) && (
          <div className="ui-pool-card__footer">
            <div className="ui-pool-card__footer-left">{footer}</div>
            {cta}
          </div>
        )}
      </div>
    </Card>
  );
}
