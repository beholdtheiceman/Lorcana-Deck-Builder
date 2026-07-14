// Tests the deterministic scoring core for the Ask AI eval harness, and
// validates the gold question set's shape. The live runner (scripts/eval-agent.mjs)
// needs ANTHROPIC_API_KEY; this scores pre-captured {answer, toolLog} results so
// it runs anywhere with no model call.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { scoreCase, VALID_MODES } from '../../api/_lib/agentEval.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const GOLD = JSON.parse(
  readFileSync(join(__dirname, '../../evals/agent/gold-questions.json'), 'utf8')
)

const result = (answer, tools = []) => ({
  answer,
  toolLog: tools.map((t) => (typeof t === 'string' ? { tool: t, input: {} } : t)),
})

describe('scoreCase — tool usage checks', () => {
  it('passes when every required tool was called', () => {
    const def = { id: 'x', expect: { toolsUsed: ['read_knowledge'] } }
    const s = scoreCase(def, result('...', ['list_knowledge', 'read_knowledge']))
    expect(s.ok).toBe(true)
  })

  it('fails when a required tool was not called', () => {
    const def = { id: 'x', expect: { toolsUsed: ['read_knowledge'] } }
    const s = scoreCase(def, result('...', ['get_card']))
    expect(s.ok).toBe(false)
    expect(s.checks.find((c) => c.name.includes('read_knowledge')).pass).toBe(false)
  })

  it('anyToolsUsed passes when at least one is present', () => {
    const def = { id: 'x', expect: { anyToolsUsed: ['get_card', 'search_cards'] } }
    expect(scoreCase(def, result('...', ['search_cards'])).ok).toBe(true)
    expect(scoreCase(def, result('...', ['list_my_decks'])).ok).toBe(false)
  })

  it('knowledgeFiles checks the read_knowledge input filenames', () => {
    const def = { id: 'x', expect: { knowledgeFiles: ['matchup-guide.md'] } }
    const good = result('...', [{ tool: 'read_knowledge', input: { file: 'matchup-guide.md' } }])
    const bad = result('...', [{ tool: 'read_knowledge', input: { file: 'tech-cards.md' } }])
    expect(scoreCase(def, good).ok).toBe(true)
    expect(scoreCase(def, bad).ok).toBe(false)
  })
})

describe('scoreCase — answer content checks', () => {
  it('mustMatch requires every pattern (case-insensitive)', () => {
    const def = { id: 'x', expect: { mustMatch: ['budget', '\\b60\\b'] } }
    expect(scoreCase(def, result('Card BUDGET total: 60 cards')).ok).toBe(true)
    expect(scoreCase(def, result('here is a list')).ok).toBe(false)
  })

  it('mustNotMatch fails if any forbidden pattern appears', () => {
    const def = { id: 'x', expect: { mustNotMatch: ['i am not able'] } }
    expect(scoreCase(def, result('Sure, here you go')).ok).toBe(true)
    expect(scoreCase(def, result('I am not able to help')).ok).toBe(false)
  })

  it('reports per-check detail and an aggregate pass count', () => {
    const def = { id: 'x', expect: { mustMatch: ['a'], toolsUsed: ['get_card'] } }
    const s = scoreCase(def, result('a', ['get_card']))
    expect(s.total).toBe(2)
    expect(s.passed).toBe(2)
    expect(Array.isArray(s.checks)).toBe(true)
  })

  it('a case with no expectations is vacuously ok', () => {
    expect(scoreCase({ id: 'x', expect: {} }, result('anything')).ok).toBe(true)
  })
})

describe('gold-questions.json — dataset integrity', () => {
  it('has a healthy number of questions across modes', () => {
    expect(Array.isArray(GOLD)).toBe(true)
    expect(GOLD.length).toBeGreaterThanOrEqual(15)
  })

  it('every case has a unique id, a valid mode, a question, and an expect block', () => {
    const ids = new Set()
    for (const c of GOLD) {
      expect(typeof c.id, JSON.stringify(c)).toBe('string')
      expect(ids.has(c.id), `duplicate id ${c.id}`).toBe(false)
      ids.add(c.id)
      expect(VALID_MODES).toContain(c.mode)
      expect(typeof c.question).toBe('string')
      expect(c.question.length).toBeGreaterThan(0)
      expect(typeof c.expect).toBe('object')
    }
  })

  it('covers the strategic modes that depend on the knowledge base', () => {
    const modes = new Set(GOLD.map((c) => c.mode))
    for (const m of ['deck_build', 'meta', 'matchup', 'gameplay', 'rules']) {
      expect(modes.has(m), `missing mode ${m}`).toBe(true)
    }
  })

  it('at least half the strategy cases assert knowledge-base grounding', () => {
    const strat = GOLD.filter((c) => ['deck_build', 'meta', 'matchup', 'gameplay', 'tech'].includes(c.mode))
    const grounded = strat.filter(
      (c) =>
        (c.expect.toolsUsed || []).some((t) => t.includes('knowledge')) ||
        (c.expect.anyToolsUsed || []).some((t) => t.includes('knowledge')) ||
        c.expect.knowledgeFiles
    )
    expect(grounded.length).toBeGreaterThanOrEqual(Math.ceil(strat.length / 2))
  })

  it('every case validates cleanly against the scorer contract', () => {
    // A perfect synthetic result should score ok for every case (proves the
    // rubric fields are all recognized by scoreCase, no typos in expect keys).
    for (const c of GOLD) {
      const tools = [
        ...(c.expect.toolsUsed || []),
        ...(c.expect.anyToolsUsed || []).slice(0, 1),
        ...((c.expect.knowledgeFiles || []).map((f) => ({ tool: 'read_knowledge', input: { file: f } }))),
      ]
      const answer = (c.expect.mustMatch || []).map((m) => m.replace(/\\b/g, '')).join(' ') || 'ok'
      const s = scoreCase(c, result(answer, tools))
      expect(s.ok, `case ${c.id} should pass with a synthetic ideal answer`).toBe(true)
    }
  })
})
