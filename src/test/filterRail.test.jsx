// src/test/filterRail.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FilterRail from '../features/builder/FilterRail.jsx'

const baseFilters = {
  text: '', inks: new Set(), rarities: new Set(), types: new Set(),
  sets: new Set(), classifications: new Set(), abilities: new Set(),
  selectedCosts: new Set(), inkable: 'any',
  sortBy: 'ink-set-number', sortDir: 'asc',
  setNumber: '', franchise: '', gamemode: '',
  loreMin: '', loreMax: '', willpowerMin: '', willpowerMax: '', strengthMin: '', strengthMax: '',
}

const setup = (overrides = {}) => {
  const onChange = vi.fn()
  const onClear = vi.fn()
  render(
    <FilterRail
      filters={{ ...baseFilters, ...overrides.filters }}
      onChange={onChange}
      activeCount={overrides.activeCount ?? 0}
      onClear={onClear}
    />
  )
  return { onChange, onClear }
}

describe('FilterRail', () => {
  it('renders all six ink toggles with accessible names', () => {
    setup()
    for (const ink of ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel']) {
      expect(screen.getByRole('button', { name: ink })).toBeInTheDocument()
    }
  })

  it('dispatches TOGGLE_INK when an ink is clicked', async () => {
    const { onChange } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Ruby' }))
    expect(onChange).toHaveBeenCalledWith({ type: 'TOGGLE_INK', ink: 'Ruby' })
  })

  it('marks an active ink as pressed', () => {
    setup({ filters: { inks: new Set(['Ruby']) } })
    expect(screen.getByRole('button', { name: 'Ruby' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Amber' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('dispatches TOGGLE_COST when a cost is clicked', async () => {
    const { onChange } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Cost 3' }))
    expect(onChange).toHaveBeenCalledWith({ type: 'TOGGLE_COST', cost: 3 })
  })

  it('dispatches SET_INKABLE from the tri-state control', async () => {
    const { onChange } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Inkable only' }))
    expect(onChange).toHaveBeenCalledWith({ type: 'SET_INKABLE', value: 'yes' })
  })

  it('hides the clear control when nothing is active', () => {
    setup({ activeCount: 0 })
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument()
  })

  it('shows the active count and calls onClear', async () => {
    const { onClear } = setup({ activeCount: 3 })
    const clear = screen.getByRole('button', { name: /clear 3/i })
    await userEvent.click(clear)
    expect(onClear).toHaveBeenCalled()
  })
})
