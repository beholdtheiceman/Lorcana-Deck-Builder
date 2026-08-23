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

        <p className="mt-1 flex items-baseline gap-1.5" aria-label={`${total} of 60 cards`}>
          <span className="text-xl font-semibold leading-none tabular-nums">{total}</span>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>/ 60 cards</span>
        </p>

        <div className="mt-3">
          <SaveStatus saveStatus={saveStatus} onSave={onSave} />
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
