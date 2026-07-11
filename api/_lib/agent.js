// api/_lib/agent.js
//
// Multi-tool "Ask AI" agent. Runs a real Claude tool-use loop against the
// tools in agentTools.js (card oracle, decks, team stats, reviews, primers,
// meta reports, tournament results) instead of stuffing one giant context
// string into a single prompt. This lets the model make precise, targeted
// lookups ("Larry's games with Blurple vs GB Control") instead of reasoning
// over everything at once, and lets it reach for card data, personal decks,
// or team data as the question calls for it.

import Anthropic from "@anthropic-ai/sdk";
import { TOOL_SPECS, runTool } from "./agentTools.js";
import { COACH_MODEL, COACH_SYSTEM_PROMPT } from "./coachPrompt.js";

export const MODEL = COACH_MODEL;
// Deck builds, matchup breakdowns, and multi-part answers need real room — a
// 60-card list with role notes + strategy + key cards easily runs 2–3k tokens,
// and adaptive thinking shares this budget. 1200 truncated everything.
const MAX_TOKENS = 6000;
// Deck building often needs several card lookups before it can write the list;
// 6 iterations ran out mid-research and returned the "out of budget" fallback.
const MAX_ITERATIONS = 10;
const MAX_TOOL_RESULT_CHARS = 8000;

// The canonical Lorcana Coach persona (mirrored from the Console agent) plus an
// app-runtime addendum. The Console agent grounds card lookups with web tools,
// which this runtime does NOT have — so we redirect grounding to the app's
// database tools and add the hub-scoping rules that only exist in the app.
const BASE_SYSTEM_PROMPT =
  COACH_SYSTEM_PROMPT +
  "\n\n--- APP RUNTIME (Team Hub \"Ask AI\") ---\n" +
  "You are running inside the Team Hub app as the Ask AI assistant, NOT in the Console. " +
  "You do NOT have web_fetch, web_search, or code execution here — ignore those grounding " +
  "instructions above and ground yourself with the database tools you DO have: look up card " +
  "oracle text with get_card/search_cards, and use the tools for the user's own saved decks, a " +
  "teammate's deck (in a shared hub's practice games), hub-scoped team stats (win rates by " +
  "matchup and by archetype), replay reviews, matchup primers, meta reports, and synced " +
  "tournament results. The lorcana-knowledge Skill's files are available to these tools.\n" +
  "Ground every claim in a tool result — never invent card text, stats, or review content. If a " +
  "hub-scoped question doesn't specify which hub and there's more than one candidate, call " +
  "list_my_hubs and, if it's still ambiguous, ask the user to clarify rather than guessing. If the " +
  "data needed to answer confidently isn't available (e.g. no review exists for that matchup), say " +
  "so plainly instead of speculating.";

/**
 * @param {object} opts
 * @param {string} opts.question
 * @param {string} opts.userId
 * @param {{id:string,name:string}} [opts.hubHint]  hub the question was asked from/about, if any
 * @returns {Promise<{answer: string, usage: {input_tokens:number, output_tokens:number}, toolLog: Array, hubIdsTouched: string[]}>}
 */
export async function runAgent({ question, userId, hubHint }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const ctx = { userId };

  let system = BASE_SYSTEM_PROMPT;
  if (hubHint?.id) {
    system += `\n\nThe user is currently in Team Hub "${hubHint.name}" (id: ${hubHint.id}) — default hub-scoped tool calls to this hubId unless the question clearly names a different team.`;
  }

  const messages = [{ role: "user", content: question }];
  const totalUsage = { input_tokens: 0, output_tokens: 0 };
  const toolLog = [];
  const hubIdsTouched = new Set(hubHint?.id ? [hubHint.id] : []);

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // Adaptive thinking materially improves deck building, matchup reads, and
      // sequencing advice. Safe here because MAX_TOKENS gives it headroom and
      // this path returns prose (no strict-JSON contract to truncate).
      thinking: { type: "adaptive" },
      system,
      tools: TOOL_SPECS,
      messages,
    });

    totalUsage.input_tokens += resp.usage?.input_tokens ?? 0;
    totalUsage.output_tokens += resp.usage?.output_tokens ?? 0;
    messages.push({ role: "assistant", content: resp.content });

    if (resp.stop_reason !== "tool_use") {
      const answer = (resp.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      return { answer, usage: totalUsage, toolLog, hubIdsTouched: [...hubIdsTouched] };
    }

    const toolResults = [];
    for (const block of resp.content) {
      if (block.type !== "tool_use") continue;
      let result;
      try {
        result = await runTool(block.name, block.input, ctx);
      } catch (err) {
        console.error(`[agent] tool ${block.name} failed:`, err);
        result = { error: "That lookup failed unexpectedly." };
      }
      if (result && typeof result === "object" && result._hubId) hubIdsTouched.add(result._hubId);
      toolLog.push({ tool: block.name, input: block.input });

      let content = JSON.stringify(result ?? {});
      if (content.length > MAX_TOOL_RESULT_CHARS) {
        content = content.slice(0, MAX_TOOL_RESULT_CHARS) + '…"[truncated]"';
      }
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return {
    answer:
      "I wasn't able to finish researching that within my tool budget for one question — " +
      "try narrowing it down (e.g. name a specific hub, player, or archetype).",
    usage: totalUsage,
    toolLog,
    hubIdsTouched: [...hubIdsTouched],
  };
}
