const MIN_OMW = 1 / 3

function mulberry32(seed) {
  let state = seed >>> 0
  return function random() {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function integer(value, name, minimum, maximum) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new RangeError(`${name} must be an integer from ${minimum} to ${maximum}`)
  }
  return parsed
}

function probability(value, name) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new RangeError(`${name} must be between 0 and 1`)
  }
  return parsed
}

function normalizeRecord(record) {
  if (typeof record === 'string') {
    const match = record.trim().match(/^(\d+)\s*[-/]\s*(\d+)$/)
    if (!match) throw new TypeError('record must be a wins-losses string or object')
    return { wins: Number(match[1]), losses: Number(match[2]) }
  }
  return {
    wins: integer(record?.wins ?? 0, 'record.wins', 0, 100),
    losses: integer(record?.losses ?? 0, 'record.losses', 0, 100),
  }
}

function binomial(trials, chance, random) {
  let wins = 0
  for (let index = 0; index < trials; index += 1) {
    if (random() < chance) wins += 1
  }
  return wins
}

function percentile(sorted, fraction) {
  if (!sorted.length) return 0
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(fraction * sorted.length)))
  return sorted[index]
}

// Estimate an opponent's final match-win percentage. Opponents are assumed to be
// average players, with the result of their match against the tracked player fixed.
function opponentMatchWin(resultForPlayer, rounds, random) {
  const otherWins = binomial(Math.max(0, rounds - 1), 0.5, random)
  const winAgainstPlayer = resultForPlayer === 'loss' ? 1 : 0
  const drawAgainstPlayer = resultForPlayer === 'draw' ? 1 / 3 : 0
  return Math.max(MIN_OMW, (otherWins + winAgainstPlayer + drawAgainstPlayer) / rounds)
}

function playerOmcw(matchResults, rounds, random) {
  if (!matchResults.length) return 0.5
  let total = 0
  for (const result of matchResults) total += opponentMatchWin(result, rounds, random)
  return total / matchResults.length
}

function competitorOmcw(rounds, random) {
  let total = 0
  for (let round = 0; round < rounds; round += 1) {
    total += Math.max(MIN_OMW, binomial(rounds, 0.5, random) / rounds)
  }
  return total / Math.max(1, rounds)
}

function makesCut({ points, omw, players, rounds, topN, random }) {
  let ahead = 0
  for (let index = 1; index < players; index += 1) {
    const competitorPoints = binomial(rounds, 0.5, random) * 3
    if (competitorPoints > points || (competitorPoints === points && competitorOmcw(rounds, random) > omw)) {
      ahead += 1
      if (ahead >= topN) return false
    }
  }
  return true
}

function branchOutcome({ wins, losses, remaining, firstResult, winProbability, players, rounds, topN, random }) {
  const results = []
  for (let index = 0; index < wins; index += 1) results.push('win')
  for (let index = 0; index < losses; index += 1) results.push('loss')

  let points = wins * 3
  let roundsLeft = remaining
  if (firstResult === 'draw' && roundsLeft > 0) {
    points += 1
    results.push('draw')
    roundsLeft -= 1
  }
  for (let round = 0; round < roundsLeft; round += 1) {
    const won = random() < winProbability
    points += won ? 3 : 0
    results.push(won ? 'win' : 'loss')
  }
  const omw = playerOmcw(results, rounds, random)
  return { points, omw, cut: makesCut({ points, omw, players, rounds, topN, random }) }
}

/**
 * Run a deterministic Swiss tournament Monte Carlo simulation.
 *
 * Pairings and tie-breakers are deliberately approximate: the tracked player's
 * opponents and the rest of the field are modeled as 50% players, and ties are
 * ordered by independently sampled OMW%. The tracked player's supplied
 * winProbability is used only for their future matches.
 */
export function simulate(options = {}) {
  const players = integer(options.players ?? 64, 'players', 2, 10000)
  const rounds = integer(options.rounds ?? 6, 'rounds', 1, 30)
  const iterations = integer(options.iterations ?? 10000, 'iterations', 1, 1000000)
  const winProbability = probability(options.winProbability ?? 0.5, 'winProbability')
  const seed = integer(options.seed ?? 1, 'seed', 0, 0xffffffff)
  const record = normalizeRecord(options.record)
  const completed = record.wins + record.losses
  if (completed > rounds) throw new RangeError('record cannot contain more matches than rounds')

  const remainingRounds = rounds - completed
  const topN = integer(options.topN ?? Math.min(8, players), 'topN', 1, players)
  const defaultThresholdWins = Math.ceil((rounds * 2) / 3)
  const pointsThreshold = integer(options.pointsThreshold ?? defaultThresholdWins * 3, 'pointsThreshold', 0, rounds * 3)
  const random = mulberry32(seed)
  const frequencies = {}
  const omwSamples = []
  let totalPoints = 0
  let topNFinishes = 0
  let thresholdFinishes = 0
  let drawCuts = 0
  let playCuts = 0

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const outcome = branchOutcome({
      ...record, remaining: remainingRounds, firstResult: null,
      winProbability, players, rounds, topN, random,
    })
    frequencies[outcome.points] = (frequencies[outcome.points] || 0) + 1
    totalPoints += outcome.points
    omwSamples.push(outcome.omw)
    if (outcome.cut) topNFinishes += 1
    if (outcome.points >= pointsThreshold) thresholdFinishes += 1

    if (remainingRounds > 0) {
      const draw = branchOutcome({
        ...record, remaining: remainingRounds, firstResult: 'draw',
        winProbability, players, rounds, topN, random,
      })
      const play = branchOutcome({
        ...record, remaining: remainingRounds, firstResult: null,
        winProbability, players, rounds, topN, random,
      })
      if (draw.cut) drawCuts += 1
      if (play.cut) playCuts += 1
    }
  }

  const pointsDistribution = {}
  const histogram = Object.keys(frequencies).map(Number).sort((a, b) => a - b).map((points) => {
    const count = frequencies[points]
    const probabilityValue = count / iterations
    pointsDistribution[points] = probabilityValue
    return { points, count, probability: probabilityValue }
  })
  omwSamples.sort((a, b) => a - b)
  const low = percentile(omwSamples, 0.1)
  const median = percentile(omwSamples, 0.5)
  const high = percentile(omwSamples, 0.9)

  return {
    iterations,
    seed,
    remainingRounds,
    topN,
    pointsThreshold,
    pointsDistribution,
    pointsFrequencies: frequencies,
    histogram,
    meanPoints: totalPoints / iterations,
    topNProbability: topNFinishes / iterations,
    thresholdProbability: thresholdFinishes / iterations,
    omwBand: { low, median, high, percentileRange: [10, 90], approximate: true },
    intentionalDraw: remainingRounds > 0
      ? {
          drawProbability: drawCuts / iterations,
          playProbability: playCuts / iterations,
          difference: (drawCuts - playCuts) / iterations,
          safe: drawCuts >= playCuts,
        }
      : { drawProbability: null, playProbability: null, difference: null, safe: null },
  }
}

export default simulate
