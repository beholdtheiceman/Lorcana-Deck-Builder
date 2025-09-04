import { prisma } from '../../../_lib/db.js';
import { getSession } from '../../../_lib/auth.js';

export default async function handler(req, res) {
  const { id: hubId } = req.query;
  
  if (!hubId) {
    return res.status(400).json({ error: 'Hub ID is required' });
  }

  try {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const user = { id: session.uid, email: session.email };

    // Get hub with members to verify permissions
    const hub = await prisma.hub.findFirst({
      where: {
        id: hubId,
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

    if (!hub) {
      return res.status(404).json({ error: 'Hub not found or access denied' });
    }

    const isOwner = hub.ownerId === user.id;

    if (req.method === 'DELETE') {
      // Remove member from hub (owner only)
      const { memberId } = req.body;
      
      if (!isOwner) {
        return res.status(403).json({ error: 'Only hub owners can remove members' });
      }

      if (!memberId) {
        return res.status(400).json({ error: 'Member ID is required' });
      }

      // Check if member exists in this hub
      const member = await prisma.hubMember.findFirst({
        where: {
          hubId: hubId,
          userId: memberId
        }
      });

      if (!member) {
        return res.status(404).json({ error: 'Member not found in this hub' });
      }

      // Remove the member
      await prisma.hubMember.delete({
        where: { id: member.id }
      });

      return res.status(200).json({ message: 'Member removed successfully' });

    } else if (req.method === 'POST') {
      // Leave hub (any member)
      const { action } = req.body;

      if (action === 'leave') {
        // Check if user is a member (not owner)
        if (isOwner) {
          return res.status(400).json({ error: 'Owners cannot leave their own hub. Transfer ownership first or delete the hub.' });
        }

        const membership = await prisma.hubMember.findFirst({
          where: {
            hubId: hubId,
            userId: user.id
          }
        });

        if (!membership) {
          return res.status(404).json({ error: 'You are not a member of this hub' });
        }

        // Remove the membership
        await prisma.hubMember.delete({
          where: { id: membership.id }
        });

        return res.status(200).json({ message: 'Left hub successfully' });

      } else if (action === 'transfer_ownership') {
        // Transfer ownership (owner only)
        const { newOwnerId } = req.body;

        if (!isOwner) {
          return res.status(403).json({ error: 'Only current owners can transfer ownership' });
        }

        if (!newOwnerId) {
          return res.status(400).json({ error: 'New owner ID is required' });
        }

        // Check if new owner is a member of this hub
        const newOwnerMembership = await prisma.hubMember.findFirst({
          where: {
            hubId: hubId,
            userId: newOwnerId
          }
        });

        if (!newOwnerMembership) {
          return res.status(400).json({ error: 'New owner must be a member of this hub' });
        }

        // Transfer ownership
        await prisma.$transaction(async (tx) => {
          // Update hub owner
          await tx.hub.update({
            where: { id: hubId },
            data: { ownerId: newOwnerId }
          });

          // Remove the new owner from members list (since they're now the owner)
          await tx.hubMember.delete({
            where: { id: newOwnerMembership.id }
          });

          // Add the old owner as a member
          await tx.hubMember.create({
            data: {
              hubId: hubId,
              userId: user.id
            }
          });
        });

        return res.status(200).json({ message: 'Ownership transferred successfully' });

      } else {
        return res.status(400).json({ error: 'Invalid action' });
      }

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Error managing hub members:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}