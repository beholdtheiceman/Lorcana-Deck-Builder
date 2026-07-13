import { useEffect, useMemo, useRef, useState } from 'react'
import DeckPasteImport from '../../components/tools/DeckPasteImport'
import { fetchAllCards } from '../../lib/cardsApi'
import { useIncomingDeck } from '../../lib/deckPayload'
import { buildProxyPdf } from '../../lib/pdf'

function normalizedName(value) {
  return String(value || '').trim().toLocaleLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ')
}

function displayName(card) {
  const name = String(card?.name || card?.baseName || '').trim()
  const subname = String(card?.subname || '').trim()
  return subname && !normalizedName(name).includes(normalizedName(subname)) ? `${name} - ${subname}` : name
}

function catalogIndex(cards) {
  const byId = new Map()
  const byName = new Map()
  for (const card of cards) {
    if (card?.id) byId.set(String(card.id), card)
    const names = [displayName(card), card?.name, card?.baseName]
    for (const name of names) {
      const key = normalizedName(name)
      if (key && !byName.has(key)) byName.set(key, card)
    }
  }
  return { byId, byName }
}

function resolvePayload(payload, index) {
  return (payload?.cards || []).map((item) => ({
    card: (item.cardId && index.byId.get(String(item.cardId))) || index.byName.get(normalizedName(item.name)) || { name: item.name },
    count: Number(item.count) || 1,
  }))
}

function safeFilename(value) {
  const stem = String(value || 'lorcana-proxies').trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '')
  return `${stem || 'lorcana-proxies'}-playtest-proxies.pdf`
}

