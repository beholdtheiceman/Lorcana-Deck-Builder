import {
  applyFilters, countActiveFilters, defaultFilterState, filterReducer,
  hydrateFilterState, CORE_SET_NUMS, FORMATS, DEFAULT_FORMAT,
} from '../lib/filters/filterModel.js'

const card = (id, setNum) => ({
  id, name: `Card ${id}`, cost: 2, inks: ['Ruby'], type: 'Character', inkable: true, setNum,
})

// Sets 1-8 are rotated out of Core; 9-13 are legal.
const cards = [card('old1', 1), card('old8', 8), card('new9', 9), card('new13', 13)]

describe('format filter', () => {
  it('defaults to Core', () => {
    expect(defaultFilterState().gamemode).toBe(DEFAULT_FORMAT)
    expect(DEFAULT_FORMAT).toBe(FORMATS.CORE)
  })

  it('Core allows only sets 9 through 13', () => {
    const out = applyFilters(cards, { ...defaultFilterState(), gamemode: FORMATS.CORE })
    expect(out.map((c) => c.id).sort()).toEqual(['new13', 'new9'])
  })

  it('Infinity allows every card', () => {
    const out = applyFilters(cards, { ...defaultFilterState(), gamemode: FORMATS.INFINITY })
    expect(out).toHaveLength(4)
  })

  it('exposes the Core set numbers so the UI and the filter agree', () => {
    expect([...CORE_SET_NUMS].sort((a, b) => a - b)).toEqual([9, 10, 11, 12, 13])
  })

  it('switches format through the reducer', () => {
    const next = filterReducer(defaultFilterState(), { type: 'SET_GAMEMODE', value: FORMATS.INFINITY })
    expect(next.gamemode).toBe(FORMATS.INFINITY)
  })

  it('does not count the default format as an active filter', () => {
    expect(countActiveFilters(defaultFilterState())).toBe(0)
  })

  it('counts a non-default format as active', () => {
    const s = { ...defaultFilterState(), gamemode: FORMATS.INFINITY }
    expect(countActiveFilters(s)).toBe(1)
  })

  it('resets back to Core rather than to no format', () => {
    let s = filterReducer(defaultFilterState(), { type: 'SET_GAMEMODE', value: FORMATS.INFINITY })
    s = filterReducer(s, { type: 'RESET' })
    expect(s.gamemode).toBe(FORMATS.CORE)
  })

  it('migrates legacy empty gamemode to Infinity, preserving what the user saw', () => {
    // The old builder used "" to mean "Any", which showed every card. Mapping
    // that to Core would silently hide sets 1-8 from returning users.
    expect(hydrateFilterState({ gamemode: '' }).gamemode).toBe(FORMATS.INFINITY)
  })

  it('keeps an explicitly saved format', () => {
    expect(hydrateFilterState({ gamemode: FORMATS.CORE }).gamemode).toBe(FORMATS.CORE)
  })

  it('lets a card through when its set number is unknown', () => {
    const unknown = [{ id: 'x', name: 'X', cost: 1, inks: ['Ruby'], type: 'Character' }]
    expect(applyFilters(unknown, { ...defaultFilterState(), gamemode: FORMATS.CORE })).toHaveLength(1)
  })
})
