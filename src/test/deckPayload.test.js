import { describe, expect, it } from 'vitest'
import { decodePayload, encodePayload } from '../lib/deckPayload'

describe('deck payload URL codec', () => {
  it('round-trips card names and counts', () => {
    const payload = {
      cards: [
        { name: 'Mickey Mouse - Brave Little Tailor', count: 4 },
        { name: 'Déjà Vu', count: 2 },
      ],
    }

    expect(decodePayload(encodePayload(payload))).toEqual(payload)
  })

  it('round-trips an empty payload', () => {
    expect(decodePayload(encodePayload({ cards: [] }))).toEqual({ cards: [] })
  })

  it('returns null for oversized or malformed input', () => {
    expect(decodePayload('a'.repeat(12001))).toBeNull()
    expect(decodePayload('not+base64')).toBeNull()
    expect(decodePayload('e30')).toBeNull()
    expect(decodePayload('garbage')).toBeNull()
  })
})
