import { getSession } from "./auth.js";

/**
 * Wraps a serverless handler so that a valid session is required (401 otherwise),
 * the session is passed as the third arg, and thrown errors are logged
 * server-side and returned as a generic message (never leaking error.message,
 * stack traces, or env-var presence to the client).
 *
 * Usage: export default withAuth(async (req, res, session) => { ... })
 */
export function withAuth(handler) {
  return async function wrapped(req, res) {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    try {
      return await handler(req, res, session);
    } catch (err) {
      console.error(`[api] ${req.method} ${req.url ?? ""} failed:`, err);
      if (err?.code === "P2025") return res.status(404).json({ error: "Not found" });
      if (err?.name === "ZodError") return res.status(400).json({ error: "Invalid input" });
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}
