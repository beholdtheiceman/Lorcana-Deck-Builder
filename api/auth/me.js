import { getSession } from "../_lib/auth.js";

export default async function handler(req, res) {
  try {
    console.log('[AUTH/ME] Handler called');
    console.log('[AUTH/ME] JWT_SECRET exists:', !!process.env.JWT_SECRET);
    console.log('[AUTH/ME] Cookie header:', req.headers.cookie ? 'Present' : 'Missing');
    
    const sess = getSession(req);
    console.log('[AUTH/ME] Session result:', sess ? { uid: sess.uid, email: sess.email } : 'null');
    
    res.json({ 
      user: sess ? { id: sess.uid, email: sess.email } : null,
      debug: {
        hasJwtSecret: !!process.env.JWT_SECRET,
        hasCookie: !!req.headers.cookie,
        cookieValue: req.headers.cookie ? req.headers.cookie.substring(0, 50) + '...' : null
      }
    });
  } catch (error) {
    console.error('[AUTH/ME] Error:', error.message);
    console.error('[AUTH/ME] Stack:', error.stack);
    res.status(500).json({ 
      error: error.message,
      hasJwtSecret: !!process.env.JWT_SECRET
    });
  }
}
