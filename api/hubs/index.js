import { prisma } from '../_lib/db.js';
import { getSession } from '../_lib/auth.js';
import { z } from 'zod';

// Validation schemas
const createHubSchema = z.object({
  name: z.string().min(1).max(100)
});

const generateInviteCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const session = getSession(req);
      if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const user = { id: session.uid, email: session.email };

      const { name } = createHubSchema.parse(req.body);

      // Generate unique invite code
      let inviteCode;
      let attempts = 0;
      do {
        inviteCode = generateInviteCode();
        attempts++;
        if (attempts > 10) {
          return res.status(500).json({ error: 'Failed to generate unique invite code' });
        }
      } while (await prisma.hub.findUnique({ where: { inviteCode } }));

      const hub = await prisma.hub.create({
        data: {
          name,
          inviteCode,
          ownerId: user.id
        },
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

      return res.status(201).json(hub);
    } catch (error) {
      console.error('Error creating hub:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'GET') {
    try {
      const session = getSession(req);
      if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const user = { id: session.uid, email: session.email };

      // Get all hubs where user is owner or member
      const hubs = await prisma.hub.findMany({
        where: {
          OR: [
            { ownerId: user.id },
            { members: { some: { userId: user.id } } }
          ]
        },
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

      return res.status(200).json(hubs);
    } catch (error) {
      console.error('Error fetching hubs:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}


