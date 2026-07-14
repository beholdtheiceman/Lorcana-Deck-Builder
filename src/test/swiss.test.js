import { describe, expect, it } from 'vitest'
import { simulate } from '../lib/swiss'

const BASE = { players: 64, rounds: 6, record: { wins: 0, losses: 0 }, winProbability: 0.5, iterations: 2000 }

describe('Swiss simulation', () => {
  it('is deterministic for a seed and changes for another seed', () => {
    expect(simulate({ ...BASE, seed: 1234 })).toEqual(simulate({ ...BASE, seed: 1234 }))
    expect(simulate({ ...BASE, seed: 1234 }).pointsDistribution)
      .not.toEqual(simulate({ ...BASE, seed: 4321 }).pointsDistribution)
  })

  it('centers a 50% record around half of the available points', () => {
    const result = simulate({ ...BASE, iterations: 10000, seed: 17 })
    expect(result.meanPoints).toBeGreaterThan(8.7)
    expect(result.meanPoints).toBeLessThan(9.3)
  })

  it('matches the hand-calculated chance to win at least two of three rounds', () => {
    const result = simulate({
      players: 32, rounds: 3, record: '0-0', winProbability: 0.5,
      pointsThreshold: 6, iterations: 20000, seed: 99,
    })
    // Binomial(3, .5): P(2 or 3 wins) = 4/8 = 50%.
    expect(result.thresholdProbability).toBeGreaterThan(0.48)
    expect(result.thresholdProbability).toBeLessThan(0.52)
  })
})
