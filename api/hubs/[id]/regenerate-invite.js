import { randomInt } from "crypto";
import { prisma } from "../../_lib/db.js";
import { withAuth } from "../../_lib/withAuth.js";

const generateInviteCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) result += chars.charAt(randomInt(chars.length));
  return result;
};

export default withAuth(async (req, res, session) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id: hubId } = req.query;
  if (!hubId) return res.status(400).json({ error: "Hub id is required" });

  const userId = session.uid;
  const hub = await prisma.hub.findUnique({ where: { id: hubId }, select: { ownerId: true } });
  if (!hub) return res.status(404).json({ error: "Hub not found" });
  if (hub.ownerId !== userId) return res.status(403).json({ error: "Only the hub owner can regenerate the invite code" });

  let inviteCode;
  let attempts = 0;
  do {
    inviteCode = generateInviteCode();
    if (++attempts > 10) return res.status(500).json({ error: "Failed to generate unique invite code" });
  } while (await prisma.hub.findUnique({ where: { inviteCode } }));

  await prisma.hub.update({ where: { id: hubId }, data: { inviteCode } });
  return res.status(200).json({ inviteCode });
});
