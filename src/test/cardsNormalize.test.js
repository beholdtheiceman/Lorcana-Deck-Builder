import { toAppCard, getPrimaryInk, getCardInks, matchesInkFilter, cardComparator, validateCardData } from '../lib/cards/normalize.js'

const raw = {
  id: 'crd_1', name: 'Cinderella - Ballroom Sensation',
  cost: 2, inks: ['Amethyst'], type: 'Character', rarity: 'Super Rare',
  inkwell: true, lore: 2, strength: 2, willpower: 2,
  set: { code: 'TFC', num: 1 }, collector_number: '42',
}

describe('toAppCard', () => {
  it('splits name and subtitle on the dash', () => {
    const c = toAppCard(raw)
    expect(c.name).toBe('Cinderella - Ballroom Sensation')
    expect(c.baseName).toBe('Cinderella')
    expect(c.subtitle).toBe('Ballroom Sensation')
  })

  it('does not preserve the raw payload under _raw', () => {
    expect(toAppCard(raw)._raw).toBeUndefined()
  })
})

describe('getPrimaryInk', () => {
  it('returns the first ink', () => {
    expect(getPrimaryInk(raw)).toBe('Amethyst')
  })
})

describe('getCardInks', () => {
  it('returns every ink on a dual-ink card', () => {
    const dual = { ...raw, inks: ['Amber', 'Steel'] }
    expect([...getCardInks(dual)].sort()).toEqual(['Amber', 'Steel'])
  })
})

describe('matchesInkFilter', () => {
  it('passes when the filter set is empty', () => {
    expect(matchesInkFilter(toAppCard(raw), new Set())).toBe(true)
  })

  it('matches on any shared ink', () => {
    expect(matchesInkFilter(raw, new Set(['Amethyst']))).toBe(true)
    expect(matchesInkFilter(raw, new Set(['Ruby']))).toBe(false)
  })
})

describe('validateCardData', () => {
  it('accepts a well-formed card', () => {
    expect(validateCardData(raw)).toBeTruthy()
  })

  it('rejects null', () => {
    expect(validateCardData(null).isValid).toBe(false)
  })
})

describe('cardComparator', () => {
  it('is a total order over a card list', () => {
    const cards = [
      toAppCard({ ...raw, name: 'Zeus - God', cost: 5 }),
      toAppCard({ ...raw, name: 'Anna - Heir', cost: 1 }),
      toAppCard(raw),
    ]
    const sorted = [...cards].sort(cardComparator)
    expect(sorted).toHaveLength(3)
    expect([...cards].sort(cardComparator)).toEqual(sorted)
  })
})
