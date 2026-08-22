const TYPES = ['Character', 'Action', 'Item', 'Location', 'Song']

export default function TypeFilter({ types, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Card type">
      {TYPES.map((cardType) => {
        const active = types?.has(cardType) ?? false
        return (
          <button
            key={cardType}
            type="button"
            aria-pressed={active}
            onClick={() => onChange({ type: 'TOGGLE_TYPE', cardType })}
            className="rounded-full border px-2 py-1 text-xs transition-opacity"
            style={{
              background: active ? 'var(--sapphire)' : 'var(--canvas)',
              borderColor: active ? 'var(--sapphire)' : 'var(--line)',
              color: active ? 'var(--canvas)' : 'var(--text)',
            }}
          >
            {cardType}
          </button>
        )
      })}
    </div>
  )
}
