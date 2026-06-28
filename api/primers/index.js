import { z } from "zod";
import { prisma } from "../_lib/db.js";
import { withAuth } from "../_lib/withAuth.js";

// Owner or member of the hub may read/write its primers.
async function hubForUser(userId, hubId) {
  return prisma.hub.findFirst({
    where: { id: hubId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
  });
}

const keyCard = z.object({
  id: z.union([z.string(), z.number()]).nullish(),
  name: z.string().min(1),
  note: z.string().optional(),
});

const upsertSchema = z.object({
  hubId: z.string().min(1),
  deckArchetype: z.string().min(1),
  vsArchetype: z.string().min(1),
  verdict: z.string().nullish(),
  confidence: z.string().optional(),
  gameplan: z.string().nullish(),
  mustKill: z.string().nullish(),
  mistakes: z.string().nullish(),
  keyCards: z.array(keyCard).default([]),
});

export default withAuth(async (req, res, session) => {
  const userId = session.uid;

  if (req.method === "GET") {
    const { hubId } = req.query;
    if (!hubId) return res.status(400).json({ error: "hubId is required" });

    const hub = await hubForUser(userId, hubId);
    if (!hub) return res.status(403).json({ error: "Forbidden" });

    const primers = await prisma.primer.findMany({
      where: { hubId },
      include: { owner: { select: { id: true, email: true } } },
      orderBy: [{ deckArchetype: "asc" }, { vsArchetype: "asc" }],
    });
    return res.status(200).json(primers);
  }

  if (req.method === "POST") {
    const data = upsertSchema.parse(req.body ?? {});

    const hub = await hubForUser(userId, data.hubId);
    if (!hub) return res.status(403).json({ error: "Forbidden" });

    // Fields that exist on both create and update.
    const shared = {
      verdict: data.verdict ?? null,
      gameplan: data.gameplan ?? null,
      mustKill: data.mustKill ?? null,
      mistakes: data.mistakes ?? null,
      keyCards: data.keyCards,
      lastReviewedAt: new Date(),
    };
    if (data.confidence !== undefined) shared.confidence = data.confidence;

    const primer = await prisma.primer.upsert({
      where: {
        hubId_deckArchetype_vsArchetype: {
          hubId: data.hubId,
          deckArchetype: data.deckArchetype,
          vsArchetype: data.vsArchetype,
        },
      },
      create: {
        hubId: data.hubId,
        deckArchetype: data.deckArchetype,
        vsArchetype: data.vsArchetype,
        confidence: data.confidence ?? "Draft",
        ownerId: userId,
        ...shared,
      },
      update: shared,
      include: { owner: { select: { id: true, email: true } } },
    });
    return res.status(200).json(primer);
  }

  return res.status(405).json({ error: "Method not allowed" });
});
