function normalizedName(value) {
  return String(value || '').trim().toLowerCase()
}

function indexedCards(payload) {
  const cards = new Map()

  for (const card of payload?.cards || []) {
    const name = String(card?.name || '').trim()
    const count = Number(card?.count)
    const key = normalizedName(name)
    if (!key || !Number.isFinite(count)) continue

    const previous = cards.get(key)
    cards.set(key, {
      name: previous?.name || name,
      count: (previous?.count || 0) + count,
    })
  }

  return cards
}

/**
 * Aggregate target-minus-current copy deltas from ink-split segments.
 * Ink names are normalized because card sources and callers may use different
 * casing for the same ink.
 */
export function inkDeltas(currentSegments, targetSegments) {
  const deltas = {}

  for (const [direction, segments] of [[-1, currentSegments], [1, targetSegments]]) {
    for (const segment of segments || []) {
      const ink = String(segment?.ink || '').trim().toLowerCase()
      const count = Number(segment?.count)
      if (!ink || !Number.isFinite(count)) continue
      deltas[ink] = (deltas[ink] || 0) + (direction * count)
    }
  }

  return Object.fromEntries(Object.entries(deltas).filter(([, delta]) => delta !== 0))
}

/**
 * Compare two DeckPayload objects by normalized card name.
 * curveShift is the signed copy movement used by the UI after resolving card
 * metadata (cost and ink are intentionally not part of DeckPayload).
 */
export function diff(a, b) {
  const aCards = indexedCards(a)
  const bCards = indexedCards(b)
  const names = new Set([...aCards.keys(), ...bCards.keys()])
  const cuts = []
  const adds = []
  const unchanged = []

  for (const key of names) {
    const current = aCards.get(key)
    const target = bCards.get(key)
    const from = current?.count || 0
    const to = target?.count || 0
    const delta = to - from

    if (delta < 0) cuts.push({ name: current.name, from, to, delta })
    else if (delta > 0) adds.push({ name: target.name, from, to, delta })
    else unchanged.push(current?.name || target.name)
  }

  const byName = (left, right) => left.name.localeCompare(right.name)
  cuts.sort(byName)
  adds.sort(byName)
  unchanged.sort((left, right) => left.localeCompare(right))

  const aCount = Array.from(aCards.values()).reduce((sum, card) => sum + card.count, 0)
  const bCount = Array.from(bCards.values()).reduce((sum, card) => sum + card.count, 0)
  const changed = [...cuts, ...adds].reduce((sum, card) => sum + Math.abs(card.delta), 0)
  const curveShift = [...cuts, ...adds]
    .map(({ name, delta }) => ({ name, delta }))
    .sort(byName)

  return {
    cuts,
    adds,
    unchanged,
    totals: { aCount, bCount, changed },
    curveShift,
  }
}
