import { prisma } from "../_lib/db.js";
import { withAuth } from "../_lib/withAuth.js";

export default withAuth(async (req, res, sess) => {
  if (req.method !== "DELETE") return res.status(405).end();

  const { id } = req.query;

  // updateMany/deleteMany-style ownership scoping: only deletes if it belongs to the user.
  const result = await prisma.deck.deleteMany({
    where: { id, userId: sess.uid },
  });

  if (result.count === 0) {
    return res.status(404).json({ error: "Deck not found" });
  }
  return res.json({ ok: true });
});
