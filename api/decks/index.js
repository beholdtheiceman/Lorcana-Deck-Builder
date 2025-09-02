import { prisma } from "../_lib/db.js";
import { getSession } from "../_lib/auth.js";
import { readJson } from "../_lib/http.js";

export default async function handler(req, res) {
  // Add debugging for environment variables
  console.log('[DECKS] Handler called - Method:', req.method);
  console.log('[DECKS] Environment check - JWT_SECRET exists:', !!process.env.JWT_SECRET);
  console.log('[DECKS] Environment check - DATABASE_URL exists:', !!process.env.DATABASE_URL);
  console.log('[DECKS] Request headers - Cookie:', req.headers.cookie ? 'Present' : 'Missing');
  
  let sess;
  try {
    sess = getSession(req);
    console.log('[DECKS] Session result:', sess ? { uid: sess.uid, email: sess.email } : 'null');
  } catch (sessionError) {
    console.error('[DECKS] Session retrieval error:', sessionError.message);
    console.error('[DECKS] Session error stack:', sessionError.stack);
    return res.status(401).json({ 
      error: "Authentication failed", 
      details: sessionError.message,
      hasJwtSecret: !!process.env.JWT_SECRET
    });
  }
  
  if (!sess) {
    console.log('[DECKS] No valid session found - returning 401');
    return res.status(401).json({ 
      error: "Unauthorized",
      hasCookie: !!req.headers.cookie,
      hasJwtSecret: !!process.env.JWT_SECRET
    });
  }
  
  console.log('[DECKS] Session validated successfully - proceeding with request');

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
