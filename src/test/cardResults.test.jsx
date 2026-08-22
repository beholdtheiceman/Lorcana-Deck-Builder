import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CardResults from '../features/builder/CardResults.jsx'

const cards = [
  { id: '1', name: 'Cinderella', subtitle: 'Ballroom Sensation', cost: 2, inks: ['Amethyst'], type: 'Character' },
  { id: '2', name: 'Mulan', subtitle: 'Imperial Soldier', cost: 3, inks: ['Ruby'], type: 'Character' },
]
const emptyFilters = {
  text: '', inks: new Set(), selectedCosts: new Set(), types: new Set(),
  rarities: new Set(), sets: new Set(), classifications: new Set(), abilities: new Set(),
  inkable: 'any', setNumber: '', franchise: '', gamemode: '',
}
const emptyDeck = { entries: {}, total: 0 }

const setup = (props = {}) => {
  const onAdd = vi.fn()
  const onRetry = vi.fn()
  const onSearch = vi.fn()
  render(
    <CardResults
      cards={cards} deck={emptyDeck} filters={emptyFilters}
      loading={false} error={null}
      onAdd={onAdd} onInspect={vi.fn()} onRetry={onRetry} onSearch={onSearch}
      {...props}
    />
  )
  return { onAdd, onRetry, onSearch }
}

describe('CardResults', () => {
  it('renders a tile per card', () => {
    setup()
    expect(screen.getByText('Cinderella')).toBeInTheDocument()
    expect(screen.getByText('Mulan')).toBeInTheDocument()
  })

  it('reports the result count', () => {
    setup()
    expect(screen.getByText(/2 cards/i)).toBeInTheDocument()
  })

  it('describes active filters in the summary', () => {
    setup({ filters: { ...emptyFilters, inks: new Set(['Ruby']) } })
    expect(screen.getByText(/Ruby/)).toBeInTheDocument()
  })

  it('calls onAdd when a tile is clicked', async () => {
    const { onAdd } = setup()
    await userEvent.click(screen.getByRole('button', { name: /add Cinderella/i }))
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }))
  })

  it('shows a count badge for a card already in the deck', () => {
    setup({ deck: { entries: { k: { card: cards[0], count: 3 } }, total: 3 } })
    expect(screen.getByLabelText(/Cinderella.*3 in deck/i)).toBeInTheDocument()
  })

  it('renders an empty state with no results', () => {
    setup({ cards: [] })
    expect(screen.getByText(/no cards match/i)).toBeInTheDocument()
  })

  it('renders an error state with a retry control', async () => {
    const { onRetry } = setup({ error: new Error('network down'), cards: [] })
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('calls onSearch as the user types', async () => {
    const { onSearch } = setup()
    await userEvent.type(screen.getByRole('searchbox'), 'mul')
    expect(onSearch).toHaveBeenCalled()
  })
})
