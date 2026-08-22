import { asUrl, encodeImageURL, lorcanaImageProxyUrl } from '../lib/cards/imageUrl.js'

describe('asUrl', () => {
  it('returns a string url unchanged', () => {
    expect(asUrl('https://example.com/a.png')).toBe('https://example.com/a.png')
  })

  it('returns null for null', () => {
    expect(asUrl(null)).toBeNull()
  })
})

describe('encodeImageURL', () => {
  it('encodes spaces in the path', () => {
    expect(encodeImageURL('https://x.com/a b.png')).toContain('%20')
  })

  it('double-encodes an already-encoded url', () => {
    const once = encodeImageURL('https://x.com/a b.png')
    expect(encodeImageURL(once)).toBe('https://x.com/a%2520b.png')
  })
})

describe('lorcanaImageProxyUrl', () => {
  it('returns a non-empty string for a valid source', () => {
    const out = lorcanaImageProxyUrl('https://cards.lorcast.io/card/digital/small/crd_1.avif')
    expect(typeof out).toBe('string')
    expect(out.length).toBeGreaterThan(0)
  })

  it('does not throw on empty input', () => {
    expect(() => lorcanaImageProxyUrl('')).not.toThrow()
  })
})
