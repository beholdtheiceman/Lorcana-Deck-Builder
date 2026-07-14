// Verifies the Ask AI agent's knowledge-base accessor: it lists the strategy
// files the coach prompt references, reads their real content, and refuses
// anything outside the whitelist (including path-traversal attempts). Also
// checks the two knowledge tools are wired into the Ask AI dispatcher.
import { describe, it, expect } from 'vitest'
import { listKnowledge, readKnowledge, KNOWLEDGE_INDEX } from '../../api/_lib/agentKnowledge.js'
import { TOOL_SPECS, runTool } from '../../api/_lib/agentTools.js'

describe('agentKnowledge — listKnowledge', () => {
  it('indexes every strategy file the coach prompt tells the model to read', () => {
    const { files } = listKnowledge()
    const names = files.map((f) => f.file)
    // Files named explicitly in coachPrompt.js / SKILL-UPDATE.md mode routing.
    for (const expected of [
      'meta-archetypes.md',
      'matchup-guide.md',
      'role-theory.md',
      'archetype-playbooks.md',
      'synergy-theory.md',
      'game-state-evaluation.md',
      'gameplay-heuristics.md',
      'tech-cards.md',
      'set-changelog.md',
    ]) {
      expect(names).toContain(expected)
    }
    // Each entry carries a "when to read" hint so the model can pick correctly.
    for (const f of files) expect(typeof f.when).toBe('string')
  })
})

describe('agentKnowledge — readKnowledge', () => {
  it('returns the real content of a whitelisted file', () => {
    const res = readKnowledge('matchup-guide.md')
    expect(res.error).toBeUndefined()
    expect(res.file).toBe('matchup-guide.md')
    expect(res.content).toContain('# Lorcana Matchup Guide')
  })

  it('errors on a file that is not in the index', () => {
    const res = readKnowledge('nope-not-real.md')
    expect(res.content).toBeUndefined()
    expect(res.error).toMatch(/unknown|not found|available/i)
  })

  it('refuses path-traversal outside the knowledge dir', () => {
    const res = readKnowledge('../coachPrompt.js')
    expect(res.content).toBeUndefined()
    expect(res.error).toBeTruthy()
  })

  it('every indexed file is actually readable', () => {
    for (const entry of KNOWLEDGE_INDEX) {
      const res = readKnowledge(entry.file)
      expect(res.error, `${entry.file} should be readable`).toBeUndefined()
      expect(res.content.length).toBeGreaterThan(0)
    }
  })
})

describe('agentTools — knowledge tools are wired into the Ask AI dispatcher', () => {
  it('exposes list_knowledge and read_knowledge in TOOL_SPECS', () => {
    const names = TOOL_SPECS.map((t) => t.name)
    expect(names).toContain('list_knowledge')
    expect(names).toContain('read_knowledge')
  })

  it('runTool("list_knowledge") returns the index', async () => {
    const res = await runTool('list_knowledge', {}, { userId: 'u1' })
    expect(res.files.map((f) => f.file)).toContain('role-theory.md')
  })

  it('runTool("read_knowledge") opens a real file', async () => {
    const res = await runTool('read_knowledge', { file: 'role-theory.md' }, { userId: 'u1' })
    expect(res.content).toContain('# Role Theory')
  })

  it('runTool("read_knowledge") without a file returns an error, not a throw', async () => {
    const res = await runTool('read_knowledge', {}, { userId: 'u1' })
    expect(res.error).toBeTruthy()
  })
})
