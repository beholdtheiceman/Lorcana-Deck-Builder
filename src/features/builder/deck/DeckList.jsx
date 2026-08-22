import DeckRow from './DeckRow.jsx'

function groupedEntries(entries) {
  const groups = new Map()

  for (const entry of Object.values(entries || {})) {
    if (!entry?.card || entry.count <= 0) continue
    const type = entry.card.type || 'Other'
    if (!groups.has(type)) groups.set(type, [])
    groups.get(type).push(entry)
  }

  return [...groups.entries()].map(([type, items]) => ({
    type,
    count: items.reduce((total, item) => total + item.count, 0),
    items: items.sort((a, b) => a.card.name.localeCompare(b.card.name)),
  }))
}

export default function DeckList({ entries, onSetCount, onRemove }) {
  const groups = groupedEntries(entries)

  if (!groups.length) {
    return <p className="py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>Your deck is empty.</p>
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.type} aria-labelledby={`deck-group-${group.type}`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 id={`deck-group-${group.type}`} className="text-xs font-semibold uppercase tracking-wider">
              {group.type}
            </h3>
            <span className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
              {group.count} {group.count === 1 ? 'card' : 'cards'}
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
            {group.items.map((entry) => (
              <DeckRow
                key={entry.card.id || `${entry.card.name}-${entry.card.subtitle || ''}`}
                card={entry.card}
                count={entry.count}
                onSetCount={onSetCount}
                onRemove={onRemove}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
