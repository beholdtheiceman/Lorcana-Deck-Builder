import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { loadAllDecks, saveAllDecks, saveCurrentDeckId } from '../../../lib/deck/storage.js'

const CLOUD_SAVE_DELAY = 2000

export default function useAutosave(deck, { isAuthenticated } = {}) {
  const [status, setStatus] = useState('idle')
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const deckRef = useRef(deck)
  const mountedRef = useRef(true)
  const timerRef = useRef(null)
  const requestRef = useRef(null)
  const operationRef = useRef(0)

  deckRef.current = deck

  const cancelCloudSave = useCallback(() => {
    operationRef.current += 1
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    requestRef.current?.abort()
    requestRef.current = null
  }, [])

  const saveToCloud = useCallback(async (deckToSave, operation) => {
    const controller = new AbortController()
    requestRef.current = controller

    try {
      const response = await fetch('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deckToSave),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`Deck sync failed with status ${response.status}`)

      if (mountedRef.current && operationRef.current === operation) {
        setLastSavedAt(Date.now())
        setStatus('saved')
      }
    } catch (error) {
      if (error?.name !== 'AbortError' && mountedRef.current && operationRef.current === operation) {
        setStatus('sync-failed')
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }, [])

  useLayoutEffect(() => {
    if (deck?.id) {
      const { decks } = loadAllDecks()
      saveAllDecks({ ...decks, [deck.id]: deck })
      // Also pin the current deck id. Without this the deck is written but
      // orphaned: initialDeckState looks up decks[currentDeckId] on the next
      // mount, misses, and hands back a fresh Untitled Deck.
      saveCurrentDeckId(deck.id)
      setLastSavedAt(Date.now())
    }
    setStatus(isAuthenticated ? 'saving' : 'local-only')
  }, [deck, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      cancelCloudSave()
      return undefined
    }

    cancelCloudSave()
    const operation = operationRef.current
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      void saveToCloud(deckRef.current, operation)
    }, CLOUD_SAVE_DELAY)

    return cancelCloudSave
  }, [deck, isAuthenticated, cancelCloudSave, saveToCloud])

  useEffect(() => () => {
    mountedRef.current = false
    cancelCloudSave()
  }, [cancelCloudSave])

  const retry = useCallback(() => {
    if (!isAuthenticated) return undefined

    cancelCloudSave()
    const operation = operationRef.current
    setStatus('saving')
    return saveToCloud(deckRef.current, operation)
  }, [isAuthenticated, cancelCloudSave, saveToCloud])

  return { status, lastSavedAt, retry }
}
