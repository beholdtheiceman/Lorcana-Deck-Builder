const WIN_RESULTS = new Set(['win', 'won', 'w', 'victory', '1', 'true'])
const LOSS_RESULTS = new Set(['loss', 'lost', 'lose', 'l', 'defeat', '0', 'false'])
const PLAY_VALUES = new Set(['play', 'on play', 'on the play', 'first', '1', 'true'])
const DRAW_VALUES = new Set(['draw', 'on draw', 'on the draw', 'second', '0', 'false'])

function clean(value) {
  return String(value ?? '').trim()
}

function normalizedValue(value) {
  return clean(value).toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

export function normalizeResult(value) {
  const result = normalizedValue(value)
  if (WIN_RESULTS.has(result)) return 'win'
  if (LOSS_RESULTS.has(result)) return 'loss'
  return null
}

export function normalizePlayDraw(value) {
  const playDraw = normalizedValue(value)
  if (PLAY_VALUES.has(playDraw)) return 'play'
  if (DRAW_VALUES.has(playDraw)) return 'draw'
  return null
}

function summary(games) {
  const wins = games.reduce((total, game) => total + (game.result === 'win' ? 1 : 0), 0)
  const losses = games.length - wins
  return { games: games.length, wins, losses, winRate: games.length ? wins / games.length : null }
}

function groupBy(games, keyFor, fieldsFor) {
  const groups = new Map()
  for (const game of games) {
    const key = keyFor(game)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(game)
  }
  return [...groups.entries()]
    .map(([key, group]) => ({ ...fieldsFor(group[0], key), ...summary(group) }))
    .sort((a, b) => b.games - a.games || String(a.label).localeCompare(String(b.label)))
}

function parsedTime(value) {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function timeSeries(games, rollingWindow) {
  const ordered = games
    .map((game, index) => ({ ...game, originalIndex: index, timestamp: parsedTime(game.date) }))
    .sort((a, b) => {
      if (a.timestamp === null && b.timestamp === null) return a.originalIndex - b.originalIndex
      if (a.timestamp === null) return 1
      if (b.timestamp === null) return -1
      return a.timestamp - b.timestamp || a.originalIndex - b.originalIndex
    })
  let wins = 0
  return ordered.map((game, index) => {
    if (game.result === 'win') wins += 1
    const window = ordered.slice(Math.max(0, index - rollingWindow + 1), index + 1)
    const rollingWins = window.filter((item) => item.result === 'win').length
    return {
      index: index + 1,
      date: game.date || `Game ${index + 1}`,
      result: game.result,
      winRate: wins / (index + 1),
      cumulativeWinRate: wins / (index + 1),
      rollingWinRate: rollingWins / window.length,
    }
  })
}

function tiltStats(games, consecutiveLosses, sessionGapMinutes) {
  const ordered = games
    .map((game, index) => ({ ...game, index, timestamp: parsedTime(game.date) }))
    .sort((a, b) => (a.timestamp ?? Number.MAX_SAFE_INTEGER) - (b.timestamp ?? Number.MAX_SAFE_INTEGER) || a.index - b.index)
  const events = []
  let streak = 0
  let maximum = 0
  let previousTime = null

  ordered.forEach((game, index) => {
    if (previousTime !== null && game.timestamp !== null && game.timestamp - previousTime > sessionGapMinutes * 60_000) streak = 0
    if (game.result === 'loss') {
      streak += 1
      maximum = Math.max(maximum, streak)
      if (streak === consecutiveLosses) {
        events.push({ date: game.date || null, game: index + 1, consecutiveLosses: streak })
      }
    } else {
      streak = 0
    }
    if (game.timestamp !== null) previousTime = game.timestamp
  })

  return { triggered: events.length > 0, maxConsecutiveLosses: maximum, threshold: consecutiveLosses, events }
}

export function calculatePerformanceStats(rows, options = {}) {
  const rollingWindow = Math.max(1, Number(options.rollingWindow) || 5)
  const consecutiveLosses = Math.max(2, Number(options.consecutiveLosses) || 3)
  const sessionGapMinutes = Math.max(1, Number(options.sessionGapMinutes) || 120)
  const games = (Array.isArray(rows) ? rows : []).flatMap((row) => {
    const result = normalizeResult(row?.result)
    if (!result) return []
    return [{
      date: clean(row.date),
      myDeck: clean(row.myDeck),
      opponentDeck: clean(row.opponentDeck),
      result,
      playDraw: normalizePlayDraw(row.playDraw ?? row.onPlay),
    }]
  })

  const byDeck = groupBy(games, (game) => game.myDeck, (game, label) => ({ label, deck: game.myDeck }))
  const byMatchup = groupBy(
    games,
    (game) => game.opponentDeck && `${game.myDeck || 'All decks'}\u0000${game.opponentDeck}`,
    (game) => ({ label: `${game.myDeck || 'All decks'} vs ${game.opponentDeck}`, myDeck: game.myDeck, opponentDeck: game.opponentDeck }),
  )
  const playDraw = {
    play: summary(games.filter((game) => game.playDraw === 'play')),
    draw: summary(games.filter((game) => game.playDraw === 'draw')),
  }

  return {
    overall: summary(games),
    byDeck,
    byMyDeck: byDeck,
    byMatchup,
    playDraw,
    playDrawSplit: playDraw,
    timeSeries: timeSeries(games, rollingWindow),
    tilt: tiltStats(games, consecutiveLosses, sessionGapMinutes),
    ignoredRows: (Array.isArray(rows) ? rows.length : 0) - games.length,
  }
}

export const computePerformanceStats = calculatePerformanceStats
export const analyzePerformance = calculatePerformanceStats

export default calculatePerformanceStats
