import { prisma } from '../_lib/db.js';
import { getSession } from '../_lib/auth.js';
import { z } from 'zod';

const joinHubSchema = z.object({
  inviteCode: z.string().length(8)
});

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const session = getSession(req);
      if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const user = { id: session.uid, email: session.email };

      const { inviteCode } = joinHubSchema.parse(req.body);

      // Find hub by invite code
      const hub = await prisma.hub.findUnique({
        where: { inviteCode },
        include: {
          owner: {
            select: { id: true, email: true }
          },
          members: {
            include: {
              user: {
                select: { id: true, email: true }
              }
            }
          }
        }
      });

      if (!hub) {
        return res.status(404).json({ error: 'Invalid invite code' });
      }

      // Check if user is already a member
      const existingMember = await prisma.hubMember.findUnique({
        where: {
          hubId_userId: {
            hubId: hub.id,
            userId: user.id
          }
        }
      });

      if (existingMember) {
        return res.status(400).json({ error: 'Already a member of this hub' });
      }

      // Check if user is the owner
      if (hub.ownerId === user.id) {
        return res.status(400).json({ error: 'You are already the owner of this hub' });
      }

      // Add user to hub
      await prisma.hubMember.create({
        data: {
          hubId: hub.id,
          userId: user.id
        }
      });

      // Return updated hub with new member
      const updatedHub = await prisma.hub.findUnique({
        where: { id: hub.id },
        include: {
          owner: {
            select: { id: true, email: true }
          },
          members: {
            include: {
              user: {
                select: { id: true, email: true }
              }
            }
          }
        }
      });

      return res.status(200).json(updatedHub);
    } catch (error) {
      console.error('Error joining hub:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
