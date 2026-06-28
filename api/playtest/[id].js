import { prisma } from "../_lib/db.js";
import { withAuth } from "../_lib/withAuth.js";

// DELETE /api/playtest/:id -> the logger or the hub owner can remove a game.
export default withAuth(async (req, res, session) => {
  const userId = session.uid;
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Game id is required" });

  const game = await prisma.playtestGame.findUnique({ where: { id } });
  if (!game) return res.status(404).json({ error: "Game not found" });

  const hub = await prisma.hub.findFirst({
    where: { id: game.hubId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { ownerId: true },
  });
  if (!hub) return res.status(403).json({ error: "Forbidden" });

  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (game.loggedById !== userId && hub.ownerId !== userId) {
    return res.status(403).json({ error: "Only the logger or hub owner can delete this game" });
  }

  await prisma.playtestGame.delete({ where: { id } });
  return res.status(200).json({ ok: true });
});
