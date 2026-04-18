import './Skeleton.css';

export function Skeleton({ variant = 'text', count = 1, className = '' }) {
  return Array.from({ length: count }, (_, i) => (
    <div key={i} className={`ui-skeleton ui-skeleton--${variant} ${className}`} />
  ));
}

/** Pre-composed skeleton for a typical page with stats + table rows */
export function PageSkeleton() {
  return (
    <div style={{ padding: 'var(--ds-space-6) 0' }}>
      <Skeleton variant="heading" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--ds-space-3)', marginBottom: 'var(--ds-space-6)' }}>
        <Skeleton variant="stat" count={4} />
      </div>
      <Skeleton variant="row" count={6} />
    </div>
  );
}
