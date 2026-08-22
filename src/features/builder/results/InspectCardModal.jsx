import { useEffect, useRef } from 'react'
import { inkVar } from '../../../components/ui/index.js'
import { asUrl, lorcanaImageProxyUrl } from '../../../lib/cards/imageUrl.js'

const MAX_COPIES = 4

function Stat({ label, value }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
}

/**
 * Card detail view. Rules text is the reason this exists — it is unreadable at
 * tile size, which is the whole point of inspecting a card.
 */
export default function InspectCardModal({ card, deckCount = 0, onClose, onSetCount }) {
  const panelRef = useRef(null)
  const returnFocusRef = useRef(null)

  useEffect(() => {
    if (!card) return undefined

    returnFocusRef.current = document.activeElement
    panelRef.current?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose?.()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      const previous = returnFocusRef.current
      if (previous && typeof previous.focus === 'function') previous.focus()
    }
  }, [card, onClose])

  if (!card) return null

  const ink = card.inks?.[0] || 'Steel'
  const imageSource = asUrl(card.image_url || card.image)
  const imageUrl = imageSource ? lorcanaImageProxyUrl(imageSource) : ''
  const title = card.subtitle ? `${card.name} — ${card.subtitle}` : card.name

  const setCount = (next) => {
    const clamped = Math.max(0, Math.min(MAX_COPIES, next))
    if (clamped === deckCount) return
    onSetCount?.(card, clamped)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: 'color-mix(in srgb, var(--canvas) 70%, black)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border p-5 outline-none"
        style={{ background: 'var(--canvas)', borderColor: 'var(--line)', color: 'var(--text)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight">{card.name}</h2>
            {card.subtitle && (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>{card.subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close card details"
            className="shrink-0 rounded-md border px-2 py-1 text-xs"
            style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
          >
            Close
          </button>
        </div>

        <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
          <div
            className="overflow-hidden rounded-lg border"
            style={{ borderColor: inkVar(ink), aspectRatio: '0.72' }}
          >
            {imageUrl ? (
              <img src={imageUrl} alt={title} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs" style={{ color: 'var(--muted)' }}>
                No image
              </div>
            )}
          </div>

          <div className="min-w-0">
            {card.text && (
              <p
                className="whitespace-pre-line rounded-md border p-3 text-sm leading-relaxed"
                style={{ borderColor: 'var(--line)' }}
              >
                {card.text}
              </p>
            )}

            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Cost" value={card.cost} />
              <Stat label="Type" value={card.type} />
              <Stat label="Ink" value={card.inks?.join(' / ')} />
              <Stat label="Rarity" value={card.rarity} />
              <Stat label="Strength" value={card.strength} />
              <Stat label="Willpower" value={card.willpower} />
              <Stat label="Lore" value={card.lore} />
              <Stat label="Inkable" value={card.inkable ? 'Yes' : 'No'} />
              <Stat label="Set" value={card.setName || card.set_name} />
            </dl>

            <div className="mt-5 flex items-center gap-3 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
              <button
                type="button"
                aria-label={`Remove a copy of ${card.name}`}
                onClick={() => setCount(deckCount - 1)}
                className="h-8 w-8 rounded-md border text-sm"
                style={{ borderColor: 'var(--line)', color: 'var(--text)' }}
              >
                −
              </button>
              <span className="text-sm tabular-nums">
                {deckCount} / {MAX_COPIES}
                <span className="ml-1" style={{ color: 'var(--muted)' }}>in deck</span>
              </span>
              <button
                type="button"
                aria-label={`Add a copy of ${card.name}`}
                onClick={() => setCount(deckCount + 1)}
                className="h-8 w-8 rounded-md border text-sm"
                style={{ borderColor: 'var(--line)', color: 'var(--text)' }}
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
