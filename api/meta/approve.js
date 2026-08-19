import { PrismaClient } from "@prisma/client";

const prisma = globalThis.__prisma ?? new PrismaClient();
if (!globalThis.__prisma) globalThis.__prisma = prisma;

const ADMIN_SECRET = process.env.DIGEST_SECRET || process.env.CRON_SECRET;

// Sanity band: a plausible pull has a real sample and no absurd win rates.
export function passesSanityCheck(snapshot) {
  if (snapshot.totalGames < 1000) return false;
  return snapshot.archetypes
    .filter((a) => a.games >= 500)
    .every((a) => a.winRate >= 30 && a.winRate <= 70);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const token = (req.headers["authorization"] || "").replace(/^Bearer\s+/i, "");
  if (!ADMIN_SECRET || token !== ADMIN_SECRET) return res.status(401).json({ error: "Unauthorized" });

  const { snapshotId, status } = req.body ?? {};
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: 'status must be "approved" or "rejected"' });
  }
  try {
    const snapshot = await prisma.metaSnapshot.findUnique({
      where: { id: snapshotId },
      include: { archetypes: true },
    });
    if (!snapshot) return res.status(404).json({ error: "Snapshot not found" });

    const sane = passesSanityCheck(snapshot);
    await prisma.metaSnapshot.update({ where: { id: snapshotId }, data: { status } });
    return res.status(200).json({ id: snapshotId, status, sanityCheckPassed: sane });
  } catch (err) {
    console.error("[meta/approve] failed:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to update snapshot" });
  }
}
