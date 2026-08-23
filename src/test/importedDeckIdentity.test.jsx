import { renderHook, act, waitFor } from '@testing-library/react'
import { deckReducer } from '../lib/deck/deckReducer.js'
import { createNewDeck } from '../lib/deck/storage.js'
import useDeckSave from '../features/builder/hooks/useDeckSave.js'

// parseTextImport returns a bare { entries, total } object with no identity.
// IMPORT_STATE used to install it wholesale, leaving the deck with no id --
// which silently disabled both the local draft write and the Save button.
const imported = () => ({
  entries: { k: { card: { id: 'c1', name: 'Cinderella', cost: 2, inks: ['Amethyst'], type: 'Character' }, count: 4 } },
  total: 4,
})

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('IMPORT_STATE keeps the deck identifiable', () => {
  it('gives the imported deck an id', () => {
    const next = deckReducer(createNewDeck('Ruby Aggro'), { type: 'IMPORT_STATE', deck: imported() })
    expect(next.id).toBeTruthy()
  })

  it('keeps the current deck id, since importing replaces this deck', () => {
    const current = createNewDeck('Ruby Aggro')
    const next = deckReducer(current, { type: 'IMPORT_STATE', deck: imported() })
    expect(next.id).toBe(current.id)
  })

  it('keeps a name rather than going undefined', () => {
    const next = deckReducer(createNewDeck('Ruby Aggro'), { type: 'IMPORT_STATE', deck: imported() })
    expect(next.name).toBe('Ruby Aggro')
  })

  it('takes the imported cards', () => {
    const next = deckReducer(createNewDeck('Ruby Aggro'), { type: 'IMPORT_STATE', deck: imported() })
    expect(next.total).toBe(4)
    expect(Object.keys(next.entries)).toHaveLength(1)
  })

  it('recomputes the total from the entries rather than trusting the import', () => {
    const next = deckReducer(createNewDeck('T'), {
      type: 'IMPORT_STATE',
      deck: { ...imported(), total: 999 },
    })
    expect(next.total).toBe(4)
  })

  it('preserves the cloud id so a later save updates instead of duplicating', () => {
    const current = { ...createNewDeck('Ruby Aggro'), _dbId: 'clx_abc' }
    const next = deckReducer(current, { type: 'IMPORT_STATE', deck: imported() })
    expect(next._dbId).toBe('clx_abc')
  })

  it('still produces a usable deck when there is no current deck', () => {
    const next = deckReducer(undefined, { type: 'IMPORT_STATE', deck: imported() })
    expect(next.id).toBeTruthy()
    expect(next.name).toBeTruthy()
  })
})

describe('an imported deck can actually be saved', () => {
  it('writes the local draft, so it reaches My Decks', () => {
    const deck = deckReducer(createNewDeck('Ruby Aggro'), { type: 'IMPORT_STATE', deck: imported() })
    renderHook(() => useDeckSave(deck, { isAuthenticated: false }))
    expect(localStorage.getItem('lorcana.decks.v2')).toContain(deck.id)
  })

  it('posts to the API when Save is pressed', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ deck: { id: 'clx_1' } }) })
    vi.stubGlobal('fetch', fetchMock)
    const deck = deckReducer(createNewDeck('Ruby Aggro'), { type: 'IMPORT_STATE', deck: imported() })

    const { result } = renderHook(() => useDeckSave(deck, { isAuthenticated: true }))
    await act(async () => { await result.current.save() })

    expect(fetchMock).toHaveBeenCalledWith('/api/decks', expect.anything())
    await waitFor(() => expect(result.current.status).toBe('saved'))
  })
})

describe('save never fails silently', () => {
  it('reports an error instead of quietly doing nothing when the deck has no id', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const { result } = renderHook(() => useDeckSave({ name: 'No id', entries: {}, total: 0 }, { isAuthenticated: true }))
    await act(async () => { await result.current.save() })
    expect(result.current.status).toBe('error')
  })
})
