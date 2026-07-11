import { prisma } from "../_lib/db.js";
import { readJson } from "../_lib/http.js";
import { withAuth } from "../_lib/withAuth.js";
import { z } from "zod";

// `data` is an intentionally opaque deck blob — validate only its presence/type,
// not its internal card shape. Size is bounded separately after parsing.
const DeckSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1).max(200),
  data: z.any(),
});

const MAX_DECK_BYTES = 512 * 1024; // 512 KB serialized deck blob

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
    const body = await readJson(req);
    const parsed = DeckSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const { id, title, data } = parsed.data;

    if (JSON.stringify(data ?? {}).length > MAX_DECK_BYTES) {
      return res.status(413).json({ error: "Deck too large" });
    }

    if (id) {
      // Snapshot the CURRENT state into an immutable DeckVersion before
      // overwriting, so each save appends to the deck's history. Scoped by
      // userId; done in one transaction so a snapshot never lands without the
      // update (or vice versa).
      const existing = await prisma.deck.findFirst({
        where: { id, userId: sess.uid },
        select: { id: true, title: true, data: true },
      });
      if (!existing) {
        return res.status(404).json({ error: "Deck not found" });
      }

      const [, deck] = await prisma.$transaction([
        prisma.deckVersion.create({
          data: { deckId: existing.id, title: existing.title, data: existing.data ?? {} },
        }),
        prisma.deck.update({
          where: { id: existing.id },
          data: { title, data },
        }),
      ]);
      return res.json({ deck });
    }

    const created = await prisma.deck.create({
      data: { userId: sess.uid, title: title ?? "Untitled Deck", data: data ?? {} },
    });
    return res.json({ deck: created });
  }

  return res.status(405).end();
});
