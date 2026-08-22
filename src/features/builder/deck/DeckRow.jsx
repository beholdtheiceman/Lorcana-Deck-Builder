import { CostHex, HexGlyph } from '../../../components/ui/index.js'

export default function DeckRow({ card, count, onSetCount, onRemove }) {
  const name = card?.name || 'Unknown card'
  const primaryInk = card?.inks?.[0] || 'Steel'

  return (
    <div className="flex items-center gap-2 py-2 text-sm">
      <CostHex cost={card?.cost ?? 0} ink={primaryInk} size={24} surface="var(--canvas)" />
      <HexGlyph ink={primaryInk} size={9} cutout="var(--canvas)" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{name}</div>
        {card?.subtitle && (
          <div className="truncate text-xs" style={{ color: 'var(--muted)' }}>{card.subtitle}</div>
        )}
      </div>
      <button
        type="button"
        aria-label={`Decrease ${name} count`}
        className="h-7 w-7 rounded border"
        style={{ borderColor: 'var(--line)', color: 'var(--text)' }}
        onClick={() => onSetCount?.(card, Math.max(0, count - 1))}
      >
        −
      </button>
      <span className="w-4 text-center font-semibold tabular-nums">{count}</span>
      <button
        type="button"
        aria-label={`Increase ${name} count`}
        className="h-7 w-7 rounded border"
        style={{ borderColor: 'var(--line)', color: 'var(--text)' }}
        disabled={count >= 4}
        onClick={() => onSetCount?.(card, Math.min(4, count + 1))}
      >
        +
      </button>
      <button
        type="button"
        aria-label={`remove ${name}`}
        className="h-7 rounded border px-2 text-xs font-semibold"
        style={{ borderColor: 'var(--line)', color: 'var(--ruby)' }}
        onClick={() => onRemove?.(card)}
      >
        Remove
      </button>
    </div>
  )
}
