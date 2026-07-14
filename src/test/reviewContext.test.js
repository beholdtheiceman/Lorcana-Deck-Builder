// Verifies buildReviewContext resolves card oracle text from ids (with a
// name-based fallback) so the CARD ORACLE glossary and game log render real
// card text instead of "unknown — do not infer".
import { describe, it, expect } from 'vitest'
import { buildReviewContext } from '../../api/_lib/reviewContext.js'

const makeReplay = (events) => ({
  parsed: { games: [{ gameNumber: 1, events }] },
})

describe('buildReviewContext — card oracle resolution', () => {
  it('resolves a card by id and renders its real oracle body text', async () => {
    const replay = makeReplay([
      {
        cardId: '1-1',
        card: 'Mickey Mouse - Brave Little Tailor',
        type: 'play_card',
        action: 'played Mickey Mouse - Brave Little Tailor',
        turn: 1,
        player: 'me',
      },
    ])
    const ctx = await buildReviewContext({ replay, primer: null, gameNumber: 1 })

    // Oracle body for 1-1 starts with "Evasive".
    expect(ctx).toContain('Mickey Mouse - Brave Little Tailor — Evasive')
    // No unresolved-card noise.
    expect(ctx).not.toContain('[cards: unknown')
    expect(ctx).not.toContain('unknown — do not infer')
  })

  it('falls back to name resolution when an event has no cardId', async () => {
    // "Let It Go" is a real card (1-2) in cards.min.json.
    const replay = makeReplay([
      {
        card: 'Let It Go',
        type: 'play_card',
        action: 'played Let It Go',
        turn: 2,
        player: 'me',
      },
    ])
    const ctx = await buildReviewContext({ replay, primer: null, gameNumber: 1 })

    expect(ctx).toContain('Let It Go — ')
    expect(ctx).not.toContain('unknown — do not infer')
  })

  it('renders a not-found fallback for an unknown card id', async () => {
    const replay = makeReplay([
      {
        cardId: '99-999',
        type: 'play_card',
        action: 'played mystery card',
        turn: 3,
        player: 'me',
      },
    ])
    const ctx = await buildReviewContext({ replay, primer: null, gameNumber: 1 })

    expect(ctx).toContain('99-999 — (not found in oracle — do not infer card text)')
  })
})

describe('buildReviewContext — strategy frameworks injection', () => {
  it('injects the reasoning frameworks the coach prompt tells the model to use', async () => {
    const replay = makeReplay([
      { cardId: '1-1', type: 'quest', action: 'quested with Mickey Mouse', turn: 2, player: 'me' },
    ])
    const ctx = await buildReviewContext({ replay, primer: null, gameNumber: 1 })

    expect(ctx).toContain('STRATEGY FRAMEWORKS')
    // Role theory is the highest-priority framework and must be present.
    expect(ctx).toContain('# Role Theory')
  })

  it('keeps the game log even when frameworks are injected (log tail preserved)', async () => {
    const replay = makeReplay([
      { cardId: '1-1', type: 'quest', action: 'quested with Mickey Mouse', turn: 9, player: 'me' },
    ])
    const ctx = await buildReviewContext({ replay, primer: null, gameNumber: 1, maxChars: 60000 })

    expect(ctx).toContain('--- GAME LOG ---')
    expect(ctx).toContain('quested with Mickey Mouse')
  })
})
