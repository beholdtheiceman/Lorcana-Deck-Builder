import { z } from "zod";
import { prisma } from "../_lib/db.js";
import { withAuth } from "../_lib/withAuth.js";
import { postDiscord } from "../_lib/discord.js";

const keyCard = z.object({
  id: z.union([z.string(), z.number()]).nullish(),
  name: z.string().min(1),
  note: z.string().optional(),
});

const patchSchema = z.object({
  deckArchetype: z.string().min(1).optional(),
  vsArchetype: z.string().min(1).optional(),
  verdict: z.string().nullish(),
  confidence: z.string().optional(),
  gameplan: z.string().nullish(),
  mustKill: z.string().nullish(),
  mistakes: z.string().nullish(),
  keyCards: z.array(keyCard).optional(),
  // When true, bumps lastReviewedAt to now (clears the "Stale" badge).
  touchReviewed: z.boolean().optional(),
});

export default withAuth(async (req, res, session) => {
  const userId = session.uid;
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Primer id is required" });

  const primer = await prisma.primer.findUnique({
    where: { id },
    include: {
      hub: {
        select: {
          name: true,
          ownerId: true,
          discordWebhookUrl: true,
          members: { where: { userId }, select: { id: true } },
        },
      },
    },
  });
  if (!primer) return res.status(404).json({ error: "Not found" });

  const isPrimerOwner = primer.ownerId === userId;
  const isHubOwner = primer.hub.ownerId === userId;
  const isHubMember = primer.hub.members.length > 0;

  if (req.method === "PATCH") {
    // The primer owner or any hub member (owner counts as access) may edit.
    if (!isPrimerOwner && !isHubOwner && !isHubMember) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const data = patchSchema.parse(req.body ?? {});
    const update = {};
    for (const k of [
      "deckArchetype",
      "vsArchetype",
      "verdict",
      "confidence",
      "gameplan",
      "mustKill",
      "mistakes",
      "keyCards",
    ]) {
      if (data[k] !== undefined) update[k] = data[k];
    }
    // Any meaningful edit (or an explicit touch) refreshes the review clock.
    if (data.touchReviewed || Object.keys(update).length > 0) {
      update.lastReviewedAt = new Date();
    }

    const updated = await prisma.primer.update({
      where: { id },
      data: update,
      include: { owner: { select: { id: true, email: true } } },
    });

    // Fire-and-forget Discord notification (never blocks/breaks the response).
    await postDiscord(
      primer.hub.discordWebhookUrl,
      `📖 **Primer updated in ${primer.hub.name}**: ${updated.deckArchetype} vs ${updated.vsArchetype}`
    );

    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    // Only the primer owner or the hub owner may delete.
    if (!isPrimerOwner && !isHubOwner) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await prisma.primer.delete({ where: { id } });
    return res.status(200).json({ message: "Primer deleted" });
  }

  return res.status(405).json({ error: "Method not allowed" });
});
