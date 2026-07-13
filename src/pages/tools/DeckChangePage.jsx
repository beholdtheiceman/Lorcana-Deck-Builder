import { useEffect, useMemo, useState } from 'react'
import { averageCost, buildCostCurve, buildInkSplit } from '../../components/DeckStats'
import DeckPasteImport from '../../components/tools/DeckPasteImport'
import { diff } from '../../lib/deckDiff'
import { useIncomingDeck } from '../../lib/deckPayload'
import { fetchAllCards } from '../../lib/cardsApi'

const EMPTY_DECK = { cards: [] }
const INKS = ['amber', 'amethyst', 'emerald', 'ruby', 'sapphire', 'steel']

function normalizeName(value) {
  return String(value || '').trim().toLowerCase()
}

function displayName(card) {
  const name = String(card?.name || card?.baseName || '').trim()
  const subname = String(card?.subname || '').trim()
  return subname && !normalizeName(name).includes(normalizeName(subname)) ? `${name} - ${subname}` : name
}

function cardIndex(cards) {
  const byId = new Map()
  const byName = new Map()

  for (const card of cards) {
    if (card?.id) byId.set(String(card.id), card)
    const key = normalizeName(displayName(card))
    if (key && !byName.has(key)) byName.set(key, card)
  }

  return { byId, byName }
}

function deckEntries(payload, index) {
  return (payload?.cards || []).flatMap((item) => {
    const card = (item.cardId && index.byId.get(String(item.cardId))) || index.byName.get(normalizeName(item.name))
    return card ? [{ card, count: item.count }] : []
  })
}

function inkCounts(entries) {
  return Object.fromEntries(buildInkSplit(entries).segments.map(({ ink, count }) => [ink, count]))
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value)
}

function ChangeColumn({ title, changes, kind }) {
  const color = kind === 'cut' ? 'var(--ruby)' : 'var(--emerald)'
  return (
    <section className="rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg" style={{ color: 'var(--text)' }}>{title}</h2>
        <span className="rounded-full border px-2 py-1 text-xs tabular-nums" style={{ borderColor: 'var(--line-2)', color }}>
          {changes.length} card{changes.length === 1 ? '' : 's'}
        </span>
      </div>
      {changes.length ? (
        <ul className="mt-3 divide-y" style={{ borderColor: 'var(--line)' }}>
          {changes.map((card) => (
            <li key={normalizeName(card.name)} className="flex items-center justify-between gap-4 py-3 text-sm">
              <span style={{ color: 'var(--text)' }}>{card.name}</span>
              <span className="shrink-0 tabular-nums font-semibold" style={{ color }}>
                {signed(card.delta)} <span className="font-normal" style={{ color: 'var(--faint)' }}>({card.from} → {card.to})</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm" style={{ color: 'var(--muted)' }}>No {title.toLowerCase()}.</p>
      )}
    </section>
  )
}
function ShiftSummary({ current, target, cards }) {
  const index = useMemo(() => cardIndex(cards), [cards])
  const aEntries = useMemo(() => deckEntries(current, index), [current, index])
  const bEntries = useMemo(() => deckEntries(target, index), [target, index])
  const aCurve = buildCostCurve(aEntries)
  const bCurve = buildCostCurve(bEntries)
  const aInks = inkCounts(aEntries)
  const bInks = inkCounts(bEntries)
  const curveChanges = aCurve.map((count, cost) => ({ cost, delta: bCurve[cost] - count })).filter(({ delta }) => delta)
  const inkChanges = INKS.map((ink) => ({ ink, delta: (bInks[ink] || 0) - (aInks[ink] || 0) })).filter(({ delta }) => delta)
  const resolved = aEntries.length + bEntries.length
  const avgShift = averageCost(bEntries) - averageCost(aEntries)

  return (
    <section className="rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
      <h2 className="font-display text-lg" style={{ color: 'var(--text)' }}>Ink and curve shift</h2>
      {!resolved ? (
        <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>Card details are unavailable for this list, so ink and cost shifts cannot be calculated.</p>
      ) : (
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--faint)' }}>Ink copies</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {inkChanges.length ? inkChanges.map(({ ink, delta }) => (
                <span key={ink} className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm capitalize" style={{ borderColor: 'var(--line-2)', color: 'var(--muted)' }}>
                  <span className="h-2.5 w-2.5" style={{ clipPath: 'var(--hex)', background: `var(--${ink})` }} />
                  {ink} <strong className="tabular-nums" style={{ color: delta > 0 ? 'var(--emerald)' : 'var(--ruby)' }}>{signed(delta)}</strong>
                </span>
              )) : <span className="text-sm" style={{ color: 'var(--muted)' }}>No ink shift.</span>}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--faint)' }}>Cost curve</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {curveChanges.length ? curveChanges.map(({ cost, delta }) => (
                <span key={cost} className="rounded-full border px-3 py-1.5 text-sm" style={{ borderColor: 'var(--line-2)', color: 'var(--muted)' }}>
                  {cost === 9 ? '9+' : cost}: <strong className="tabular-nums" style={{ color: delta > 0 ? 'var(--emerald)' : 'var(--ruby)' }}>{signed(delta)}</strong>
                </span>
              )) : <span className="text-sm" style={{ color: 'var(--muted)' }}>No curve shift.</span>}
            </div>
            <p className="mt-3 text-xs" style={{ color: 'var(--faint)' }}>Average cost shift: {signed(Number(avgShift.toFixed(2)))}</p>
          </div>
        </div>
      )}
    </section>
  )
}

