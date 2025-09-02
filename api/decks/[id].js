import { prisma } from "../../_lib/db.js";
import { getSession } from "../../_lib/auth.js";

export default async function handler(req, res) {
  try {
    // Add a test endpoint to check if the function is working
    if (req.method === "GET") {
      return res.json({ 
        message: "DELETE endpoint is working", 
        timestamp: new Date().toISOString(),
        hasId: !!req.query.id,
        environment: process.env.NODE_ENV,
        hasJwtSecret: !!process.env.JWT_SECRET,
        hasDatabaseUrl: !!process.env.DATABASE_URL
      });
    }

    console.log('[DELETE /api/decks/[id]] Function started for method:', req.method);
    console.log('[DELETE /api/decks/[id]] Query params:', req.query);
    console.log('[DELETE /api/decks/[id]] Environment check:', {
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      nodeEnv: process.env.NODE_ENV
    });
    
    if (!process.env.JWT_SECRET) {
      console.error('[DELETE /api/decks/[id]] CRITICAL: JWT_SECRET environment variable is missing');
      return res.status(500).json({ error: "Server configuration error - JWT_SECRET missing" });
    }
    
    if (!process.env.DATABASE_URL) {
      console.error('[DELETE /api/decks/[id]] CRITICAL: DATABASE_URL environment variable is missing');
      return res.status(500).json({ error: "Server configuration error - DATABASE_URL missing" });
    }
    
    console.log('[DELETE /api/decks/[id]] Attempting to get session...');
    const sess = getSession(req);
    console.log('[DELETE /api/decks/[id]] Session retrieved:', !!sess);
    
    if (!sess) return res.status(401).json({ error: "Unauthorized" });
    
    if (req.method !== "DELETE") return res.status(405).end();

  const { id } = req.query;
  
  try {
    console.log('[DELETE /api/decks/[id]] DEBUG: Attempting to delete deck:', id, 'for user:', sess.uid);
    console.log('[DELETE /api/decks/[id]] DEBUG: Prisma client available:', !!prisma);
    console.log('[DELETE /api/decks/[id]] DEBUG: Environment check - DATABASE_URL exists:', !!process.env.DATABASE_URL);
    
    // Test database connection first
    console.log('[DELETE /api/decks/[id]] DEBUG: Testing database connection...');
    await prisma.$connect();
    console.log('[DELETE /api/decks/[id]] DEBUG: Database connected successfully');
    
    // First check if the deck exists and belongs to the user
    console.log('[DELETE /api/decks/[id]] DEBUG: Looking for deck with query:', { id, userId: sess.uid });
    const existingDeck = await prisma.deck.findFirst({
      where: { id, userId: sess.uid }
    });
    
    if (!existingDeck) {
      console.log('[DELETE /api/decks/[id]] Deck not found or user unauthorized:', { id, userId: sess.uid });
      
      // Additional debugging - check if deck exists with different user
      const deckWithDifferentUser = await prisma.deck.findFirst({
        where: { id }
      });
      if (deckWithDifferentUser) {
        console.log('[DELETE /api/decks/[id]] DEBUG: Deck exists but belongs to different user:', deckWithDifferentUser.userId);
      } else {
        console.log('[DELETE /api/decks/[id]] DEBUG: Deck does not exist in database at all');
      }
      
      return res.status(404).json({ error: "Deck not found or unauthorized" });
    }
    
    console.log('[DELETE /api/decks/[id]] Found deck to delete:', existingDeck.title);
    console.log('[DELETE /api/decks/[id]] DEBUG: Performing delete operation...');
    
    await prisma.deck.delete({ 
      where: { id, userId: sess.uid } 
    });
    
    console.log('[DELETE /api/decks/[id]] Successfully deleted deck:', id);
    res.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/decks/[id]] Error deleting deck:', error);
    console.error('[DELETE /api/decks/[id]] Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack?.substring(0, 500)
    });
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "Deck not found" });
    }
    res.status(500).json({ error: "Failed to delete deck", details: error.message });
  }
  } catch (outerError) {
    console.error('[DELETE /api/decks/[id]] CRITICAL: Function failed to start:', outerError);
    console.error('[DELETE /api/decks/[id]] CRITICAL: Error details:', {
      message: outerError.message,
      stack: outerError.stack?.substring(0, 500)
    });
    return res.status(500).json({ 
      error: "Function initialization failed", 
      details: outerError.message 
    });
  }
}
