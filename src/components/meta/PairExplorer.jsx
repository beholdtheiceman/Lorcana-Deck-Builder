import { useEffect, useMemo, useState } from 'react'

const INKS = ['amber', 'amethyst', 'emerald', 'ruby', 'sapphire', 'steel']

// Matchups below this are noise, not reads. Without it the "best matchups" list
// is topped by mono-ink rows with 23 games at 70% — technically the highest win
// rate on the board, and completely meaningless.
const MIN_MATCHUP_GAMES = 500

/** The 15 two-ink combinations, alphabetically sorted like the stored pair keys. */
export const PAIR_KEYS = INKS.flatMap((a, i) => INKS.slice(i + 1).map((b) => `${a}/${b}`))

function label(key) {
  return String(key || '')
    .split('/')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' / ')
}

function badgeSrc(key) {
  const parts = String(key || '').split('/').filter(Boolean)
  return parts.length === 2 ? `/ink-pairs/${[...parts].sort().join('-')}.png` : null
}

function pct(v) {
  return v === null || v === undefined ? '—' : `${Number(v).toFixed(1)}%`
}

function num(v) {
  return v === null || v === undefined ? '—' : Number(v).toLocaleString()
}

/** Win rates cluster tightly around 50, so tint on distance from even. */
function winRateColor(wr) {
  if (wr === null || wr === undefined) return 'var(--muted)'
  if (wr >= 53) return 'var(--emerald)'
  if (wr <= 47) return 'var(--ruby)'
  return 'var(--text)'
}

function PairBadge({ pairKey, selected, onSelect }) {
  const src = badgeSrc(pairKey)
  return (
    <button
      type="button"
      onClick={() => onSelect(pairKey)}
      aria-pressed={selected}
      title={label(pairKey)}
      className="flex flex-col items-center gap-1 rounded-lg p-2 transition"
      style={{
        border: `1px solid ${selected ? 'var(--sapphire)' : 'var(--line)'}`,
        background: selected ? 'var(--panel)' : 'transparent',
        opacity: selected ? 1 : 0.82,
      }}
    >
      {src ? <img src={src} alt="" width={40} height={46} loading="lazy" /> : null}
      <span className="text-[10px] leading-tight" style={{ color: 'var(--muted)' }}>
        {label(pairKey)}
      </span>
    </button>
  )
}

function MatchupList({ matchups }) {
  const { solid, thin } = useMemo(() => {
    const solid = matchups.filter((m) => m.games >= MIN_MATCHUP_GAMES)
    const thin = matchups.filter((m) => m.games < MIN_MATCHUP_GAMES)
    return { solid, thin }
  }, [matchups])

  const row = (m) => (
    <tr key={m.opponent}>
      <td className="px-4 py-2" style={{ color: 'var(--text)' }}>
        <span className="inline-flex items-center gap-2">
          {badgeSrc(m.opponent) ? (
            <img src={badgeSrc(m.opponent)} alt="" width={18} height={21} loading="lazy" />
          ) : null}
          {label(m.opponent)}
          {m.mirror ? (
            <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              mirror
            </span>
          ) : null}
        </span>
      </td>
      <td
        className="px-4 py-2 text-right font-semibold tabular-nums"
        style={{ color: winRateColor(m.winRate) }}
      >
        {pct(m.winRate)}
      </td>
      <td className="px-4 py-2 text-right tabular-nums" style={{ color: 'var(--muted)' }}>
        {pct(m.firstPlayerWinRate)}
      </td>
      <td className="px-4 py-2 text-right tabular-nums" style={{ color: 'var(--muted)' }}>
        {num(m.games)}
      </td>
    </tr>
  )

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left" style={{ color: 'var(--muted)' }}>
            <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">Versus</th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider">Win rate</th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider">On the play</th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider">Games</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
          {solid.map(row)}
          {thin.length ? (
            <>
              <tr>
                <td colSpan={4} className="px-4 pt-4 pb-1 text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                  Low sample (under {num(MIN_MATCHUP_GAMES)} games — not a reliable read)
                </td>
              </tr>
              {thin.map(row)}
            </>
          ) : null}
        </tbody>
      </table>
      <p className="px-4 pt-3 text-xs" style={{ color: 'var(--muted)' }}>
        On-the-play figures are only recorded from one side of each pairing, so they show “—” where
        this pair is the recorded opponent rather than the recorded side.
      </p>
    </div>
  )
}

