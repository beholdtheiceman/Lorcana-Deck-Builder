import { renderHook, act, waitFor } from '@testing-library/react'
import useDeckSave from '../features/builder/hooks/useDeckSave.js'
import { deckReducer } from '../lib/deck/deckReducer.js'
import { createNewDeck } from '../lib/deck/storage.js'

const ok = (id = 'clx_1') => ({ ok: true, status: 200, json: async () => ({ deck: { id } }) })

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('save status after a successful save', () => {
  // Storing the returned database id dispatches UPDATE_METADATA, which stamps a
  // fresh updatedAt. Comparing updatedAt made that look like a user edit, so the
  // first Save reported "unsaved changes" even though it had succeeded.
  it('stays saved when the db id is written back to the deck', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok('clx_abc')))
    let deck = createNewDeck('Ruby Aggro')

    const { result, rerender } = renderHook(
      ({ d }) => useDeckSave(d, { isAuthenticated: true, onSaved: (dbId) => {
        deck = deckReducer(deck, { type: 'UPDATE_METADATA', updates: { _dbId: dbId } })
      } }),
      { initialProps: { d: deck } }
    )

    await act(async () => { await result.current.save() })
    rerender({ d: deck })

    await waitFor(() => expect(result.current.status).toBe('saved'))
  })

  it('does not treat a metadata-only change as an edit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok()))
    const base = createNewDeck('Ruby Aggro')
    const { result, rerender } = renderHook(
      ({ d }) => useDeckSave(d, { isAuthenticated: true }),
      { initialProps: { d: base } }
    )
    await act(async () => { await result.current.save() })

    rerender({ d: { ...base, _dbId: 'clx_1', updatedAt: base.updatedAt + 5000 } })
    expect(result.current.status).toBe('saved')
  })

  it('still reports unsaved when the deck actually changes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok()))
    const base = createNewDeck('Ruby Aggro')
    const { result, rerender } = renderHook(
      ({ d }) => useDeckSave(d, { isAuthenticated: true }),
      { initialProps: { d: base } }
    )
    await act(async () => { await result.current.save() })

    const card = { id: 'c1', name: 'Cinderella', cost: 2, inks: ['Amethyst'], type: 'Character' }
    rerender({ d: deckReducer(base, { type: 'ADD', card, count: 1 }) })
    expect(result.current.status).toBe('unsaved')
  })

  it('reports unsaved after a rename', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok()))
    const base = createNewDeck('Ruby Aggro')
    const { result, rerender } = renderHook(
      ({ d }) => useDeckSave(d, { isAuthenticated: true }),
      { initialProps: { d: base } }
    )
    await act(async () => { await result.current.save() })

    rerender({ d: deckReducer(base, { type: 'SET_NAME', name: 'Amethyst Control' }) })
    expect(result.current.status).toBe('unsaved')
  })
})

describe('save under StrictMode', () => {
  it('completes rather than sticking on Saving', async () => {
    const { StrictMode } = await import('react')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok()))
    const deck = createNewDeck('Ruby Aggro')
    const { result } = renderHook(
      () => useDeckSave(deck, { isAuthenticated: true }),
      { wrapper: ({ children }) => <StrictMode>{children}</StrictMode> }
    )
    await act(async () => { await result.current.save() })
    await waitFor(() => expect(result.current.status).toBe('saved'))
  })
})
