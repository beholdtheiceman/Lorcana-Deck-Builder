// Win/loss ratio bar. Extracted verbatim from App.jsx (H9).
export default function WinRateBar({ win = 0, loss = 0 }) {
  const total = Math.max(1, win + loss)
  const winPct = (win / total) * 100
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-48 rounded overflow-hidden" style={{ background: 'var(--panel-2)' }}>
        <div className="h-full" style={{ width: `${winPct}%`, background: 'var(--emerald)' }} />
      </div>
      <div className="text-xs w-12 text-right" style={{ color: 'var(--muted)' }}>{Math.round(winPct)}%</div>
    </div>
  )
}
