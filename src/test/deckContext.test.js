// Tests for api/_lib/deckContext.js — deck-list summarization for the review
// agent. Uses the real card oracle (public/data/cards.min.json), same as the
// server does: "1-1" is Mickey Mouse - Brave Little Tailor (Ruby, cost 8).
import { describe, it, expect } from 'vitest'
import {
  summarizeDecklist,
  renderDeckSection,
  collectOpponentRevealed,
  renderOpponentSection,
  summarizeNamedCards,
  namedPairsFromDeckData,
} from '../../api/_lib/deckContext.js'
import { getById } from '../../api/_lib/cards.js'

describe('summarizeDecklist', () => {
  it('returns null for empty/absent decklists', () => {
    expect(summarizeDecklist(null)).toBeNull()
    expect(summarizeDecklist([])).toBeNull()
    expect(summarizeDecklist(['', null])).toBeNull()
  })

  it('aggregates copies, resolves cards, and computes the profile', () => {
    // 3 copies of 1-1 + 2 copies of 1-2 (whatever 1-2 is — assert via oracle).
    const s = summarizeDecklist(['1-1', '1-1', '1-1', '1-2', '1-2'])
    expect(s).not.toBeNull()
    expect(s.totalCards).toBe(5)
    expect(s.cards).toHaveLength(2)

    const mickey = s.cards.find((c) => c.id === '1-1')
    expect(mickey.count).toBe(3)
    expect(mickey.card.name).toBe('Mickey Mouse - Brave Little Tailor')

    expect(s.colors).toContain('Ruby')
    expect(s.avgCost).toBeGreaterThan(0)
    expect(s.unknownIds).toHaveLength(0)
    // Mickey costs 8 → lands in the 7+ curve bucket.
    expect(s.curve['7+']).toBeGreaterThanOrEqual(3)
  })

  it('tracks unresolvable ids without crashing', () => {
    const s = summarizeDecklist(['1-1', '99-999'])
    expect(s.totalCards).toBe(2)
    expect(s.unknownIds).toEqual(['99-999'])
  })
})

describe('renderDeckSection', () => {
  it('renders header, profile, and count-prefixed card lines', () => {
    const s = summarizeDecklist(['1-1', '1-1', '1-1', '1-2'])
    const text = renderDeckSection(s)
    expect(text).toContain('--- YOUR DECK (4 cards) ---')
    expect(text).toContain('3x Mickey Mouse - Brave Little Tailor')
    expect(text).toContain('Inks:')
    expect(text).toContain('Curve:')
  })

  it('returns null when there is no summary', () => {
    expect(renderDeckSection(null)).toBeNull()
  })

  it('accepts a custom section title', () => {
    const s = summarizeDecklist(['1-1'])
    const text = renderDeckSection(s, 'ATTACHED DECK: My Ruby List')
    expect(text).toContain('--- ATTACHED DECK: My Ruby List (1 cards) ---')
    expect(text).not.toContain('YOUR DECK')
  })
})

describe('summarizeDecklist — id↔name evidence cross-checking', () => {
  // Real data: '1-1' = Mickey Mouse - Brave Little Tailor (Ruby),
  // '1-2' resolves to a different card. Evidence claims '1-2' is actually
  // Mickey — simulating the duels.ink set-numbering mismatch.
  it('corrects an id whose oracle name contradicts the replay evidence', () => {
    const evidence = new Map([['1-2', 'Mickey Mouse - Brave Little Tailor']])
    const s = summarizeDecklist(['1-2'], evidence)
    expect(s.cards[0].card.name).toBe('Mickey Mouse - Brave Little Tailor')
  })

  it('flags no-evidence cards from a set with observed mismatches as unverified', () => {
    // Evidence: some OTHER set-1 id is misnumbered → whole set suspect.
    const evidence = new Map([['1-2', 'Mickey Mouse - Brave Little Tailor']])
    const s = summarizeDecklist(['1-2', '1-5'], evidence) // 1-5 never seen in log
    const unseen = s.cards.find((c) => c.id === '1-5')
    expect(unseen.unverified).toBe(true)
    expect(s.unverifiedCount).toBe(1)
  })

  it('flags off-color cards once two inks are verified', () => {
    // Build evidence for two cards of different (real) colors, then include a
    // third-color card without evidence — it must be flagged.
    const all = JSON.parse(
      require('node:fs').readFileSync('public/data/cards.min.json', 'utf8')
    )
    const byColor = {}
    for (const [id, c] of Object.entries(all)) {
      if (c.color && !c.color.includes('-') && !byColor[c.color]) byColor[c.color] = { id, name: c.name }
    }
    const [a, b, offColor] = Object.values(byColor)
    const evidence = new Map([[a.id, a.name], [b.id, b.name]])
    const s = summarizeDecklist([a.id, b.id, offColor.id], evidence)
    expect(s.cards.find((c) => c.id === offColor.id).unverified).toBe(true)
    expect(s.colors).toHaveLength(2)
  })
})

