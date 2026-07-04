// Tests for api/_lib/deckTextParse.js — permissive pasted-decklist parsing.
// Pure text→pairs; card-name resolution happens later in summarizeNamedCards.
import { describe, it, expect } from 'vitest'
import { parseDeckText, MAX_DECK_TEXT_CHARS } from '../../api/_lib/deckTextParse.js'

describe('parseDeckText', () => {
  it('parses "N Name" and "Nx Name" lines', () => {
    const { pairs, error } = parseDeckText('4 Be Prepared\n2x Mickey Mouse - Brave Little Tailor\n1X Lantern')
    expect(error).toBeUndefined()
    expect(pairs).toEqual([
      { name: 'Be Prepared', count: 4 },
      { name: 'Mickey Mouse - Brave Little Tailor', count: 2 },
      { name: 'Lantern', count: 1 },
    ])
  })

  it('skips blank lines and passes count-less lines through as implicit', () => {
    const { pairs } = parseDeckText('Ruby/Sapphire\n\n  \n4 Be Prepared')
    expect(pairs).toEqual([
      { name: 'Ruby/Sapphire', count: 1, implicit: true },
      { name: 'Be Prepared', count: 4 },
    ])
  })

  it('rejects out-of-range counts as implicit-style lines rather than huge decks', () => {
    const { pairs } = parseDeckText('999 Be Prepared')
    expect(pairs).toEqual([{ name: '999 Be Prepared', count: 1, implicit: true }])
  })

  it('errors on oversized input', () => {
    const { error } = parseDeckText('x'.repeat(MAX_DECK_TEXT_CHARS + 1))
    expect(error).toMatch(/too (long|large)/i)
  })

  it('errors on empty input', () => {
    expect(parseDeckText('').error).toBeTruthy()
    expect(parseDeckText('   \n  ').error).toBeTruthy()
  })

  it('caps the number of lines', () => {
    const big = Array.from({ length: 200 }, () => '4 Be Prepared').join('\n')
    const { error } = parseDeckText(big)
    expect(error).toMatch(/too many lines/i)
  })
})
