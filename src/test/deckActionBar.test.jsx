import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DeckActionBar from '../components/deck/DeckActionBar.jsx'

const setup = (props = {}) => {
  const handlers = {
    onSave: vi.fn(),
    onDownloadImage: vi.fn(),
    onPrint: vi.fn(),
    onCopyDeckList: vi.fn(),
    onCopyLorcanito: vi.fn(),
    onCopyStats: vi.fn(),
  }
  render(<DeckActionBar {...handlers} {...props} />)
  return handlers
}

const teamHub = (overrides = {}) => ({
  hubs: [{ id: 'h1', name: 'Databorn' }],
  selectedId: '',
  onSelect: vi.fn(),
  onSave: vi.fn(),
  saving: false,
  loading: false,
  ...overrides,
})

describe('DeckActionBar', () => {
  it('shows one primary action and the rest quiet', () => {
    setup()
    expect(screen.getByRole('button', { name: /save deck/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download image/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^print$/i })).toBeInTheDocument()
  })

  it('collapses the three copy actions into one menu', async () => {
    setup()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^copy/i }))
    const menu = screen.getByRole('menu')
    expect(menu).toBeInTheDocument()
    expect(screen.getAllByRole('menuitem')).toHaveLength(3)
  })

  it('copies the deck list from the menu', async () => {
    const { onCopyDeckList } = setup()
    await userEvent.click(screen.getByRole('button', { name: /^copy/i }))
    await userEvent.click(screen.getByRole('menuitem', { name: /deck list/i }))
    expect(onCopyDeckList).toHaveBeenCalled()
  })

  it('copies the Lorcanito format from the menu', async () => {
    const { onCopyLorcanito } = setup()
    await userEvent.click(screen.getByRole('button', { name: /^copy/i }))
    await userEvent.click(screen.getByRole('menuitem', { name: /lorcanito/i }))
    expect(onCopyLorcanito).toHaveBeenCalled()
  })

  it('copies the stats summary from the menu', async () => {
    const { onCopyStats } = setup()
    await userEvent.click(screen.getByRole('button', { name: /^copy/i }))
    await userEvent.click(screen.getByRole('menuitem', { name: /stats/i }))
    expect(onCopyStats).toHaveBeenCalled()
  })

  it('confirms what was copied instead of leaving the press unacknowledged', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /^copy/i }))
    await userEvent.click(screen.getByRole('menuitem', { name: /deck list/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /copied deck list/i })).toBeInTheDocument())
  })

  it('closes the menu on Escape', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /^copy/i }))
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })

  it('saves the deck', async () => {
    const { onSave } = setup()
    await userEvent.click(screen.getByRole('button', { name: /save deck/i }))
    expect(onSave).toHaveBeenCalled()
  })

  it('blocks saving when the deck cannot be saved', async () => {
    const { onSave } = setup({ canSave: false })
    await userEvent.click(screen.getByRole('button', { name: /save deck/i }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('reports image generation in progress', () => {
    setup({ isGeneratingImage: true })
    expect(screen.getByRole('button', { name: /generating/i })).toBeDisabled()
  })

  it('prints', async () => {
    const { onPrint } = setup()
    await userEvent.click(screen.getByRole('button', { name: /^print$/i }))
    expect(onPrint).toHaveBeenCalled()
  })

  it('omits the Team Hub control when there is no hub context', () => {
    setup()
    expect(screen.queryByLabelText(/team hub/i)).not.toBeInTheDocument()
  })

  it('cannot add to a hub until one is chosen', () => {
    setup({ teamHub: teamHub() })
    expect(screen.getByRole('button', { name: /^add$/i })).toBeDisabled()
  })

  it('adds to the selected hub', async () => {
    const hub = teamHub({ selectedId: 'h1' })
    setup({ teamHub: hub })
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(hub.onSave).toHaveBeenCalled()
  })

  it('labels the hub select for assistive tech', () => {
    setup({ teamHub: teamHub() })
    expect(screen.getByLabelText(/team hub/i)).toBeInTheDocument()
  })
})
