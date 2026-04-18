/**
 * CourtBackdrop — accurate top-down tennis court (ITF proportions).
 * Absolutely positioned inside a relatively-positioned parent.
 * Uses currentColor so the parent controls line colour via `color`.
 *
 * ITF court dimensions (metres):
 *   Full doubles court: 23.77 × 10.97
 *   Singles sidelines:  23.77 × 8.23  (1.37m inside each doubles sideline)
 *   Service box depth:  6.40m from net each side
 *   Net at midpoint:    11.885m from each baseline
 *   Centre mark:        0.10m long (ignored at SVG scale)
 *
 * ViewBox maps 1m → 40px for clarity:
 *   width  = 10.97 × 40 ≈ 439     → padded to 539 (50px each side)
 *   height = 23.77 × 40 ≈ 951     → padded to 1051 (50px each side)
 *
 * Court origin at (50, 50).
 */
export function CourtBackdrop({
  opacity = 0.08,
  className = '',
  style,
  ...rest
}) {
  // All values in px (1m = 40px), origin offset = 50
  const O = 50;                    // origin offset (padding)
  const W = 10.97 * 40;           // 438.8  — doubles court width
  const H = 23.77 * 40;           // 950.8  — court length
  const SW = 1.37 * 40;           // 54.8   — singles inset from each side
  const SB = 6.40 * 40;           // 256    — service box depth
  const NET = H / 2;              // 475.4  — net at halfway

  // Derived coordinates
  const left = O;                  // doubles sideline left
  const right = O + W;            // doubles sideline right
  const top = O;                   // baseline top
  const bottom = O + H;           // baseline bottom
  const sLeft = O + SW;           // singles sideline left
  const sRight = O + W - SW;      // singles sideline right
  const netY = O + NET;           // net line
  const svcTop = netY - SB;       // top service line
  const svcBot = netY + SB;       // bottom service line
  const centreX = O + W / 2;      // centre of court (x)

  const vw = W + 100;             // viewBox width
  const vh = H + 100;             // viewBox height

  return (
    <svg
      className={['ui-court-backdrop', className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${vw.toFixed(0)} ${vh.toFixed(0)}`}
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
      <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        {/* Doubles outer boundary — top baseline + sidelines (no bottom baseline) */}
        <line x1={left} y1={top} x2={right} y2={top} />
        <line x1={left} y1={top} x2={left} y2={bottom} />
        <line x1={right} y1={top} x2={right} y2={bottom} />

        {/* Singles sidelines */}
        <line x1={sLeft} y1={top} x2={sLeft} y2={bottom} />
        <line x1={sRight} y1={top} x2={sRight} y2={bottom} />

        {/* Service line (top only — bottom removed for cleaner fade) */}
        <line x1={sLeft} y1={svcTop} x2={sRight} y2={svcTop} />

        {/* Centre service line (top half only) */}
        <line x1={centreX} y1={svcTop} x2={centreX} y2={netY} />

        {/* Net (dashed) */}
        <line
          x1={left - 16} y1={netY}
          x2={right + 16} y2={netY}
          strokeWidth="1.5"
          strokeDasharray="8 5"
        />

        {/* Centre mark on top baseline only (bottom baseline removed) */}
        <line x1={centreX} y1={top} x2={centreX} y2={top + 16} />
      </g>
    </svg>
  );
}
