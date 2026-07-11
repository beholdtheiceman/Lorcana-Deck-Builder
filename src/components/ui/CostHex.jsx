// Ink-cost hex: the card's cost inside a hex ring tinted with its ink color
// (deck-list rows in design/comps/uninkable-deck-detail-comp.html).
import { inkVar } from './inks'

export default function CostHex({
  cost,
  ink = 'steel',
  size = 26,               // width in px; height keeps the comp's 29:26 ratio
  surface = 'var(--panel)', // color inside the ring
  className = '',
  ...rest
}) {
  const height = Math.round(size * (29 / 26))
  return (
    <span
      className={`relative grid place-items-center ${className}`}
      style={{
        width: size,
        height,
        clipPath: 'var(--hex)',
        background: `color-mix(in srgb, ${inkVar(ink)} 80%, transparent)`,
      }}
      {...rest}
    >
      <span className="absolute" style={{ inset: 1.5, clipPath: 'var(--hex)', background: surface }} />
      <b className="relative z-[1] font-semibold" style={{ fontSize: size * 0.48, fontVariantNumeric: 'tabular-nums' }}>
        {cost}
      </b>
    </span>
  )
}
