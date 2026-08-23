import InkFilter from './filters/InkFilter.jsx'
import CostFilter from './filters/CostFilter.jsx'
import TypeFilter from './filters/TypeFilter.jsx'
import MoreFilters from './filters/MoreFilters.jsx'
import { FORMATS, CORE_SET_NUMS } from '../../lib/filters/filterModel.js'

const CORE_RANGE = (() => {
  const nums = [...CORE_SET_NUMS].sort((a, b) => a - b)
  return `sets ${nums[0]}–${nums[nums.length - 1]}`
})()

const FORMAT_OPTIONS = [
  { label: 'Core', value: FORMATS.CORE, hint: CORE_RANGE },
  { label: 'Infinity', value: FORMATS.INFINITY, hint: 'all sets' },
]

const INKABLE_OPTIONS = [
  { label: 'Any inkability', value: 'any' },
  { label: 'Inkable only', value: 'yes' },
  { label: 'Uninkable only', value: 'no' },
]

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
        {title}
      </h3>
      {children}
    </section>
  )
}

function FormatFilter({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-1" role="group" aria-label="Format">
      {FORMAT_OPTIONS.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            aria-label={`${option.label} format`}
            title={option.hint}
            onClick={() => onChange({ type: 'SET_GAMEMODE', value: option.value })}
            className="rounded-md border px-2 py-1.5 text-center text-xs font-medium"
            style={{
              background: active ? 'var(--sapphire)' : 'var(--canvas)',
              borderColor: active ? 'var(--sapphire)' : 'var(--line)',
              color: active ? 'var(--canvas)' : 'var(--text)',
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function InkableFilter({ value, onChange }) {
  return (
    <div className="grid gap-1" role="group" aria-label="Inkability">
      {INKABLE_OPTIONS.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange({ type: 'SET_INKABLE', value: option.value })}
            className="rounded-md border px-2 py-1.5 text-left text-xs"
            style={{
              background: active ? 'var(--sapphire)' : 'var(--canvas)',
              borderColor: active ? 'var(--sapphire)' : 'var(--line)',
              color: active ? 'var(--canvas)' : 'var(--text)',
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export default function FilterRail({ filters, onChange, activeCount, onClear }) {
  return (
    <aside
      aria-label="Filters"
      className="space-y-5 rounded-lg border p-3"
      style={{ background: 'var(--canvas)', borderColor: 'var(--line)', color: 'var(--text)' }}
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Filters</h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-md border px-2 py-1 text-xs"
            style={{ background: 'var(--canvas)', borderColor: 'var(--line)', color: 'var(--muted)' }}
          >
            Clear {activeCount}
          </button>
        )}
      </header>

      <Section title="Format">
        <FormatFilter value={filters?.gamemode} onChange={onChange} />
      </Section>

      <Section title="Ink">
        <InkFilter inks={filters.inks} onChange={onChange} />
      </Section>
      <Section title="Cost">
        <CostFilter selectedCosts={filters.selectedCosts} onChange={onChange} />
      </Section>
      <Section title="Type">
        <TypeFilter types={filters.types} onChange={onChange} />
      </Section>
      <Section title="Inkability">
        <InkableFilter value={filters.inkable} onChange={onChange} />
      </Section>
      <MoreFilters filters={filters} onChange={onChange} />
    </aside>
  )
}
