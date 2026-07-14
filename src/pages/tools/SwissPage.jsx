import { useEffect, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const DEFAULTS = {
  players: 64,
  rounds: 6,
  wins: 0,
  losses: 0,
  winProbability: 50,
  iterations: 10000,
  topN: 8,
  pointsThreshold: 12,
}

function percent(value, digits = 1) {
  return value == null ? '—' : `${(value * 100).toFixed(digits)}%`
}

function NumberField({ label, hint, value, onChange, min, max, step = 1 }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--faint)' }}>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border px-3 py-2.5 text-sm tabular-nums outline-none focus:ring-2"
        style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--text)', '--tw-ring-color': 'var(--sapphire)' }}
      />
      {hint ? <span className="mt-1 block text-xs" style={{ color: 'var(--faint)' }}>{hint}</span> : null}
    </label>
  )
}

function Stat({ label, value, detail }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--faint)' }}>{label}</div>
      <div className="mt-2 font-display text-2xl tabular-nums" style={{ color: 'var(--text)' }}>{value}</div>
      {detail ? <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{detail}</div> : null}
    </div>
  )
}

function ProbabilityTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border px-3 py-2 text-sm shadow-lg" style={{ borderColor: 'var(--line)', background: 'var(--panel)', color: 'var(--text)' }}>
      <div>{label} points</div>
      <div className="mt-1 font-semibold" style={{ color: 'var(--sapphire)' }}>{percent(payload[0].value, 2)}</div>
    </div>
  )
}

