import { computeDeckStats } from '../lib/deck/stats.js'

const mk = (id, cost, inks, type, inkable) => ({
  id, name: id, cost, inks, type, inkable,
})

const deck = {
  entries: {
    a: { card: mk('a', 1, ['Ruby'], 'Character', true), count: 4 },
    b: { card: mk('b', 3, ['Amethyst'], 'Character', true), count: 4 },
    c: { card: mk('c', 9, ['Ruby'], 'Action', false), count: 2 },
  },
  total: 10,
}

describe('computeDeckStats', () => {
  it('totals the cards', () => {
    expect(computeDeckStats(deck).total).toBe(10)
  })

  it('buckets cost 7 and above into the 7+ bucket', () => {
    const curve = computeDeckStats(deck).curve
    expect(curve.find((b) => b.cost === 7).count).toBe(2)
    expect(curve.find((b) => b.cost === 1).count).toBe(4)
    expect(curve.find((b) => b.cost === 3).count).toBe(4)
  })

  it('always returns buckets 1 through 7', () => {
    expect(computeDeckStats(deck).curve.map((b) => b.cost)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('computes average cost to one decimal', () => {
    expect(computeDeckStats(deck).avgCost).toBe(3.4)
  })

  it('counts inkable and uninkable', () => {
    const ink = computeDeckStats(deck).inkable
    expect(ink.inkable).toBe(8)
    expect(ink.uninkable).toBe(2)
    expect(ink.ratio).toBeCloseTo(0.8, 5)
  })

  it('groups by type descending', () => {
    expect(computeDeckStats(deck).byType).toEqual([
      { type: 'Character', count: 8 },
      { type: 'Action', count: 2 },
    ])
  })

  it('counts ink split', () => {
    const split = computeDeckStats(deck).inkSplit
    expect(split.find((s) => s.ink === 'Ruby').count).toBe(6)
    expect(split.find((s) => s.ink === 'Amethyst').count).toBe(4)
  })

  it('returns zeroed stats for an empty deck', () => {
    const s = computeDeckStats({ entries: {}, total: 0 })
    expect(s.total).toBe(0)
    expect(s.avgCost).toBe(0)
    expect(s.inkable.ratio).toBe(0)
    expect(s.curve).toHaveLength(7)
  })

  it('does not throw on a null deck', () => {
    expect(() => computeDeckStats(null)).not.toThrow()
  })
})
