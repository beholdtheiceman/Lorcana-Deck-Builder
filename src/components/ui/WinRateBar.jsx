// Win/loss ratio bar. Extracted verbatim from App.jsx (H9).
export default function WinRateBar({ win = 0, loss = 0 }) {
  const total = Math.max(1, win + loss)
  const winPct = (win / total) * 100
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-48 bg-gray-600 rounded overflow-hidden">
        <div className="h-full bg-emerald-500" style={{ width: `${winPct}%` }} />
      </div>
      <div className="text-xs text-gray-300 w-12 text-right">{Math.round(winPct)}%</div>
    </div>
  )
}
