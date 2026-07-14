import { z } from "zod";
import { COACH_MODEL, COACH_SYSTEM_PROMPT } from "./coachPrompt.js";
import { readKnowledge } from "./agentKnowledge.js";
import {
  COACH_MAX_TOKENS,
  PRIMER_MAX_TOKENS as SHARED_PRIMER_MAX_TOKENS,
} from "./anthropic.js";

export const MODEL = COACH_MODEL;
export const MAX_CONTEXT_CHARS = 60000;
// The review JSON (recap + up to 4 decision points + leak tags) plus adaptive
// thinking needs real room; 2000 truncated the JSON and failed the parse.
export const MAX_TOKENS = COACH_MAX_TOKENS;
// A useful primer (gameplan + must-kill + 3–6 key cards) needs more than 800.
export const PRIMER_MAX_TOKENS = SHARED_PRIMER_MAX_TOKENS;

// The canonical Lorcana Coach persona (mirrored from the Console agent), pinned
// to POST-GAME REVIEW mode. This runtime is tool-less: everything the model
// needs (deck list, opponent reveals, card-text oracle, matchup primer, game
// log) is injected into the context, so we redirect grounding away from the
// web tools the Console prompt assumes.
export const SYSTEM_PROMPT =
  COACH_SYSTEM_PROMPT +
  "\n\n--- APP RUNTIME (Post-Game Review) ---\n" +
  "You are running inside the Team Hub app generating a post-game review, NOT in the Console. " +
  "You have NO web_fetch, web_search, or code execution here — ignore those grounding " +
  "instructions above. Everything you need is in the context below: the player's full deck " +
  "list, the opponent's revealed cards, a card-text oracle, a matchup primer, and the game log. " +
  "Ground every claim in that provided context; never invent card text. Answer in POST-GAME " +
  "REVIEW mode and follow the exact output shape the user instruction requests.";

export const PRIMER_SYSTEM_PROMPT =
  "You are a Disney Lorcana competitive expert. Generate concise matchup primers in JSON only.";

/** Shape we expect the review model to return. */
export const ModelOutSchema = z.object({
  recap: z.string(),
  decisionPoints: z
    .array(
      z.object({
        turn: z.union([z.number(), z.string()]).optional(),
        whatHappened: z.string().optional(),
        betterLine: z.string().optional(),
        why: z.string().optional(),
      })
    )
    .default([]),
  leakTags: z.array(z.string()).default([]),
});

export function extractJson(text) {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  return t.slice(start, end + 1);
}

/**
 * Call the review model and parse its strict-JSON reply.
 *
 * `think` controls adaptive thinking. Adaptive thinking SHARES the max_tokens
 * budget with the visible answer, so on a complex game it can consume most of
 * the 6000 tokens and truncate (or entirely drop) the JSON text block —
 * historically the exact cause of "Model did not return valid JSON". The happy
 * path runs with thinking ON for better analysis; the invalid-JSON retry runs
 * with thinking OFF so the whole budget goes to producing the JSON.
 *
 * @param {import("@anthropic-ai/sdk").default} client
 * @param {string} userInstruction
 * @param {{ think?: boolean }} [opts]
 */
export async function callModel(client, userInstruction, { think = true } = {}) {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: think ? { type: "adaptive" } : { type: "disabled" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userInstruction }],
  });
  const text = (resp.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  const usage = resp.usage;
  const stopReason = resp.stop_reason;
  // Truncation is the dominant failure mode here — surface it in logs instead
  // of collapsing every cause into a silent null.
  if (stopReason === "max_tokens") {
    console.warn(
      `[reviewLlm] review call hit max_tokens (think=${think}); JSON likely truncated`
    );
  }
  const json = extractJson(text);
  if (!json) return { data: null, usage, stopReason };
  let obj;
  try {
    obj = JSON.parse(json);
  } catch {
    return { data: null, usage, stopReason };
  }
  const validated = ModelOutSchema.safeParse(obj);
  return { data: validated.success ? validated.data : null, usage, stopReason };
}

/** Build the exact user-instruction string for a review generation. */
export function buildUserInstruction(context) {
  return (
    "Using only the context below, write the review as JSON with exactly this shape:\n" +
    '{ "recap": string, "decisionPoints": [{ "turn": number|string, "whatHappened": string, ' +
    '"betterLine": string, "why": string }], "leakTags": string[] }\n' +
    "Return ONLY the JSON object, no prose, no markdown fences.\n\n" +
    "=== CONTEXT ===\n" +
    context
  );
}

/** Truncate context to MAX_CONTEXT_CHARS, appending a marker when it overflows. */
export function truncateContext(context) {
  if (context.length > MAX_CONTEXT_CHARS) {
    context = context.slice(0, MAX_CONTEXT_CHARS) + "\n…[context truncated]";
  }
  return context;
}

