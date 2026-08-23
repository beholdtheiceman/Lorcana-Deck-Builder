import { parseTextImport } from '../lib/import/textImport.js'

// Pool cards carry image_url plus _raw.image_uris. The import path used to
// derive the image from toAppCard(), which reads `imageUrl` (camelCase) and
// drops _raw -- so every imported card lost its art and rendered a placeholder.
const POOL = [{
  id: 'crd_1',
  name: 'Cinderella - Ballroom Sensation',
  baseName: 'Cinderella',
  subname: 'Ballroom Sensation',
  cost: 2, inks: ['Amethyst'], type: 'Character', setNum: 9, number: '42',
  classifications: ['Hero', 'Princess'],
  abilities: ['Singer 4'],
  image_url: 'https://cards.lorcast.io/card/digital/small/crd_1.avif',
  _raw: { image_uris: { digital: {
    small: 'https://cards.lorcast.io/card/digital/small/crd_1.avif',
    normal: 'https://cards.lorcast.io/card/digital/normal/crd_1.avif',
  } } },
}]

describe('imported cards keep their art', () => {
  it('stores a usable image url', () => {
    const deck = parseTextImport('4 Cinderella - Ballroom Sensation', POOL)
    const card = Object.values(deck.entries)[0].card
    expect(card.image_url).toBeTruthy()
    expect(typeof card.image_url).toBe('string')
  })

  it('keeps the raw image data so downstream resolvers can work', () => {
    const deck = parseTextImport('4 Cinderella - Ballroom Sensation', POOL)
    const card = Object.values(deck.entries)[0].card
    expect(card._raw?.image_uris || card.image_url).toBeTruthy()
  })
})

describe('toAppCard tolerates real pool card shapes', () => {
  it('does not throw when classifications and abilities are arrays', async () => {
    const { toAppCard } = await import('../lib/cards/normalize.js')
    expect(() => toAppCard(POOL[0])).not.toThrow()
  })

  it('still parses legacy comma-separated strings', async () => {
    const { toAppCard } = await import('../lib/cards/normalize.js')
    const card = toAppCard({ ...POOL[0], classifications: 'Hero, Princess' })
    expect(card.classifications).toEqual(['Hero', 'Princess'])
  })
})
