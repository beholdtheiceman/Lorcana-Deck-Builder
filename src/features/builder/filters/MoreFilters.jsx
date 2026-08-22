const RARITIES = ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary']
const KEYWORDS = ['Evasive', 'Rush', 'Singer', 'Support', 'Ward']

const controlStyle = {
  background: 'var(--canvas)',
  borderColor: 'var(--line)',
  color: 'var(--text)',
}

function ToggleGroup({ label, values, selected, actionKey, actionType, onChange }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs" style={{ color: 'var(--muted)' }}>{label}</p>
      <div className="flex flex-wrap gap-1">
        {values.map((value) => {
          const active = selected?.has(value) ?? false
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ type: actionType, [actionKey]: value })}
              className="rounded-full border px-2 py-1 text-xs"
              style={active ? {
                background: 'var(--sapphire)',
                borderColor: 'var(--sapphire)',
                color: 'var(--canvas)',
              } : controlStyle}
            >
              {value}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function MoreFilters({ filters, onChange }) {
  return (
    <details className="border-t pt-3" style={{ borderColor: 'var(--line)' }}>
      <summary className="cursor-pointer text-xs font-semibold" style={{ color: 'var(--text)' }}>
        More filters
      </summary>
      <div className="mt-3 space-y-3">
        <ToggleGroup label="Rarity" values={RARITIES} selected={filters.rarities} actionKey="rarity" actionType="TOGGLE_RARITY" onChange={onChange} />
        <label className="block text-xs" style={{ color: 'var(--muted)' }}>
          Set number
          <input
            type="text"
            value={filters.setNumber}
            onChange={(event) => onChange({ type: 'SET_SET_NUMBER', value: event.target.value })}
            className="mt-1 h-8 w-full rounded-md border px-2"
            style={controlStyle}
          />
        </label>
        <ToggleGroup label="Keywords" values={KEYWORDS} selected={filters.abilities} actionKey="ability" actionType="TOGGLE_ABILITY" onChange={onChange} />
        <label className="block text-xs" style={{ color: 'var(--muted)' }}>
          Franchise
          <input
            type="text"
            value={filters.franchise}
            onChange={(event) => onChange({ type: 'SET_FRANCHISE', value: event.target.value })}
            className="mt-1 h-8 w-full rounded-md border px-2"
            style={controlStyle}
          />
        </label>
      </div>
    </details>
  )
}
