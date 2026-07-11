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

const GenerateSchema = z.object({
  replayId: z.string().min(1),
  gameNumber: z.number().int(),
  primerId: z.string().min(1).optional(),
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
      take: 200, // cap payload; UI shows recent reviews
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

  const client = getAnthropicClient();
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
    // Colors-only labels ("Amber/Steel") are the fallback; when the replay
    // carries the deck list, the primer model names the archetypes from the
    // actual cards, aligning them with the knowledge base.
    const deckArchetype = game?.deckArchetype || game?.deck || null;
    const vsArchetype =
      game?.vsArchetype || game?.opponentDeck || game?.opponentArchetype || null;
    const deckSummary = summarizeDecklist(game?.decklistMe);
    const oppRevealed = collectOpponentRevealed(game);

    if (deckArchetype && vsArchetype) {
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
          deckArchetype,
          vsArchetype,
          ...autoPrimer.data,
          // Prefer the model's card-informed archetype names over colors-only.
          deckArchetype: autoPrimer.data.deckArchetype || deckArchetype,
          vsArchetype: autoPrimer.data.vsArchetype || vsArchetype,
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

  let context = await buildReviewContext({ replay, primer, gameNumber, maxChars: MAX_CONTEXT_CHARS });
  context = truncateContext(context);

  const userInstruction = buildUserInstruction(context);

  let result = await callModel(client, userInstruction);
  addUsage(result.usage);
  if (!result.data) {
    // Retry with thinking OFF so the full token budget goes to the JSON — the
    // first attempt's adaptive thinking can eat the budget and truncate it.
    result = await callModel(
      client,
      userInstruction +
        "\n\nYour previous reply was not valid JSON. Reply with the raw JSON object only.",
      { think: false }
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

async function assertHubMember(hubId, userId, res) {
  const hub = await prisma.hub.findFirst({
    where: { id: hubId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true },
  });
  if (!hub) res.status(403).json({ error: "Forbidden" });
}