export default function ProxyPage() {
  const incomingDeck = useIncomingDeck()
  const incomingDeckRef = useRef(incomingDeck)
  const [cards, setCards] = useState(null)
  const [entries, setEntries] = useState([])
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('image')
  const [pageSize, setPageSize] = useState('Letter')
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const [message, setMessage] = useState('')

  useEffect(() => {
    let alive = true
    const controller = new AbortController()
    fetchAllCards({ signal: controller.signal }).then((loaded) => {
      // StrictMode's aborted first request may resolve to []; never let it
      // overwrite the catalog loaded by the surviving mount.
      if (alive && loaded?.length) setCards(loaded)
      else if (alive) setCards([])
    })
    return () => { alive = false; controller.abort() }
  }, [])

  const index = useMemo(() => catalogIndex(cards || []), [cards])

  useEffect(() => {
    const deck = incomingDeckRef.current
    if (deck?.cards?.length && cards !== null) setEntries(resolvePayload(deck, index))
  }, [cards, index])

  const results = useMemo(() => {
    const needle = normalizedName(query)
    if (!needle) return []
    return (cards || []).filter((card) => normalizedName(displayName(card)).includes(needle)).slice(0, 12)
  }, [cards, query])

  const total = entries.reduce((sum, entry) => sum + entry.count, 0)
  const expandedCards = useMemo(() => entries.flatMap(({ card, count }) => (
    Array.from({ length: count }, () => card)
  )), [entries])

  function addCard(card) {
    setEntries((current) => {
      const key = String(card.id || displayName(card))
      const found = current.findIndex((entry) => String(entry.card.id || displayName(entry.card)) === key)
      if (found === -1) return [...current, { card, count: 1 }]
      return current.map((entry, position) => position === found ? { ...entry, count: Math.min(60, entry.count + 1) } : entry)
    })
    setQuery('')
    setMessage('')
  }

  function updateCount(position, value) {
    const count = Math.max(1, Math.min(60, Math.floor(Number(value) || 1)))
    setEntries((current) => current.map((entry, indexValue) => indexValue === position ? { ...entry, count } : entry))
  }

  function importDeck(payload) {
    setEntries(resolvePayload(payload, index))
    setMessage('')
  }

  async function downloadPdf() {
    if (!expandedCards.length || generating) return
    setGenerating(true)
    setMessage('')
    setProgress({ completed: 0, total: expandedCards.length })
    try {
      const bytes = await buildProxyPdf(expandedCards, { mode, pageSize, onProgress: setProgress })
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = safeFilename(incomingDeck?.meta?.name)
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setMessage(`Created ${Math.ceil(expandedCards.length / 9)}-page playtest proxy PDF.`)
    } catch (error) {
      setMessage(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl py-4 sm:py-8">
      <div className="max-w-2xl">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--muted)' }}>Deckbuilding tool</div>
        <h1 className="font-display mt-3 text-4xl" style={{ fontWeight: 560, color: 'var(--text)' }}>Proxy Card Creator</h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>Create correctly sized 2.5×3.5-inch cards for private playtesting. Proxies are non-commercial and not for sale.</p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
          <h2 className="font-display text-lg" style={{ color: 'var(--text)' }}>Search Lorcast cards</h2>
          <label className="mt-3 block text-xs font-semibold" style={{ color: 'var(--muted)' }}>
            Card name
            <input value={query} onChange={(event) => setQuery(event.target.value)} disabled={cards === null} placeholder={cards === null ? 'Loading card catalog…' : 'Search by name'} className="mt-1.5 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-[color:var(--sapphire)] disabled:opacity-50" style={{ borderColor: 'var(--line-2)', color: 'var(--text)' }} />
          </label>
          {query && (
            <div className="mt-2 max-h-56 overflow-y-auto rounded-md border" style={{ borderColor: 'var(--line-2)' }}>
              {results.length ? results.map((card) => (
                <button key={card.id || displayName(card)} type="button" onClick={() => addCard(card)} className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-[color:var(--panel-2)]" style={{ borderColor: 'var(--line)', color: 'var(--text)' }}>
                  <span>{displayName(card)}</span><span className="shrink-0 text-xs" style={{ color: 'var(--sapphire)' }}>Add</span>
                </button>
              )) : <p className="px-3 py-4 text-sm" style={{ color: 'var(--muted)' }}>No matching cards.</p>}
            </div>
          )}
        </section>

        {cards === null
          ? <div className="rounded-xl border p-5 text-sm" style={{ borderColor: 'var(--line)', background: 'var(--panel)', color: 'var(--muted)' }}>Loading deck importer…</div>
          : <DeckPasteImport cards={cards} onImport={importDeck} title="Import a proxy deck" />}
      </div>

      <section className="mt-4 rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg" style={{ color: 'var(--text)' }}>{incomingDeck ? 'Proxy this deck' : 'Proxy set'}</h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{total} card{total === 1 ? '' : 's'} · {total ? Math.ceil(total / 9) : 0} sheet{Math.ceil(total / 9) === 1 ? '' : 's'}</p>
          </div>
          {entries.length > 0 && <button type="button" onClick={() => setEntries([])} className="rounded-md border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: 'var(--line-2)', color: 'var(--ruby)' }}>Clear set</button>}
        </div>

        {entries.length ? (
          <ul className="mt-4 divide-y" style={{ borderColor: 'var(--line)' }}>
            {entries.map((entry, position) => (
              <li key={`${entry.card.id || displayName(entry.card)}-${position}`} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--text)' }}>{displayName(entry.card)}</span>
                <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                  Copies
                  <input aria-label={`Copies of ${displayName(entry.card)}`} type="number" min="1" max="60" value={entry.count} onChange={(event) => updateCount(position, event.target.value)} className="w-16 rounded-md border bg-transparent px-2 py-1.5 text-sm tabular-nums" style={{ borderColor: 'var(--line-2)', color: 'var(--text)' }} />
                </label>
                <button type="button" aria-label={`Remove ${displayName(entry.card)}`} onClick={() => setEntries((current) => current.filter((_, indexValue) => indexValue !== position))} className="rounded-md px-2 py-1 text-lg" style={{ color: 'var(--ruby)' }}>×</button>
              </li>
            ))}
          </ul>
        ) : <p className="mt-4 rounded-lg border border-dashed p-6 text-center text-sm" style={{ borderColor: 'var(--line-2)', color: 'var(--muted)' }}>Search for cards or import a deck to build the proxy set.</p>}
      </section>

      <section className="mt-4 flex flex-wrap items-end gap-4 rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
        <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
          Render mode
          <select value={mode} onChange={(event) => setMode(event.target.value)} className="mt-1.5 block rounded-md border bg-[color:var(--canvas)] px-3 py-2 text-sm" style={{ borderColor: 'var(--line-2)', color: 'var(--text)' }}>
            <option value="image">Card images</option>
            <option value="text-only">Text-only</option>
          </select>
        </label>
        <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
          Page size
          <select value={pageSize} onChange={(event) => setPageSize(event.target.value)} className="mt-1.5 block rounded-md border bg-[color:var(--canvas)] px-3 py-2 text-sm" style={{ borderColor: 'var(--line-2)', color: 'var(--text)' }}>
            <option value="Letter">Letter</option>
            <option value="A4">A4</option>
          </select>
        </label>
        <button type="button" onClick={downloadPdf} disabled={!expandedCards.length || generating} className="rounded-md px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40" style={{ background: 'var(--sapphire)', color: 'white' }}>
          {generating ? `Generating ${progress.completed}/${progress.total}…` : 'Download PDF'}
        </button>
        <p className="basis-full text-xs leading-relaxed" style={{ color: 'var(--faint)' }}>Image mode fetches Lorcast artwork in your browser. If an image is blocked or invalid, that card automatically uses a text-only proxy.</p>
        {message && <p className="basis-full text-sm" role="status" style={{ color: message.startsWith('PDF generation failed') ? 'var(--ruby)' : 'var(--muted)' }}>{message}</p>}
      </section>
    </div>
  )
}
