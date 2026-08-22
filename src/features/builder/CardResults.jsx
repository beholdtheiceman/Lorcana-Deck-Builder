import SearchBar from './results/SearchBar.jsx'
import ResultSummary, { describeActiveFilters } from './results/ResultSummary.jsx'
import CardTile from './results/CardTile.jsx'

function deckCountFor(card, deck) {
  return Object.values(deck?.entries || {}).reduce((count, entry) => {
    return entry?.card?.id === card.id ? count + (Number(entry.count) || 0) : count
  }, 0)
}

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
        <div className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {cards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              deckCount={deckCountFor(card, deck)}
              onAdd={onAdd}
              onInspect={onInspect}
            />
          ))}
        </div>
      )}
    </section>
  )
}
