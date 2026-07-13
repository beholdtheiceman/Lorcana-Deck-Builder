import { useEffect, useMemo, useState } from 'react'
import { parseDeckText } from '../../../api/_lib/deckTextParse.js'
import { fetchAllCards } from '../../lib/cardsApi.js'
import { toPayload } from '../../lib/deckPayload.js'
import { LS_KEYS, loadLS } from '../../lib/storage.js'

function normalizedName(value) {
  return String(value || '').trim().toLocaleLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ')
}

function namesFor(card) {
  const name = String(card?.name || '').trim()
  const baseName = String(card?.baseName || name).trim()
  const subname = String(card?.subname || '').trim()
  return new Set([
    normalizedName(name),
    normalizedName(baseName),
    normalizedName(subname ? `${baseName} - ${subname}` : ''),
  ].filter(Boolean))
}

function resolvedName(card) {
  const name = String(card?.name || card?.baseName || '').trim()
  const subname = String(card?.subname || '').trim()
  return subname && !normalizedName(name).includes(normalizedName(subname)) ? `${name} - ${subname}` : name
}

export default function DeckPasteImport({ cards: suppliedCards, onImport, title = 'Import a deck' }) {
  const [text, setText] = useState('')
  const [cards, setCards] = useState(suppliedCards || [])
  const [loading, setLoading] = useState(!suppliedCards?.length)
  const [message, setMessage] = useState('')
  const savedDecks = useMemo(() => Object.values(loadLS(LS_KEYS.DECKS, {})), [])

  useEffect(() => {
    if (suppliedCards?.length) {
      setCards(suppliedCards)
      setLoading(false)
      return undefined
    }
    const controller = new AbortController()
    fetchAllCards({ signal: controller.signal }).then((loaded) => {
      setCards(loaded)
      setLoading(false)
    })
    return () => controller.abort()
  }, [suppliedCards])

  const nameIndex = useMemo(() => {
    const index = new Map()
    for (const card of cards) {
      for (const name of namesFor(card)) {
        const matches = index.get(name) || []
        matches.push(card)
        index.set(name, matches)
      }
    }
    return index
  }, [cards])

  function importText() {
    const parsed = parseDeckText(text)
    if (parsed.error) {
      setMessage(parsed.error)
      return
    }

    const byCard = new Map()
    const unresolved = []
    for (const pair of parsed.pairs) {
      const matches = nameIndex.get(normalizedName(pair.name)) || []
      if (matches.length !== 1) {
        if (!pair.implicit) unresolved.push(pair.name)
        continue
      }
      const card = matches[0]
      const key = String(card.id || resolvedName(card))
      const previous = byCard.get(key)
      byCard.set(key, {
        name: resolvedName(card),
        count: (previous?.count || 0) + pair.count,
        ...(card.id ? { cardId: String(card.id) } : {}),
      })
    }

    const payload = { cards: Array.from(byCard.values()) }
    if (!payload.cards.length) {
      setMessage(loading ? 'Card data is still loading.' : 'No card names could be resolved.')
      return
    }
    setMessage(unresolved.length ? `Imported with ${unresolved.length} unresolved line${unresolved.length === 1 ? '' : 's'}.` : '')
    onImport?.(payload)
  }

  function importSavedDeck(event) {
    const deck = savedDecks.find((item) => item.id === event.target.value)
    if (deck) onImport?.(toPayload(deck))
    event.target.value = ''
  }

  return (
    <section className="rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
      <h2 className="font-display text-lg" style={{ color: 'var(--text)' }}>{title}</h2>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={7}
        placeholder={'4 Card Name\n2x Another Card'}
        className="mt-3 w-full rounded-md border bg-transparent p-3 text-sm outline-none focus:border-[color:var(--sapphire)]"
        style={{ borderColor: 'var(--line-2)', color: 'var(--text)' }}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={importText} disabled={loading} className="rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ background: 'var(--sapphire)', color: 'white' }}>
          {loading ? 'Loading cards…' : 'Import pasted deck'}
        </button>
        {savedDecks.length > 0 && (
          <select defaultValue="" onChange={importSavedDeck} className="rounded-md border bg-[color:var(--canvas)] px-3 py-2 text-sm" style={{ borderColor: 'var(--line-2)', color: 'var(--text)' }} aria-label="From My Decks">
            <option value="" disabled>From My Decks</option>
            {savedDecks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
          </select>
        )}
      </div>
      {message && <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>{message}</p>}
    </section>
  )
}
