import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import BuilderPage from '../features/builder/BuilderPage.jsx'

vi.mock('../features/builder/hooks/useCardPool.js', () => ({
  default: () => ({
    cards: [{ id: '1', name: 'Cinderella', subtitle: 'Ballroom Sensation', cost: 2, inks: ['Amethyst'], type: 'Character', inkable: true }],
    loading: false, error: null, retry: vi.fn(),
  }),
}))

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname + location.search}</div>
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
})

const renderBuilder = () =>
  render(
    <MemoryRouter initialEntries={['/builder']}>
      <Routes>
        <Route path="/builder" element={<BuilderPage />} />
        <Route path="/my-decks" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  )

describe('Deck stats navigation', () => {
  it('sends the user to the deck page on My Decks', async () => {
    renderBuilder()
    const panel = screen.getByRole('complementary', { name: /deck/i })
    await userEvent.click(within(panel).getByRole('button', { name: /deck stats/i }))

    await waitFor(() => expect(screen.getByTestId('location')).toBeInTheDocument())
    expect(screen.getByTestId('location').textContent).toMatch(/^\/my-decks\?deck=/)
  })

  it('links to the deck currently open in the builder', async () => {
    renderBuilder()
    await userEvent.click(screen.getByRole('button', { name: /add Cinderella/i }))

    const currentId = JSON.parse(localStorage.getItem('lorcana.currentDeckId.v2'))
    const panel = screen.getByRole('complementary', { name: /deck/i })
    await userEvent.click(within(panel).getByRole('button', { name: /deck stats/i }))

    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe(
        `/my-decks?deck=${encodeURIComponent(currentId)}`
      ))
  })

  it('no longer opens a second stats surface inside the builder', async () => {
    renderBuilder()
    const panel = screen.getByRole('complementary', { name: /deck/i })
    await userEvent.click(within(panel).getByRole('button', { name: /deck stats/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
