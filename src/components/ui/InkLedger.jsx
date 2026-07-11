// Ink ledger — one hex per card, hollow = uninkable, grouped by ink color.
// The deck hero's signature element (design/comps/uninkable-deck-detail-comp.html).
import HexGlyph from './HexGlyph'
import { inkVar } from './inks'

/**
 * entries: one item per card copy, e.g. [{ ink: 'Sapphire', inkable: true }, ...].
 * Groups by ink (inkable copies first within each group) so the strip reads as
 * contiguous color runs like the comp.
 */
export default function InkLedger({ entries = [], hexSize = 11, cutout = 'var(--panel)', className = '', ...rest }) {
  const groups = new Map()
  for (const e of entries) {
    const key = String(e.ink || 'steel').toLowerCase()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(e)
  }
  const ordered = [...groups.values()].flatMap((g) =>
    [...g].sort((a, b) => Number(b.inkable) - Number(a.inkable))
  )
  const label = describe(groups)
  return (
    <div
      role="img"
      aria-label={label}
      className={`flex flex-wrap gap-[3px] ${className}`}
      {...rest}
    >
      {ordered.map((e, i) => (
        <HexGlyph key={i} ink={e.ink} hollow={!e.inkable} size={hexSize} cutout={cutout} />
      ))}
    </div>
  )
}

function describe(groups) {
  const parts = [...groups.entries()].map(([ink, g]) => {
    const un = g.filter((e) => !e.inkable).length
    return `${g.length} ${ink}${un ? ` (${un} uninkable)` : ''}`
  })
  const total = [...groups.values()].reduce((n, g) => n + g.length, 0)
  return `${total} cards: ${parts.join(', ')}`
}

export { inkVar }
