import { useState } from 'react'
import DeckPasteImport from '../../components/tools/DeckPasteImport'
import { useIncomingDeck } from '../../lib/deckPayload'

export default function ToolStubPage({ title, description }) {
  const incomingDeck = useIncomingDeck()
  const [importedDeck, setImportedDeck] = useState(null)
  const deck = incomingDeck || importedDeck

  return (
    <div className="mx-auto max-w-4xl py-6 sm:py-10">
      <h1 className="font-display text-3xl" style={{ fontWeight: 560, color: 'var(--text)' }}>{title}</h1>
      <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>{description}</p>
      <div className="mt-8">
        {deck ? (
          <section className="rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Incoming deck</div>
            <h2 className="font-display mt-2 text-xl" style={{ color: 'var(--text)' }}>{deck.meta?.name || 'Imported deck'}</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
              {deck.cards.reduce((total, card) => total + card.count, 0)} cards · {deck.cards.length} unique
            </p>
            <ul className="mt-4 grid gap-1 text-sm sm:grid-cols-2" style={{ color: 'var(--text)' }}>
              {deck.cards.map((card) => <li key={card.cardId || card.name}>{card.count}× {card.name}</li>)}
            </ul>
          </section>
        ) : (
          <DeckPasteImport onImport={setImportedDeck} />
        )}
      </div>
    </div>
  )
}
