// Horizontal ink-split bar with count labels
// (design/comps/uninkable-deck-detail-comp.html: .split / .split-l).
import { inkVar } from './inks'

/** segments: [{ ink: 'Sapphire', count: 34 }, { ink: 'Ruby', count: 26 }] */
export default function InkSplitBar({ segments = [], className = '', ...rest }) {
  const total = Math.max(1, segments.reduce((n, s) => n + (s.count || 0), 0))
  return (
    <div className={className} {...rest}>
      <div className="mb-2 flex h-[10px] overflow-hidden rounded-[5px]">
        {segments.map((s) => (
          <div key={s.ink} style={{ width: `${((s.count || 0) / total) * 100}%`, background: inkVar(s.ink) }} />
        ))}
      </div>
      <div className="flex justify-between" style={{ color: 'var(--muted)', fontSize: '12.5px' }}>
        {segments.map((s) => (
          <span key={s.ink}>
            <b style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{s.count}</b> {s.ink}
          </span>
        ))}
      </div>
    </div>
  )
}
