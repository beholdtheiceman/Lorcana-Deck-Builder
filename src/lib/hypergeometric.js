const chooseCache = new Map()

function isWhole(value) {
  return Number.isInteger(value) && value >= 0
}

function choose(n, k) {
  if (!isWhole(n) || !isWhole(k) || k > n) return 0
  k = Math.min(k, n - k)
  const key = `${n}:${k}`
  if (chooseCache.has(key)) return chooseCache.get(key)
  let result = 1
  for (let i = 1; i <= k; i += 1) result *= (n - k + i) / i
  chooseCache.set(key, result)
  return result
}

function normalizedGroups(N, groups) {
  if (!isWhole(N) || !Array.isArray(groups)) return null
  const clean = groups.map((group) => ({
    copies: Number(group?.copies),
    min: Number(group?.min ?? 0),
    max: Number(group?.max ?? group?.copies),
  }))
  if (clean.some((group) => !isWhole(group.copies) || !isWhole(group.min) || !isWhole(group.max) || group.min > group.max)) return null
  if (clean.reduce((sum, group) => sum + group.copies, 0) > N) return null
  return clean
}

function boundedProbability(value) {
  if (value < 0 && value > -1e-12) return 0
  if (value > 1 && value < 1 + 1e-12) return 1
  return value
}

/** Probability of exactly k successes in n draws without replacement. */
export function hypergeom(N, K, n, k) {
  if (![N, K, n, k].every(isWhole) || K > N || n > N) return 0
  if (k > K || n - k > N - K) return 0
  return boundedProbability((choose(K, k) * choose(N - K, n - k)) / choose(N, n))
}

/** Probability that the success count is between min and max, inclusive. */
export function hypergeomRange(N, K, n, min = 0, max = n) {
  if (![min, max].every(isWhole) || min > max) return 0
  let probability = 0
  for (let k = min; k <= Math.min(max, n, K); k += 1) probability += hypergeom(N, K, n, k)
  return boundedProbability(probability)
}

function categoryEventProbability(groupCopies, otherCopies, drawSize, ranges) {
  const population = groupCopies.reduce((sum, count) => sum + count, otherCopies)
  if (!isWhole(drawSize) || drawSize > population) return 0
  const denominator = choose(population, drawSize)
  let favorable = 0

  function visit(index, used, ways) {
    if (index === groupCopies.length) {
      const otherDrawn = drawSize - used
      if (otherDrawn >= 0 && otherDrawn <= otherCopies) favorable += ways * choose(otherCopies, otherDrawn)
      return
    }
    const { min, max } = ranges[index]
    const upper = Math.min(max, groupCopies[index], drawSize - used)
    for (let count = min; count <= upper; count += 1) {
      visit(index + 1, used + count, ways * choose(groupCopies[index], count))
    }
  }

  visit(0, 0, 1)
  return denominator ? boundedProbability(favorable / denominator) : 0
}

/** Exact joint probability for disjoint card groups. */
export function multivariateHypergeom(N, n, groups) {
  const clean = normalizedGroups(N, groups)
  if (!clean || !isWhole(n) || n > N) return 0
  const groupedCopies = clean.reduce((sum, group) => sum + group.copies, 0)
  return categoryEventProbability(
    clean.map((group) => group.copies),
    N - groupedCopies,
    n,
    clean.map(({ min, max }) => ({ min, max })),
  )
}

export const jointProbability = multivariateHypergeom

function countVectors(capacities, total, callback, index = 0, vector = []) {
  if (index === capacities.length - 1) {
    const count = total
    if (count >= 0 && count <= capacities[index]) callback([...vector, count])
    return
  }
  for (let count = 0; count <= Math.min(capacities[index], total); count += 1) {
    countVectors(capacities, total - count, callback, index + 1, [...vector, count])
  }
}

function bestMulliganForHand(N, groups, opening) {
  const handSize = opening.reduce((sum, count) => sum + count, 0)
  const capacities = opening
  const library = groups.map((group, index) => group.copies - opening[index])
  const groupedCopies = groups.reduce((sum, group) => sum + group.copies, 0)
  const openingGrouped = opening.slice(0, groups.length).reduce((sum, count) => sum + count, 0)
  library.push((N - groupedCopies) - (handSize - openingGrouped))
  const librarySize = N - handSize
  let best = 0

  // Enumerate every subset to keep. Bottomed cards are unavailable for the redraw.
  function considerKeeps(index, kept) {
    if (index === capacities.length) {
      const keptTotal = kept.reduce((sum, count) => sum + count, 0)
      const redraw = handSize - keptTotal
      if (redraw > librarySize) return
      const ranges = groups.map((group, groupIndex) => ({
        min: Math.max(0, group.min - kept[groupIndex]),
        max: group.max - kept[groupIndex],
      }))
      if (ranges.some(({ max }) => max < 0)) return
      best = Math.max(best, categoryEventProbability(library.slice(0, -1), library.at(-1), redraw, ranges))
      return
    }
    for (let count = 0; count <= capacities[index]; count += 1) considerKeeps(index + 1, [...kept, count])
  }

  considerKeeps(0, [])
  return best
}

/**
 * Exact probability after an optimal Lorcana bottom-and-redraw mulligan.
 * Accepts mulliganAdjust({ N, groups, handSize }) or mulliganAdjust(N, groups, handSize).
 */
export function mulliganAdjust(input, positionalGroups, positionalHandSize = 7) {
  const { N, groups, handSize = 7 } = typeof input === 'object'
    ? input
    : { N: input, groups: positionalGroups, handSize: positionalHandSize }
  const clean = normalizedGroups(N, groups)
  if (!clean || !isWhole(handSize) || handSize > N) return 0

  const capacities = [...clean.map((group) => group.copies), N - clean.reduce((sum, group) => sum + group.copies, 0)]
  const denominator = choose(N, handSize)
  let probability = 0
  countVectors(capacities, handSize, (opening) => {
    const ways = opening.reduce((product, count, index) => product * choose(capacities[index], count), 1)
    probability += (ways / denominator) * bestMulliganForHand(N, clean, opening)
  })
  return boundedProbability(probability)
}

/** Probability by turns 1..turns. extraLooks is a cumulative number or per-turn array. */
export function byTurn({ N, groups, onThePlay = true, extraLooks = 0, turns = 10 } = {}) {
  if (!isWhole(turns)) return []
  return Array.from({ length: turns }, (_, index) => {
    const turn = index + 1
    const normalDraws = onThePlay ? Math.max(0, turn - 1) : turn
    const extra = Array.isArray(extraLooks) ? Number(extraLooks[index] ?? 0) : Number(extraLooks || 0)
    const drawSize = Math.min(N, 7 + normalDraws + (isWhole(extra) ? extra : 0))
    return { turn, drawSize, probability: multivariateHypergeom(N, drawSize, groups) }
  })
}
