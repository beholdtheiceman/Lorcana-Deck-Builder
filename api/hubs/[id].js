import { prisma } from '../_lib/db.js';
import { withAuth } from '../_lib/withAuth.js';

const HUB_INCLUDE = {
  owner: { select: { id: true, email: true } },
  members: { include: { user: { select: { id: true, email: true } } } },
};

export default withAuth(async (req, res, session) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id: hubId } = req.query;
  if (!hubId) return res.status(400).json({ error: 'Hub ID is required' });

  const hub = await prisma.hub.findUnique({ where: { id: hubId }, include: HUB_INCLUDE });
  if (!hub) return res.status(404).json({ error: 'Hub not found' });

  const userId = session.uid;
  const isMember = hub.members.some(m => m.user.id === userId);
  const isOwner = hub.ownerId === userId;
  if (!isMember && !isOwner) return res.status(403).json({ error: 'Access denied' });

  return res.status(200).json(hub);
});
