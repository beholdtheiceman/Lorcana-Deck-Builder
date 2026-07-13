import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import DeckPasteImport from '../../components/tools/DeckPasteImport'
import { fetchAllCards } from '../../lib/cardsApi'
import { useIncomingDeck } from '../../lib/deckPayload'
import { byTurn, mulliganAdjust, multivariateHypergeom } from '../../lib/hypergeometric'

const makeGroup = (overrides = {}) => ({
  id: `${Date.now()}-${Math.random()}`,
  label: '',
  copies: 4,
  min: 1,
  max: 4,
  ...overrides,
})

const fieldClass = 'w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-[color:var(--sapphire)]'

function totalCards(deck) {
  return (deck?.cards || []).reduce((sum, card) => sum + Number(card.count || 0), 0)
}

function percent(probability) {
  return `${(probability * 100).toFixed(2)}%`
}

export default function HypergeometricPage() {
  const incomingDeck = useIncomingDeck()
  const [deck, setDeck] = useState(incomingDeck)
  const [deckSize, setDeckSize] = useState(() => totalCards(incomingDeck) || 60)
  const [groups, setGroups] = useState(() => [makeGroup()])
  const [afterMulligan, setAfterMulligan] = useState(false)
  const [onThePlay, setOnThePlay] = useState(true)
  const [extraLooks, setExtraLooks] = useState(0)
  const [cards, setCards] = useState(null)

  useEffect(() => {
    let alive = true
    const controller = new AbortController()
    fetchAllCards({ signal: controller.signal }).then((loaded) => {
      if (alive && loaded?.length) setCards(loaded)
      else if (alive) setCards([])
    })
    return () => { alive = false; controller.abort() }
  }, [])

  const mathGroups = useMemo(() => groups.map(({ copies, min, max }) => ({
    copies: Number(copies),
    min: Number(min),
    max: Number(max),
  })), [groups])
  const copiesTotal = mathGroups.reduce((sum, group) => sum + group.copies, 0)
  const valid = Number.isInteger(deckSize) && deckSize >= 7 && mathGroups.every((group) => (
    Number.isInteger(group.copies) && group.copies >= 0
    && Number.isInteger(group.min) && group.min >= 0
    && Number.isInteger(group.max) && group.max >= group.min
  )) && copiesTotal <= deckSize

  const openingProbability = useMemo(() => {
    if (!valid) return 0
    return afterMulligan
      ? mulliganAdjust({ N: deckSize, groups: mathGroups })
      : multivariateHypergeom(deckSize, 7, mathGroups)
  }, [afterMulligan, deckSize, mathGroups, valid])

  const curve = useMemo(() => {
    if (!valid) return []
    return byTurn({ N: deckSize, groups: mathGroups, onThePlay, extraLooks: Number(extraLooks), turns: 10 })
      .map((point) => ({ ...point, percent: point.probability * 100 }))
  }, [deckSize, extraLooks, mathGroups, onThePlay, valid])

  function updateGroup(id, field, value) {
    setGroups((current) => current.map((group) => group.id === id
      ? { ...group, [field]: field === 'label' ? value : Number(value) }
      : group))
  }

  function removeGroup(id) {
    setGroups((current) => current.length === 1 ? current : current.filter((group) => group.id !== id))
  }

  function seedCard(card) {
    const seeded = { label: card.name, copies: card.count, min: 1, max: card.count }
    setGroups((current) => {
      const blank = current.findIndex((group) => !group.label.trim())
      if (blank === -1) return [...current, makeGroup(seeded)]
      return current.map((group, index) => index === blank ? { ...group, ...seeded } : group)
    })
  }

  function importDeck(payload) {
    setDeck(payload)
    setDeckSize(totalCards(payload) || 60)
  }

  return (
    <div className="mx-auto max-w-5xl py-4 sm:py-8">
      <div className="max-w-2xl">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--muted)' }}>Probability tool</div>
        <h1 className="font-display mt-3 text-4xl" style={{ fontWeight: 560, color: 'var(--text)' }}>Hypergeometric Calculator</h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>Calculate exact opening-hand and by-turn odds for several cards at once, without simulation.</p>
      </div>

      {!deck && (
        <div className="mt-8">
          {cards === null
            ? <div className="rounded-xl border p-5 text-sm" style={{ borderColor: 'var(--line)', background: 'var(--panel)', color: 'var(--muted)' }}>Loading deck importer…</div>
            : <DeckPasteImport cards={cards} onImport={importDeck} title="Import a deck (optional)" />}
        </div>
      )}

      {deck?.cards?.length > 0 && (
        <section className="mt-8 rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg" style={{ color: 'var(--text)' }}>Cards in this deck</h2>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>{totalCards(deck)} cards · click to add a group</span>
          </div>
          <div className="mt-3 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
            {deck.cards.map((card) => (
              <button key={`${card.cardId || card.name}-${card.count}`} type="button" onClick={() => seedCard(card)} className="rounded-full border px-3 py-1.5 text-left text-xs transition hover:border-[color:var(--sapphire)]" style={{ borderColor: 'var(--line-2)', color: 'var(--text)' }}>
                <strong className="tabular-nums" style={{ color: 'var(--sapphire)' }}>{card.count}×</strong> {card.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mt-4 rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
            Deck size
            <input type="number" min="7" value={deckSize} onChange={(event) => setDeckSize(Number(event.target.value))} className={`${fieldClass} mt-1.5`} style={{ borderColor: 'var(--line-2)', color: 'var(--text)' }} />
          </label>
          <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
            Extra looks by each turn
            <input type="number" min="0" value={extraLooks} onChange={(event) => setExtraLooks(Number(event.target.value))} className={`${fieldClass} mt-1.5`} style={{ borderColor: 'var(--line-2)', color: 'var(--text)' }} />
          </label>
          <div className="flex flex-col justify-end gap-2 pb-1 text-sm" style={{ color: 'var(--text)' }}>
            <label className="flex items-center gap-2"><input type="checkbox" checked={afterMulligan} onChange={(event) => setAfterMulligan(event.target.checked)} /> After optimal mulligan</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={onThePlay} onChange={(event) => setOnThePlay(event.target.checked)} /> On the play</label>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <div className="hidden grid-cols-[minmax(0,1fr)_7rem_6rem_6rem_2rem] gap-2 px-1 text-[10px] font-semibold uppercase tracking-wider sm:grid" style={{ color: 'var(--faint)' }}>
            <span>Card or group</span><span>Copies</span><span>Minimum</span><span>Maximum</span><span />
          </div>
          {groups.map((group) => (
            <div key={group.id} className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_6rem_6rem_2rem]">
              <input aria-label="Group label" value={group.label} onChange={(event) => updateGroup(group.id, 'label', event.target.value)} placeholder="Card or group label" className={`${fieldClass} col-span-2 sm:col-span-1`} style={{ borderColor: 'var(--line-2)', color: 'var(--text)' }} />
              <input aria-label="Copies in deck" type="number" min="0" value={group.copies} onChange={(event) => updateGroup(group.id, 'copies', event.target.value)} className={fieldClass} style={{ borderColor: 'var(--line-2)', color: 'var(--text)' }} />
              <input aria-label="Desired minimum" type="number" min="0" value={group.min} onChange={(event) => updateGroup(group.id, 'min', event.target.value)} className={fieldClass} style={{ borderColor: 'var(--line-2)', color: 'var(--text)' }} />
              <input aria-label="Desired maximum" type="number" min="0" value={group.max} onChange={(event) => updateGroup(group.id, 'max', event.target.value)} className={fieldClass} style={{ borderColor: 'var(--line-2)', color: 'var(--text)' }} />
              <button type="button" aria-label="Remove group" disabled={groups.length === 1} onClick={() => removeGroup(group.id)} className="rounded-md text-lg disabled:opacity-30" style={{ color: 'var(--ruby)' }}>×</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setGroups((current) => [...current, makeGroup()])} className="mt-4 rounded-md border px-4 py-2 text-sm font-semibold" style={{ borderColor: 'var(--line-2)', color: 'var(--sapphire)' }}>Add group</button>
        {!valid && <p className="mt-3 text-xs" style={{ color: 'var(--ruby)' }}>Use whole non-negative values, keep each maximum at least its minimum, and keep total group copies within the deck size.</p>}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <section className="flex min-h-48 flex-col justify-center rounded-xl border p-5 text-center" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{afterMulligan ? 'After mulligan' : 'Opening seven'}</div>
          <div className="mt-3 font-display text-4xl tabular-nums" style={{ color: 'var(--sapphire)' }}>{valid ? percent(openingProbability) : '—'}</div>
          <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--faint)' }}>{afterMulligan ? 'Best exact result when any subset may be bottomed and redrawn.' : 'All group ranges satisfied in the opening hand.'}</p>
        </section>
        <section className="rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg" style={{ color: 'var(--text)' }}>Probability by turn</h2>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>{onThePlay ? 'On the play' : 'On the draw'} · natural draws{extraLooks ? ` + ${extraLooks} extra looks` : ''}</span>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curve} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                <XAxis dataKey="turn" stroke="var(--faint)" tickLine={false} axisLine={false} label={{ value: 'Turn', position: 'insideBottomRight', offset: -2, fill: 'var(--faint)' }} />
                <YAxis domain={[0, 100]} stroke="var(--faint)" tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Probability']} labelFormatter={(turn) => `Turn ${turn}`} contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line-2)', borderRadius: 8 }} />
                <Line type="monotone" dataKey="percent" stroke="var(--sapphire)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  )
}
