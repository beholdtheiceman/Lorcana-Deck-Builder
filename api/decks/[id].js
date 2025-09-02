import { prisma } from "../../_lib/db.js";
import { getSession } from "../../_lib/auth.js";

export default async function handler(req, res) {
  const sess = getSession(req);
  if (!sess) return res.status(401).json({ error: "Unauthorized" });
  
  if (req.method !== "DELETE") return res.status(405).end();

  const { id } = req.query;
  
  try {
    console.log('[DELETE /api/decks/[id]] DEBUG: Attempting to delete deck:', id, 'for user:', sess.uid);
    
    // First check if the deck exists and belongs to the user
    const existingDeck = await prisma.deck.findFirst({
      where: { id, userId: sess.uid }
    });
    
    if (!existingDeck) {
      console.log('[DELETE /api/decks/[id]] Deck not found or user unauthorized:', { id, userId: sess.uid });
      return res.status(404).json({ error: "Deck not found or unauthorized" });
    }
    
    console.log('[DELETE /api/decks/[id]] Found deck to delete:', existingDeck.title);
    
    await prisma.deck.delete({ 
      where: { id, userId: sess.uid } 
    });
    
    console.log('[DELETE /api/decks/[id]] Successfully deleted deck:', id);
    res.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/decks/[id]] Error deleting deck:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "Deck not found" });
    }
    res.status(500).json({ error: "Failed to delete deck", details: error.message });
  }
}
