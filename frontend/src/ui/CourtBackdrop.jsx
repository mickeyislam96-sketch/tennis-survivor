/**
 * CourtBackdrop — decorative SVG pattern of tennis-court lines.
 * Absolutely positioned inside a relatively-positioned parent.
 * Uses currentColor so parent can control line colour via `color`.
 */
export function CourtBackdrop({
  opacity = 0.08,
  className = '',
  style,
  ...rest
}) {
  return (
    <svg
      className={['ui-court-backdrop', className].filter(Boolean).join(' ')}
      viewBox="0 0 1200 600"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity,
        pointerEvents: 'none',
        ...style,
      }}
      {...rest}
    >
      <g fill="none" stroke="currentColor" strokeWidth="2">
        {/* Outer court */}
        <rect x="120" y="60" width="960" height="480" />
        {/* Singles sidelines */}
        <line x1="200" y1="60" x2="200" y2="540" />
        <line x1="1000" y1="60" x2="1000" y2="540" />
        {/* Service boxes */}
        <line x1="200" y1="180" x2="1000" y2="180" />
        <line x1="200" y1="420" x2="1000" y2="420" />
        <line x1="600" y1="180" x2="600" y2="420" />
        {/* Centre line / net */}
        <line x1="120" y1="300" x2="1080" y2="300" strokeDasharray="6 6" />
        {/* Centre mark */}
        <line x1="600" y1="56" x2="600" y2="72" />
        <line x1="600" y1="528" x2="600" y2="544" />
      </g>
    </svg>
  );
}
