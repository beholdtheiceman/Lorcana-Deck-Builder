import { prisma } from '../../_lib/db.js';
import { getSession } from '../../_lib/auth.js';
import { z } from 'zod';

const removeMemberSchema = z.object({
  userId: z.string().uuid()
});

const transferOwnershipSchema = z.object({
  newOwnerId: z.string().uuid()
});

export default async function handler(req, res) {
  const { id: hubId } = req.query;

  if (req.method === 'DELETE') {
    try {
      const session = getSession(req);
      if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const user = { id: session.uid, email: session.email };

      const { userId } = removeMemberSchema.parse(req.body);

      // Check if user is the hub owner
      const hub = await prisma.hub.findUnique({
        where: { id: hubId }
      });

      if (!hub || hub.ownerId !== user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Check if trying to remove the owner
      if (userId === user.id) {
        return res.status(400).json({ error: 'Cannot remove yourself as owner' });
      }

      // Remove member
      await prisma.hubMember.deleteMany({
        where: {
          hubId,
          userId
        }
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error removing member:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PATCH') {
    try {
      const session = getSession(req);
      if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const user = { id: session.uid, email: session.email };

      const { newOwnerId } = transferOwnershipSchema.parse(req.body);

      // Check if user is the current hub owner
      const hub = await prisma.hub.findUnique({
        where: { id: hubId }
      });

      if (!hub || hub.ownerId !== user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Check if new owner is a member
      const newOwnerMembership = await prisma.hubMember.findUnique({
        where: {
          hubId_userId: {
            hubId,
            userId: newOwnerId
          }
        }
      });

      if (!newOwnerMembership) {
        return res.status(400).json({ error: 'New owner must be a member of the hub' });
      }

      // Transfer ownership
      await prisma.hub.update({
        where: { id: hubId },
        data: { ownerId: newOwnerId }
      });

      // Remove new owner from members list since they're now the owner
      await prisma.hubMember.deleteMany({
        where: {
          hubId,
          userId: newOwnerId
        }
      });

      // Add old owner as a member
      await prisma.hubMember.create({
        data: {
          hubId,
          userId: user.id
        }
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error transferring ownership:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
