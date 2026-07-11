// CSS-only stacked cost curve, split by ink color
// (design/comps/uninkable-deck-detail-comp.html: .curve).
import { inkVar } from './inks'

/**
 * buckets: [{ label: '1', counts: { Sapphire: 8, Ruby: 4 } }, ...]
 * Column heights are normalized against the tallest bucket.
 */
export default function InkCurve({ buckets = [], height = 120, className = '', ...rest }) {
  const totals = buckets.map((b) => sumCounts(b.counts))
  const max = Math.max(1, ...totals)
  const label = `Cost curve: ${buckets.map((b, i) => `${b.label}: ${totals[i]}`).join(', ')}`
  return (
    <div role="img" aria-label={label} className={`flex items-end gap-2 ${className}`} style={{ height }} {...rest}>
      {buckets.map((b, i) => (
        <div key={b.label ?? i} className="flex h-full flex-1 flex-col justify-end gap-[2px]">
          {Object.entries(b.counts || {})
            .filter(([, n]) => n > 0)
            .map(([ink, n]) => (
              <div
                key={ink}
                className="rounded-[3px]"
                style={{ minHeight: 3, height: `${(n / max) * 100}%`, background: inkVar(ink) }}
              />
            ))}
          <div
            className="mt-1.5 text-center"
            style={{ fontSize: 11, color: totals[i] === 0 ? 'var(--line-2)' : 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}
          >
            {b.label}
          </div>
        </div>
      ))}
    </div>
  )
}

function sumCounts(counts) {
  return Object.values(counts || {}).reduce((a, n) => a + n, 0)
}
