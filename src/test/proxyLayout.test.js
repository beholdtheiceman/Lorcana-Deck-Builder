import { describe, expect, it } from 'vitest'
import { CARD_SIZE, layoutPages, paginate, slotPosition, slotsForPage } from '../lib/proxyLayout.js'

describe('proxy layout', () => {
  it('paginates 60 expanded cards into seven sheets', () => {
    const cards = Array.from({ length: 60 }, (_, index) => index)
    const pages = paginate(cards)
    expect(pages).toHaveLength(7)
    expect(pages.slice(0, 6).every((page) => page.length === 9)).toBe(true)
    expect(pages[6]).toHaveLength(6)
    expect(layoutPages(cards, 'Letter')[6].slots).toHaveLength(6)
  })

  it('places a centered 3 by 3 Letter grid from top-left to bottom-right', () => {
    const slots = slotsForPage(9, 'Letter')
    expect(slots[0]).toEqual({ x: 30, y: 528, ...CARD_SIZE })
    expect(slots[1]).toEqual({ x: 216, y: 528, ...CARD_SIZE })
    expect(slots[3]).toEqual({ x: 30, y: 270, ...CARD_SIZE })
    expect(slots[8]).toEqual({ x: 402, y: 12, ...CARD_SIZE })
  })

  it('centers the same card grid differently on A4', () => {
    expect(slotPosition(0, 'A4')).toEqual({ x: 21.5, y: 553, ...CARD_SIZE })
    expect(slotPosition(0, 'A4')).not.toEqual(slotPosition(0, 'Letter'))
  })
})
