import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { layoutPages, pageDimensions } from './proxyLayout.js'

const BLACK = rgb(0.08, 0.08, 0.1)
const MUTED = rgb(0.35, 0.35, 0.4)
const BORDER = rgb(0.18, 0.18, 0.22)
const WHITE = rgb(1, 1, 1)

function printable(value) {
  return String(value ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7e\n]/g, '?')
}

function label(value, fallback = '-') {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || fallback
  return printable(value).trim() || fallback
}

export function wrapText(text, font, size, maxWidth) {
  const lines = []
  for (const paragraph of printable(text).split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean)
    if (!words.length) {
      lines.push('')
      continue
    }
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (!line || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate
      } else {
        lines.push(line)
        line = word
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

function statsLine(card) {
  const parts = []
  if (card?.strength !== undefined && card?.strength !== null && card?.strength !== '') parts.push(`Strength ${card.strength}`)
  if (card?.willpower !== undefined && card?.willpower !== null && card?.willpower !== '') parts.push(`Willpower ${card.willpower}`)
  if (card?.lore !== undefined && card?.lore !== null && card?.lore !== '') parts.push(`Lore ${card.lore}`)
  return parts.join('  |  ')
}

function drawTextProxy(page, card, slot, fonts) {
  const inset = 10
  const left = slot.x + inset
  const maxWidth = slot.w - (inset * 2)
  const bottom = slot.y + inset
  let y = slot.y + slot.h - 18

  page.drawRectangle({ x: slot.x, y: slot.y, width: slot.w, height: slot.h, borderWidth: 1, borderColor: BORDER })
  const titleLines = wrapText(label(card?.name, 'Unknown card'), fonts.bold, 12, maxWidth).slice(0, 2)
  for (const line of titleLines) {
    page.drawText(line, { x: left, y, size: 12, font: fonts.bold, color: BLACK })
    y -= 14
  }

  y -= 2
  page.drawText(`Cost: ${label(card?.cost)}   Ink: ${label(card?.inks)}`, { x: left, y, size: 8.5, font: fonts.regular, color: MUTED })
  y -= 13
  page.drawText(`Type: ${label(card?.type)}   Rarity: ${label(card?.rarity)}`, { x: left, y, size: 8, font: fonts.regular, color: MUTED, maxWidth })
  y -= 13

  const stats = statsLine(card)
  if (stats) {
    page.drawText(printable(stats), { x: left, y, size: 8, font: fonts.bold, color: BLACK, maxWidth })
    y -= 14
  }

  page.drawLine({ start: { x: left, y: y + 4 }, end: { x: slot.x + slot.w - inset, y: y + 4 }, thickness: 0.5, color: MUTED })
  for (const line of wrapText(card?.text || 'No rules text.', fonts.regular, 8, maxWidth)) {
    if (y < bottom + 13) break
    page.drawText(line, { x: left, y, size: 8, font: fonts.regular, color: BLACK })
    y -= 10
  }

  page.drawText('PLAYTEST PROXY - NOT FOR SALE', { x: left, y: bottom, size: 6.5, font: fonts.bold, color: MUTED })
}

function imageKind(bytes, contentType) {
  const type = String(contentType || '').toLowerCase()
  if (type.includes('png') || (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)) return 'png'
  if (type.includes('jpeg') || type.includes('jpg') || (bytes[0] === 0xff && bytes[1] === 0xd8)) return 'jpg'
  return null
}

async function embedRemoteImage(pdf, url, fetchImpl) {
  if (!url) throw new Error('Card has no image URL')
  const response = await fetchImpl(url, { mode: 'cors' })
  if (!response.ok) throw new Error(`Image request failed (${response.status})`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const kind = imageKind(bytes, response.headers?.get?.('content-type'))
  if (kind === 'png') return pdf.embedPng(bytes)
  if (kind === 'jpg') return pdf.embedJpg(bytes)
  throw new Error('Unsupported card image format')
}

export async function buildProxyPdf(cards, {
  mode = 'image',
  pageSize = 'Letter',
  fetchImpl = fetch,
  onProgress,
} = {}) {
  if (!Array.isArray(cards)) throw new TypeError('cards must be an array')
  if (!['image', 'text-only'].includes(mode)) throw new Error(`Unsupported proxy mode: ${mode}`)

  const pdf = await PDFDocument.create()
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  }
  const dimensions = pageDimensions(pageSize)
  const pages = layoutPages(cards, pageSize)
  const embedded = new Map()
  let completed = 0

  for (const layout of pages) {
    const page = pdf.addPage([dimensions.w, dimensions.h])
    for (let index = 0; index < layout.items.length; index += 1) {
      const card = layout.items[index]
      const slot = layout.slots[index]
      let renderedImage = false
      if (mode === 'image' && card?.image_url) {
        try {
          let image = embedded.get(card.image_url)
          if (!image) {
            image = await embedRemoteImage(pdf, card.image_url, fetchImpl)
            embedded.set(card.image_url, image)
          }
          page.drawImage(image, { x: slot.x, y: slot.y, width: slot.w, height: slot.h })
          page.drawRectangle({ x: slot.x, y: slot.y, width: slot.w, height: 10, color: WHITE, opacity: 0.82 })
          page.drawText('PLAYTEST PROXY - NOT FOR SALE', { x: slot.x + 5, y: slot.y + 2.5, size: 6.5, font: fonts.bold, color: BLACK })
          renderedImage = true
        } catch {
          // A missing, blocked, or malformed image degrades only this proxy.
        }
      }
      if (!renderedImage) drawTextProxy(page, card, slot, fonts)
      completed += 1
      onProgress?.({ completed, total: cards.length })
    }
  }

  return pdf.save()
}

export const generateProxyPdf = buildProxyPdf
