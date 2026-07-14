// Verifies the review generation instruction scaffolds real reasoning (board
// reconstruction, role assignment, hand-uncertainty hedging) rather than just
// asking for a JSON shape, and that the auto-primer schema carries an explicit
// perspective-player role.
import { describe, it, expect } from 'vitest'
import { buildUserInstruction, AutoPrimerSchema } from '../../api/_lib/reviewLlm.js'

describe('buildUserInstruction — scaffolds role-first, board-aware reasoning', () => {
  const instr = buildUserInstruction('THE-CONTEXT-STRING')

  it('still asks for the exact JSON review shape and embeds the context', () => {
    expect(instr).toContain('"recap"')
    expect(instr).toContain('"decisionPoints"')
    expect(instr).toContain('"leakTags"')
    expect(instr).toContain('THE-CONTEXT-STRING')
  })

  it('tells the model to reconstruct the board and lore race from the log', () => {
    expect(instr.toLowerCase()).toMatch(/reconstruct|board|lore race/)
  })

  it('tells the model to commit to a role (beatdown vs control) first', () => {
    expect(instr.toLowerCase()).toContain('role')
    expect(instr.toLowerCase()).toContain('beatdown')
  })

  it('warns that the hand is unknown and hand-dependent claims must be hedged', () => {
    expect(instr.toLowerCase()).toMatch(/hand/)
    expect(instr.toLowerCase()).toMatch(/uncertain|cannot see|unknown|do not assert/)
  })
})

describe('AutoPrimerSchema — carries an explicit perspective role', () => {
  it('accepts and preserves a role field', () => {
    const parsed = AutoPrimerSchema.parse({
      verdict: 'Favored',
      gameplan: 'Race to the mid-game and stabilize.',
      role: 'beatdown',
      keyCards: [],
    })
    expect(parsed.role).toBe('beatdown')
  })

  it('role is optional (older primers without it still parse)', () => {
    const parsed = AutoPrimerSchema.parse({ verdict: 'Even', gameplan: 'x', keyCards: [] })
    expect(parsed.role).toBeUndefined()
  })
})
