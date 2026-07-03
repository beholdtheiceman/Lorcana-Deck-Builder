// Validates the replay parser against a REAL duels.ink export (sanitized:
// player names replaced). The fixture is a genuine bo3 .match-replay.zip —
// match.json + two gzipped duels-replay-v1 game files.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseReplayBuffer } from '../../api/_lib/replayParse.js'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = () => readFileSync(resolve(here, 'fixtures/duels-match-replay.zip'))

describe('parseReplayBuffer — real duels.ink match-replay zip', () => {
  it('parses match metadata: winner, score, perspective names', async () => {
    const r = await parseReplayBuffer(fixture(), 'duels-match-replay.zip')
    expect(r.source).toBe('duels.ink')
    expect(r.matchScore).toBe('0-2')
    expect(r.matchWinner).toBe('Player Two')
    expect(r.perspectivePlayer).toBe('Player One')
    expect(r.playerNames).toEqual({ me: 'Player One', opp: 'Player Two' })
  })

  it('normalizes both games with results, decklists, events, and lore curves', async () => {
    const r = await parseReplayBuffer(fixture(), 'duels-match-replay.zip')
    expect(r.games).toHaveLength(2)

    const [g1, g2] = r.games
    expect(g1.gameNumber).toBe(1)
    expect(g1.result).toBe('L')
    expect(g1.victoryReason).toBe('lore')
    expect(g1.turnCount).toBe(9)
    expect(g1.decklistMe).toHaveLength(60)
    expect(g1.decklistMe[0]).toMatch(/^\d+-\d+$/) // "<set>-<num>" card ids
    expect(g1.events.length).toBeGreaterThan(50)
    expect(g1.logs.length).toBeGreaterThan(300)
    // Loser reached 0 lore, winner hit 20 (confirmed against raw logs).
    expect(g1.loreCurve.at(-1)).toEqual({ turn: 9, you: 0, opp: 20 })
    // Ink colors detected from PLAY_CARD patches.
    expect(g1.deckArchetype).toBe('Amethyst/Sapphire')
    expect(g1.vsArchetype).toBe('Amber/Emerald')

    expect(g2.gameNumber).toBe(2)
    expect(g2.result).toBe('L')
    expect(g2.victoryReason).toBe('concession')
    expect(g2.turnCount).toBe(11)
    expect(g2.decklistMe).toHaveLength(60)
  })

  it('event stream reads as human actions with correct attribution', async () => {
    const r = await parseReplayBuffer(fixture(), 'duels-match-replay.zip')
    const events = r.games[0].events
    const types = new Set(events.map(e => e.type))
    expect(types.has('play_card')).toBe(true)
    expect(types.has('add_to_ink')).toBe(true)
    expect(types.has('quest')).toBe(true)
    expect(types.has('challenge')).toBe(true)
    for (const e of events) {
      expect(['me', 'opp']).toContain(e.player)
      expect(e.turn).toBeGreaterThan(0)
      expect(typeof e.action).toBe('string')
    }
    // Game 1 ground truth: the perspective player never quested.
    expect(events.filter(e => e.type === 'quest' && e.player === 'me')).toHaveLength(0)
  })

  it('parses a single .replay.gz game file (non-zip path)', async () => {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(fixture())
    const gzName = Object.keys(zip.files).find(f => /game-01.*\.replay\.gz$/.test(f))
    const gz = await zip.file(gzName).async('nodebuffer')
    const r = await parseReplayBuffer(gz, gzName)
    expect(r.games).toHaveLength(1)
    expect(r.games[0].result).toBe('L')
    expect(r.games[0].turnCount).toBe(9)
    expect(r.matchWinner).toBeNull() // single game carries no match metadata
  })
})
