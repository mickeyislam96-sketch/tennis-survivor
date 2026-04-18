import './SiteHeader.css';

/**
 * SiteHeader — sticky top bar with brand lockup, nav links and account slot.
 *
 * Props:
 *  brand       — { href, mark, name, accent }  default: { href: '/', mark: 'F', name: 'Final ', accent: 'Serve-ivor' }
 *  links       — [{ href, label }]
 *  rightSlot   — arbitrary node rendered in the actions area (e.g. Button, avatar)
 */
export function SiteHeader({
  brand = { href: '/', mark: 'F', name: 'Final ', accent: 'Serve-ivor' },
  links = [],
  rightSlot,
  className = '',
  as = 'header',
  ...rest
}) {
  const Tag = as;
  return (
    <Tag className={['ui-site-header', className].filter(Boolean).join(' ')} {...rest}>
      <div className="ui-site-header__inner">
        <a className="ui-brand" href={brand.href}>
          {brand.mark && <span className="ui-brand__mark">{brand.mark}</span>}
          <span>
            {brand.name}
            {brand.accent && <em>{brand.accent}</em>}
          </span>
        </a>
        {links.length > 0 && (
          <nav className="ui-site-header__nav" aria-label="Primary">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="ui-site-header__link">
                {l.label}
              </a>
            ))}
          </nav>
        )}
        <div className="ui-site-header__actions">{rightSlot}</div>
      </div>
    </Tag>
  );
}
