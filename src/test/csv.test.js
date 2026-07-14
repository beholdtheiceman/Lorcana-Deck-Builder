import { describe, expect, it } from 'vitest'
import { parseCsv } from '../lib/csv'

describe('parseCsv', () => {
  it('parses quoted fields and embedded commas and newlines', () => {
    expect(parseCsv('name,notes\n"Steel Song","fast, resilient"\nRuby,"line one\nline two"')).toEqual([
      { name: 'Steel Song', notes: 'fast, resilient' },
      { name: 'Ruby', notes: 'line one\nline two' },
    ])
  })

  it('unescapes doubled quotes', () => {
    expect(parseCsv('deck,notes\nAmethyst,"Said ""hello"""')).toEqual([{ deck: 'Amethyst', notes: 'Said "hello"' }])
  })

  it('returns an empty array for an empty file', () => {
    expect(parseCsv('')).toEqual([])
  })

  it('tolerates short and long ragged rows', () => {
    expect(parseCsv('a,b,c\n1,2\n3,4,5,6')).toEqual([
      { a: '1', b: '2', c: '' },
      { a: '3', b: '4', c: '5' },
    ])
  })
})
