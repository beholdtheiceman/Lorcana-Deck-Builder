import { prisma } from "../../_lib/db.js";
import { getSession } from "../../_lib/auth.js";

export default async function handler(req, res) {
  const sess = getSession(req);
  if (!sess) return res.status(401).json({ error: "Unauthorized" });
  
  if (req.method !== "DELETE") return res.status(405).end();

  const { id } = req.query;
  
  try {
    await prisma.deck.delete({ 
      where: { id, userId: sess.uid } 
    });
    res.json({ ok: true });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "Deck not found" });
    }
    res.status(500).json({ error: "Failed to delete deck" });
  }
}
