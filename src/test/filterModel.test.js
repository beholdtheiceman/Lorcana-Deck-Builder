import {
  initialFilterState, filterReducer, applyFilters,
  serializeFilterState, hydrateFilterState, countActiveFilters,
} from '../lib/filters/filterModel.js'

const cards = [
  { id: '1', name: 'Cinderella', cost: 2, inks: ['Amethyst'], type: 'Character', rarity: 'Rare', inkable: true, setNum: 1 },
  { id: '2', name: 'Mulan', cost: 3, inks: ['Ruby'], type: 'Character', rarity: 'Common', inkable: false, setNum: 9 },
  { id: '3', name: 'Be Prepared', cost: 7, inks: ['Ruby'], type: 'Action', rarity: 'Rare', inkable: true, setNum: 9 },
]

// Pin Infinity so these ink/cost/type assertions are not affected by the
// Core format default, which excludes sets 1-8.
const base = () => ({ ...initialFilterState(), gamemode: 'Infinity', inks: new Set(), selectedCosts: new Set(), types: new Set(), rarities: new Set(), sets: new Set(), classifications: new Set(), abilities: new Set() })

describe('applyFilters', () => {
  it('returns everything with a default filter state', () => {
    expect(applyFilters(cards, base())).toHaveLength(3)
  })

  it('filters by ink', () => {
    const out = applyFilters(cards, { ...base(), inks: new Set(['Ruby']) })
    expect(out.map((c) => c.id).sort()).toEqual(['2', '3'])
  })

  it('filters by cost', () => {
    expect(applyFilters(cards, { ...base(), selectedCosts: new Set([2]) })).toHaveLength(1)
  })

  it('filters by type', () => {
    expect(applyFilters(cards, { ...base(), types: new Set(['Action']) })).toHaveLength(1)
  })

  it('filters by text on name', () => {
    expect(applyFilters(cards, { ...base(), text: 'mulan' })).toHaveLength(1)
  })

  it('returns everything when inkable is any', () => {
    expect(applyFilters(cards, { ...base(), inkable: 'any' })).toHaveLength(3)
  })

  it('returns only inkable cards when inkable is yes', () => {
    expect(applyFilters(cards, { ...base(), inkable: 'yes' }).map((c) => c.id).sort()).toEqual(['1', '3'])
  })

  it('returns only uninkable cards when inkable is no', () => {
    expect(applyFilters(cards, { ...base(), inkable: 'no' }).map((c) => c.id)).toEqual(['2'])
  })

  it('does not mutate the input array', () => {
    const input = [...cards]
    applyFilters(input, { ...base(), inks: new Set(['Ruby']) })
    expect(input).toHaveLength(3)
  })

  it('returns all cards when the filter object is missing', () => {
    expect(applyFilters(cards, null)).toHaveLength(3)
  })
})

describe('filterReducer', () => {
  it('toggles an ink on and off', () => {
    let s = filterReducer(base(), { type: 'TOGGLE_INK', ink: 'Ruby' })
    expect(s.inks.has('Ruby')).toBe(true)
    s = filterReducer(s, { type: 'TOGGLE_INK', ink: 'Ruby' })
    expect(s.inks.has('Ruby')).toBe(false)
  })

  it('sets the inkable tri-state', () => {
    expect(filterReducer(base(), { type: 'SET_INKABLE', value: 'no' }).inkable).toBe('no')
  })

  it('resets to defaults', () => {
    let s = filterReducer(base(), { type: 'TOGGLE_INK', ink: 'Ruby' })
    s = filterReducer(s, { type: 'RESET' })
    expect(s.inks.size).toBe(0)
    expect(s.inkable).toBe('any')
  })
})

// These assert the active-dimension count, so they use the true default
// state (Core) rather than the Infinity-pinned base above.
const countBase = () => ({ ...base(), gamemode: 'Core Constructed' })

describe('countActiveFilters', () => {
  it('is zero for a default state', () => {
    expect(countActiveFilters(countBase())).toBe(0)
  })

  it('counts each active dimension once', () => {
    const s = { ...countBase(), inks: new Set(['Ruby', 'Amber']), selectedCosts: new Set([2]), inkable: 'yes' }
    expect(countActiveFilters(s)).toBe(3)
  })

  it('counts each min/max stat pair as one dimension', () => {
    const s = { ...countBase(), loreMin: '1', loreMax: '3', willpowerMax: '5', strengthMin: '2' }
    expect(countActiveFilters(s)).toBe(3)
  })
})

describe('state persistence round trip', () => {
  it('survives serialize then hydrate', () => {
    const s = { ...base(), inks: new Set(['Ruby']), inkable: 'no', text: 'x' }
    const back = hydrateFilterState(JSON.parse(JSON.stringify(serializeFilterState(s))))
    expect(back.inks instanceof Set).toBe(true)
    expect(back.inks.has('Ruby')).toBe(true)
    expect(back.inkable).toBe('no')
    expect(back.text).toBe('x')
  })

  it('migrates legacy showUninkablesOnly to inkable no', () => {
    expect(hydrateFilterState({ showUninkablesOnly: true }).inkable).toBe('no')
  })

  it('migrates legacy showInkablesOnly to inkable yes', () => {
    expect(hydrateFilterState({ showInkablesOnly: true }).inkable).toBe('yes')
  })

  it('defaults legacy state with neither flag to any', () => {
    expect(hydrateFilterState({}).inkable).toBe('any')
  })
})
