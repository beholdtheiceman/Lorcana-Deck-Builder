import { render, screen, waitFor, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import BuilderPage from '../features/builder/BuilderPage.jsx'

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

const deckPanel = () => within(screen.getByRole('complementary', { name: /deck/i }))

describe('builder persistence', () => {
  it('survives a full unmount and remount', async () => {
    render(<MemoryRouter><BuilderPage /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: /add Cinderella/i }))
    await waitFor(() => expect(deckPanel().getByLabelText(/1 of 60 cards/)).toBeInTheDocument())

    await userEvent.click(deckPanel().getByRole('button', { name: /rename deck/i }))
    const input = deckPanel().getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, 'Persisted Deck{Enter}')
    await waitFor(() => expect(deckPanel().getByText('Persisted Deck')).toBeInTheDocument())

    cleanup()
    render(<MemoryRouter><BuilderPage /></MemoryRouter>)

    await waitFor(() => expect(deckPanel().getByText('Persisted Deck')).toBeInTheDocument())
    expect(deckPanel().getByLabelText(/1 of 60 cards/)).toBeInTheDocument()
  })
})
