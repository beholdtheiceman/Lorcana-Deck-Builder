import { describe, expect, it } from 'vitest'
import {
  byTurn,
  hypergeom,
  hypergeomRange,
  mulliganAdjust,
  multivariateHypergeom,
} from '../lib/hypergeometric'

function bruteForceJoint(deck, drawSize, groups) {
  let total = 0
  let favorable = 0

  function visit(start, chosen) {
    if (chosen.length === drawSize) {
      total += 1
      const counts = groups.map((group) => chosen.filter((index) => deck[index] === group.label).length)
      if (counts.every((count, index) => count >= groups[index].min && count <= groups[index].max)) favorable += 1
      return
    }
    for (let index = start; index <= deck.length - (drawSize - chosen.length); index += 1) {
      visit(index + 1, [...chosen, index])
    }
  }

  visit(0, [])
  return favorable / total
}

describe('hypergeometric probabilities', () => {
  it('matches a hand-checkable exactly-two value', () => {
    // C(4,2) * C(6,1) / C(10,3) = 36 / 120.
    expect(hypergeom(10, 4, 3, 2)).toBeCloseTo(0.3, 12)
  })

  it('calculates at least one success', () => {
    const expected = 1 - (56 * 55 * 54 * 53 * 52 * 51 * 50) / (60 * 59 * 58 * 57 * 56 * 55 * 54)
    expect(hypergeomRange(60, 4, 7, 1, 7)).toBeCloseTo(expected, 12)
  })

  it('matches brute-force enumeration for multiple disjoint groups', () => {
    const deck = ['A', 'A', 'A', 'B', 'B', 'other', 'other', 'other']
    const groups = [
      { label: 'A', copies: 3, min: 1, max: 2 },
      { label: 'B', copies: 2, min: 1, max: 1 },
    ]
    const bruteForce = bruteForceJoint(deck, 4, groups)
    expect(multivariateHypergeom(8, 4, groups)).toBeCloseTo(bruteForce, 12)
  })

  it('models bottomed cards as unavailable during the mulligan redraw', () => {
    expect(mulliganAdjust({ N: 8, handSize: 7, groups: [{ copies: 1, min: 1, max: 1 }] })).toBe(1)
  })

  it('skips the first-turn draw on the play', () => {
    const groups = [{ copies: 4, min: 1, max: 4 }]
    const play = byTurn({ N: 60, groups, onThePlay: true, turns: 2 })
    const draw = byTurn({ N: 60, groups, onThePlay: false, turns: 2 })
    expect(play.map((point) => point.drawSize)).toEqual([7, 8])
    expect(draw.map((point) => point.drawSize)).toEqual([8, 9])
  })
})
