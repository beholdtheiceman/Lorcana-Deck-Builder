import { prisma } from '../../_lib/db.js';
import { getSession } from '../../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const session = getSession(req);
      if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const user = { id: session.uid, email: session.email };

      const { id: hubId } = req.query;

      // Check if user is a member or owner of the hub
      const hub = await prisma.hub.findFirst({
        where: {
          id: hubId,
          OR: [
            { ownerId: user.id },
            { members: { some: { userId: user.id } } }
          ]
        }
      });

      if (!hub) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Get all members of the hub (including owner)
      const hubMembers = await prisma.hubMember.findMany({
        where: { hubId },
        select: { userId: true }
      });

      const memberIds = [
        hub.ownerId,
        ...hubMembers.map(member => member.userId)
      ];

      // Get all decks from hub members
      const decks = await prisma.deck.findMany({
        where: {
          userId: { in: memberIds }
        },
        include: {
          user: {
            select: { id: true, email: true }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      return res.status(200).json(decks);
    } catch (error) {
      console.error('Error fetching hub decks:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
