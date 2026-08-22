import { CostHex, inkVar } from '../../../components/ui/index.js'
import { asUrl, lorcanaImageProxyUrl } from '../../../lib/cards/imageUrl.js'

export default function CardTile({ card, deckCount = 0, onAdd, onInspect }) {
  const ink = card?.inks?.[0] || 'Steel'
  const imageSource = asUrl(card?.image_url || card?.image)
  const imageUrl = imageSource ? lorcanaImageProxyUrl(imageSource) : ''
  const addLabel = deckCount > 0
    ? `Add ${card.name}, ${deckCount} in deck`
    : `Add ${card.name}`

  return (
    <article
      className="relative overflow-hidden rounded-lg border"
      style={{
        background: 'var(--canvas)',
        borderColor: deckCount > 0 ? inkVar(ink) : 'var(--line)',
      }}
    >
      <button
        type="button"
        aria-label={addLabel}
        onClick={() => onAdd?.(card)}
        className="block w-full text-left"
        style={{ color: 'var(--text)' }}
      >
        <div className="relative aspect-[5/7] w-full overflow-hidden border-b" style={{ borderColor: 'var(--line)' }}>
          {imageUrl && (
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
          <CostHex
            cost={card.cost}
            ink={ink}
            size={30}
            surface="var(--canvas)"
            className="absolute left-2 top-2"
          />
          {deckCount > 0 && (
            <span
              className="absolute right-2 top-2 grid h-7 min-w-7 place-items-center rounded-full border px-1 text-sm font-semibold"
              style={{
                background: 'var(--canvas)',
                borderColor: inkVar(ink),
                color: 'var(--text)',
              }}
            >
              {deckCount}
            </span>
          )}
        </div>
        <span className="block p-3">
          <span className="block font-semibold leading-tight">{card.name}</span>
          {card.subtitle && (
            <span className="mt-1 block text-xs" style={{ color: 'var(--muted)' }}>{card.subtitle}</span>
          )}
        </span>
      </button>

      <button
        type="button"
        aria-label={`Inspect ${card.name}`}
        onClick={() => onInspect?.(card)}
        className="m-3 mt-0 rounded-md border px-2 py-1 text-xs"
        style={{ borderColor: 'var(--line)', color: 'var(--text)', background: 'var(--canvas)' }}
      >
        Inspect
      </button>
    </article>
  )
}
