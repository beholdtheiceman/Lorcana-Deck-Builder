const emptyStats = () => ({
  total: 0,
  curve: [1, 2, 3, 4, 5, 6, 7].map((cost) => ({ cost, count: 0 })),
  avgCost: 0,
  inkable: { inkable: 0, uninkable: 0, ratio: 0 },
  byType: [],
  inkSplit: [],
})

function isInkable(card) {
  if (typeof card?.inkable === 'boolean') return card.inkable
  if (typeof card?._raw?.inkable === 'boolean') return card._raw.inkable
  if (typeof card?._raw?.inkwell === 'boolean') return card._raw.inkwell
  return false
}

export function computeDeckStats(deck) {
  const entries = Object.values(deck?.entries || {}).filter((e) => e?.card && e.count > 0)
  if (!entries.length) return emptyStats()

  const curveMap = new Map([1, 2, 3, 4, 5, 6, 7].map((c) => [c, 0]))
  const typeMap = new Map()
  const inkMap = new Map()
  let total = 0
  let costSum = 0
  let inkableCount = 0

  for (const { card, count } of entries) {
    total += count
    const cost = Number(card.cost) || 0
    costSum += cost * count
    const bucket = cost >= 7 ? 7 : Math.max(1, cost)
    curveMap.set(bucket, curveMap.get(bucket) + count)

    const type = card.type || 'Unknown'
    typeMap.set(type, (typeMap.get(type) || 0) + count)

    for (const ink of card.inks || []) {
      inkMap.set(ink, (inkMap.get(ink) || 0) + count)
    }

    if (isInkable(card)) inkableCount += count
  }

  return {
    total,
    curve: [...curveMap.entries()].map(([cost, count]) => ({ cost, count })),
    avgCost: Math.round((costSum / total) * 10) / 10,
    inkable: {
      inkable: inkableCount,
      uninkable: total - inkableCount,
      ratio: inkableCount / total,
    },
    byType: [...typeMap.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    inkSplit: [...inkMap.entries()]
      .map(([ink, count]) => ({ ink, count }))
      .sort((a, b) => b.count - a.count),
  }
}
