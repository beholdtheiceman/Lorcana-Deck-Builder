import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const LS_DECKS = 'lorcana.decks.v2'
const LS_CURRENT = 'lorcana.currentDeckId.v2'

const INK_COLORS = {
  Amber: '#F59E0B',
  Amethyst: '#8B5CF6',
  Emerald: '#10B981',
  Ruby: '#EF4444',
  Sapphire: '#3B82F6',
  Steel: '#6B7280',
}

const TYPE_ORDER = ['Character', 'Action', 'Song', 'Item', 'Location', 'Other']

function getCardInks(card) {
  const raw = card.ink || card.inks || card.color || ''
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string' && raw) return [raw]
  return []
}

function getDeckInks(deck) {
  const inkSet = new Set()
  for (const entry of Object.values(deck.entries || {})) {
    getCardInks(entry.card).forEach(ink => inkSet.add(ink))
  }
  return [...inkSet]
}

function getCardType(card) {
  const t = card.type || ''
  if (t.includes('Song')) return 'Song'
  if (t.includes('Action')) return 'Action'
  if (t.includes('Character')) return 'Character'
  if (t.includes('Item')) return 'Item'
  if (t.includes('Location')) return 'Location'
  return 'Other'
}

function groupEntriesByType(deck) {
  const groups = {}
  for (const entry of Object.values(deck.entries || {})) {
    const type = getCardType(entry.card)
    if (!groups[type]) groups[type] = []
    groups[type].push(entry)
  }
  for (const type in groups) {
    groups[type].sort((a, b) => {
      const costDiff = (a.card.cost ?? 0) - (b.card.cost ?? 0)
      return costDiff !== 0 ? costDiff : (a.card.name || '').localeCompare(b.card.name || '')
    })
  }
  return groups
}

function formatDate(ts) {
  if (!ts) return null
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function InkDot({ ink }) {
  return (
    <span
      className="w-2.5 h-2.5 rounded-full inline-block"
      style={{ backgroundColor: INK_COLORS[ink] ?? '#6B7280' }}
      title={ink}
    />
  )
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
  const [decks, setDecks] = useState([])
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_DECKS)
      if (raw) {
        const parsed = JSON.parse(raw)
        const arr = Object.values(parsed).sort(
          (a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0)
        )
        setDecks(arr)
      }
    } catch {}
  }, [])

  const selectedDeck = decks.find(d => d.id === selectedId) ?? null

  function handleEdit(deck) {
    localStorage.setItem(LS_CURRENT, deck.id)
    navigate('/builder')
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
    <div className="flex gap-6 items-start">
      {/* Left: deck list */}
      <div className={selectedDeck ? 'w-72 shrink-0' : 'w-full'}>
        <h1 className="text-xl font-bold text-white mb-4">My Decks</h1>
        <div className={selectedDeck ? 'flex flex-col gap-3' : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'}>
          {decks.map(deck => {
            const inks = getDeckInks(deck)
            const isSelected = deck.id === selectedId
            const date = formatDate(deck.updatedAt ?? deck.createdAt)
            return (
              <button
                key={deck.id}
                onClick={() => setSelectedId(isSelected ? null : deck.id)}
                className={`text-left rounded-xl border p-4 transition-all ${
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

      {/* Right: deck detail */}
      {selectedDeck && (() => {
        const groups = groupEntriesByType(selectedDeck)
        const inks = getDeckInks(selectedDeck)
        return (
          <div className="flex-1 min-w-0">
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-white truncate">
                    {selectedDeck.name || 'Untitled Deck'}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-400">
                    <span>{selectedDeck.total ?? 0} cards</span>
                    {formatDate(selectedDeck.updatedAt ?? selectedDeck.createdAt) && (
                      <span>Updated {formatDate(selectedDeck.updatedAt ?? selectedDeck.createdAt)}</span>
                    )}
                    {selectedDeck._dbId && (
                      <span className="text-emerald-400">☁ Cloud saved</span>
                    )}
                  </div>
                  {inks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {inks.map(ink => <InkBadge key={ink} ink={ink} />)}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setSelectedId(null)}
                    className="px-3 py-2 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 rounded-lg text-sm transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => handleEdit(selectedDeck)}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Edit in Deck Lab
                  </button>
                </div>
              </div>

              {/* Cards grouped by type */}
              <div className="space-y-5">
                {TYPE_ORDER.map(type => {
                  const entries = groups[type]
                  if (!entries?.length) return null
                  const typeTotal = entries.reduce((s, e) => s + e.count, 0)
                  return (
                    <div key={type}>
                      <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-800">
                        <span className="text-sm font-semibold text-gray-200">{type}s</span>
                        <span className="text-xs text-gray-500">({typeTotal})</span>
                      </div>
                      <div className="space-y-1">
                        {entries.map(entry => {
                          const cardInks = getCardInks(entry.card)
                          return (
                            <div
                              key={entry.card.id ?? entry.card.name}
                              className="flex items-center gap-2 text-sm py-0.5"
                            >
                              <span className="w-5 text-right text-gray-400 shrink-0 tabular-nums">
                                {entry.count}x
                              </span>
                              {entry.card.cost != null && (
                                <span className="w-5 h-5 rounded-full bg-gray-800 border border-gray-700 text-xs flex items-center justify-center text-gray-300 shrink-0 tabular-nums">
                                  {entry.card.cost}
                                </span>
                              )}
                              <span className="text-gray-100 truncate">{entry.card.name}</span>
                              {entry.card.subtitle && (
                                <span className="text-gray-500 text-xs truncate hidden sm:inline">
                                  — {entry.card.subtitle}
                                </span>
                              )}
                              {cardInks.length > 0 && (
                                <div className="ml-auto flex gap-0.5 shrink-0">
                                  {cardInks.map(ink => <InkDot key={ink} ink={ink} />)}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Notes */}
              {selectedDeck.notes && (
                <div className="mt-5 pt-4 border-t border-gray-800">
                  <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Notes</p>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{selectedDeck.notes}</p>
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
