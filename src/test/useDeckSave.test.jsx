import { renderHook, act, waitFor } from '@testing-library/react'
import useDeckSave from '../features/builder/hooks/useDeckSave.js'

const deck = { id: 'deck_1', name: 'Ruby Aggro', entries: {}, total: 0, updatedAt: 1 }

const okResponse = (id = 'clx_db_1') => ({
  ok: true, status: 200, json: async () => ({ deck: { id, title: 'Ruby Aggro' } }),
})

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('useDeckSave local draft', () => {
  it('writes the draft to localStorage without any save press', () => {
    renderHook(() => useDeckSave(deck, { isAuthenticated: true }))
    expect(localStorage.getItem('lorcana.decks.v2')).toContain('deck_1')
  })

  it('pins the current deck id so the draft is found again on reload', () => {
    renderHook(() => useDeckSave(deck, { isAuthenticated: true }))
    expect(localStorage.getItem('lorcana.currentDeckId.v2')).toContain('deck_1')
  })

  it('never posts on its own', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal('fetch', fetchMock)
    const { rerender } = renderHook(({ d }) => useDeckSave(d, { isAuthenticated: true }), {
      initialProps: { d: deck },
    })
    for (let i = 2; i < 6; i++) rerender({ d: { ...deck, name: `n${i}`, updatedAt: i } })
    await new Promise((r) => setTimeout(r, 2600))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('useDeckSave cloud save', () => {
  // This is the assertion that would have caught the original bug: the hook
  // used to post the raw deck object, which /api/decks rejects with a 400
  // because `title` is required and a deck calls its name `name`.
  it('posts the shape /api/decks actually requires', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useDeckSave(deck, { isAuthenticated: true }))

    await act(async () => { await result.current.save() })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/decks')
    const body = JSON.parse(init.body)
    expect(body.title).toBe('Ruby Aggro')
    expect(body.data).toMatchObject({ id: 'deck_1' })
    expect(body).not.toHaveProperty('entries')
  })

  it('does not send the local deck id as the database id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useDeckSave(deck, { isAuthenticated: true }))

    await act(async () => { await result.current.save() })

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).id).toBeUndefined()
  })

  it('falls back to Untitled Deck rather than posting an empty title', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useDeckSave({ ...deck, name: '   ' }, { isAuthenticated: true }))

    await act(async () => { await result.current.save() })

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).title).toBe('Untitled Deck')
  })

  it('reports the returned database id so re-saves update instead of duplicating', async () => {
    const onSaved = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse('clx_abc')))
    const { result } = renderHook(() => useDeckSave(deck, { isAuthenticated: true, onSaved }))

    await act(async () => { await result.current.save() })

    expect(onSaved).toHaveBeenCalledWith('clx_abc')
  })

  it('sends the database id on a re-save', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal('fetch', fetchMock)
    const saved = { ...deck, _dbId: 'clx_abc' }
    const { result } = renderHook(() => useDeckSave(saved, { isAuthenticated: true }))

    await act(async () => { await result.current.save() })

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).id).toBe('clx_abc')
  })

  it('recreates the deck when the stored database id is gone', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
      .mockResolvedValueOnce(okResponse('clx_new'))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() =>
      useDeckSave({ ...deck, _dbId: 'clx_stale' }, { isAuthenticated: true }))

    await act(async () => { await result.current.save() })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).id).toBeUndefined()
    await waitFor(() => expect(result.current.status).toBe('saved'))
  })

  it('reaches saved on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()))
    const { result } = renderHook(() => useDeckSave(deck, { isAuthenticated: true }))
    await act(async () => { await result.current.save() })
    expect(result.current.status).toBe('saved')
  })

  it('surfaces a readable message when signed out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }))
    const { result } = renderHook(() => useDeckSave(deck, { isAuthenticated: false }))
    await act(async () => { await result.current.save() })
    expect(result.current.status).toBe('error')
    expect(result.current.error.message).toMatch(/sign in/i)
  })

  it('reports error on a network failure and keeps the local draft', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const { result } = renderHook(() => useDeckSave(deck, { isAuthenticated: true }))
    await act(async () => { await result.current.save() })
    expect(result.current.status).toBe('error')
    expect(localStorage.getItem('lorcana.decks.v2')).toContain('deck_1')
  })

  it('goes to unsaved once the deck changes after a save', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()))
    const { result, rerender } = renderHook(
      ({ d }) => useDeckSave(d, { isAuthenticated: true }),
      { initialProps: { d: deck } }
    )
    await act(async () => { await result.current.save() })
    expect(result.current.status).toBe('saved')

    rerender({ d: { ...deck, name: 'Changed', updatedAt: 2 } })
    expect(result.current.status).toBe('unsaved')
  })
})
