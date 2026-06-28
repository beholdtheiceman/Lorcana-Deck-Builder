import { z } from "zod";
import { prisma } from "../_lib/db.js";
import { withAuth } from "../_lib/withAuth.js";
import { readJson } from "../_lib/http.js";
import { postDiscord } from "../_lib/discord.js";

/**
 * Stage A: import a fully-formed review object (produced by an external agent /
 * human) directly into storage. No LLM is invoked here.
 */

const LineSchema = z.object({
  turn: z.union([z.number(), z.string()]).optional(),
  whatHappened: z.string().optional(),
  betterLine: z.string().optional(),
  why: z.string().optional(),
});

const ReviewImportSchema = z.object({
  hubId: z.string().min(1),
  replayId: z.string().min(1).optional(),
  primerId: z.string().min(1).optional(),
  gameNumber: z.number().int().optional(),
  player: z.string().optional(),
  deckArchetype: z.string().optional(),
  vsArchetype: z.string().optional(),
  result: z.string().optional(),
  recap: z.string().min(1),
  lines: z.array(LineSchema).default([]),
  leakTags: z.array(z.string()).default([]),
  generatedBy: z.string().default("agent"),
});

export default withAuth(async (req, res, session) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body ?? (await readJson(req));
  const parsed = ReviewImportSchema.safeParse(body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const data = parsed.data;

  // Hub membership check: requester must own or belong to the hub.
  const userId = session.uid;
  const hub = await prisma.hub.findFirst({
    where: { id: data.hubId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true, name: true, discordWebhookUrl: true },
  });
  if (!hub) return res.status(403).json({ error: "Forbidden" });

  const review = await prisma.review.create({
    data: {
      hubId: data.hubId,
      replayId: data.replayId ?? null,
      primerId: data.primerId ?? null,
      authorId: userId,
      generatedBy: data.generatedBy,
      gameNumber: data.gameNumber ?? null,
      player: data.player ?? null,
      deckArchetype: data.deckArchetype ?? null,
      vsArchetype: data.vsArchetype ?? null,
      result: data.result ?? null,
      recap: data.recap,
      lines: data.lines,
      leakTags: data.leakTags,
    },
  });

  // Fire-and-forget Discord notification (never blocks/breaks the response).
  const matchup = [review.deckArchetype, review.vsArchetype].filter(Boolean).join(" vs ");
  await postDiscord(
    hub.discordWebhookUrl,
    `📝 **New review filed in ${hub.name}**${matchup ? `: ${matchup}` : ""}${review.result ? ` (${review.result})` : ""}`
  );

  return res.status(201).json(review);
});
