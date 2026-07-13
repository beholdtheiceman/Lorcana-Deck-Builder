import { describe, expect, it } from 'vitest'
import { diff, inkDeltas } from '../lib/deckDiff'

describe('deck diff', () => {
  it('reports count deltas in both directions', () => {
    const result = diff(
      { cards: [{ name: 'Cut Me', count: 4 }, { name: 'Add Me', count: 1 }] },
      { cards: [{ name: 'Cut Me', count: 2 }, { name: 'Add Me', count: 3 }] },
    )

    expect(result.cuts).toEqual([{ name: 'Cut Me', from: 4, to: 2, delta: -2 }])
    expect(result.adds).toEqual([{ name: 'Add Me', from: 1, to: 3, delta: 2 }])
    expect(result.totals).toEqual({ aCount: 5, bCount: 5, changed: 4 })
  })

  it('reports cards only in the current deck as cuts', () => {
    expect(diff({ cards: [{ name: 'Old Card', count: 3 }] }, { cards: [] }).cuts)
      .toEqual([{ name: 'Old Card', from: 3, to: 0, delta: -3 }])
  })

  it('reports cards only in the target deck as adds', () => {
    expect(diff({ cards: [] }, { cards: [{ name: 'New Card', count: 4 }] }).adds)
      .toEqual([{ name: 'New Card', from: 0, to: 4, delta: 4 }])
  })

  it('keeps identical lists unchanged', () => {
    const result = diff(
      { cards: [{ name: 'Same Card', count: 4 }] },
      { cards: [{ name: 'Same Card', count: 4 }] },
    )

    expect(result.cuts).toEqual([])
    expect(result.adds).toEqual([])
    expect(result.unchanged).toEqual(['Same Card'])
    expect(result.totals.changed).toBe(0)
  })

  it('matches names without regard to case or surrounding whitespace', () => {
    const result = diff(
      { cards: [{ name: '  Mickey Mouse  ', count: 4 }] },
      { cards: [{ name: 'mIcKeY mOuSe', count: 2 }] },
    )

    expect(result.cuts).toEqual([{ name: 'Mickey Mouse', from: 4, to: 2, delta: -2 }])
    expect(result.adds).toEqual([])
  })
})

describe('ink deltas', () => {
  it('aggregates the deck-change repro by normalized ink name', () => {
    const current = [
      { ink: 'Steel', count: 4 },
      { ink: 'Ruby', count: 2 },
    ]
    const target = [
      { ink: 'steel', count: 2 },
      { ink: 'ruby', count: 4 },
      { ink: 'Ruby', count: 1 },
    ]

    expect(inkDeltas(current, target)).toEqual({ steel: -2, ruby: 3 })
  })
})