describe('collectOpponentRevealed / renderOpponentSection', () => {
  const game = {
    events: [
      { player: 'me', type: 'play_card', card: 'My Card', cardId: '1-1' },
      { player: 'opp', type: 'play_card', card: 'Mickey Mouse - Brave Little Tailor', cardId: '1-1' },
      { player: 'opp', type: 'quest', card: 'Mickey Mouse - Brave Little Tailor', cardId: '1-1' },
      // Our challenge reveals their defender.
      { player: 'me', type: 'challenge', card: 'Attacker', target: 'Defender Card', defenderCardId: '1-2' },
    ],
  }

  it('collects only opponent-side reveals, with counts', () => {
    const revealed = collectOpponentRevealed(game)
    const keys = revealed.map((r) => r.key)
    expect(keys).toContain('1-1')
    expect(keys).toContain('1-2')
    expect(keys).not.toContain('My Card')
    const mickey = revealed.find((r) => r.key === '1-1')
    expect(mickey.timesSeen).toBe(2)
  })

  it('renders resolved names and seen-counts', () => {
    const text = renderOpponentSection(collectOpponentRevealed(game))
    expect(text).toContain('OPPONENT REVEALED CARDS')
    expect(text).toContain('Mickey Mouse - Brave Little Tailor (seen 2x)')
    const card12 = getById('1-2')
    expect(text).toContain(card12.name)
  })

  it('returns null / [] on games with no events', () => {
    expect(collectOpponentRevealed({})).toEqual([])
    expect(renderOpponentSection([])).toBeNull()
  })
})

describe('summarizeNamedCards', () => {
  it('resolves names, aggregates counts, and reports no warnings for clean input', () => {
    const { summary, warnings } = summarizeNamedCards([
      { name: 'Mickey Mouse - Brave Little Tailor', count: 3 },
    ])
    expect(warnings).toEqual([])
    expect(summary.totalCards).toBe(3)
    expect(summary.cards).toHaveLength(1)
    expect(summary.cards[0].card.name).toBe('Mickey Mouse - Brave Little Tailor')
    expect(summary.cards[0].count).toBe(3)
    expect(summary.colors).toContain('Ruby')
  })

  it('keeps explicit-count unknown names in the deck as unresolved, with a warning', () => {
    const { summary, warnings } = summarizeNamedCards([
      { name: 'Mickey Mouse - Brave Little Tailor', count: 1 },
      { name: 'Totally Fake Card', count: 2 },
    ])
    expect(warnings).toEqual(['Card not found: "Totally Fake Card"'])
    expect(summary.totalCards).toBe(3)
    expect(summary.unknownIds).toEqual(['Totally Fake Card'])
  })

  it('drops implicit (count-less) unresolved lines with a warning', () => {
    const { summary, warnings } = summarizeNamedCards([
      { name: 'Ruby / Sapphire Midrange', count: 1, implicit: true },
      { name: 'Mickey Mouse - Brave Little Tailor', count: 4 },
    ])
    expect(warnings).toEqual(['Skipped line: "Ruby / Sapphire Midrange"'])
    expect(summary.totalCards).toBe(4)
    expect(summary.unknownIds).toEqual([])
  })

  it('resolves implicit lines that ARE real card names as count 1', () => {
    const { summary, warnings } = summarizeNamedCards([
      { name: 'Mickey Mouse - Brave Little Tailor', count: 1, implicit: true },
    ])
    expect(warnings).toEqual([])
    expect(summary.totalCards).toBe(1)
  })

  it('returns null summary when nothing resolves', () => {
    const { summary, warnings } = summarizeNamedCards([
      { name: 'Header Line', count: 1, implicit: true },
    ])
    expect(summary).toBeNull()
    expect(warnings).toHaveLength(1)
  })
})

describe('namedPairsFromDeckData', () => {
  it('maps deck data entries to name+count pairs', () => {
    const data = {
      entries: {
        k1: { card: { name: 'Mickey Mouse - Brave Little Tailor' }, count: 4 },
        k2: { card: { name: 'Some Other Card' }, count: 2 },
      },
    }
    expect(namedPairsFromDeckData(data)).toEqual([
      { name: 'Mickey Mouse - Brave Little Tailor', count: 4 },
      { name: 'Some Other Card', count: 2 },
    ])
  })

  it('skips malformed entries and handles missing data', () => {
    expect(namedPairsFromDeckData(null)).toEqual([])
    expect(namedPairsFromDeckData({})).toEqual([])
    expect(
      namedPairsFromDeckData({
        entries: { a: { card: {}, count: 3 }, b: { card: { name: 'X' }, count: 0 }, c: null },
      })
    ).toEqual([])
  })

  it('recombines a base name + subname into "Name - Subname" (saved decks store them separately)', () => {
    const data = {
      entries: {
        k1: { card: { name: 'Mickey Mouse', subname: 'Brave Little Tailor' }, count: 3 },
      },
    }
    expect(namedPairsFromDeckData(data)).toEqual([
      { name: 'Mickey Mouse - Brave Little Tailor', count: 3 },
    ])
  })

  it('falls back to card.version when subname is absent, and does not double-append an already-combined name', () => {
    const data = {
      entries: {
        k1: { card: { name: 'Elsa', version: 'Snow Queen' }, count: 1 },
        k2: { card: { name: 'Mickey Mouse - Brave Little Tailor' }, count: 2 },
      },
    }
    expect(namedPairsFromDeckData(data)).toEqual([
      { name: 'Elsa - Snow Queen', count: 1 },
      { name: 'Mickey Mouse - Brave Little Tailor', count: 2 },
    ])
  })
})