export default function DeckChangePage() {
  const incomingDeck = useIncomingDeck()
  const [current, setCurrent] = useState(incomingDeck)
  const [target, setTarget] = useState(null)
  const [cards, setCards] = useState(null)
  const [copyState, setCopyState] = useState('')

  useEffect(() => {
    let alive = true
    const controller = new AbortController()
    fetchAllCards({ signal: controller.signal }).then((loaded) => {
      // Guard against StrictMode's double-mount: the aborted first fetch
      // resolves to [] and must not clobber a good catalog from the remount.
      if (alive && loaded?.length) setCards(loaded)
    })
    return () => { alive = false; controller.abort() }
  }, [])

  const result = useMemo(() => diff(current || EMPTY_DECK, target || EMPTY_DECK), [current, target])
  const hasDeck = Boolean(current || target)
  const changeText = [...result.cuts, ...result.adds].map((card) => `${signed(card.delta)} ${card.name}`).join('\n')

  async function copyChanges() {
    try {
      await navigator.clipboard.writeText(changeText)
      setCopyState('Copied')
    } catch {
      setCopyState('Could not copy')
    }
  }

  return (
    <div className="mx-auto max-w-5xl py-4 sm:py-8">
      <div className="max-w-2xl">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--muted)' }}>Deckbuilding tool</div>
        <h1 className="font-display mt-3 text-4xl" style={{ fontWeight: 560, color: 'var(--text)' }}>Deck Change Calculator</h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>Compare your current list with a target list to get an exact cut-and-add checklist.</p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {cards === null ? (
          <>
            <div className="rounded-xl border p-5 text-sm" style={{ borderColor: 'var(--line)', background: 'var(--panel)', color: 'var(--muted)' }}>Loading current deck importer…</div>
            <div className="rounded-xl border p-5 text-sm" style={{ borderColor: 'var(--line)', background: 'var(--panel)', color: 'var(--muted)' }}>Loading target deck importer…</div>
          </>
        ) : (
          <>
            <DeckPasteImport cards={cards} title="Current deck" onImport={setCurrent} />
            <DeckPasteImport cards={cards} title="Target deck" onImport={setTarget} />
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs" style={{ color: 'var(--muted)' }}>
        <span>Current: <strong style={{ color: 'var(--text)' }}>{current ? result.totals.aCount : 'not loaded'}</strong></span>
        <span>Target: <strong style={{ color: 'var(--text)' }}>{target ? result.totals.bCount : 'not loaded'}</strong></span>
      </div>

      {!hasDeck ? (
        <div className="mt-8 rounded-xl border border-dashed p-8 text-center" style={{ borderColor: 'var(--line-2)', color: 'var(--muted)' }}>
          Import a current deck and a target deck to compare them.
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {!current || !target ? <p className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: 'var(--line)', background: 'var(--panel-2)', color: 'var(--muted)' }}>Only one deck is loaded. The missing side is treated as an empty deck.</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-4" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              <strong className="tabular-nums" style={{ color: 'var(--text)' }}>{result.totals.aCount}</strong> current → <strong className="tabular-nums" style={{ color: 'var(--text)' }}>{result.totals.bCount}</strong> target · <strong className="tabular-nums" style={{ color: 'var(--sapphire)' }}>{result.totals.changed}</strong> copies changed
            </p>
            <div className="flex items-center gap-3">
              {copyState && <span className="text-xs" style={{ color: 'var(--muted)' }}>{copyState}</span>}
              <button type="button" onClick={copyChanges} disabled={!changeText} className="rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40" style={{ background: 'var(--sapphire)', color: 'white' }}>Copy changes</button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ChangeColumn title="Cuts" changes={result.cuts} kind="cut" />
            <ChangeColumn title="Adds" changes={result.adds} kind="add" />
          </div>
          <ShiftSummary current={current || EMPTY_DECK} target={target || EMPTY_DECK} cards={cards || []} />
        </div>
      )}
    </div>
  )
}
