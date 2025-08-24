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

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const user = { id: session.uid, email: session.email };

    const body = await request.json();
    const { name } = createHubSchema.parse(body);

    // Generate unique invite code
    let inviteCode;
    let attempts = 0;
    do {
      inviteCode = generateInviteCode();
      attempts++;
      if (attempts > 10) {
        return new Response(JSON.stringify({ error: 'Failed to generate unique invite code' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
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

    return new Response(JSON.stringify(hub), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating hub:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function GET(request) {
  try {
    const session = getSession(request);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
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

    return new Response(JSON.stringify(hubs), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching hubs:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
