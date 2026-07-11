import { z } from "zod";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { COACH_MODEL, COACH_SYSTEM_PROMPT } from "./coachPrompt.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = join(__dirname, "../../src/data/agent-knowledge");

export const MODEL = COACH_MODEL;
export const MAX_CONTEXT_CHARS = 60000;
// The review JSON (recap + up to 4 decision points + leak tags) plus adaptive
// thinking needs real room; 2000 truncated the JSON and failed the parse.
export const MAX_TOKENS = 6000;
// A useful primer (gameplan + must-kill + 3–6 key cards) needs more than 800.
export const PRIMER_MAX_TOKENS = 1500;

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

export async function callModel(client, userInstruction) {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // Adaptive thinking makes the review analysis substantially better; the
    // large MAX_TOKENS budget + the invalid-JSON retry below keep the strict
    // JSON contract safe from truncation.
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userInstruction }],
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
  const validated = ModelOutSchema.safeParse(obj);
  return { data: validated.success ? validated.data : null, usage };
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

// Per-file cap so a runaway knowledge file can't blow up the primer call.
const KNOWLEDGE_FILE_CAP = 15000;

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
  for (const file of ["meta-archetypes.md", "matchup-guide.md"]) {
    try {
      const text = readFileSync(join(KNOWLEDGE_DIR, file), "utf8");
      knowledgeSnippet += `\n\n=== ${file} ===\n${text.slice(0, KNOWLEDGE_FILE_CAP)}`;
    } catch {
      // File absent in this environment — skip it.
    }
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
