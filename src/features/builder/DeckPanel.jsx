import DeckTitle from './deck/DeckTitle.jsx'
import SaveStatus from './deck/SaveStatus.jsx'
import DeckList from './deck/DeckList.jsx'
import DeckStatsPanel from './deck/DeckStatsPanel.jsx'

export default function DeckPanel({ deck, stats, saveStatus, onRename, onSetCount, onRemove, onSave }) {
  const total = Number(deck?.total) || 0

  return (
    <aside
      aria-label="Deck"
      className="flex min-h-0 flex-col border p-4"
      style={{ background: 'var(--canvas)', borderColor: 'var(--line)', color: 'var(--text)' }}
    >
      <header className="border-b pb-4" style={{ borderColor: 'var(--line)' }}>
        <DeckTitle name={deck?.name} onRename={onRename} />
        <div className="mt-2 flex items-center justify-between gap-3 text-xs">
          <SaveStatus saveStatus={saveStatus} onSave={onSave} />
          <span aria-label={`${total} of 60 cards`} className="font-semibold tabular-nums">
            {total} / 60
          </span>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto py-4">
        <DeckList
          entries={deck?.entries}
          onSetCount={onSetCount}
          onRemove={onRemove}
        />
      </div>

      <DeckStatsPanel stats={stats} />
    </aside>
  )
}
