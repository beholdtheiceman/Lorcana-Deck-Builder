// Hex-shaped ink glyph — the design system's signature mark (see design/comps).
// Solid = inkable; hollow = uninkable (tinted ring with a cutout the color of
// the surface it sits on).
import { inkVar } from './inks'

export default function HexGlyph({
  ink = 'steel',
  hollow = false,
  size = 11,           // width in px; height keeps the comp's ~13:11 ratio
  cutout = 'var(--panel)', // surface color visible inside a hollow hex
  className = '',
  ...rest
}) {
  const height = Math.round(size * (13 / 11))
  const color = inkVar(ink)
  return (
    <span
      aria-hidden="true"
      className={`relative inline-block align-middle ${className}`}
      style={{
        width: size,
        height,
        clipPath: 'var(--hex)',
        background: hollow ? `color-mix(in srgb, ${color} 75%, transparent)` : color,
      }}
      {...rest}
    >
      {hollow && (
        <span
          className="absolute"
          style={{ inset: Math.max(2, size * 0.22), clipPath: 'var(--hex)', background: cutout }}
        />
      )}
    </span>
  )
}