function CardLiftList({ cardLift }) {
  if (!cardLift.length) {
    return (
      <p className="px-4 py-3 text-sm" style={{ color: 'var(--muted)' }}>
        No card-level data recorded for this pairing.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left" style={{ color: 'var(--muted)' }}>
            <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">Card</th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider">Lift</th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider">In lists</th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider">Win rate with</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
          {cardLift.map((c) => (
            <tr key={c.cardId}>
              <td className="px-4 py-2" style={{ color: 'var(--text)' }}>
                {c.name}
                {c.cost !== null ? (
                  <span className="ml-2 text-xs" style={{ color: 'var(--muted)' }}>{c.cost} ink</span>
                ) : null}
              </td>
              <td
                className="px-4 py-2 text-right font-semibold tabular-nums"
                style={{ color: c.lift >= 0 ? 'var(--emerald)' : 'var(--ruby)' }}
              >
                {c.lift > 0 ? '+' : ''}{Number(c.lift).toFixed(2)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums" style={{ color: 'var(--muted)' }}>
                {pct((c.presence ?? 0) * 100)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums" style={{ color: 'var(--muted)' }}>
                {pct(c.winRateWith)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 pt-3 text-xs" style={{ color: 'var(--muted)' }}>
        Lift is how many points the pairing’s win rate moves when the card is in the list. It is a
        correlation across many decks, not proof the card causes the win.
      </p>
    </div>
  )
}

function DeckList({ decks }) {
  if (!decks.length) {
    return (
      <p className="px-4 py-3 text-sm" style={{ color: 'var(--muted)' }}>
        No distinct deck shapes recorded for this pairing.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left" style={{ color: 'var(--muted)' }}>
            <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">Deck</th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider">Win rate</th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider">Games</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
          {decks.map((d) => (
            <tr key={d.name + d.games}>
              <td className="px-4 py-2" style={{ color: 'var(--text)' }}>
                {d.name}
                {d.shapes > 1 ? (
                  <span className="ml-2 text-xs" style={{ color: 'var(--muted)' }}>
                    {d.shapes} variants
                  </span>
                ) : null}
              </td>
              <td
                className="px-4 py-2 text-right font-semibold tabular-nums"
                style={{ color: winRateColor(d.winRate) }}
              >
                {pct(d.winRate)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums" style={{ color: 'var(--muted)' }}>
                {num(d.games)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const TABS = [
  { id: 'matchups', label: 'Matchups' },
  { id: 'cards', label: 'Card lift' },
  { id: 'decks', label: 'Deck shapes' },
]

export default function PairExplorer({ queue }) {
  const [selected, setSelected] = useState('amber/emerald')
  const [tab, setTab] = useState('matchups')
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading')

  useEffect(() => {
    let cancelled = false
    setState('loading')
    fetch(`/api/meta/pair?queue=${encodeURIComponent(queue)}&pair=${encodeURIComponent(selected)}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        if (json.empty || json.error) {
          setData(null)
          setState(json.error ? 'error' : 'empty')
          return
        }
        setData(json)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [queue, selected])

  return (
    <section className="mt-10">
      <h2 className="font-display text-lg" style={{ color: 'var(--text)' }}>Pair explorer</h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
        Pick a pairing to see how it performs across the field.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
        {PAIR_KEYS.map((key) => (
          <PairBadge key={key} pairKey={key} selected={key === selected} onSelect={setSelected} />
        ))}
      </div>

      <div
        className="mt-6 rounded-xl"
        style={{ border: '1px solid var(--line)', background: 'var(--panel)' }}
      >
        <div className="flex flex-wrap items-center gap-4 px-4 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
          {badgeSrc(selected) ? <img src={badgeSrc(selected)} alt="" width={34} height={39} /> : null}
          <div>
            <div className="font-display text-base" style={{ color: 'var(--text)' }}>{label(selected)}</div>
            {state === 'ready' ? (
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                {pct(data.stats.winRate)} win · {pct(data.stats.playRate)} of the field ·{' '}
                {pct(data.stats.firstPlayerWinRate)} on the play · {num(data.stats.games)} games
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex gap-1 px-3 pt-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="rounded-md px-3 py-1.5 text-sm transition"
              style={{
                color: tab === t.id ? 'var(--text)' : 'var(--muted)',
                background: tab === t.id ? 'var(--bg)' : 'transparent',
                border: `1px solid ${tab === t.id ? 'var(--line)' : 'transparent'}`,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="py-3">
          {state === 'loading' ? (
            <p className="px-4 py-6 text-sm" style={{ color: 'var(--muted)' }}>Loading {label(selected)}…</p>
          ) : state === 'error' ? (
            <p className="px-4 py-6 text-sm" style={{ color: 'var(--muted)' }}>
              Couldn’t load data for {label(selected)}.
            </p>
          ) : state === 'empty' ? (
            <p className="px-4 py-6 text-sm" style={{ color: 'var(--muted)' }}>
              No approved snapshot for this queue yet.
            </p>
          ) : tab === 'matchups' ? (
            <MatchupList matchups={data.matchups} />
          ) : tab === 'cards' ? (
            <CardLiftList cardLift={data.cardLift} />
          ) : (
            <DeckList decks={data.decks} />
          )}
        </div>
      </div>
    </section>
  )
}
