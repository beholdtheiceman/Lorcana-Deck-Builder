import { z } from "zod";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../_lib/db.js";
import { withAuth } from "../_lib/withAuth.js";
import { readJson } from "../_lib/http.js";
import { buildReviewContext } from "../_lib/reviewContext.js";
import { getBudgetStatus, recordUsage } from "../_lib/llmBudget.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = join(__dirname, "../../src/data/agent-knowledge");

const MODEL = "claude-sonnet-4-6";
const MAX_CONTEXT_CHARS = 60000;
const MAX_TOKENS = 2000;
const PRIMER_MAX_TOKENS = 600;

const SYSTEM_PROMPT =
  "You are a Lorcana coach. Ground every claim in the provided log and card text. " +
  "Give the flow of the game, not a play-by-play. Identify 2-4 decision points where a " +
  "different line was stronger, citing the turn. Respect the matchup primer.";

const PRIMER_SYSTEM_PROMPT =
  "You are a Disney Lorcana competitive expert. Generate concise matchup primers in JSON only.";

const GenerateSchema = z.object({
  replayId: z.string().min(1),
  gameNumber: z.number().int(),
  primerId: z.string().min(1).optional(),
});

/** Shape we expect the review model to return. */
const ModelOutSchema = z.object({
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

/** Shape we expect the auto-primer model to return. */
const AutoPrimerSchema = z.object({
  verdict: z.string(),
  confidence: z.string().optional(),
  gameplan: z.string(),
  mustKill: z.string().optional(),
  mistakes: z.string().optional(),
  keyCards: z.array(z.object({ name: z.string(), note: z.string().optional() })).default([]),
});

export default withAuth(async (req, res, session) => {
  const userId = session.uid;

  if (req.method === "GET") {
    const hubId = req.query.hubId;
    if (!hubId) return res.status(400).json({ error: "hubId is required" });
    await assertHubMember(hubId, userId, res);
    if (res.writableEnded) return;

    const reviews = await prisma.review.findMany({
      where: { hubId },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json(reviews);
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(501).json({
      error:
        "LLM review generation is not configured. Set ANTHROPIC_API_KEY to enable Stage B, " +
        "or POST a finished review to /api/reviews/import (Stage A).",
    });
  }

  const body = req.body ?? (await readJson(req));
  const parsed = GenerateSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const { replayId, gameNumber, primerId } = parsed.data;

  const replay = await prisma.replay.findUnique({ where: { id: replayId } });
  if (!replay) return res.status(404).json({ error: "Replay not found" });
  await assertHubMember(replay.hubId, userId, res);
  if (res.writableEnded) return;

  // DEBUG — remove after confirming parser fix
  const _parsed = replay.parsed || {};
  const _games = Array.isArray(_parsed.games) ? _parsed.games : [];
  console.log("[review-debug] replay.parsed keys:", Object.keys(_parsed));
  console.log("[review-debug] game count:", _games.length);
  if (_games[0]) {
    console.log("[review-debug] game[0] keys:", Object.keys(_games[0]));
    console.log("[review-debug] game[0].events length:", (_games[0].events || []).length);
    console.log("[review-debug] game[0].gameNumber:", _games[0].gameNumber);
    console.log("[review-debug] game[0] first event:", JSON.stringify((_games[0].events || [])[0]));
  }

  // Budget guard before any LLM calls.
  const budget = await getBudgetStatus(replay.hubId);
  if (budget.exceeded) {
    return res.status(429).json({
      error:
        `Monthly AI budget reached for this hub ` +
        `(${budget.used.toLocaleString()} / ${budget.budget.toLocaleString()} tokens). ` +
        `The hub owner can raise it in the Reviews tab.`,
    });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const totalUsage = { input_tokens: 0, output_tokens: 0 };
  const addUsage = (u) => {
    totalUsage.input_tokens += u?.input_tokens ?? 0;
    totalUsage.output_tokens += u?.output_tokens ?? 0;
  };

  // Resolve primer — use the supplied one, or auto-generate from replay archetypes.
  let primer = null;
  let savedPrimerId = null;
  const game = findGame(replay.parsed || {}, gameNumber);

  if (primerId) {
    primer = await prisma.primer.findUnique({ where: { id: primerId } });
    if (!primer) return res.status(404).json({ error: "Primer not found" });
    if (primer.hubId !== replay.hubId) {
      return res.status(400).json({ error: "Primer and replay belong to different hubs" });
    }
    savedPrimerId = primer.id;
  } else {
    // Derive archetypes from the parsed game and auto-generate matchup context.
    const deckArchetype = game?.deckArchetype || game?.deck || replay.playerDeck || null;
    const vsArchetype =
      game?.vsArchetype || game?.opponentDeck || game?.opponentArchetype || null;

    if (deckArchetype && vsArchetype) {
      const autoPrimer = await autoGeneratePrimer(deckArchetype, vsArchetype, client);
      addUsage(autoPrimer?.usage);
      if (autoPrimer?.data) {
        primer = {
          deckArchetype,
          vsArchetype,
          ...autoPrimer.data,
          // Normalize keyCards to the shape buildReviewContext expects.
          keyCards: (autoPrimer.data.keyCards || []).map((kc) => ({
            id: null,
            name: kc.name,
            note: kc.note ?? "",
          })),
        };
      }
    }
  }

  let context = await buildReviewContext({ replay, primer, gameNumber });
  if (context.length > MAX_CONTEXT_CHARS) {
    context = context.slice(0, MAX_CONTEXT_CHARS) + "\n…[context truncated]";
  }

  const userInstruction =
    "Using only the context below, write the review as JSON with exactly this shape:\n" +
    '{ "recap": string, "decisionPoints": [{ "turn": number|string, "whatHappened": string, ' +
    '"betterLine": string, "why": string }], "leakTags": string[] }\n' +
    "Return ONLY the JSON object, no prose, no markdown fences.\n\n" +
    "=== CONTEXT ===\n" +
    context;

  let result = await callModel(client, userInstruction);
  addUsage(result.usage);
  if (!result.data) {
    result = await callModel(
      client,
      userInstruction +
        "\n\nYour previous reply was not valid JSON. Reply with the raw JSON object only."
    );
    addUsage(result.usage);
  }
  await recordUsage(replay.hubId, userId, "generate", totalUsage);
  if (!result.data) {
    return res.status(502).json({ error: "Model did not return valid JSON" });
  }
  const modelOut = result.data;

  const review = await prisma.review.create({
    data: {
      hubId: replay.hubId,
      replayId: replay.id,
      primerId: savedPrimerId ?? null,
      authorId: userId,
      generatedBy: "llm",
      gameNumber,
      player: replay.playerName ?? null,
      deckArchetype: primer?.deckArchetype ?? game?.deckArchetype ?? null,
      vsArchetype: primer?.vsArchetype ?? game?.vsArchetype ?? null,
      result: replay.matchResult ?? game?.result ?? null,
      recap: modelOut.recap,
      lines: modelOut.decisionPoints,
      leakTags: modelOut.leakTags,
    },
  });

  return res.status(201).json(review);
});

/**
 * Auto-generate a matchup primer using knowledge files + a fast LLM call.
 * Falls back gracefully if files are missing or the model returns bad JSON.
 */
async function autoGeneratePrimer(deckArchetype, vsArchetype, client) {
  let knowledgeSnippet = "";
  for (const file of ["matchup-guide.md", "gameplay-heuristics.md", "meta-archetypes.md"]) {
    try {
      const text = readFileSync(join(KNOWLEDGE_DIR, file), "utf8");
      // Cap each file to keep the primer call cheap.
      knowledgeSnippet += `\n\n=== ${file} ===\n${text.slice(0, 4000)}`;
    } catch {
      // File absent in this environment — skip it.
    }
  }

  const prompt =
    `Matchup: ${deckArchetype} vs ${vsArchetype}\n` +
    (knowledgeSnippet
      ? `\nUse the knowledge below to inform your answer.${knowledgeSnippet}\n\n`
      : "") +
    "Return ONLY a JSON object with this exact shape (no prose, no fences):\n" +
    '{ "verdict": "Favored|Even|Unfavored", "confidence": "High|Medium|Low", ' +
    '"gameplan": "string", "mustKill": "string", "mistakes": "string", ' +
    '"keyCards": [{ "name": "string", "note": "string" }] }';

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: PRIMER_MAX_TOKENS,
      temperature: 0.1,
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

/** Extract the game matching gameNumber from replay.parsed. */
function findGame(parsed, gameNumber) {
  const games =
    (Array.isArray(parsed.games) && parsed.games) ||
    (Array.isArray(parsed.matches) && parsed.matches) ||
    null;
  if (!games || games.length === 0) return parsed || {};
  if (gameNumber != null) {
    const byField = games.find((g) => g && Number(g.gameNumber) === Number(gameNumber));
    if (byField) return byField;
    const byIndex = games[Number(gameNumber) - 1];
    if (byIndex) return byIndex;
  }
  return games[0];
}

async function callModel(client, userInstruction) {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.2,
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

function extractJson(text) {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  return t.slice(start, end + 1);
}

async function assertHubMember(hubId, userId, res) {
  const hub = await prisma.hub.findFirst({
    where: { id: hubId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true },
  });
  if (!hub) res.status(403).json({ error: "Forbidden" });
}
