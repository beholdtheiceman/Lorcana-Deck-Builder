import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { loadAllDecks, saveAllDecks, saveCurrentDeckId } from '../../../lib/deck/storage.js'

/**
 * Deck persistence, in two layers.
 *
 * The local draft is written on every change so a refresh never loses work —
 * this is invisible and not something the user manages.
 *
 * The cloud save is explicit: the user presses Save when a deck is finished.
 * `/api/decks` expects `{ id?, title, data }` where `title` is required and
 * `id` is the DATABASE id, not the local `deck_<ts>_<rand>` one. Posting the
 * raw deck object fails validation with a 400.
 */
export default function useDeckSave(deck, { isAuthenticated, onSaved } = {}) {
  const [phase, setPhase] = useState('idle') // idle | saving | saved | error
  const [error, setError] = useState(null)
  const [lastSavedAt, setLastSavedAt] = useState(null)

  const deckRef = useRef(deck)
  const savedDeckRef = useRef(null)
  const mountedRef = useRef(true)
  deckRef.current = deck

  useEffect(() => () => { mountedRef.current = false }, [])

  // Local draft. useLayoutEffect so the write lands before paint and a fast
  // reload cannot race it.
  useLayoutEffect(() => {
    if (!deck?.id) return
    const { decks } = loadAllDecks()
    saveAllDecks({ ...decks, [deck.id]: deck })
    // Pin the current deck id too, or initialDeckState looks up decks[null]
    // on the next mount and hands back a fresh Untitled Deck.
    saveCurrentDeckId(deck.id)
  }, [deck])

  const postDeck = useCallback(async (deckToSave, { includeDbId }) => {
    const response = await fetch('/api/decks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(includeDbId && deckToSave._dbId ? { id: deckToSave._dbId } : {}),
        title: String(deckToSave.name || '').trim() || 'Untitled Deck',
        data: deckToSave,
      }),
    })
    return response
  }, [])

  const save = useCallback(async () => {
    const deckToSave = deckRef.current
    if (!deckToSave?.id) return

    setPhase('saving')
    setError(null)

    try {
      let response = await postDeck(deckToSave, { includeDbId: true })

      // The stored database id can go stale if the deck was deleted from
      // another device. Fall back to creating a new row rather than leaving
      // the user permanently unable to save.
      if (response.status === 404 && deckToSave._dbId) {
        response = await postDeck(deckToSave, { includeDbId: false })
      }

      if (!response.ok) {
        const detail = response.status === 401
          ? 'You are signed out. Sign in to save to your account.'
          : `Save failed (${response.status})`
        throw new Error(detail)
      }

      const body = await response.json().catch(() => null)
      const dbId = body?.deck?.id

      if (!mountedRef.current) return
      savedDeckRef.current = deckToSave
      setLastSavedAt(Date.now())
      setPhase('saved')
      if (dbId && dbId !== deckToSave._dbId) onSaved?.(dbId)
    } catch (caught) {
      if (!mountedRef.current) return
      setError(caught)
      setPhase('error')
    }
  }, [postDeck, onSaved])

  // Compare content, not object identity. deckReducer stamps updatedAt on
  // every action, and comparing values means a caller that rebuilds the deck
  // object each render does not read as permanently unsaved.
  const savedDeck = savedDeckRef.current
  const dirty = Boolean(
    savedDeck &&
    (deck?.id !== savedDeck.id ||
      deck?.updatedAt !== savedDeck.updatedAt ||
      deck?.total !== savedDeck.total ||
      deck?.name !== savedDeck.name)
  )

  let status = phase
  if (phase === 'saved' && dirty) status = 'unsaved'
  if (phase === 'idle' && !isAuthenticated) status = 'local-only'

  return { status, lastSavedAt, error, save, canSave: Boolean(deck?.id) }
}
