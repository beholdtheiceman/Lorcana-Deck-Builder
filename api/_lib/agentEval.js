// api/_lib/agentEval.js
//
// Deterministic scoring core for the Ask AI eval harness (see
// scripts/eval-agent.mjs and evals/agent/gold-questions.json).
//
// The live runner asks runAgent() a gold question, then hands the resulting
// { answer, toolLog } here to be scored against the case's `expect` rubric.
// Scoring is pure and string/tool-based (no second LLM call), so it runs
// anywhere and gives stable pass/fail signals — the highest-value being
// "did the agent actually reach for the knowledge base", which is exactly the
// grounding gap this whole effort was about.

// Modes mirror the seven jobs in coachPrompt.js (plus a grounding bucket that
// reuses "rules"). Kept as a whitelist so the dataset can't drift on typos.
export const VALID_MODES = [
  "deck_build",
  "meta",
  "gameplay",
  "rules",
  "deck_review",
  "matchup",
  "simulation",
  "tech",
];

function toolNames(toolLog) {
  return (Array.isArray(toolLog) ? toolLog : []).map((t) => t && t.tool).filter(Boolean);
}

function knowledgeFilesRead(toolLog) {
  return (Array.isArray(toolLog) ? toolLog : [])
    .filter((t) => t && t.tool === "read_knowledge")
    .map((t) => (t.input && t.input.file) || null)
    .filter(Boolean);
}

function rx(pattern) {
  // Patterns are authored as regex source strings; matched case-insensitively.
  return new RegExp(pattern, "i");
}

/**
 * Score one eval case against a captured agent result.
 * @param {{ id: string, expect?: object }} def
 * @param {{ answer?: string, toolLog?: Array<{tool:string,input?:object}> }} result
 * @returns {{ id:string, checks: Array<{name:string,pass:boolean,detail?:string}>, passed:number, total:number, ok:boolean }}
 */
export function scoreCase(def, result) {
  const expect = (def && def.expect) || {};
  const answer = (result && result.answer) || "";
  const tools = toolNames(result && result.toolLog);
  const filesRead = knowledgeFilesRead(result && result.toolLog);
  const checks = [];

  // Every listed tool must have been called.
  for (const t of expect.toolsUsed || []) {
    checks.push({ name: `tool:${t}`, pass: tools.includes(t), detail: `tools=${tools.join(",") || "∅"}` });
  }

  // At least one of the listed tools must have been called.
  if (Array.isArray(expect.anyToolsUsed) && expect.anyToolsUsed.length) {
    const hit = expect.anyToolsUsed.some((t) => tools.includes(t));
    checks.push({
      name: `anyTool:[${expect.anyToolsUsed.join("|")}]`,
      pass: hit,
      detail: `tools=${tools.join(",") || "∅"}`,
    });
  }

  // At least one of the expected knowledge files must have been opened.
  if (Array.isArray(expect.knowledgeFiles) && expect.knowledgeFiles.length) {
    const hit = expect.knowledgeFiles.some((f) => filesRead.includes(f));
    checks.push({
      name: `knowledge:[${expect.knowledgeFiles.join("|")}]`,
      pass: hit,
      detail: `read=${filesRead.join(",") || "∅"}`,
    });
  }

  // Every mustMatch pattern must appear in the answer.
  for (const p of expect.mustMatch || []) {
    checks.push({ name: `match:/${p}/`, pass: rx(p).test(answer) });
  }

  // No mustNotMatch pattern may appear in the answer.
  for (const p of expect.mustNotMatch || []) {
    checks.push({ name: `!match:/${p}/`, pass: !rx(p).test(answer) });
  }

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  return { id: def && def.id, checks, passed, total, ok: passed === total };
}

/** Aggregate scored cases into a report summary. */
export function summarize(scored) {
  const total = scored.length;
  const passedCases = scored.filter((s) => s.ok).length;
  const checkTotal = scored.reduce((n, s) => n + s.total, 0);
  const checkPassed = scored.reduce((n, s) => n + s.passed, 0);
  return {
    cases: total,
    casesPassed: passedCases,
    casePassRate: total ? passedCases / total : 1,
    checks: checkTotal,
    checksPassed: checkPassed,
    checkPassRate: checkTotal ? checkPassed / checkTotal : 1,
  };
}
