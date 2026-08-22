import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterSheet, DeckSheet } from '../features/builder/MobileSheets.jsx'

describe('FilterSheet', () => {
  it('is not rendered when closed', () => {
    render(<FilterSheet open={false} onClose={vi.fn()}><p>rail</p></FilterSheet>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders as a labelled modal dialog when open', () => {
    render(<FilterSheet open onClose={vi.fn()}><p>rail</p></FilterSheet>)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName(/filters/i)
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(<FilterSheet open onClose={onClose}><p>rail</p></FilterSheet>)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('closes from the close control', async () => {
    const onClose = vi.fn()
    render(<FilterSheet open onClose={onClose}><p>rail</p></FilterSheet>)
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders its children', () => {
    render(<FilterSheet open onClose={vi.fn()}><p>rail contents</p></FilterSheet>)
    expect(screen.getByText('rail contents')).toBeInTheDocument()
  })
})

describe('DeckSheet', () => {
  it('renders as a labelled modal dialog when open', () => {
    render(<DeckSheet open onClose={vi.fn()}><p>deck</p></DeckSheet>)
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/deck/i)
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(<DeckSheet open onClose={onClose}><p>deck</p></DeckSheet>)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
