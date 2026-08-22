import { useCallback, useMemo, useReducer, useState } from 'react'
import FilterRail from './FilterRail.jsx'
import CardResults from './CardResults.jsx'
import DeckPanel from './DeckPanel.jsx'
import { FilterSheet, DeckSheet } from './MobileSheets.jsx'
import useCardPool from './hooks/useCardPool.js'
import useAutosave from './hooks/useAutosave.js'
import { deckReducer, initialDeckState } from '../../lib/deck/deckReducer.js'
import { computeDeckStats } from '../../lib/deck/stats.js'
import {
  applyFilters,
  countActiveFilters,
  filterReducer,
  initialFilterState,
} from '../../lib/filters/filterModel.js'

/**
 * The three-pane deck builder. This is the only stateful component in the
 * feature: it owns deck state, filter state and the card pool, and passes
 * everything below it as props.
 */
export default function BuilderPage({ isAuthenticated = false }) {
  const [deck, deckDispatch] = useReducer(deckReducer, undefined, initialDeckState)
  const [filters, filterDispatch] = useReducer(filterReducer, undefined, initialFilterState)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [deckSheetOpen, setDeckSheetOpen] = useState(false)

  const { cards, loading, error, retry } = useCardPool()
  const saveStatus = useAutosave(deck, { isAuthenticated })

  const filteredCards = useMemo(() => applyFilters(cards, filters), [cards, filters])
  const stats = useMemo(() => computeDeckStats(deck), [deck])
  const activeCount = useMemo(() => countActiveFilters(filters), [filters])

  const handleSearch = useCallback((text) => {
    filterDispatch({ type: 'SET_TEXT', text })
  }, [])

  const handleClear = useCallback(() => {
    filterDispatch({ type: 'RESET' })
  }, [])

  const handleAdd = useCallback((card) => {
    deckDispatch({ type: 'ADD', card, count: 1 })
  }, [])

  const handleSetCount = useCallback((card, count) => {
    deckDispatch({ type: 'SET_COUNT', card, count })
  }, [])

  const handleRemove = useCallback((card) => {
    deckDispatch({ type: 'REMOVE', card })
  }, [])

  const handleRename = useCallback((name) => {
    deckDispatch({ type: 'SET_NAME', name })
  }, [])

  const rail = (
    <FilterRail
      filters={filters}
      onChange={filterDispatch}
      activeCount={activeCount}
      onClear={handleClear}
    />
  )

  const panel = (
    <DeckPanel
      deck={deck}
      stats={stats}
      saveStatus={saveStatus}
      onRename={handleRename}
      onSetCount={handleSetCount}
      onRemove={handleRemove}
    />
  )

  return (
    <div
      className="mx-auto w-full max-w-[1600px] px-3 py-4"
      style={{ color: 'var(--text)' }}
    >
      <div className="grid gap-4 lg:grid-cols-[188px_minmax(0,1fr)_264px]">
        <div className="hidden lg:block">{rail}</div>

        <main className="min-w-0">
          <div className="mb-3 flex gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setFilterSheetOpen(true)}
              className="rounded border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--line)', color: 'var(--text)' }}
            >
              Filters{activeCount > 0 ? ` (${activeCount})` : ''}
            </button>
          </div>

          <CardResults
            cards={filteredCards}
            deck={deck}
            filters={filters}
            loading={loading}
            error={error}
            onSearch={handleSearch}
            onAdd={handleAdd}
            onInspect={handleAdd}
            onRetry={retry}
          />
        </main>

        <div className="hidden lg:block">{panel}</div>
      </div>

      <button
        type="button"
        onClick={() => setDeckSheetOpen(true)}
        className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border px-5 py-2 text-sm font-medium shadow-lg lg:hidden"
        style={{ background: 'var(--canvas)', borderColor: 'var(--line)', color: 'var(--text)' }}
      >
        {deck?.name || 'Deck'} · {Number(deck?.total) || 0}/60
      </button>

      <FilterSheet open={filterSheetOpen} onClose={() => setFilterSheetOpen(false)}>
        {rail}
      </FilterSheet>
      <DeckSheet open={deckSheetOpen} onClose={() => setDeckSheetOpen(false)}>
        {panel}
      </DeckSheet>
    </div>
  )
}
