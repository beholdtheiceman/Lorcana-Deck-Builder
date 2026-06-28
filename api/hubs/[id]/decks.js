import { prisma } from "../../_lib/db.js";
import { withAuth } from "../../_lib/withAuth.js";

function cardCountOf(deck) {
  const deckData = deck.data || {};
  if (deckData.entries && typeof deckData.entries === "object") {
    return Object.values(deckData.entries).reduce((t, e) => t + (e.count || 0), 0);
  }
  return deckData.total || 0;
}

export default withAuth(async (req, res, session) => {
  const userId = session.uid;
  const { id: hubId } = req.query;

  // Must be owner or member of the hub.
  const hub = await prisma.hub.findFirst({
    where: { id: hubId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
  });
  if (!hub) return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") {
    const hubMembers = await prisma.hubMember.findMany({
      where: { hubId },
      select: { userId: true },
    });
    const memberIds = [hub.ownerId, ...hubMembers.map((m) => m.userId)];

    const decks = await prisma.deck.findMany({
      where: { userId: { in: memberIds } },
      include: { user: { select: { id: true, email: true } } },
      orderBy: { updatedAt: "desc" },
    });

    return res.status(200).json(decks.map((d) => ({ ...d, cardCount: cardCountOf(d) })));
  }

  if (req.method === "DELETE") {
    const { deckId } = req.body;
    if (!deckId) return res.status(400).json({ error: "Deck ID is required" });

    const isHubOwner = hub.ownerId === userId;
    // Members may delete their own decks; the hub owner may delete any deck in the hub.
    const ownDeck = await prisma.deck.findFirst({ where: { id: deckId, userId } });
    if (!ownDeck && !isHubOwner) {
      return res.status(403).json({ error: "You can only delete your own decks" });
    }

    const result = await prisma.deck.deleteMany({ where: { id: deckId } });
    if (result.count === 0) return res.status(404).json({ error: "Deck not found" });

    return res.status(200).json({ message: "Deck deleted successfully" });
  }

  return res.status(405).json({ error: "Method not allowed" });
});
