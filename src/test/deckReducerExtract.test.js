import { deckReducer } from '../lib/deck/deckReducer.js'
import { createNewDeck, generateDeckId, duplicateDeck } from '../lib/deck/storage.js'

const card = { id: 'crd_1', name: 'Cinderella', subtitle: 'Ballroom Sensation', cost: 2, setCode: 'TFC', number: '42' }
const other = { id: 'crd_2', name: 'Mulan', subtitle: 'Imperial Soldier', cost: 3, setCode: 'TFC', number: '43' }

describe('deckReducer ADD', () => {
  it('adds a card and tracks the total', () => {
    const s = deckReducer(createNewDeck('T'), { type: 'ADD', card, count: 2 })
    expect(s.total).toBe(2)
  })

  it('caps copies at 4', () => {
    let s = createNewDeck('T')
    s = deckReducer(s, { type: 'ADD', card, count: 9 })
    expect(s.total).toBe(4)
  })

  it('removes the entry when decremented to zero rather than leaving a ghost', () => {
    let s = deckReducer(createNewDeck('T'), { type: 'ADD', card, count: 1 })
    s = deckReducer(s, { type: 'ADD', card, count: -1 })
    expect(Object.keys(s.entries)).toHaveLength(0)
    expect(s.total).toBe(0)
  })
})

describe('deckReducer SET_COUNT', () => {
  it('drops the entry at count 0', () => {
    let s = deckReducer(createNewDeck('T'), { type: 'ADD', card, count: 3 })
    s = deckReducer(s, { type: 'SET_COUNT', card, count: 0 })
    expect(Object.keys(s.entries)).toHaveLength(0)
  })

  it('clamps above 4', () => {
    let s = deckReducer(createNewDeck('T'), { type: 'SET_COUNT', card, count: 10 })
    expect(s.total).toBe(4)
  })
})

describe('deckReducer REMOVE', () => {
  it('removes only the named card', () => {
    let s = createNewDeck('T')
    s = deckReducer(s, { type: 'ADD', card, count: 2 })
    s = deckReducer(s, { type: 'ADD', card: other, count: 3 })
    s = deckReducer(s, { type: 'REMOVE', card })
    expect(s.total).toBe(3)
  })
})

describe('deckReducer SET_NAME', () => {
  it('sets the name', () => {
    expect(deckReducer(createNewDeck('T'), { type: 'SET_NAME', name: 'Ruby Aggro' }).name).toBe('Ruby Aggro')
  })

  it('falls back to Untitled Deck on empty', () => {
    expect(deckReducer(createNewDeck('T'), { type: 'SET_NAME', name: '' }).name).toBe('Untitled Deck')
  })
})

describe('storage', () => {
  it('generates unique deck ids', () => {
    expect(generateDeckId()).not.toBe(generateDeckId())
  })

  it('duplicates a deck under a new id', () => {
    const base = createNewDeck('Original')
    const decks = { [base.id]: base }
    const after = duplicateDeck(decks, base.id, 'Copy')
    const ids = Object.keys(after)
    expect(ids).toHaveLength(2)
  })
})