export default function SwissPage() {
  const [form, setForm] = useState(DEFAULTS)
  const [result, setResult] = useState(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const workerRef = useRef(null)

  useEffect(() => () => workerRef.current?.terminate(), [])

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function runSimulation(event) {
    event.preventDefault()
    setError('')

    const params = {
      players: Number(form.players),
      rounds: Number(form.rounds),
      record: { wins: Number(form.wins), losses: Number(form.losses) },
      winProbability: Number(form.winProbability) / 100,
      iterations: Number(form.iterations),
      topN: Number(form.topN),
      pointsThreshold: Number(form.pointsThreshold),
      seed: 20260713,
    }
    if (params.record.wins + params.record.losses > params.rounds) {
      setError('The current record cannot include more matches than the number of rounds.')
      return
    }
    if (typeof Worker === 'undefined') {
      setError('Web Workers are not available in this browser.')
      return
    }

    workerRef.current?.terminate()
    const worker = new Worker(new URL('../../workers/swiss.worker.js', import.meta.url), { type: 'module' })
    workerRef.current = worker
    setRunning(true)
    worker.onmessage = ({ data }) => {
      if (data.type === 'result') setResult(data.result)
      else setError(data.error || 'The simulation could not be completed.')
      setRunning(false)
      worker.terminate()
      workerRef.current = null
    }
    worker.onerror = () => {
      setError('The simulation worker stopped unexpectedly.')
      setRunning(false)
      worker.terminate()
      workerRef.current = null
    }
    worker.postMessage({ params })
  }

  return (
    <div className="mx-auto max-w-6xl py-4 sm:py-8">
      <div className="max-w-2xl">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--muted)' }}>Tournament tool</div>
        <h1 className="font-display mt-3 text-4xl" style={{ fontWeight: 560, color: 'var(--text)' }}>Swiss Tournament Simulator</h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          Estimate your final record, cut odds, and whether taking an intentional draw is safe.
        </p>
      </div>

      <form onSubmit={runSimulation} className="mt-8 rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField label="Players" value={form.players} onChange={(value) => setField('players', value)} min={2} max={512} />
          <NumberField label="Swiss rounds" value={form.rounds} onChange={(value) => setField('rounds', value)} min={1} max={20} />
          <NumberField label="Current wins" value={form.wins} onChange={(value) => setField('wins', value)} min={0} max={form.rounds} />
          <NumberField label="Current losses" value={form.losses} onChange={(value) => setField('losses', value)} min={0} max={form.rounds} />
          <NumberField label="Win probability" hint="Percent per remaining round" value={form.winProbability} onChange={(value) => setField('winProbability', value)} min={0} max={100} />
          <NumberField label="Iterations" value={form.iterations} onChange={(value) => setField('iterations', value)} min={100} max={100000} step={100} />
          <NumberField label="Cut size" hint="Top N places" value={form.topN} onChange={(value) => setField('topN', value)} min={1} max={form.players} />
          <NumberField label="Points threshold" hint="3 points per match win" value={form.pointsThreshold} onChange={(value) => setField('pointsThreshold', value)} min={0} max={Number(form.rounds) * 3} />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={running}
            className="rounded-md px-5 py-2.5 text-sm font-semibold disabled:cursor-wait disabled:opacity-60"
            style={{ background: 'var(--sapphire)', color: 'white' }}
          >
            {running ? 'Running simulation…' : 'Run simulation'}
          </button>
          {running ? <span role="status" className="text-sm" style={{ color: 'var(--muted)' }}>Calculating off the main thread.</span> : null}
          {error ? <span role="alert" className="text-sm" style={{ color: 'var(--ruby)' }}>{error}</span> : null}
        </div>
      </form>

      {result ? (
        <div className="mt-8 space-y-4" aria-live="polite">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Average finish" value={`${result.meanPoints.toFixed(1)} pts`} detail={`${result.remainingRounds} round${result.remainingRounds === 1 ? '' : 's'} remaining`} />
            <Stat label={`Top ${result.topN}`} value={percent(result.topNProbability)} detail="Estimated cut probability" />
            <Stat label={`${result.pointsThreshold}+ points`} value={percent(result.thresholdProbability)} detail="Points-threshold probability" />
            <Stat
              label="Approx. OMW% band"
              value={`${percent(result.omwBand.low, 0)}–${percent(result.omwBand.high, 0)}`}
              detail={`10th–90th percentile · median ${percent(result.omwBand.median)}`}
            />
          </div>

          <section className="rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg" style={{ color: 'var(--text)' }}>Final points distribution</h2>
              <span className="text-xs tabular-nums" style={{ color: 'var(--faint)' }}>{result.iterations.toLocaleString()} simulations</span>
            </div>
            <div className="mt-5 h-72" aria-label="Histogram of final points probabilities">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={result.histogram} margin={{ top: 4, right: 8, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="points" stroke="var(--faint)" tickLine={false} axisLine={false} label={{ value: 'Final points', position: 'insideBottom', offset: -5, fill: 'var(--faint)' }} />
                  <YAxis stroke="var(--faint)" tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round(value * 100)}%`} />
                  <Tooltip content={<ProbabilityTooltip />} />
                  <Bar dataKey="probability" fill="var(--sapphire)" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
            <h2 className="font-display text-lg" style={{ color: 'var(--text)' }}>Intentional-draw safety</h2>
            {result.intentionalDraw.drawProbability == null ? (
              <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>No rounds remain, so an intentional draw cannot be modeled.</p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Stat label="Draw next round" value={percent(result.intentionalDraw.drawProbability)} detail="Chance to make cut" />
                <Stat label="Play out" value={percent(result.intentionalDraw.playProbability)} detail="Chance to make cut" />
                <Stat
                  label="Model verdict"
                  value={result.intentionalDraw.safe ? 'Draw is safer' : 'Play is safer'}
                  detail={`${result.intentionalDraw.difference >= 0 ? '+' : ''}${percent(result.intentionalDraw.difference)} cut probability from drawing`}
                />
              </div>
            )}
            <p className="mt-4 text-xs leading-relaxed" style={{ color: 'var(--faint)' }}>
              Approximation: pairings are represented by an average 50% field, opponents’ match-win percentages are sampled independently with the one-third floor, and tied players are ordered by sampled OMW%. It does not reproduce a tournament’s exact pair-downs or other tie-breakers.
            </p>
          </section>
        </div>
      ) : null}
    </div>
  )
}
