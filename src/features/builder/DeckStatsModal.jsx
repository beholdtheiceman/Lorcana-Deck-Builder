import { useEffect, useRef } from 'react'
import DeckStats from '../../components/DeckStats.jsx'

/**
 * Full deck statistics, reachable from the deck panel.
 *
 * Reuses the same DeckStats component My Decks renders, so the numbers cannot
 * drift between the two surfaces. Previously reaching these meant leaving the
 * builder entirely: scroll up, My Decks, find the deck, open it.
 */
export default function DeckStatsModal({ open, deck, onClose }) {
  const panelRef = useRef(null)
  const returnFocusRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

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
  }, [open, onClose])

  if (!open) return null

  const entries = Object.values(deck?.entries || {})
  const name = deck?.name || 'Deck'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8">
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
        aria-label={`${name} statistics`}
        tabIndex={-1}
        className="relative flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl border outline-none"
        style={{ background: 'var(--canvas)', borderColor: 'var(--line)', color: 'var(--text)' }}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-4 border-b px-5 py-3"
          style={{ borderColor: 'var(--line)' }}
        >
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{name}</h2>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {Number(deck?.total) || 0} cards
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close deck statistics"
            className="shrink-0 rounded-md border px-2 py-1 text-xs"
            style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {entries.length === 0 ? (
            <p className="py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>
              Add cards to see statistics.
            </p>
          ) : (
            <DeckStats entries={entries} />
          )}
        </div>
      </div>
    </div>
  )
}