/** Shape we expect the auto-primer model to return. */
export const AutoPrimerSchema = z.object({
  deckArchetype: z.string().optional(),
  vsArchetype: z.string().optional(),
  verdict: z.string(),
  confidence: z.string().optional(),
  gameplan: z.string(),
  mustKill: z.string().optional(),
  mistakes: z.string().optional(),
  keyCards: z.array(z.object({ name: z.string(), note: z.string().optional() })).default([]),
});

// Strategy files the primer/review grounds in. The authored guidance
// (coachPrompt.js "GENERATE PRIMER" + SKILL-UPDATE.md) points primers at the
// matchup guide, meta archetypes, role theory (beatdown assignment drives the
// gameplan), and gameplay heuristics — a focused set rather than the whole base,
// since the auto-primer is a thinking-off step on the review's critical path and
// dumping all nine files would balloon input tokens on every review.
const PRIMER_KNOWLEDGE_FILES = [
  "matchup-guide.md",
  "meta-archetypes.md",
  "role-theory.md",
  "gameplay-heuristics.md",
];
// Combined cap across all loaded files so the primer prompt stays bounded even
// as the knowledge base grows.
const KNOWLEDGE_SNIPPET_CAP = 40000;

/**
 * Auto-generate a matchup primer using knowledge files + a fast LLM call.
 * When a deck list / opponent reveals are provided, the model is asked to
 * identify both archetypes from the actual cards (aligning names with the
 * knowledge base) instead of trusting the colors-only labels.
 * Falls back gracefully if files are missing or the model returns bad JSON.
 *
 * @param {object} opts
 * @param {string} opts.deckArchetype   colors-only fallback label, e.g. "Amber/Steel"
 * @param {string} opts.vsArchetype     colors-only fallback label for the opponent
 * @param {string} [opts.deckList]      rendered "Nx Card Name" lines for the player's deck
 * @param {string} [opts.oppRevealed]   rendered card names the opponent showed
 * @param {import("@anthropic-ai/sdk").default} opts.client
 * @returns {Promise<{data: object|null, usage: object|null}>}
 */
export async function autoGeneratePrimer({ deckArchetype, vsArchetype, deckList, oppRevealed, client }) {
  let knowledgeSnippet = "";
  for (const file of PRIMER_KNOWLEDGE_FILES) {
    if (knowledgeSnippet.length >= KNOWLEDGE_SNIPPET_CAP) break;
    const res = readKnowledge(file);
    if (res.error) continue; // File absent / not whitelisted in this environment — skip it.
    const remaining = KNOWLEDGE_SNIPPET_CAP - knowledgeSnippet.length;
    knowledgeSnippet += `\n\n=== ${file} ===\n${res.content.slice(0, remaining)}`;
  }

  const prompt =
    `Matchup (by ink colors): ${deckArchetype} vs ${vsArchetype}\n` +
    (deckList
      ? `\nThe player's full deck list:\n${deckList}\n`
      : "") +
    (oppRevealed
      ? `\nCards the opponent revealed this game (partial — their full list is unknown):\n${oppRevealed}\n`
      : "") +
    (knowledgeSnippet
      ? `\nUse the knowledge below to inform your answer.${knowledgeSnippet}\n\n`
      : "") +
    "If the deck list matches a known archetype from the knowledge, use that archetype's " +
    "established name in deckArchetype (same for the opponent from their revealed cards); " +
    "otherwise use the ink colors plus a style word (e.g. \"Ruby/Sapphire ramp\").\n" +
    "Return ONLY a JSON object with this exact shape (no prose, no fences):\n" +
    '{ "deckArchetype": "string", "vsArchetype": "string", ' +
    '"verdict": "Favored|Even|Unfavored", "confidence": "High|Medium|Low", ' +
    '"gameplan": "string", "mustKill": "string", "mistakes": "string", ' +
    '"keyCards": [{ "name": "string", "note": "string" }] }';

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: PRIMER_MAX_TOKENS,
      // Kept thinking-off: the primer is a fast, structured context-gen step on
      // the review's critical path — quality gain from thinking is marginal here
      // and not worth doubling latency of every review generation.
      thinking: { type: "disabled" },
      system: PRIMER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });
    const text = (resp.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const usage = resp.usage;
    const json = extractJson(text);
    if (!json) return { data: null, usage };
    let obj;
    try {
      obj = JSON.parse(json);
    } catch {
      return { data: null, usage };
    }
    const v = AutoPrimerSchema.safeParse(obj);
    return { data: v.success ? v.data : null, usage };
  } catch {
    return { data: null, usage: null };
  }
}
