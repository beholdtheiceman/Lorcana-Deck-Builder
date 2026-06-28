import { prisma } from "../../_lib/db.js";
import { withAuth } from "../../_lib/withAuth.js";
import { canAccessDeck } from "../../_lib/access.js";
import { z } from "zod";

const commentSchema = z.object({ content: z.string().min(1).max(1000) });

export default withAuth(async (req, res, session) => {
  const { id: deckId } = req.query;

  if (!(await canAccessDeck(session.uid, deckId))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const comments = await prisma.comment.findMany({
      where: { deckId },
      include: { user: { select: { id: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json(comments);
  }

  if (req.method === "POST") {
    const { content } = commentSchema.parse(req.body);
    const comment = await prisma.comment.create({
      data: { content, deckId, userId: session.uid },
      include: { user: { select: { id: true, email: true } } },
    });
    return res.status(201).json(comment);
  }

  return res.status(405).json({ error: "Method not allowed" });
});
