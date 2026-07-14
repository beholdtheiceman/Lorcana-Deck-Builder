import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { parseCsv } from '../../lib/csv'
import { calculatePerformanceStats } from '../../lib/performanceStats'

const FIELDS = [
  { key: 'date', label: 'Date / time', hints: ['date', 'datetime', 'timestamp', 'played at'] },
  { key: 'myDeck', label: 'My deck', hints: ['my deck', 'deck', 'deck name', 'player deck'] },
  { key: 'opponentDeck', label: 'Opponent deck', hints: ['opponent deck', 'opposing deck', 'matchup'] },
  { key: 'result', label: 'Result', hints: ['result', 'outcome', 'win loss', 'won'] },
  { key: 'playDraw', label: 'Play / draw', hints: ['play draw', 'on play', 'on the play', 'first second'] },
]

function key(value) {
  return String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

function suggestedMapping(headers) {
  const used = new Set()
  return Object.fromEntries(FIELDS.map((field) => {
    const header = headers.find((candidate) => !used.has(candidate) && field.hints.includes(key(candidate))) || ''
    if (header) used.add(header)
    return [field.key, header]
  }))
}

function percent(value) {
  return value === null || value === undefined ? '—' : `${(value * 100).toFixed(1)}%`
}

function RateCard({ label, stats }) {
  return (
    <div className="rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--faint)' }}>{label}</p>
      <p className="mt-2 font-display text-3xl tabular-nums" style={{ color: 'var(--text)' }}>{percent(stats.winRate)}</p>
      <p className="mt-1 text-xs tabular-nums" style={{ color: 'var(--muted)' }}>{stats.wins}–{stats.losses} · {stats.games} games</p>
    </div>
  )
}

function RateTable({ title, rows, columns }) {
  return (
    <section className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
      <h2 className="px-5 py-4 font-display text-lg" style={{ color: 'var(--text)' }}>{title}</h2>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead style={{ background: 'var(--panel-2)', color: 'var(--faint)' }}>
              <tr>{columns.map((column) => <th key={column.key} className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider">{column.label}</th>)}<th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider">Record</th><th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider">Win rate</th></tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
              {rows.map((row) => (
                <tr key={row.label}>
                  {columns.map((column) => <td key={column.key} className="px-5 py-3" style={{ color: 'var(--text)' }}>{row[column.key] || '—'}</td>)}
                  <td className="px-5 py-3 text-right tabular-nums" style={{ color: 'var(--muted)' }}>{row.wins}–{row.losses}</td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums" style={{ color: 'var(--sapphire)' }}>{percent(row.winRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="px-5 pb-5 text-sm" style={{ color: 'var(--muted)' }}>No mapped data is available for this breakdown.</p>}
    </section>
  )
}

export default function PerformancePage() {
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])
  const [headers, setHeaders] = useState([])
  const [mapping, setMapping] = useState({})
  const [dashboardMapping, setDashboardMapping] = useState(null)
  const [error, setError] = useState('')

  async function loadFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const parsed = parseCsv(await file.text())
      const detected = parsed.length ? Object.keys(parsed[0]) : []
      if (!detected.length) throw new Error('The CSV needs a header row and at least one data row.')
      setFileName(file.name)
      setRows(parsed)
      setHeaders(detected)
      setMapping(suggestedMapping(detected))
      setDashboardMapping(null)
      setError('')
    } catch (caught) {
      setFileName('')
      setRows([])
      setHeaders([])
      setDashboardMapping(null)
      setError(caught instanceof Error ? caught.message : 'Could not read that CSV.')
    } finally {
      event.target.value = ''
    }
  }

  const normalizedRows = useMemo(() => rows.map((row) => Object.fromEntries(FIELDS.map((field) => [field.key, dashboardMapping?.[field.key] ? row[dashboardMapping[field.key]] : '']))), [rows, dashboardMapping])
  const stats = useMemo(() => calculatePerformanceStats(normalizedRows), [normalizedRows])
  const chartData = stats.timeSeries.map((point) => ({ ...point, cumulative: point.cumulativeWinRate * 100, rolling: point.rollingWinRate * 100 }))

  return (
    <div className="mx-auto max-w-6xl py-4 sm:py-8">
      <div className="max-w-2xl">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--muted)' }}>Competitive tool</div>
        <h1 className="font-display mt-3 text-4xl" style={{ fontWeight: 560, color: 'var(--text)' }}>Performance Analyzer</h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>Upload game history, match its columns to the fields below, and explore deck and matchup results. Your file stays in this browser.</p>
      </div>

      <section className="mt-8 rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
        <div className="flex flex-wrap items-center gap-4">
          <label className="cursor-pointer rounded-md px-4 py-2 text-sm font-semibold" style={{ background: 'var(--sapphire)', color: 'white' }}>
            Choose CSV
            <input type="file" accept=".csv,text/csv" onChange={loadFile} className="sr-only" />
          </label>
          <span className="text-sm" style={{ color: 'var(--muted)' }}>{fileName || 'No file selected'}</span>
        </div>
        {error && <p className="mt-3 text-sm" role="alert" style={{ color: 'var(--ruby)' }}>{error}</p>}
      </section>

      {headers.length > 0 && !dashboardMapping ? (
        <section className="mt-6 rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
          <h2 className="font-display text-xl" style={{ color: 'var(--text)' }}>Map your columns</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>Only Result is required. Unmapped analytics are left empty.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((field) => (
              <label key={field.key} className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                {field.label}{field.key === 'result' ? ' *' : ''}
                <select value={mapping[field.key] || ''} onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value }))} className="mt-1.5 w-full rounded-md border px-3 py-2" style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--text)' }}>
                  <option value="">Not mapped</option>
                  {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                </select>
              </label>
            ))}
          </div>
          <button type="button" disabled={!mapping.result} onClick={() => setDashboardMapping({ ...mapping })} className="mt-5 rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40" style={{ background: 'var(--sapphire)', color: 'white' }}>Analyze {rows.length} rows</button>
        </section>
      ) : null}

      {dashboardMapping ? (
        <div className="mt-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{stats.overall.games} valid games{stats.ignoredRows ? ` · ${stats.ignoredRows} rows ignored` : ''}</p>
            <button type="button" onClick={() => setDashboardMapping(null)} className="rounded-md border px-3 py-2 text-sm font-semibold" style={{ borderColor: 'var(--line-2)', color: 'var(--text)' }}>Edit mapping</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <RateCard label="Overall" stats={stats.overall} />
            <RateCard label="On the play" stats={stats.playDraw.play} />
            <RateCard label="On the draw" stats={stats.playDraw.draw} />
          </div>

          <section className="rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-display text-lg" style={{ color: 'var(--text)' }}>Win-rate trend</h2><p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>Cumulative rate and rolling five-game average.</p></div>
              {stats.tilt.triggered ? <span className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: 'var(--ruby)', color: 'var(--ruby)' }}>Tilt signal: {stats.tilt.maxConsecutiveLosses} consecutive losses</span> : null}
            </div>
            {chartData.length ? (
              <div className="mt-5 h-72" aria-label="Win rate trend chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 12, bottom: 5, left: 0 }}>
                    <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 11 }} minTickGap={24} />
                    <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: 'var(--muted)', fontSize: 11 }} width={42} />
                    <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} contentStyle={{ background: 'var(--panel)', borderColor: 'var(--line-2)', color: 'var(--text)' }} />
                    <Legend />
                    <Line type="monotone" dataKey="cumulative" name="Cumulative" stroke="var(--sapphire)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="rolling" name="Rolling 5" stroke="var(--amethyst)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="mt-4 text-sm" style={{ color: 'var(--muted)' }}>No recognized win/loss results were found.</p>}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <RateTable title="By my deck" rows={stats.byDeck} columns={[{ key: 'deck', label: 'Deck' }]} />
            <RateTable title="By matchup" rows={stats.byMatchup} columns={[{ key: 'myDeck', label: 'My deck' }, { key: 'opponentDeck', label: 'Opponent' }]} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
