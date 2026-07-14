#!/usr/bin/env node
// scripts/eval-agent.mjs
//
// Runs the Ask AI agent against the gold question set and scores each answer
// with the deterministic rubric in api/_lib/agentEval.js. Its main job is to
// prove the agent actually grounds strategy answers in the knowledge base
// (calls read_knowledge) and card answers in the oracle (get_card/search_cards),
// and to catch regressions when the prompt, tools, or knowledge files change.
//
// Requires ANTHROPIC_API_KEY (it makes real model calls). Card/strategy
// questions are hub-less and don't touch the database; if the model reaches for
// a DB-backed tool without a DB, that case is reported as an error, not a crash.
//
// Usage:
//   node scripts/eval-agent.mjs                 # run all cases
//   node scripts/eval-agent.mjs --mode matchup  # only one mode
//   node scripts/eval-agent.mjs --id meta-tier1 # one case
//   node scripts/eval-agent.mjs --json          # machine-readable report
//   node scripts/eval-agent.mjs --dry           # validate dataset, no model calls
//
// Exit code: 0 if the case pass-rate meets --threshold (default 0.8), else 1.
// (2 = misconfiguration, e.g. missing API key.)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { scoreCase, summarize } from "../api/_lib/agentEval.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLD_PATH = join(__dirname, "..", "evals", "agent", "gold-questions.json");

function parseArgs(argv) {
  const args = { threshold: 0.8 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") args.json = true;
    else if (a === "--dry") args.dry = true;
    else if (a === "--mode") args.mode = argv[++i];
    else if (a === "--id") args.id = argv[++i];
    else if (a === "--threshold") args.threshold = Number(argv[++i]);
  }
  return args;
}

function selectCases(gold, args) {
  let cases = gold;
  if (args.mode) cases = cases.filter((c) => c.mode === args.mode);
  if (args.id) cases = cases.filter((c) => c.id === args.id);
  return cases;
}

// Colorless status glyphs so output is readable in any terminal / log.
const mark = (ok) => (ok ? "PASS" : "FAIL");

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const gold = JSON.parse(readFileSync(GOLD_PATH, "utf8"));
  const cases = selectCases(gold, args);

  if (cases.length === 0) {
    console.error("No cases matched the given filters.");
    process.exit(2);
  }

  // --dry: validate the dataset against the scorer with synthetic ideal answers,
  // no model calls, no API key needed. Useful in CI and while editing the set.
  if (args.dry) {
    let bad = 0;
    for (const c of cases) {
      const tools = [
        ...(c.expect.toolsUsed || []),
        ...(c.expect.anyToolsUsed || []).slice(0, 1),
        ...((c.expect.knowledgeFiles || []).map((f) => ({ tool: "read_knowledge", input: { file: f } }))),
      ].map((t) => (typeof t === "string" ? { tool: t, input: {} } : t));
      const answer = (c.expect.mustMatch || []).map((m) => m.replace(/\\b/g, "")).join(" ") || "ok";
      const s = scoreCase(c, { answer, toolLog: tools });
      if (!s.ok) {
        bad++;
        console.log(`DRY FAIL ${c.id}: ${s.checks.filter((x) => !x.pass).map((x) => x.name).join(", ")}`);
      }
    }
    console.log(bad === 0 ? `Dataset OK — ${cases.length} cases validate against the scorer.` : `${bad} case(s) failed dry validation.`);
    process.exit(bad === 0 ? 0 : 1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set — cannot run live evals. (Use --dry to validate the dataset only.)");
    process.exit(2);
  }

  // Import the agent lazily so --dry works without pulling the model/DB stack.
  const { runAgent } = await import("../api/_lib/agent.js");
  const EVAL_USER_ID = "eval-harness"; // hub-less; DB-backed tools aren't expected

  const scored = [];
  for (const c of cases) {
    let result;
    try {
      const { answer, toolLog } = await runAgent({ question: c.question, userId: EVAL_USER_ID });
      result = { answer, toolLog };
    } catch (err) {
      result = { answer: "", toolLog: [], error: err?.message || String(err) };
    }
    const s = scoreCase(c, result);
    s.mode = c.mode;
    s.error = result.error;
    s.tools = (result.toolLog || []).map((t) => t.tool);
    scored.push(s);

    if (!args.json) {
      console.log(`\n[${mark(s.ok)}] ${c.id} (${c.mode})  ${s.passed}/${s.total} checks`);
      if (result.error) console.log(`   ERROR: ${result.error}`);
      console.log(`   tools: ${s.tools.join(", ") || "∅"}`);
      for (const chk of s.checks.filter((x) => !x.pass)) {
        console.log(`   ✗ ${chk.name}${chk.detail ? `  (${chk.detail})` : ""}`);
      }
    }
  }

  const sum = summarize(scored);
  if (args.json) {
    console.log(JSON.stringify({ summary: sum, cases: scored }, null, 2));
  } else {
    console.log("\n" + "=".repeat(48));
    console.log(`Cases:  ${sum.casesPassed}/${sum.cases} passed  (${(sum.casePassRate * 100).toFixed(0)}%)`);
    console.log(`Checks: ${sum.checksPassed}/${sum.checks} passed  (${(sum.checkPassRate * 100).toFixed(0)}%)`);
    console.log(`Threshold: ${(args.threshold * 100).toFixed(0)}% case pass-rate`);
  }

  process.exit(sum.casePassRate >= args.threshold ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
