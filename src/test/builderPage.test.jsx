import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BuilderPage from '../features/builder/BuilderPage.jsx'

vi.mock('../features/builder/hooks/useCardPool.js', () => ({
  default: () => ({
    cards: [
      { id: '1', name: 'Cinderella', subtitle: 'Ballroom Sensation', cost: 2, inks: ['Amethyst'], type: 'Character', inkable: true },
      { id: '2', name: 'Mulan', subtitle: 'Imperial Soldier', cost: 3, inks: ['Ruby'], type: 'Character', inkable: false },
    ],
    loading: false, error: null, retry: vi.fn(),
  }),
}))

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
})

describe('BuilderPage', () => {
  it('renders all three panes', async () => {
    render(<BuilderPage />)
    expect(screen.getByRole('complementary', { name: /filters/i })).toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: /rename deck/i })).toBeInTheDocument())
  })

  // The mobile deck pill mirrors the panel's name and count. jsdom does not
  // apply Tailwind, so `lg:hidden` does not hide it and both are in the DOM —
  // scope deck assertions to the panel itself.
  const deckPanel = () => within(screen.getByRole('complementary', { name: /deck/i }))

  it('adding a card updates the deck panel total', async () => {
    render(<BuilderPage />)
    await userEvent.click(screen.getByRole('button', { name: /add Cinderella/i }))
    await waitFor(() => expect(deckPanel().getByText(/1\s*\/\s*60/)).toBeInTheDocument())
  })

  it('filtering by ink narrows the results', async () => {
    render(<BuilderPage />)
    expect(screen.getByText('Mulan')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Amethyst' }))
    await waitFor(() => expect(screen.queryByText('Mulan')).not.toBeInTheDocument())
    expect(screen.getByText('Cinderella')).toBeInTheDocument()
  })

  it('clearing filters restores every card', async () => {
    render(<BuilderPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Amethyst' }))
    await waitFor(() => expect(screen.queryByText('Mulan')).not.toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /clear 1/i }))
    await waitFor(() => expect(screen.getByText('Mulan')).toBeInTheDocument())
  })

  it('renaming the deck updates the visible title', async () => {
    render(<BuilderPage />)
    await userEvent.click(deckPanel().getByRole('button', { name: /rename deck/i }))
    const input = deckPanel().getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, 'My New Deck{Enter}')
    await waitFor(() => expect(deckPanel().getByText('My New Deck')).toBeInTheDocument())
  })

  it('searching narrows the results', async () => {
    render(<BuilderPage />)
    await userEvent.type(screen.getByRole('searchbox'), 'mulan')
    await waitFor(() => expect(screen.queryByText('Cinderella')).not.toBeInTheDocument())
    expect(screen.getByText('Mulan')).toBeInTheDocument()
  })
})
