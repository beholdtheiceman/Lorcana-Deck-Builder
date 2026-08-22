import {
  importDeck,
  findCardByLorcanitoFormat,
  parseTextImport,
  matchCard,
  findCardByName,
} from '../lib/import/textImport.js'
import { parseCSVImport } from '../lib/import/csvImport.js'

const db = [
  { id: 'crd_1', name: 'Cinderella', subtitle: 'Ballroom Sensation', cost: 2, setCode: 'TFC', number: '42', inks: ['Amethyst'], type: 'Character' },
  { id: 'crd_2', name: 'Mulan', subtitle: 'Imperial Soldier', cost: 3, setCode: 'TFC', number: '43', inks: ['Ruby'], type: 'Character' },
]

beforeEach(() => {
  window.getAllCards = () => db
  delete window.getCurrentCards
})

afterEach(() => {
  delete window.getAllCards
  delete window.getCurrentCards
})

describe('parseTextImport', () => {
  it('returns a deck with matched entries and the parsed total', () => {
    const out = parseTextImport('4 Cinderella - Ballroom Sensation\n3 Mulan - Imperial Soldier')

    expect(out.total).toBe(7)
    expect(out.entries.crd_1.count).toBe(4)
    expect(out.entries.crd_2.count).toBe(3)
    expect(out.entries.crd_1.card.id).toBe('crd_1')
  })

  it('throws the current invalid-input error on empty input', () => {
    expect(() => parseTextImport('')).toThrow('Invalid text input')
  })

  it('throws when garbage contains no count-prefixed card lines', () => {
    expect(() => parseTextImport('!!!! nonsense ????')).toThrow('No valid cards found in text input')
  })
})

describe('findCardByName', () => {
  it('returns the card object for a full name plus subtitle fuzzy match', () => {
    expect(findCardByName('Cinderella - Ballroom Sensation', db)).toBe(db[0])
  })

  it('does not strip a leading count from the supplied name', () => {
    expect(findCardByName('4 Cinderella - Ballroom Sensation', db)).toBeNull()
  })

  it('returns null for an unknown card', () => {
    expect(findCardByName('Nonexistent Card - Nowhere', db)).toBeNull()
  })
})

describe('matchCard', () => {
  it('returns the existing deterministic exact-match result shape', () => {
    expect(matchCard('Cinderella', db)).toEqual({
      match: db[0],
      needsConfirmation: false,
      reason: 'exact-name',
    })
  })
})

describe('findCardByLorcanitoFormat', () => {
  it('does not treat subtitle/setCode/number fields as its legacy match fields', () => {
    expect(findCardByLorcanitoFormat('Cinderella', 'Ballroom Sensation', 'TFC', '42')).toBeNull()
  })
})

describe('parseCSVImport', () => {
  it('returns an empty entries object for an empty string', () => {
    expect(parseCSVImport('')).toEqual({ entries: {} })
  })

  it('returns cards keyed by the existing deck key helper', () => {
    const csv = 'name,set,number,cost,type,rarity,count\nCinderella,TFC,42,2,Character,Rare,4'
    expect(parseCSVImport(csv)).toEqual({
      entries: {
        'TFC-42': {
          card: { name: 'Cinderella', set: 'TFC', number: '42', cost: 2, type: 'Character', rarity: 'Rare' },
          count: 4,
        },
      },
    })
  })
})

describe('importDeck', () => {
  it('normalizes a parsed text deck into the existing import shape', () => {
    const out = importDeck('2 Cinderella - Ballroom Sensation', 'txt')
    expect(out).toEqual(expect.objectContaining({
      name: 'Imported Deck',
      total: 2,
      entries: expect.objectContaining({ crd_1: expect.any(Object) }),
      format: 'Lorcana',
    }))
    expect(out.id).toMatch(/^deck_/)
  })
})
