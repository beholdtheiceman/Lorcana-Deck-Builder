import { useEffect, useMemo, useRef, useState } from 'react'
import SearchBar from './results/SearchBar.jsx'
import ResultSummary, { describeActiveFilters } from './results/ResultSummary.jsx'
import CardTile from './results/CardTile.jsx'

export function deckCountFor(card, deck) {
  return Object.values(deck?.entries || {}).reduce((count, entry) => {
    return entry?.card?.id === card.id ? count + (Number(entry.count) || 0) : count
  }, 0)
}

// One pass over the deck instead of one pass per rendered tile. With a
// thousand tiles on screen the per-tile scan dominated every re-render.
function deckCountsById(deck) {
  const counts = new Map()
  for (const entry of Object.values(deck?.entries || {})) {
    const id = entry?.card?.id
    if (!id) continue
    counts.set(id, (counts.get(id) || 0) + (Number(entry.count) || 0))
  }
  return counts
}

// The grid used to render every match - over a thousand tiles and images at
// once, which pushed the document past 10,000 nodes and made every
// interaction on the page slow, not just the grid.
const PAGE_SIZE = 60

export default function CardResults({
  cards = [],
  deck,
  filters,
  loading = false,
  error,
  onSearch,
  onAdd,
  onInspect,
  onRetry,
}) {
  const filterDescription = describeActiveFilters(filters)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const loadMoreRef = useRef(null)

  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [cards])

  const counts = useMemo(() => deckCountsById(deck), [deck])
  const shown = useMemo(() => cards.slice(0, visibleCount), [cards, visibleCount])
  const hasMore = visibleCount < cards.length

  // Auto-load on scroll where supported; the button below is the fallback
  // and keeps this reachable by keyboard.
  useEffect(() => {
    if (!hasMore || typeof IntersectionObserver === 'undefined') return undefined
    const node = loadMoreRef.current
    if (!node) return undefined
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCount((count) => Math.min(count + PAGE_SIZE, cards.length))
      }
    }, { rootMargin: '600px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, cards.length])

  return (
    <section className="min-w-0" aria-label="Card results">
      <div className="space-y-3 border-b pb-4" style={{ borderColor: 'var(--line)' }}>
        <SearchBar value={filters?.text || ''} onSearch={onSearch} />
        <ResultSummary count={cards.length} filters={filters} />
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <p style={{ color: 'var(--text)' }}>Cards could not be loaded.</p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border px-4 py-2 text-sm font-medium"
            style={{ borderColor: 'var(--line)', color: 'var(--text)', background: 'var(--canvas)' }}
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <p className="px-4 py-12 text-center text-sm" role="status" style={{ color: 'var(--muted)' }}>
          Loading cards
        </p>
      ) : cards.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>No cards match</h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
            {filterDescription
              ? `Clear or change these filters: ${filterDescription}.`
              : 'Try a different search or clear your filters.'}
          </p>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              deckCount={counts.get(card.id) || 0}
              onAdd={onAdd}
              onInspect={onInspect}
            />
          ))}
        </div>

          {hasMore && (
            <div className="flex justify-center pb-6">
              <button
                ref={loadMoreRef}
                type="button"
                onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, cards.length))}
                className="rounded-md border px-4 py-2 text-sm"
                style={{ borderColor: 'var(--line)', color: 'var(--text)', background: 'var(--canvas)' }}
              >
                Show more ({cards.length - shown.length} left)
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
