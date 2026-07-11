import { z } from "zod";
import { prisma } from "../_lib/db.js";
import { withAuth } from "../_lib/withAuth.js";
import { readJson } from "../_lib/http.js";
import { buildReviewContext, findGame } from "../_lib/reviewContext.js";
import { getBudgetStatus, recordUsage } from "../_lib/llmBudget.js";
import {
  MAX_CONTEXT_CHARS,
  autoGeneratePrimer,
  callModel,
  buildUserInstruction,
  truncateContext,
} from "../_lib/reviewLlm.js";
import { summarizeDecklist, renderCompactDeckList, collectOpponentRevealed } from "../_lib/deckContext.js";
import { getAnthropicClient } from "../_lib/anthropic.js";

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
  if (!review.replayId) {
    return res.status(400).json({ error: "This review has no linked replay to regenerate from" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(501).json({ error: "LLM review generation is not configured. Set ANTHROPIC_API_KEY." });
  }

  const replay = await prisma.replay.findUnique({ where: { id: review.replayId } });
  if (!replay) return res.status(404).json({ error: "Linked replay no longer exists" });

  // Budget guard: refuse before any LLM call (auto-primer included).
  const budget = await getBudgetStatus(review.hubId);
  if (budget.exceeded) {
    return res.status(429).json({
      error:
        `Monthly AI budget reached for this hub ` +
        `(${budget.used.toLocaleString()} / ${budget.budget.toLocaleString()} tokens). ` +
        `The hub owner can raise it in the Reviews tab.`,
    });
  }

  const client = getAnthropicClient();
  const totalUsage = { input_tokens: 0, output_tokens: 0 };
  const addUsage = (u) => {
    totalUsage.input_tokens += u?.input_tokens ?? 0;
    totalUsage.output_tokens += u?.output_tokens ?? 0;
  };

  // Resolve the primer: stored one when linked, else re-run the same
  // auto-primer path the original generation used (reviews created via
  // auto-primer store primerId = null and used to be un-regenerable).
  let primer = null;
  if (review.primerId) {
    primer = await prisma.primer.findUnique({ where: { id: review.primerId } });
    if (!primer) return res.status(404).json({ error: "Linked primer no longer exists" });
  } else {
    const game = findGame(replay.parsed || {}, review.gameNumber);
    const deckArchetype = review.deckArchetype || game?.deckArchetype || null;
    const vsArchetype = review.vsArchetype || game?.vsArchetype || null;
    if (deckArchetype && vsArchetype) {
      const deckSummary = summarizeDecklist(game?.decklistMe);
      const oppRevealed = collectOpponentRevealed(game);
      const autoPrimer = await autoGeneratePrimer({
        deckArchetype,
        vsArchetype,
        deckList: renderCompactDeckList(deckSummary),
        oppRevealed: oppRevealed.length ? oppRevealed.map((r) => r.name).join("\n") : null,
        client,
      });
      addUsage(autoPrimer?.usage);
      if (autoPrimer?.data) {
        primer = {
          ...autoPrimer.data,
          deckArchetype: autoPrimer.data.deckArchetype || deckArchetype,
          vsArchetype: autoPrimer.data.vsArchetype || vsArchetype,
          keyCards: (autoPrimer.data.keyCards || []).map((kc) => ({
            id: null,
            name: kc.name,
            note: kc.note ?? "",
          })),
        };
      }
    }
  }

  let context = await buildReviewContext({
    replay,
    primer,
    gameNumber: review.gameNumber,
    maxChars: MAX_CONTEXT_CHARS,
  });
  context = truncateContext(context);

  const userInstruction = buildUserInstruction(context);

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
