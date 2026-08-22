const INKS = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel']

export default function InkFilter({ inks, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Ink colors">
      {INKS.map((ink) => {
        const active = inks?.has(ink) ?? false
        return (
          <button
            key={ink}
            type="button"
            aria-label={ink}
            aria-pressed={active}
            onClick={() => onChange({ type: 'TOGGLE_INK', ink })}
            className="h-8 w-9 justify-self-center transition-opacity"
            style={{
              background: `var(--${ink.toLowerCase()})`,
              clipPath: 'var(--hex)',
              opacity: active ? 1 : 0.28,
            }}
          />
        )
      })}
    </div>
  )
}
