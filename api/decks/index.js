import { prisma } from "../_lib/db.js";
import { getSession } from "../_lib/auth.js";
import { readJson } from "../_lib/http.js";

export default async function handler(req, res) {
  const sess = getSession(req);
  if (!sess) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "GET") {
    const decks = await prisma.deck.findMany({
      where: { userId: sess.uid }, 
      orderBy: { updatedAt: "desc" }
    });
    return res.json({ decks });
  }

  if (req.method === "POST") {
    const { id, title, data } = await readJson(req);
    
    if (id) {
      // Update existing deck
      const updated = await prisma.deck.update({ 
        where: { id, userId: sess.uid }, 
        data: { title, data } 
      });
      return res.json({ deck: updated });
    }
    
    // Create new deck
    const created = await prisma.deck.create({
      data: { 
        userId: sess.uid, 
        title: title ?? "Untitled Deck", 
        data: data ?? {} 
      }
    });
    return res.json({ deck: created });
  }

  res.status(405).end();
}
