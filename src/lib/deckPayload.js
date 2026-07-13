import { useLocation } from 'react-router-dom'

const MAX_ENCODED_LENGTH = 12000
const MAX_CARDS = 120
const MAX_NAME_LENGTH = 200

function displayName(card) {
  const name = String(card?.name || card?.baseName || '').trim()
  const subname = String(card?.subname || '').trim()
  if (!subname || name.toLowerCase().includes(subname.toLowerCase())) return name
  return `${name} - ${subname}`
}

function cleanCards(cards) {
  if (!Array.isArray(cards) || cards.length > MAX_CARDS) return null

  const cleaned = []
  for (const card of cards) {
    const name = String(card?.name || '').trim()
    const count = Number(card?.count)
    if (!name || name.length > MAX_NAME_LENGTH || !Number.isInteger(count) || count < 1 || count > 60) {
      return null
    }
    cleaned.push({
      name,
      count,
      ...(typeof card.cardId === 'string' && card.cardId ? { cardId: card.cardId } : {}),
    })
  }
  return cleaned
}

function validPayload(payload) {
  if (!payload || typeof payload !== 'object') return null
  const cards = cleanCards(payload.cards)
  if (!cards) return null
  return { ...payload, cards }
}

export function toPayload(deckState) {
  const entries = Object.values(deckState?.entries || {})
  const cards = entries
    .filter((entry) => entry?.card && Number(entry.count) > 0)
    .map((entry) => ({
      name: displayName(entry.card),
      count: Number(entry.count),
      ...(entry.card.id ? { cardId: String(entry.card.id) } : {}),
    }))
    .filter((card) => card.name)
    .sort((a, b) => a.name.localeCompare(b.name))

  const inks = Array.from(new Set(entries.flatMap((entry) => {
    const value = entry?.card?.inks
    return (Array.isArray(value) ? value : [value]).filter(Boolean).map(String)
  })))

  const meta = {
    ...(deckState?.name ? { name: String(deckState.name) } : {}),
    ...(inks.length ? { inks } : {}),
    ...(deckState?.id ? { deckId: String(deckState.id) } : {}),
  }

  return { cards, ...(Object.keys(meta).length ? { meta } : {}) }
}

export function encodePayload(payload) {
  const valid = validPayload(payload)
  if (!valid) return null

  const compact = valid.cards.map(({ name, count }) => ({ n: name, c: count }))
  const bytes = new TextEncoder().encode(JSON.stringify(compact))
  const encoded = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
  return encoded.length <= MAX_ENCODED_LENGTH ? encoded : null
}

export function decodePayload(str) {
  try {
    if (typeof str !== 'string' || !str || str.length > MAX_ENCODED_LENGTH || !/^[A-Za-z0-9_-]+$/.test(str)) {
      return null
    }
    const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4)
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const compact = JSON.parse(new TextDecoder().decode(bytes))
    if (!Array.isArray(compact)) return null
    const cards = cleanCards(compact.map((card) => ({ name: card?.n, count: card?.c })))
    return cards ? { cards } : null
  } catch {
    return null
  }
}

export function useIncomingDeck() {
  const location = useLocation()
  const stateDeck = validPayload(location.state?.deck)
  if (stateDeck) return stateDeck
  return decodePayload(new URLSearchParams(location.search).get('deck'))
}
