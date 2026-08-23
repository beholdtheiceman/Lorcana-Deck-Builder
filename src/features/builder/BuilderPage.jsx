import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import FilterRail from './FilterRail.jsx'
import CardResults, { deckCountFor } from './CardResults.jsx'
import InspectCardModal from './results/InspectCardModal.jsx'
import DeckPanel from './DeckPanel.jsx'
import { FilterSheet, DeckSheet } from './MobileSheets.jsx'
import DeckStatsModal from './DeckStatsModal.jsx'
import useCardPool from './hooks/useCardPool.js'
import useDeckSave from './hooks/useDeckSave.js'
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
  const [inspectedCard, setInspectedCard] = useState(null)
  const [statsOpen, setStatsOpen] = useState(false)

  const { cards, loading, error, retry } = useCardPool()
  const handleDeckSaved = useCallback((dbId) => {
    deckDispatch({ type: 'UPDATE_METADATA', updates: { _dbId: dbId } })
  }, [])

  const saveStatus = useDeckSave(deck, { isAuthenticated, onSaved: handleDeckSaved })

  const filteredCards = useMemo(() => applyFilters(cards, filters), [cards, filters])
  const stats = useMemo(() => computeDeckStats(deck), [deck])
  const activeCount = useMemo(() => countActiveFilters(filters), [filters])


  // Each pane scrolls independently, which means the builder has to claim a
  // fixed height. Measure our own top rather than hard-coding a nav offset,
  // so this survives changes to the shell.
  const shellRef = useRef(null)
  const [shellHeight, setShellHeight] = useState(null)

  useEffect(() => {
    const measure = () => {
      const node = shellRef.current
      if (!node) return
      const top = node.getBoundingClientRect().top
      // Ancestors add their own bottom padding below us (the app shell uses
      // py-6), so claiming the full remaining viewport would push the page
      // into a scrollbar. Subtract whatever sits underneath.
      let inset = 0
      for (let el = node.parentElement; el && el !== document.body; el = el.parentElement) {
        const cs = getComputedStyle(el)
        inset += parseFloat(cs.paddingBottom) || 0
        inset += parseFloat(cs.borderBottomWidth) || 0
        inset += parseFloat(cs.marginBottom) || 0
      }
      setShellHeight(Math.max(320, window.innerHeight - top - inset))
    }
    measure()
    // Re-measure once layout settles; fonts and late chrome shift our top.
    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
    }
  }, [])
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
      onSave={saveStatus.save}
      onShowStats={() => setStatsOpen(true)}
    />
  )

  return (
    <div
      ref={shellRef}
      className="mx-auto flex w-full max-w-[1600px] flex-col px-3 py-4"
      style={{ color: 'var(--text)', height: shellHeight ? `${shellHeight}px` : undefined }}
    >
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[188px_minmax(0,1fr)_264px]">
        <div className="hidden min-h-0 overflow-y-auto pr-1 lg:block">{rail}</div>

        <main className="flex min-h-0 min-w-0 flex-col">
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

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <CardResults
            cards={filteredCards}
            deck={deck}
            filters={filters}
            loading={loading}
            error={error}
            onSearch={handleSearch}
            onAdd={handleAdd}
            onInspect={setInspectedCard}
            onRetry={retry}
          />
          </div>
        </main>

        <div className="hidden min-h-0 lg:block">{panel}</div>
      </div>

      <button
        type="button"
        onClick={() => setDeckSheetOpen(true)}
        className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border px-5 py-2 text-sm font-medium shadow-lg lg:hidden"
        style={{ background: 'var(--canvas)', borderColor: 'var(--line)', color: 'var(--text)' }}
      >
        {deck?.name || 'Deck'} · {Number(deck?.total) || 0}/60
      </button>

      <InspectCardModal
        card={inspectedCard}
        deckCount={inspectedCard ? deckCountFor(inspectedCard, deck) : 0}
        onClose={() => setInspectedCard(null)}
        onSetCount={handleSetCount}
      />

      <DeckStatsModal open={statsOpen} deck={deck} onClose={() => setStatsOpen(false)} />

      <FilterSheet open={filterSheetOpen} onClose={() => setFilterSheetOpen(false)}>
        {rail}
      </FilterSheet>
      <DeckSheet open={deckSheetOpen} onClose={() => setDeckSheetOpen(false)}>
        {panel}
      </DeckSheet>
    </div>
  )
}
