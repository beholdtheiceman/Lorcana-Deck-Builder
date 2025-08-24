import { prisma } from '../../_lib/db.js';
import { getSession } from '../../_lib/auth.js';

export async function GET(request, { params }) {
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
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
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

    return new Response(JSON.stringify(decks), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching hub decks:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
