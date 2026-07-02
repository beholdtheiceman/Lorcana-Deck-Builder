// Regression test: My Decks "Edit in Deck Lab" must write the current-deck id
// in the same JSON format the builder reads back via loadLS (JSON.parse).
// Bug: MyDecksPage wrote the id with raw localStorage.setItem (unquoted), so
// loadLS threw on JSON.parse, returned null, and the builder opened an empty
// deck — "the deck disappears".
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LS_KEYS, loadLS, saveLS } from '../lib/storage.js'
import MyDecksPage from '../pages/MyDecksPage.jsx'

const navigateMock = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}))

function seedDeck() {
  const deck = {
    id: 'deck_123_abc',
    name: 'Repro Deck',
    total: 5,
    createdAt: 1751400000000,
    updatedAt: 1751400001000,
    entries: {
      '13-1': { card: { id: '13-1', name: 'Woody', cost: 4, type: 'Character', ink: 'Amber' }, count: 3 },
      '13-2': { card: { id: '13-2', name: 'Ming Lee', cost: 3, type: 'Character', ink: 'Amber' }, count: 2 },
    },
  }
  saveLS(LS_KEYS.DECKS, { [deck.id]: deck })
  return deck
}

describe('MyDecksPage — Edit in Deck Lab', () => {
  beforeEach(() => {
    localStorage.clear()
    navigateMock.mockClear()
  })

  it('writes the current deck id so the builder (loadLS) can read it back', () => {
    const deck = seedDeck()
    render(<MyDecksPage />)

    // open the detail panel, then click Edit
    fireEvent.click(screen.getByText('Repro Deck'))
    fireEvent.click(screen.getByText('Edit in Deck Lab'))

    // the builder reads via loadLS (JSON.parse) — this must round-trip
    expect(loadLS(LS_KEYS.CURRENT_DECK_ID, null)).toBe(deck.id)
    expect(navigateMock).toHaveBeenCalledWith('/builder')
  })

  it('renders saved counts and totals from localStorage', () => {
    seedDeck()
    render(<MyDecksPage />)
    fireEvent.click(screen.getByText('Repro Deck'))
    expect(screen.getAllByText('5 cards').length).toBeGreaterThan(0)
    expect(screen.getByText('3x')).toBeTruthy()
    expect(screen.getByText('2x')).toBeTruthy()
  })
})
