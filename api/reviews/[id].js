import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../_lib/db.js";
import { withAuth } from "../_lib/withAuth.js";
import { readJson } from "../_lib/http.js";
import { buildReviewContext } from "../_lib/reviewContext.js";
import { getBudgetStatus, recordUsage } from "../_lib/llmBudget.js";

const MODEL = "claude-sonnet-4-6";
const MAX_CONTEXT_CHARS = 60000;
const MAX_TOKENS = 2000;
const SYSTEM_PROMPT =
  "You are a Lorcana coach. Ground every claim in the provided log and card text. " +
  "Give the flow of the game, not a play-by-play. Identify 2-4 decision points where a " +
  "different line was stronger, citing the turn. Respect the matchup primer.";

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

// Per-review actions:
//   GET    /api/reviews/:id                          -> fetch one review (hub-member)
//   POST   /api/reviews/:id { action: "regenerate" } -> re-run the LLM and update in place
//   DELETE /api/reviews/:id                          -> review author or hub owner
export default withAuth(async (req, res, session) => {
  const userId = session.uid;
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Review id is required" });

  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) return res.status(404).json({ error: "Review not found" });

  const hub = await prisma.hub.findFirst({
    where: { id: review.hubId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { ownerId: true },
  });
  if (!hub) return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") return res.status(200).json(review);

  if (req.method === "DELETE") {
    if (review.authorId !== userId && hub.ownerId !== userId) {
      return res.status(403).json({ error: "Only the review author or hub owner can delete this review" });
    }
    await prisma.review.delete({ where: { id } });
    return res.status(200).json({ ok: true });
  }

  if (req.method === "PATCH") {
    if (review.authorId !== userId && hub.ownerId !== userId) {
      return res.status(403).json({ error: "Only the review author or hub owner can edit this review" });
    }
    const body = req.body ?? (await readJson(req));
    const PatchSchema = z.object({
      recap: z.string().max(10000).optional(),
      leakTags: z.array(z.string().trim().max(80)).max(20).optional(),
    });
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
    const data = {};
    if (parsed.data.recap !== undefined) data.recap = parsed.data.recap;
    if (parsed.data.leakTags !== undefined) data.leakTags = parsed.data.leakTags;
    const updated = await prisma.review.update({ where: { id }, data });
    return res.status(200).json(updated);
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // POST = regenerate
  const body = req.body ?? (await readJson(req));
  if (body && body.action && body.action !== "regenerate") {
    return res.status(400).json({ error: "Unsupported action" });
  }
  if (!review.replayId || !review.primerId) {
    return res.status(400).json({ error: "This review has no linked replay/primer to regenerate from" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(501).json({ error: "LLM review generation is not configured. Set ANTHROPIC_API_KEY." });
  }

  const replay = await prisma.replay.findUnique({ where: { id: review.replayId } });
  const primer = await prisma.primer.findUnique({ where: { id: review.primerId } });
  if (!replay || !primer) return res.status(404).json({ error: "Linked replay or primer no longer exists" });

  let context = await buildReviewContext({ replay, primer, gameNumber: review.gameNumber });
  if (context.length > MAX_CONTEXT_CHARS) {
    context = context.slice(0, MAX_CONTEXT_CHARS) + "\n…[context truncated]";
  }

  // Budget guard: refuse if the hub has hit its monthly token cap.
  const budget = await getBudgetStatus(review.hubId);
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
    '{ "recap": string, "decisionPoints": [{ "turn": number|string, "whatHappened": string, "betterLine": string, "why": string }], "leakTags": string[] }\n' +
    "Return ONLY the JSON object, no prose, no markdown fences.\n\n=== CONTEXT ===\n" +
    context;

  const totalUsage = { input_tokens: 0, output_tokens: 0 };
  const addUsage = (u) => {
    totalUsage.input_tokens += u?.input_tokens ?? 0;
    totalUsage.output_tokens += u?.output_tokens ?? 0;
  };

  let result = await callModel(client, userInstruction);
  addUsage(result.usage);
  if (!result.data) {
    result = await callModel(
      client,
      userInstruction + "\n\nYour previous reply was not valid JSON. Reply with the raw JSON object only."
    );
    addUsage(result.usage);
  }
  await recordUsage(review.hubId, userId, "regenerate", totalUsage);
  if (!result.data) return res.status(502).json({ error: "Model did not return valid JSON" });
  const out = result.data;

  const updated = await prisma.review.update({
    where: { id },
    data: {
      recap: out.recap,
      lines: out.decisionPoints,
      leakTags: out.leakTags,
      generatedBy: "llm",
      authorId: userId,
    },
  });
  return res.status(200).json(updated);
});

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
  const v = ModelOutSchema.safeParse(obj);
  return { data: v.success ? v.data : null, usage };
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
