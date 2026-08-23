import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LS_KEYS, loadLS, saveLS } from '../lib/storage.js'
import { fetchAllCards } from '../lib/cardsApi.js'
import { generateDeckImagePNG } from '../lib/deckImage.js'
import { useToasts } from '../contexts/ToastContext.jsx'
import DeckPresentationView from '../components/DeckPresentationView.jsx'

const INK_COLORS = {
  Amber: 'var(--amber)',
  Amethyst: 'var(--amethyst)',
  Emerald: 'var(--emerald)',
  Ruby: 'var(--ruby)',
  Sapphire: 'var(--sapphire)',
  Steel: 'var(--steel)',
}

function getCardInks(card) {
  const raw = card.ink || card.inks || card.color || ''
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string' && raw) return [raw]
  return []
}

// Entries with count 0 are ghosts left behind by older builds — a card that was
// removed from the deck but whose entry was kept. Never render them.
function liveEntries(deck) {
  return Object.values(deck.entries || {}).filter(e => e?.count > 0)
}

function getDeckInks(deck) {
  const inkSet = new Set()
  for (const entry of liveEntries(deck)) {
    getCardInks(entry.card).forEach(ink => inkSet.add(ink))
  }
  return [...inkSet]
}

function formatDate(ts) {
  if (!ts) return null
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function InkBadge({ ink, small }) {
  return (
    <span
      className={`rounded-full font-medium ${small ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-0.5'}`}
      style={{ backgroundColor: INK_COLORS[ink] ?? 'var(--steel)', color: '#0b0c0f' }}
    >
      {ink}
    </span>
  )
}

export default function MyDecksPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToast } = useToasts()
  const [decks, setDecks] = useState([])
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState(() => searchParams.get('deck'))

  // Keep the id in the URL so a deck page can be linked to, refreshed and
  // reached with the browser back button.
  const selectDeck = (id) => {
    setSelectedId(id)
    const next = new URLSearchParams(searchParams)
    if (id) next.set('deck', id); else next.delete('deck')
    setSearchParams(next, { replace: true })
  }

  // The full card catalog is only needed once a deck's rich presentation is
  // shown, so fetch it lazily the first time a deck is opened rather than
  // eagerly on page load.
  const [allCards, setAllCards] = useState([])
  const [loadingCards, setLoadingCards] = useState(false)
  const cardsRequestedRef = React.useRef(false)

  useEffect(() => {
    const parsed = loadLS(LS_KEYS.DECKS, null)
    if (parsed) {
      const arr = Object.values(parsed).sort(
        (a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0)
      )
      setDecks(arr)
    }
  }, [])

  const selectedDeck = decks.find(d => d.id === selectedId) ?? null

  useEffect(() => {
    if (!selectedDeck || cardsRequestedRef.current) return
    cardsRequestedRef.current = true
    setLoadingCards(true)
    fetchAllCards()
      .then(cards => setAllCards(cards || []))
      .catch(err => {
        console.error('[MyDecksPage] Failed to load card catalog:', err)
        addToast?.('Failed to load card data for deck preview.', 'error')
      })
      .finally(() => setLoadingCards(false))
  }, [selectedDeck, addToast])

  function handleEdit(deck) {
    // Must round-trip through the builder's loadLS (JSON.parse) — see myDecksEdit.test.jsx
    saveLS(LS_KEYS.CURRENT_DECK_ID, deck.id)
    navigate('/builder')
  }

  function handleSaveDeck(customDeckName) {
    if (!selectedDeck) return
    const finalName = customDeckName || selectedDeck.name || 'Untitled Deck'
    const updatedDeck = { ...selectedDeck, name: finalName, updatedAt: Date.now() }
    const allDecks = loadLS(LS_KEYS.DECKS, {}) || {}
    allDecks[updatedDeck.id] = updatedDeck
    saveLS(LS_KEYS.DECKS, allDecks)
    setDecks(prev => prev.map(d => (d.id === updatedDeck.id ? updatedDeck : d)))
    addToast?.(`Deck "${finalName}" saved.`, 'success')
  }

  // DeckPresentationView doesn't import the image-generation logic itself —
  // it just awaits whatever onGenerateImage prop it's given (same pattern as
  // the Deck Lab's docked panel in App.jsx). Here there's no AppInner wrapper
  // to reuse, so call the pure generateDeckImagePNG helper directly.
  function handleGenerateImage() {
    return generateDeckImagePNG(selectedDeck, allCards, { username: user?.email })
  }

  if (decks.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="text-lg mb-2" style={{ color: 'var(--text)' }}>No decks yet.</p>
        <p className="text-sm mb-6" style={{ color: 'var(--faint)' }}>Head to the Deck Lab to build and save your first deck.</p>
        <button
          onClick={() => navigate('/builder')}
          className="px-5 py-2 rounded-md text-sm font-semibold hover:brightness-110 transition"
          style={{ background: 'var(--sapphire)', color: '#0b1620' }}
        >
          Open Deck Lab
        </button>
      </div>
    )
  }

  return (
    <div className={selectedDeck ? 'flex flex-col lg:flex-row gap-6 lg:items-start' : 'flex gap-6 items-start'}>
      {/* Left: deck list. Below lg, a selected deck's list collapses into a
          horizontally-scrollable strip above the presentation instead of a
          fixed-width column squeezed beside it — there's no room for
          side-by-side at mobile widths. */}
      <div className={selectedDeck ? 'lg:w-72 lg:shrink-0' : 'w-full'}>
        <h1 className="font-display text-xl mb-4" style={{ fontWeight: 560, color: 'var(--text)' }}>My Decks</h1>
        <div
          className={
            selectedDeck
              ? 'flex flex-row gap-3 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0'
              : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'
          }
        >
          {decks.map(deck => {
            const inks = getDeckInks(deck)
            const isSelected = deck.id === selectedId
            const date = formatDate(deck.updatedAt ?? deck.createdAt)
            return (
              <button
                key={deck.id}
                onClick={() => selectDeck(isSelected ? null : deck.id)}
                className={`text-left rounded-xl border p-4 transition-colors ${
                  selectedDeck ? 'w-48 shrink-0 lg:w-full' : ''
                }`}
                style={{
                  borderColor: isSelected ? 'color-mix(in srgb, var(--sapphire) 55%, var(--line))' : 'var(--line)',
                  background: isSelected ? 'color-mix(in srgb, var(--sapphire) 10%, var(--panel))' : 'var(--panel-2)',
                }}
              >
                <div className="font-display text-sm truncate mb-1" style={{ fontWeight: 560, color: 'var(--text)' }}>
                  {deck.name || 'Untitled Deck'}
                </div>
                <div className="text-xs mb-2 tabular-nums" style={{ color: 'var(--muted)' }}>{deck.total ?? 0} cards</div>
                {inks.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {inks.map(ink => <InkBadge key={ink} ink={ink} small />)}
                  </div>
                )}
                {date && <div className="text-xs tabular-nums" style={{ color: 'var(--faint)' }}>{date}</div>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Right: deck detail — the same rich presentation used by the Deck
          Lab's docked panel, shown inline here instead of a thinner summary. */}
      {selectedDeck && (
        <div className="flex-1 min-w-0">
          <div className="rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
            <div className="flex justify-end mb-3">
              <button
                onClick={() => selectDeck(null)}
                className="px-3 py-2 border rounded-md text-sm transition-colors"
                style={{ borderColor: 'var(--line-2)', color: 'var(--muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--faint)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--line-2)' }}
              >
                Close
              </button>
            </div>

            {/* The deck's own entries already carry full card data, so the
                presentation renders immediately — allCards (used only to
                re-resolve fresh image URLs for the PNG download) can arrive
                a beat later without blocking the view. */}
            {loadingCards && (
              <div className="text-xs mb-2" style={{ color: 'var(--faint)' }}>Loading card catalog for image export…</div>
            )}
            <DeckPresentationView
              deck={selectedDeck}
              allCards={allCards}
              onSave={handleSaveDeck}
              onGenerateImage={handleGenerateImage}
              onEditInLab={() => handleEdit(selectedDeck)}
              toast={addToast}
            />

            {/* Notes */}
            {selectedDeck.notes && (
              <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--line)' }}>
                <p className="text-[11px] uppercase tracking-[0.1em] mb-1 font-semibold" style={{ color: 'var(--faint)' }}>Notes</p>
                <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--muted)' }}>{selectedDeck.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
