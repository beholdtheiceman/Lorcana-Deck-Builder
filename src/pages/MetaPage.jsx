import { useEffect, useMemo, useState } from 'react'
import { Badge, Skeleton } from '../components/ui'
import { inkVar } from '../components/ui/inks'

const QUEUES = [
  { value: 'core-bo1', label: 'Core BO1' },
  { value: 'core-bo3', label: 'Core BO3' },
]

// Below this many games a color-pair row is too thin to compare against the
// rest of the field (e.g. a 2-game 0% "Sapphire" mono entry). We still show
// them — just called out separately — rather than silently dropping data.
const MIN_GAMES_THRESHOLD = 200

const numberFormatter = new Intl.NumberFormat('en-US')
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function formatNumber(value) {
  return value === null || value === undefined ? '—' : numberFormatter.format(value)
}

// winRate / playRate / firstPlayerWinRate are stored as percentages already
// (e.g. 52.13 means 52.13%), not 0-1 fractions — confirmed against the live
// duels.ink snapshot (Amber/Emerald: winRate 52.13, playRate 23.61).
function formatPercent(value) {
  return value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}%`
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date)
}

function colorPairLabel(key) {
  return String(key || '')
    .split('/')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ')
}

function ColorDots({ colorKey }) {
  const parts = String(colorKey || '').split('/').filter(Boolean)
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {parts.map((part) => (
        <span
          key={part}
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: inkVar(part) }}
        />
      ))}
    </span>
  )
}

function StaleBanner({ periodEnd }) {
  return (
    <div
      className="mt-6 rounded-md border px-4 py-3 text-sm"
      style={{ borderColor: 'var(--warn, #d9a441)', background: 'color-mix(in srgb, var(--warn, #d9a441) 12%, transparent)', color: 'var(--text)' }}
      role="status"
    >
      Data as of {formatDate(periodEnd)} — not currently refreshing. Showing the last approved snapshot.
    </div>
  )
}

function ColorPairTable({ archetypes }) {
  const pairs = useMemo(
    () => archetypes.filter((row) => String(row.externalId || '').startsWith('pair:')),
    [archetypes],
  )
  const substantial = pairs.filter((row) => row.games >= MIN_GAMES_THRESHOLD)
  const lowSample = pairs.filter((row) => row.games < MIN_GAMES_THRESHOLD)

  function renderRows(rows) {
    return rows.map((row) => (
      <tr key={row.id}>
        <td className="px-5 py-3" style={{ color: 'var(--text)' }}>
          <span className="inline-flex items-center gap-2">
            <ColorDots colorKey={row.archetypeId || row.name} />
            {colorPairLabel(row.name || row.archetypeId)}
          </span>
        </td>
        <td className="px-5 py-3 text-right tabular-nums" style={{ color: 'var(--muted)' }}>{formatPercent(row.playRate)}</td>
        <td className="px-5 py-3 text-right font-semibold tabular-nums" style={{ color: 'var(--sapphire)' }}>{formatPercent(row.winRate)}</td>
        <td className="px-5 py-3 text-right tabular-nums" style={{ color: 'var(--muted)' }}>{formatPercent(row.firstPlayerWinRate)}</td>
        <td className="px-5 py-3 text-right tabular-nums" style={{ color: 'var(--muted)' }}>{formatNumber(row.games)}</td>
      </tr>
    ))
  }

  return (
    <section className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
      <h2 className="px-5 py-4 font-display text-lg" style={{ color: 'var(--text)' }}>Color pairs</h2>
      {pairs.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead style={{ background: 'var(--panel-2)', color: 'var(--faint)' }}>
              <tr>
                <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider">Pair</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider">Play rate</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider">Win rate</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider">On-the-play win rate</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider">Games</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
              {renderRows(substantial)}
            </tbody>
          </table>

          {lowSample.length ? (
            <div className="border-t px-5 py-4" style={{ borderColor: 'var(--line)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--faint)' }}>
                Low sample (under {formatNumber(MIN_GAMES_THRESHOLD)} games — not comparable to the field above)
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
                    {renderRows(lowSample)}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="px-5 pb-5 text-sm" style={{ color: 'var(--muted)' }}>No color-pair data in this snapshot.</p>
      )}
    </section>
  )
}

function MatchupTable({ matchups }) {
  const sorted = useMemo(() => [...matchups].sort((a, b) => (b.games || 0) - (a.games || 0)), [matchups])

  return (
    <section className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
      <h2 className="px-5 py-4 font-display text-lg" style={{ color: 'var(--text)' }}>Matchups (color-pair grain)</h2>
      {sorted.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead style={{ background: 'var(--panel-2)', color: 'var(--faint)' }}>
              <tr>
                <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider">Deck A</th>
                <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider">Deck B</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider">A win rate</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider">On-the-play win rate</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider">Games</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
              {sorted.map((row) => (
                <tr key={`${row.keyA}-${row.keyB}`}>
                  <td className="px-5 py-3" style={{ color: 'var(--text)' }}>{colorPairLabel(row.keyA)}</td>
                  <td className="px-5 py-3" style={{ color: 'var(--text)' }}>{colorPairLabel(row.keyB)}</td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums" style={{ color: 'var(--sapphire)' }}>{formatPercent(row.winRate)}</td>
                  <td className="px-5 py-3 text-right tabular-nums" style={{ color: 'var(--muted)' }}>{formatPercent(row.firstPlayerWinRate)}</td>
                  <td className="px-5 py-3 text-right tabular-nums" style={{ color: 'var(--muted)' }}>{formatNumber(row.games)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 pb-5 text-sm" style={{ color: 'var(--muted)' }}>No matchup data in this snapshot.</p>
      )}
    </section>
  )
}

function AttributionFooter() {
  return (
    <p className="mt-8 text-xs" style={{ color: 'var(--faint)' }}>
      Meta stats courtesy of{' '}
      <a
        href="https://duels.ink/stats"
        target="_blank"
        rel="noreferrer noopener"
        className="underline"
        style={{ color: 'var(--muted)' }}
      >
        duels.ink
      </a>
      .
    </p>
  )
}

export default function MetaPage() {
  const [queue, setQueue] = useState('core-bo1')
  const [status, setStatus] = useState('loading') // loading | error | empty | data
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setData(null)

    fetch(`/api/meta/current?queue=${encodeURIComponent(queue)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Request failed with ${response.status}`)
        return response.json()
      })
      .then((payload) => {
        if (cancelled) return
        if (payload?.empty) {
          setStatus('empty')
          return
        }
        setData(payload)
        setStatus('data')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [queue])

  return (
    <div className="mx-auto max-w-6xl py-4 sm:py-8">
      <div className="max-w-2xl">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--muted)' }}>Competitive tool</div>
        <h1 className="font-display mt-3 text-4xl" style={{ fontWeight: 560, color: 'var(--text)' }}>Meta</h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          Weekly aggregate archetype and matchup stats pulled from ranked play.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }} htmlFor="meta-queue">
          Queue
        </label>
        <select
          id="meta-queue"
          value={queue}
          onChange={(event) => setQueue(event.target.value)}
          className="h-9 rounded-md border px-3 text-sm"
          style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--text)' }}
        >
          {QUEUES.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {status === 'loading' ? (
        <div className="mt-8 space-y-4">
          <Skeleton variant="block" />
          <Skeleton variant="card" />
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="mt-8 rounded-xl border p-5 text-sm" style={{ borderColor: 'var(--line)', background: 'var(--panel)', color: 'var(--ruby)' }} role="alert">
          Couldn't load meta stats right now. Try again shortly.
        </div>
      ) : null}

      {status === 'empty' ? (
        <div className="mt-8 rounded-xl border p-5 text-center text-sm" style={{ borderColor: 'var(--line)', background: 'var(--panel)', color: 'var(--muted)' }}>
          No approved meta snapshot for {QUEUES.find((option) => option.value === queue)?.label || queue} yet. Check back after the next sync.
        </div>
      ) : null}

      {status === 'data' && data ? (
        <div className="mt-8 space-y-6">
          {data.stale ? <StaleBanner periodEnd={data.periodEnd} /> : null}

          <section className="rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span style={{ color: 'var(--text)' }}><span style={{ color: 'var(--muted)' }}>Era:</span> {data.era || '—'}</span>
              <span style={{ color: 'var(--text)' }}><span style={{ color: 'var(--muted)' }}>Period:</span> {formatDate(data.periodStart)} – {formatDate(data.periodEnd)}</span>
              <span style={{ color: 'var(--text)' }}><span style={{ color: 'var(--muted)' }}>Total games:</span> {formatNumber(data.totalGames)}</span>
              <span style={{ color: 'var(--text)' }}><span style={{ color: 'var(--muted)' }}>Unique players:</span> {formatNumber(data.uniquePlayers)}</span>
              <Badge variant={data.stale ? 'warn' : 'good'}>{data.stale ? 'Stale' : 'Fresh'}</Badge>
            </div>
          </section>

          <ColorPairTable archetypes={data.archetypes || []} />
          <MatchupTable matchups={data.matchups || []} />
        </div>
      ) : null}

      <AttributionFooter />
    </div>
  )
}
