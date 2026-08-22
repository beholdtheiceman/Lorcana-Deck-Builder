const COSTS = Array.from({ length: 10 }, (_, index) => index + 1)

export default function CostFilter({ selectedCosts, onChange }) {
  return (
    <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Card cost">
      {COSTS.map((cost) => {
        const active = selectedCosts?.has(cost) ?? false
        return (
          <button
            key={cost}
            type="button"
            aria-label={`Cost ${cost}`}
            aria-pressed={active}
            onClick={() => onChange({ type: 'TOGGLE_COST', cost })}
            className="h-7 rounded-md border text-xs font-semibold transition-opacity"
            style={{
              background: active ? 'var(--sapphire)' : 'var(--canvas)',
              borderColor: active ? 'var(--sapphire)' : 'var(--line)',
              color: active ? 'var(--canvas)' : 'var(--text)',
            }}
          >
            {cost === 10 ? '10+' : cost}
          </button>
        )
      })}
    </div>
  )
}
