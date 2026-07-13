export const CARD_SIZE = Object.freeze({ w: 180, h: 252 })
export const GRID = Object.freeze({ columns: 3, rows: 3, gutter: 6 })
export const PAGE_SIZES = Object.freeze({
  Letter: Object.freeze({ w: 612, h: 792 }),
  A4: Object.freeze({ w: 595, h: 842 }),
})

export function pageDimensions(pageSize = 'Letter') {
  const dimensions = PAGE_SIZES[pageSize]
  if (!dimensions) throw new Error(`Unsupported page size: ${pageSize}`)
  return dimensions
}

export function paginate(items, perPage = GRID.columns * GRID.rows) {
  if (!Array.isArray(items)) throw new TypeError('items must be an array')
  if (!Number.isInteger(perPage) || perPage < 1) throw new RangeError('perPage must be a positive integer')

  const pages = []
  for (let index = 0; index < items.length; index += perPage) {
    pages.push(items.slice(index, index + perPage))
  }
  return pages
}

export function slotPosition(index, pageSize = 'Letter') {
  if (!Number.isInteger(index) || index < 0 || index >= GRID.columns * GRID.rows) {
    throw new RangeError('slot index must be between 0 and 8')
  }

  const page = pageDimensions(pageSize)
  const contentWidth = (GRID.columns * CARD_SIZE.w) + ((GRID.columns - 1) * GRID.gutter)
  const contentHeight = (GRID.rows * CARD_SIZE.h) + ((GRID.rows - 1) * GRID.gutter)
  const marginX = (page.w - contentWidth) / 2
  const marginY = (page.h - contentHeight) / 2
  const column = index % GRID.columns
  const row = Math.floor(index / GRID.columns)

  return {
    x: marginX + (column * (CARD_SIZE.w + GRID.gutter)),
    y: page.h - marginY - CARD_SIZE.h - (row * (CARD_SIZE.h + GRID.gutter)),
    w: CARD_SIZE.w,
    h: CARD_SIZE.h,
  }
}

export function slotsForPage(itemCount = 9, pageSize = 'Letter') {
  const count = Math.max(0, Math.min(GRID.columns * GRID.rows, Math.floor(Number(itemCount) || 0)))
  return Array.from({ length: count }, (_, index) => slotPosition(index, pageSize))
}

export function layoutPages(items, pageSize = 'Letter', perPage = 9) {
  return paginate(items, perPage).map((pageItems) => ({
    items: pageItems,
    slots: slotsForPage(pageItems.length, pageSize),
  }))
}
