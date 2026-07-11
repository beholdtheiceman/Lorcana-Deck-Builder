import { prisma } from "../../_lib/db.js";
import { withAuth } from "../../_lib/withAuth.js";

// GET /api/decks/:id/versions -> the deck's snapshot history, newest first.
// Owner-scoped. Each version is an immutable prior state (see DeckVersion in
// the schema); the client can diff them or re-save one to roll back.
export default withAuth(async (req, res, sess) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Deck id is required" });

  // Ownership check before exposing any history.
  const deck = await prisma.deck.findFirst({
    where: { id, userId: sess.uid },
    select: { id: true },
  });
  if (!deck) return res.status(404).json({ error: "Deck not found" });

  const versions = await prisma.deckVersion.findMany({
    where: { deckId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return res.json({ versions });
});
