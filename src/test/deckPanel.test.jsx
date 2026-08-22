import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DeckPanel from '../features/builder/DeckPanel.jsx'

const card = { id: '1', name: 'Cinderella', subtitle: 'Ballroom Sensation', cost: 2, inks: ['Amethyst'], type: 'Character' }
const deck = { id: 'd1', name: 'Ruby Aggro', entries: { k: { card, count: 4 } }, total: 4 }
const stats = {
  total: 4,
  curve: [1, 2, 3, 4, 5, 6, 7].map((cost) => ({ cost, count: cost === 2 ? 4 : 0 })),
  avgCost: 2,
  inkable: { inkable: 4, uninkable: 0, ratio: 1 },
  byType: [{ type: 'Character', count: 4 }],
  inkSplit: [{ ink: 'Amethyst', count: 4 }],
}
const saved = { status: 'saved', lastSavedAt: Date.now(), retry: () => {} }

const setup = (props = {}) => {
  const onRename = vi.fn()
  const onSetCount = vi.fn()
  const onRemove = vi.fn()
  render(
    <DeckPanel deck={deck} stats={stats} saveStatus={saved}
      onRename={onRename} onSetCount={onSetCount} onRemove={onRemove} {...props} />
  )
  return { onRename, onSetCount, onRemove }
}

describe('DeckTitle', () => {
  it('shows the deck name without any interaction', () => {
    setup()
    expect(screen.getByText('Ruby Aggro')).toBeInTheDocument()
  })

  it('becomes an editable input on click', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /rename deck/i }))
    expect(screen.getByRole('textbox')).toHaveValue('Ruby Aggro')
  })

  it('commits the new name on Enter', async () => {
    const { onRename } = setup()
    await userEvent.click(screen.getByRole('button', { name: /rename deck/i }))
    const input = screen.getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, 'Amethyst Control{Enter}')
    expect(onRename).toHaveBeenCalledWith('Amethyst Control')
  })

  it('commits on blur', async () => {
    const { onRename } = setup()
    await userEvent.click(screen.getByRole('button', { name: /rename deck/i }))
    const input = screen.getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, 'Steel Ramp')
    await userEvent.tab()
    expect(onRename).toHaveBeenCalledWith('Steel Ramp')
  })

  it('cancels on Escape without renaming', async () => {
    const { onRename } = setup()
    await userEvent.click(screen.getByRole('button', { name: /rename deck/i }))
    const input = screen.getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, 'Discarded{Escape}')
    expect(onRename).not.toHaveBeenCalled()
    expect(screen.getByText('Ruby Aggro')).toBeInTheDocument()
  })

  it('falls back to Untitled Deck on an empty name', async () => {
    const { onRename } = setup()
    await userEvent.click(screen.getByRole('button', { name: /rename deck/i }))
    const input = screen.getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, '   {Enter}')
    expect(onRename).toHaveBeenCalledWith('Untitled Deck')
  })
})

describe('SaveStatus', () => {
  it('reports saved', () => {
    setup()
    expect(screen.getByText(/saved/i)).toBeInTheDocument()
  })

  it('offers a Save deck button', () => {
    setup()
    expect(screen.getByRole('button', { name: /save deck/i })).toBeInTheDocument()
  })

  it('calls onSave when Save deck is pressed', async () => {
    const onSave = vi.fn()
    setup({ onSave })
    await userEvent.click(screen.getByRole('button', { name: /save deck/i }))
    expect(onSave).toHaveBeenCalled()
  })

  it('surfaces a save failure with its message', () => {
    setup({ saveStatus: { status: 'error', error: new Error('Save failed (500)') } })
    expect(screen.getByText(/couldn't save/i)).toBeInTheDocument()
    expect(screen.getByText(/Save failed \(500\)/)).toBeInTheDocument()
  })

  it('flags unsaved changes after an edit', () => {
    setup({ saveStatus: { status: 'unsaved' } })
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
  })
})

describe('DeckPanel body', () => {
  it('shows the card total against the deck size', () => {
    setup()
    expect(screen.getByText(/4\s*\/\s*60/)).toBeInTheDocument()
  })

  it('lists deck entries with counts', () => {
    setup()
    expect(screen.getByText('Cinderella')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('shows stats without any interaction', () => {
    setup()
    expect(screen.getByText(/avg/i)).toBeInTheDocument()
    expect(screen.getByText(/inkable/i)).toBeInTheDocument()
  })

  it('calls onRemove from a row', async () => {
    const { onRemove } = setup()
    await userEvent.click(screen.getByRole('button', { name: /remove Cinderella/i }))
    expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }))
  })
})
