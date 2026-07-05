import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LS_KEYS, loadLS, saveLS } from '../lib/storage.js'
import { fetchAllCards } from '../lib/cardsApi.js'
import { generateDeckImagePNG } from '../lib/deckImage.js'
import { useToasts } from '../App.jsx'
import DeckPresentationView from '../components/DeckPresentationView.jsx'

const INK_COLORS = {
  Amber: '#F59E0B',
  Amethyst: '#8B5CF6',
  Emerald: '#10B981',
  Ruby: '#EF4444',
  Sapphire: '#3B82F6',
  Steel: '#6B7280',
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
      className={`rounded-full font-medium text-white ${small ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-0.5'}`}
      style={{ backgroundColor: INK_COLORS[ink] ?? '#6B7280' }}
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
  const [selectedId, setSelectedId] = useState(null)

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
        <p className="text-gray-300 text-lg mb-2">No decks yet.</p>
        <p className="text-gray-500 text-sm mb-6">Head to the Deck Lab to build and save your first deck.</p>
        <button
          onClick={() => navigate('/builder')}
          className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
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
        <h1 className="text-xl font-bold text-white mb-4">My Decks</h1>
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
                onClick={() => setSelectedId(isSelected ? null : deck.id)}
                className={`text-left rounded-xl border p-4 transition-all ${
                  selectedDeck ? 'w-48 shrink-0 lg:w-full' : ''
                } ${
                  isSelected
                    ? 'border-violet-500 bg-violet-900/20'
                    : 'border-gray-800 bg-gray-900/60 hover:border-gray-600 hover:bg-gray-900'
                }`}
              >
                <div className="font-semibold text-white text-sm truncate mb-1">
                  {deck.name || 'Untitled Deck'}
                </div>
                <div className="text-xs text-gray-400 mb-2">{deck.total ?? 0} cards</div>
                {inks.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {inks.map(ink => <InkBadge key={ink} ink={ink} small />)}
                  </div>
                )}
                {date && <div className="text-xs text-gray-500">{date}</div>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Right: deck detail — the same rich presentation used by the Deck
          Lab's docked panel, shown inline here instead of a thinner summary. */}
      {selectedDeck && (
        <div className="flex-1 min-w-0">
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
            <div className="flex justify-end mb-3">
              <button
                onClick={() => setSelectedId(null)}
                className="px-3 py-2 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 rounded-lg text-sm transition-colors"
              >
                Close
              </button>
            </div>

            {/* The deck's own entries already carry full card data, so the
                presentation renders immediately — allCards (used only to
                re-resolve fresh image URLs for the PNG download) can arrive
                a beat later without blocking the view. */}
            {loadingCards && (
              <div className="text-xs text-gray-500 mb-2">Loading card catalog for image export…</div>
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
              <div className="mt-5 pt-4 border-t border-gray-800">
                <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Notes</p>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{selectedDeck.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
