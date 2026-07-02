import { prisma } from "../_lib/db.js";
import { readJson } from "../_lib/http.js";
import { withAuth } from "../_lib/withAuth.js";

export default withAuth(async (req, res, sess) => {
  if (req.method === "GET") {
    const decks = await prisma.deck.findMany({
      where: { userId: sess.uid },
      orderBy: { updatedAt: "desc" },
      take: 500, // cap payload; a user is not expected to exceed this
    });
    return res.json({ decks });
  }

  if (req.method === "POST") {
    const { id, title, data } = await readJson(req);

    if (id) {
      // updateMany scopes by userId so a user can only modify their own deck.
      const result = await prisma.deck.updateMany({
        where: { id, userId: sess.uid },
        data: { title, data },
      });
      if (result.count === 0) {
        return res.status(404).json({ error: "Deck not found" });
      }
      const deck = await prisma.deck.findUnique({ where: { id } });
      return res.json({ deck });
    }

    const created = await prisma.deck.create({
      data: { userId: sess.uid, title: title ?? "Untitled Deck", data: data ?? {} },
    });
    return res.json({ deck: created });
  }

  return res.status(405).end();
});
