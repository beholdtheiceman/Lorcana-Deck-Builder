import { InkCurve } from '../../../components/ui/index.js'

const emptyCurve = [1, 2, 3, 4, 5, 6, 7].map((cost) => ({ cost, count: 0 }))

export default function DeckStatsPanel({ stats }) {
  const curve = stats?.curve || emptyCurve
  const buckets = curve.map(({ cost, count }) => ({
    label: `${cost === 7 ? '7+' : cost} cost`,
    counts: { Steel: count },
  }))
  const ratio = Number(stats?.inkable?.ratio) || 0

  return (
    <section aria-labelledby="deck-stats-title" className="border-t pt-4" style={{ borderColor: 'var(--line)' }}>
      <h3 id="deck-stats-title" className="mb-3 text-xs font-semibold uppercase tracking-wider">
        Deck stats
      </h3>
      <InkCurve buckets={buckets} height={96} />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-md border p-2" style={{ borderColor: 'var(--line)' }}>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>Avg cost</div>
          <div className="mt-1 font-semibold tabular-nums">{stats?.avgCost ?? 0}</div>
        </div>
        <div className="rounded-md border p-2" style={{ borderColor: 'var(--line)' }}>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>Inkable</div>
          <div className="mt-1 font-semibold tabular-nums">{Math.round(ratio * 100)}%</div>
        </div>
      </div>
    </section>
  )
}
