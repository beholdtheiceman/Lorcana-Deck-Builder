import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CardResults from '../features/builder/CardResults.jsx'

// Rendering every match put >1,000 tiles and images in the document, pushing it
// past 10,000 nodes and making every interaction on the page slow.
const many = (n) => Array.from({ length: n }, (_, i) => ({
  id: String(i), name: `Card ${i}`, subtitle: 'Sub', cost: 2,
  inks: ['Amethyst'], type: 'Character', inkable: true,
}))

const emptyFilters = {
  text: '', inks: new Set(), selectedCosts: new Set(), types: new Set(),
  rarities: new Set(), sets: new Set(), classifications: new Set(),
  abilities: new Set(), inkable: 'any', setNumber: '', franchise: '', gamemode: '',
}

const setup = (count) => render(
  <CardResults cards={many(count)} deck={{ entries: {}, total: 0 }} filters={emptyFilters}
    loading={false} error={null} onSearch={vi.fn()} onAdd={vi.fn()} onInspect={vi.fn()} onRetry={vi.fn()} />
)

describe('CardResults paging', () => {
  it('caps how many tiles it renders', () => {
    setup(500)
    expect(screen.getAllByRole('article').length).toBeLessThanOrEqual(60)
  })

  it('still reports the full match count', () => {
    setup(500)
    expect(screen.getByText(/500 cards/)).toBeInTheDocument()
  })

  it('offers a way to reach the rest', () => {
    setup(500)
    expect(screen.getByRole('button', { name: /show more \(440 left\)/i })).toBeInTheDocument()
  })

  it('reveals more on demand', async () => {
    setup(500)
    await userEvent.click(screen.getByRole('button', { name: /show more/i }))
    expect(screen.getAllByRole('article').length).toBe(120)
  })

  it('does not page when everything already fits', () => {
    setup(10)
    expect(screen.getAllByRole('article').length).toBe(10)
    expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument()
  })
})
