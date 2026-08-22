// src/test/useAutosave.test.jsx
import { renderHook, act, waitFor } from '@testing-library/react'
import useAutosave from '../features/builder/hooks/useAutosave.js'

const deck = { id: 'd1', name: 'Ruby Aggro', entries: {}, total: 0, updatedAt: 1 }

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('useAutosave', () => {
  it('writes to localStorage immediately', () => {
    renderHook(() => useAutosave(deck, { isAuthenticated: false }))
    expect(localStorage.length).toBeGreaterThan(0)
  })

  it('reports local-only when signed out', async () => {
    const { result } = renderHook(() => useAutosave(deck, { isAuthenticated: false }))
    await waitFor(() => expect(result.current.status).toBe('local-only'))
  })

  it('reaches saved after a successful cloud write', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) }))
    const { result } = renderHook(() => useAutosave(deck, { isAuthenticated: true }))
    await waitFor(() => expect(result.current.status).toBe('saved'), { timeout: 4000 })
  })

  it('reports sync-failed when the cloud write rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const { result } = renderHook(() => useAutosave(deck, { isAuthenticated: true }))
    await waitFor(() => expect(result.current.status).toBe('sync-failed'), { timeout: 4000 })
  })

  it('keeps the local write even when the cloud write fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const { result } = renderHook(() => useAutosave(deck, { isAuthenticated: true }))
    await waitFor(() => expect(result.current.status).toBe('sync-failed'), { timeout: 4000 })
    expect(localStorage.length).toBeGreaterThan(0)
  })

  it('debounces rather than posting once per keystroke', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const { rerender } = renderHook(({ d }) => useAutosave(d, { isAuthenticated: true }), {
      initialProps: { d: deck },
    })
    for (let i = 2; i < 8; i++) {
      await act(async () => { rerender({ d: { ...deck, name: `n${i}`, updatedAt: i } }) })
    }
    await waitFor(() => expect(fetchMock).toHaveBeenCalled(), { timeout: 4000 })
    expect(fetchMock.mock.calls.length).toBeLessThan(7)
  })

  it('exposes a retry that re-attempts the cloud write', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useAutosave(deck, { isAuthenticated: true }))
    await waitFor(() => expect(result.current.status).toBe('sync-failed'), { timeout: 4000 })
    await act(async () => { result.current.retry() })
    await waitFor(() => expect(result.current.status).toBe('saved'), { timeout: 4000 })
  })
})
