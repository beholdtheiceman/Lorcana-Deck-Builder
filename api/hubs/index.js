import { prisma } from "../_lib/db.js";
import { withAuth } from "../_lib/withAuth.js";
import { z } from "zod";
import { randomInt } from "crypto";

const createHubSchema = z.object({ name: z.string().min(1).max(100) });

const HUB_INCLUDE = {
  owner: { select: { id: true, email: true } },
  members: { include: { user: { select: { id: true, email: true } } } },
};

const generateInviteCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) result += chars.charAt(randomInt(chars.length));
  return result;
};

export default withAuth(async (req, res, session) => {
  const userId = session.uid;

  if (req.method === "POST") {
    const { name } = createHubSchema.parse(req.body);

    // Rely on the DB unique constraint (source of truth) and retry on a rare
    // collision, rather than a racy check-then-insert.
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const hub = await prisma.hub.create({
          data: { name, inviteCode: generateInviteCode(), ownerId: userId },
          include: HUB_INCLUDE,
        });
        return res.status(201).json(hub);
      } catch (e) {
        if (e?.code === "P2002" && attempt < 9) continue; // invite code collision → retry
        throw e;
      }
    }
    return res.status(500).json({ error: "Failed to generate unique invite code" });
  }

  if (req.method === "GET") {
    const hubs = await prisma.hub.findMany({
      where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      include: HUB_INCLUDE,
    });
    return res.status(200).json(hubs);
  }

  if (req.method === "DELETE") {
    const { hubId } = req.query;
    if (!hubId) return res.status(400).json({ error: "Hub ID is required" });

    const result = await prisma.hub.deleteMany({ where: { id: hubId, ownerId: userId } });
    if (result.count === 0) {
      return res.status(403).json({ error: "Forbidden: You can only delete hubs you own" });
    }
    return res.status(200).json({ message: "Hub deleted successfully" });
  }

  return res.status(405).json({ error: "Method not allowed" });
});
