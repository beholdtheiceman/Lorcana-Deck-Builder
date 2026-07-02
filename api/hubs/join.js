import { prisma } from '../_lib/db.js';
import { withAuth } from '../_lib/withAuth.js';
import { z } from 'zod';

const joinHubSchema = z.object({
  inviteCode: z.string().length(8),
});

const HUB_INCLUDE = {
  owner: { select: { id: true, email: true } },
  members: { include: { user: { select: { id: true, email: true } } } },
};

export default withAuth(async (req, res, session) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { inviteCode } = joinHubSchema.parse(req.body);
  const userId = session.uid;

  const hub = await prisma.hub.findUnique({ where: { inviteCode }, include: HUB_INCLUDE });
  if (!hub) return res.status(404).json({ error: 'Invalid invite code' });

  if (hub.ownerId === userId) return res.status(400).json({ error: 'You are already the owner of this hub' });

  const existingMember = await prisma.hubMember.findUnique({
    where: { hubId_userId: { hubId: hub.id, userId } },
  });
  if (existingMember) return res.status(400).json({ error: 'Already a member of this hub' });

  try {
    await prisma.hubMember.create({ data: { hubId: hub.id, userId } });
  } catch (e) {
    // A concurrent join raced past the existence check above; the unique
    // constraint caught it. Treat as success (idempotent join).
    if (e?.code !== "P2002") throw e;
  }

  const updatedHub = await prisma.hub.findUnique({ where: { id: hub.id }, include: HUB_INCLUDE });
  return res.status(200).json(updatedHub);
});
