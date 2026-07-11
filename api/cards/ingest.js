import { ingestCards } from "../_lib/cardIngest.js";

// Accept an explicit DIGEST_SECRET or Vercel's auto-injected CRON_SECRET,
// mirroring api/hubs/digest.js.
const INGEST_SECRET = process.env.DIGEST_SECRET || process.env.CRON_SECRET;

export default async function handler(req, res) {
  // Vercel cron injects `Authorization: Bearer <CRON_SECRET>` on GET; a manual
  // POST with the same token works for ad-hoc runs.
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  // Fail closed: if no secret is configured, reject rather than run publicly.
  if (!INGEST_SECRET || token !== INGEST_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const summary = await ingestCards();
    return res.status(200).json(summary);
  } catch (err) {
    console.error("[cards/ingest] failed:", err?.message ?? err);
    return res.status(500).json({ error: "Ingest failed" });
  }
}
