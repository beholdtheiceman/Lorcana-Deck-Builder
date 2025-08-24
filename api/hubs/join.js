import { prisma } from '../_lib/db.js';
import { getSession } from '../_lib/auth.js';
import { z } from 'zod';

const joinHubSchema = z.object({
  inviteCode: z.string().length(8)
});

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
    const { inviteCode } = joinHubSchema.parse(body);

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
      return new Response(JSON.stringify({ error: 'Invalid invite code' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
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
      return new Response(JSON.stringify({ error: 'Already a member of this hub' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is the owner
    if (hub.ownerId === user.id) {
      return new Response(JSON.stringify({ error: 'You are already the owner of this hub' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
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

    return new Response(JSON.stringify(updatedHub), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error joining hub:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
