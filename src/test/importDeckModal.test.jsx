import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImportDeckModal from '../features/builder/ImportDeckModal.jsx'
import BuilderPage from '../features/builder/BuilderPage.jsx'

const POOL = [
  { id: '1', name: 'Cinderella - Ballroom Sensation', baseName: 'Cinderella', subname: 'Ballroom Sensation', cost: 2, inks: ['Amethyst'], type: 'Character', inkable: true, setNum: 9 },
  { id: '2', name: 'Mulan - Imperial Soldier', baseName: 'Mulan', subname: 'Imperial Soldier', cost: 3, inks: ['Ruby'], type: 'Character', inkable: false, setNum: 9 },
]

vi.mock('../features/builder/hooks/useCardPool.js', () => ({
  default: () => ({
    cards: [{ id: '1', name: 'Cinderella', subtitle: 'Ballroom Sensation', cost: 2, inks: ['Amethyst'], type: 'Character', inkable: true }],
    loading: false, error: null, retry: vi.fn(),
  }),
}))

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
})

const setup = (props = {}) => {
  const onImport = vi.fn()
  const onClose = vi.fn()
  render(<ImportDeckModal open cards={POOL} onClose={onClose} onImport={onImport} {...props} />)
  return { onImport, onClose }
}

describe('ImportDeckModal', () => {
  it('renders nothing when closed', () => {
    render(<ImportDeckModal open={false} cards={POOL} onClose={vi.fn()} onImport={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('is a labelled modal dialog', () => {
    setup()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName(/import a deck/i)
  })

  it('cannot preview an empty box', () => {
    setup()
    expect(screen.getByRole('button', { name: /preview/i })).toBeDisabled()
  })

  it('cannot import before previewing', () => {
    setup()
    expect(screen.getByRole('button', { name: /^import$/i })).toBeDisabled()
  })

  it('reports how many cards the paste produced', async () => {
    setup()
    await userEvent.type(screen.getByLabelText(/paste a decklist/i), '4 Cinderella - Ballroom Sensation')
    await userEvent.click(screen.getByRole('button', { name: /preview/i }))
    await waitFor(() => expect(screen.getByText((_, el) => el?.tagName === 'P' && /^4 cards/.test(el.textContent.trim()))).toBeInTheDocument())
  })

  // The parser used to compute unmatched lines and only console.log them, so a
  // typo silently vanished from the imported deck.
  it('names the lines it could not resolve instead of dropping them silently', async () => {
    setup()
    await userEvent.type(
      screen.getByLabelText(/paste a decklist/i),
      '4 Cinderella - Ballroom Sensation\n3 Notacard - Nowhere'
    )
    await userEvent.click(screen.getByRole('button', { name: /preview/i }))
    await waitFor(() => expect(screen.getByText(/not recognised/i)).toBeInTheDocument())
    // Scope to the unmatched list: the pasted text is still in the textarea.
    expect(within(screen.getByRole('list')).getByText(/Notacard/)).toBeInTheDocument()
  })

  it('says unrecognised lines become placeholders rather than vanishing', async () => {
    setup()
    await userEvent.type(
      screen.getByLabelText(/paste a decklist/i),
      '4 Cinderella - Ballroom Sensation\n3 Notacard - Nowhere'
    )
    await userEvent.click(screen.getByRole('button', { name: /preview/i }))
    await waitFor(() => expect(screen.getByText(/placeholder cards you can/i)).toBeInTheDocument())
  })

  it('warns that importing replaces the current deck', async () => {
    setup({ currentDeckTotal: 42 })
    await userEvent.type(screen.getByLabelText(/paste a decklist/i), '4 Cinderella - Ballroom Sensation')
    await userEvent.click(screen.getByRole('button', { name: /preview/i }))
    await waitFor(() => expect(screen.getByText(/replaces your current deck of 42 cards/i)).toBeInTheDocument())
  })

  it('surfaces a parse failure rather than throwing', async () => {
    setup()
    await userEvent.type(screen.getByLabelText(/paste a decklist/i), 'nonsense without counts')
    await userEvent.click(screen.getByRole('button', { name: /preview/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })

  it('imports a clean deck without the internal report attached', async () => {
    const { onImport } = setup()
    await userEvent.type(screen.getByLabelText(/paste a decklist/i), '4 Cinderella - Ballroom Sensation')
    await userEvent.click(screen.getByRole('button', { name: /preview/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /^import$/i })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: /^import$/i }))

    expect(onImport).toHaveBeenCalled()
    const imported = onImport.mock.calls[0][0]
    expect(imported).toHaveProperty('entries')
    expect(imported).not.toHaveProperty('_report')
  })

  it('closes on Escape', async () => {
    const { onClose } = setup()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})

describe('reaching import from the builder', () => {
  it('opens the import dialog from the deck panel', async () => {
    render(<BuilderPage />)
    const panel = screen.getByRole('complementary', { name: /deck/i })
    await userEvent.click(within(panel).getByRole('button', { name: /^import$/i }))
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toHaveAccessibleName(/import a deck/i))
  })
})
