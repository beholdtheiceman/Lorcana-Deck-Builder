import { prisma } from '../_lib/db.js';
import { getSession } from '../_lib/auth.js';

const HUB_INCLUDE = {
  owner: { select: { id: true, email: true } },
  members: { include: { user: { select: { id: true, email: true } } } },
};

export default async function handler(req, res) {
  const { id: hubId } = req.query;

  if (!hubId) {
    return res.status(400).json({ error: 'Hub ID is required' });
  }

  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const hub = await prisma.hub.findUnique({
      where: { id: hubId },
      include: HUB_INCLUDE,
    });

    if (!hub) {
      return res.status(404).json({ error: 'Hub not found' });
    }

    // Verify the requester is a member or owner
    const userId = session.uid;
    const isMember = hub.members.some(m => m.user.id === userId);
    const isOwner = hub.ownerId === userId;

    if (!isMember && !isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.status(200).json(hub);
  } catch (error) {
    console.error('Error fetching hub:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
