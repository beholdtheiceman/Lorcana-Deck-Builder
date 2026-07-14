import { describe, expect, it } from 'vitest'
import { calculatePerformanceStats } from '../lib/performanceStats'

const games = [
  { date: '2026-01-01T10:00:00Z', myDeck: 'Steel Song', opponentDeck: 'Ruby', result: 'win', playDraw: 'play' },
  { date: '2026-01-01T10:30:00Z', myDeck: 'Steel Song', opponentDeck: 'Ruby', result: 'loss', playDraw: 'draw' },
  { date: '2026-01-01T11:00:00Z', myDeck: 'Steel Song', opponentDeck: 'Emerald', result: 'win', playDraw: 'draw' },
  { date: '2026-01-01T11:30:00Z', myDeck: 'Ruby Amethyst', opponentDeck: 'Steel', result: 'loss', playDraw: 'play' },
  { date: '2026-01-01T12:00:00Z', myDeck: 'Ruby Amethyst', opponentDeck: 'Steel', result: 'loss', playDraw: 'draw' },
  { date: '2026-01-01T12:30:00Z', myDeck: 'Ruby Amethyst', opponentDeck: 'Steel', result: 'loss', playDraw: 'play' },
]

describe('calculatePerformanceStats', () => {
  it('calculates overall, deck, matchup, and play/draw win rates', () => {
    const stats = calculatePerformanceStats(games)
    expect(stats.overall).toMatchObject({ games: 6, wins: 2, losses: 4, winRate: 2 / 6 })
    expect(stats.byDeck.find((row) => row.deck === 'Steel Song')).toMatchObject({ games: 3, wins: 2, winRate: 2 / 3 })
    expect(stats.byMatchup.find((row) => row.myDeck === 'Steel Song' && row.opponentDeck === 'Ruby')).toMatchObject({ games: 2, wins: 1, winRate: 0.5 })
    expect(stats.playDraw.play).toMatchObject({ games: 3, wins: 1, winRate: 1 / 3 })
    expect(stats.playDraw.draw).toMatchObject({ games: 3, wins: 1, winRate: 1 / 3 })
  })

  it('triggers tilt after three consecutive losses in one session', () => {
    const stats = calculatePerformanceStats(games)
    expect(stats.tilt.triggered).toBe(true)
    expect(stats.tilt.maxConsecutiveLosses).toBe(3)
    expect(stats.tilt.events).toHaveLength(1)
  })

  it('ignores malformed outcomes and tolerates absent optional columns', () => {
    const stats = calculatePerformanceStats([{ result: 'W' }, { result: 'unknown' }, null])
    expect(stats.overall).toMatchObject({ games: 1, wins: 1, winRate: 1 })
    expect(stats.byDeck).toEqual([])
    expect(stats.ignoredRows).toBe(2)
  })
})
