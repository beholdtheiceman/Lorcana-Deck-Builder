import { prisma } from '../../_lib/db.js';
import { getSession } from '../../_lib/auth.js';
import { z } from 'zod';

const commentSchema = z.object({
  content: z.string().min(1).max(1000)
});

export default async function handler(req, res) {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id: deckId } = req.query;

  if (req.method === 'GET') {
    try {
      const comments = await prisma.comment.findMany({
        where: { deckId },
        include: {
          user: {
            select: { id: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return res.status(200).json(comments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    try {
      const { content } = commentSchema.parse(req.body);

      const comment = await prisma.comment.create({
        data: {
          content,
          deckId,
          userId: session.uid
        },
        include: {
          user: {
            select: { id: true, email: true }
          }
        }
      });

      return res.status(201).json(comment);
    } catch (error) {
      console.error('Error creating comment:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid comment data' });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
