import { prisma } from "../_lib/db.js";
import { withAuth } from "../_lib/withAuth.js";

// DELETE /api/events/:id -> the creator or the hub owner can remove an event.
export default withAuth(async (req, res, session) => {
  const userId = session.uid;
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Event id is required" });

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return res.status(404).json({ error: "Event not found" });

  const hub = await prisma.hub.findFirst({
    where: { id: event.hubId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { ownerId: true },
  });
  if (!hub) return res.status(403).json({ error: "Forbidden" });

  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (event.createdById !== userId && hub.ownerId !== userId) {
    return res.status(403).json({ error: "Only the event creator or hub owner can delete this event" });
  }

  await prisma.event.delete({ where: { id } });
  return res.status(200).json({ ok: true });
});
