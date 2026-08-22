import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InspectCardModal from '../features/builder/results/InspectCardModal.jsx'

const card = {
  id: '1',
  name: 'Cinderella',
  subtitle: 'Ballroom Sensation',
  cost: 2,
  inks: ['Amethyst'],
  type: 'Character',
  rarity: 'Super Rare',
  setName: 'The First Chapter',
  text: 'Shift 4 (You may pay 4 ink to play this on top of one of your characters named Cinderella.)',
  strength: 2,
  willpower: 2,
  lore: 2,
  inkable: true,
}

const setup = (props = {}) => {
  const onClose = vi.fn()
  const onSetCount = vi.fn()
  render(
    <InspectCardModal card={card} deckCount={0} onClose={onClose} onSetCount={onSetCount} {...props} />
  )
  return { onClose, onSetCount }
}

describe('InspectCardModal', () => {
  it('renders nothing without a card', () => {
    render(<InspectCardModal card={null} onClose={vi.fn()} onSetCount={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders a labelled modal dialog naming the card', () => {
    setup()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName(/Cinderella/)
  })

  it('shows the rules text, which is the point of inspecting', () => {
    setup()
    expect(screen.getByText(/You may pay 4 ink to play this/)).toBeInTheDocument()
  })

  it('shows cost, type, rarity and set', () => {
    setup()
    expect(screen.getByText('Super Rare')).toBeInTheDocument()
    expect(screen.getByText('The First Chapter')).toBeInTheDocument()
    expect(screen.getByText('Character')).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const { onClose } = setup()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('closes from the close control', async () => {
    const { onClose } = setup()
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('adds a copy from the modal', async () => {
    const { onSetCount } = setup({ deckCount: 1 })
    await userEvent.click(screen.getByRole('button', { name: /add a copy/i }))
    expect(onSetCount).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }), 2)
  })

  it('removes a copy from the modal', async () => {
    const { onSetCount } = setup({ deckCount: 3 })
    await userEvent.click(screen.getByRole('button', { name: /remove a copy/i }))
    expect(onSetCount).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }), 2)
  })

  it('reports how many copies are in the deck', () => {
    setup({ deckCount: 3 })
    expect(screen.getByText(/3\s*\/\s*4/)).toBeInTheDocument()
  })

  it('does not offer a fifth copy at the 4-copy limit', async () => {
    const { onSetCount } = setup({ deckCount: 4 })
    await userEvent.click(screen.getByRole('button', { name: /add a copy/i }))
    expect(onSetCount).not.toHaveBeenCalled()
  })
})
