import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../_lib/db.js";
import { withAuth } from "../_lib/withAuth.js";
import { readJson } from "../_lib/http.js";
import { buildReviewContext } from "../_lib/reviewContext.js";
import { getBudgetStatus, recordUsage } from "../_lib/llmBudget.js";

const MODEL = "claude-sonnet-4-6";
const MAX_CONTEXT_CHARS = 60000; // cap grounding context handed to the model
const MAX_TOKENS = 2000;

const SYSTEM_PROMPT =
  "You are a Lorcana coach. Ground every claim in the provided log and card text. " +
  "Give the flow of the game, not a play-by-play. Identify 2-4 decision points where a " +
  "different line was stronger, citing the turn. Respect the matchup primer.";

const GenerateSchema = z.object({
  replayId: z.string().min(1),
  gameNumber: z.number().int(),
  primerId: z.string().min(1),
});

/** Shape we expect the model to return. */
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

  // Load replay + primer, membership-checked via their hubId.
  const replay = await prisma.replay.findUnique({ where: { id: replayId } });
  if (!replay) return res.status(404).json({ error: "Replay not found" });
  await assertHubMember(replay.hubId, userId, res);
  if (res.writableEnded) return;

  const primer = await prisma.primer.findUnique({ where: { id: primerId } });
  if (!primer) return res.status(404).json({ error: "Primer not found" });
  if (primer.hubId !== replay.hubId) {
    return res.status(400).json({ error: "Primer and replay belong to different hubs" });
  }

  // Build and cap the grounding context.
  let context = await buildReviewContext({ replay, primer, gameNumber });
  if (context.length > MAX_CONTEXT_CHARS) {
    context = context.slice(0, MAX_CONTEXT_CHARS) + "\n…[context truncated]";
  }

  // Budget guard: refuse if the hub has hit its monthly token cap.
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

  const userInstruction =
    "Using only the context below, write the review as JSON with exactly this shape:\n" +
    '{ "recap": string, "decisionPoints": [{ "turn": number|string, "whatHappened": string, ' +
    '"betterLine": string, "why": string }], "leakTags": string[] }\n' +
    "Return ONLY the JSON object, no prose, no markdown fences.\n\n" +
    "=== CONTEXT ===\n" +
    context;

  // Track every token spent (incl. a failed/retried attempt) against the budget.
  const totalUsage = { input_tokens: 0, output_tokens: 0 };
  const addUsage = (u) => {
    totalUsage.input_tokens += u?.input_tokens ?? 0;
    totalUsage.output_tokens += u?.output_tokens ?? 0;
  };

  let result = await callModel(client, userInstruction);
  addUsage(result.usage);
  if (!result.data) {
    // Retry once with an even stricter reminder on malformed JSON.
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
      primerId: primer.id,
      authorId: userId,
      generatedBy: "llm",
      gameNumber,
      player: replay.playerName ?? null,
      deckArchetype: primer.deckArchetype ?? null,
      vsArchetype: primer.vsArchetype ?? null,
      result: replay.matchResult ?? null,
      recap: modelOut.recap,
      lines: modelOut.decisionPoints, // decisionPoints -> lines
      leakTags: modelOut.leakTags,
    },
  });

  return res.status(201).json(review);
});

/** Calls the model and returns parsed/validated output, or null on malformed JSON. */
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

/** Pull the first balanced JSON object out of a possibly-fenced model reply. */
function extractJson(text) {
  if (!text) return null;
  let t = text.trim();
  // Strip ```json ... ``` fences if present.
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  return t.slice(start, end + 1);
}

/** Writes a 403 response if the user is not owner/member of the hub. */
async function assertHubMember(hubId, userId, res) {
  const hub = await prisma.hub.findFirst({
    where: { id: hubId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true },
  });
  if (!hub) res.status(403).json({ error: "Forbidden" });
}
