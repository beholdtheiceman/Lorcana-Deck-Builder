import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DeckStatsModal from '../features/builder/DeckStatsModal.jsx'
import BuilderPage from '../features/builder/BuilderPage.jsx'

vi.mock('../features/builder/hooks/useCardPool.js', () => ({
  default: () => ({
    cards: [{ id: '1', name: 'Cinderella', subtitle: 'Ballroom Sensation', cost: 2, inks: ['Amethyst'], type: 'Character', inkable: true }],
    loading: false, error: null, retry: vi.fn(),
  }),
}))

const card = { id: '1', name: 'Cinderella', subtitle: 'Ballroom Sensation', cost: 2, inks: ['Amethyst'], type: 'Character', inkable: true }
const deck = { id: 'd1', name: 'Ruby Aggro', entries: { k: { card, count: 4 } }, total: 4 }

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
})

describe('DeckStatsModal', () => {
  it('renders nothing when closed', () => {
    render(<DeckStatsModal open={false} deck={deck} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('is a labelled modal dialog naming the deck', () => {
    render(<DeckStatsModal open deck={deck} onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName(/Ruby Aggro/)
  })

  it('reports the card total', () => {
    render(<DeckStatsModal open deck={deck} onClose={vi.fn()} />)
    expect(screen.getByText(/4 cards/)).toBeInTheDocument()
  })

  it('invites cards rather than rendering empty charts', () => {
    render(<DeckStatsModal open deck={{ ...deck, entries: {}, total: 0 }} onClose={vi.fn()} />)
    expect(screen.getByText(/add cards to see statistics/i)).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(<DeckStatsModal open deck={deck} onClose={onClose} />)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('closes from the close control', async () => {
    const onClose = vi.fn()
    render(<DeckStatsModal open deck={deck} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: /close deck statistics/i }))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('reaching deck stats from the builder', () => {
  it('opens full stats without leaving Deck Lab', async () => {
    render(<BuilderPage />)
    await userEvent.click(screen.getByRole('button', { name: /add Cinderella/i }))

    const panel = screen.getByRole('complementary', { name: /deck/i })
    await userEvent.click(within(panel).getByRole('button', { name: /deck stats/i }))

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })
})
