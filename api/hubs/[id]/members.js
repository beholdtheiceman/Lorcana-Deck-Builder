import { prisma } from '../../_lib/db.js';
import { getSession } from '../../_lib/auth.js';
import { z } from 'zod';

const removeMemberSchema = z.object({
  userId: z.string().uuid()
});

const transferOwnershipSchema = z.object({
  newOwnerId: z.string().uuid()
});

export async function DELETE(request, { params }) {
  try {
    const session = getSession(request);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const user = { id: session.uid, email: session.email };

    const { id: hubId } = params;
    const body = await request.json();
    const { userId } = removeMemberSchema.parse(body);

    // Check if user is the hub owner
    const hub = await prisma.hub.findUnique({
      where: { id: hubId }
    });

    if (!hub || hub.ownerId !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if trying to remove the owner
    if (userId === user.id) {
      return new Response(JSON.stringify({ error: 'Cannot remove yourself as owner' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Remove member
    await prisma.hubMember.deleteMany({
      where: {
        hubId,
        userId
      }
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error removing member:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = getSession(request);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const user = { id: session.uid, email: session.email };

    const { id: hubId } = params;
    const body = await request.json();
    const { newOwnerId } = transferOwnershipSchema.parse(body);

    // Check if user is the current hub owner
    const hub = await prisma.hub.findUnique({
      where: { id: hubId }
    });

    if (!hub || hub.ownerId !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
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
      return new Response(JSON.stringify({ error: 'New owner must be a member of the hub' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
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

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error transferring ownership:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
