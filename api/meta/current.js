import { PrismaClient } from "@prisma/client";

const prisma = globalThis.__prisma ?? new PrismaClient();
if (!globalThis.__prisma) globalThis.__prisma = prisma;

/** Latest APPROVED snapshot for a queue. Approved-only is the guardrail. */
export async function getCurrentMeta({ queue = "core-bo1" } = {}) {
  const snapshot = await prisma.metaSnapshot.findFirst({
    where: { queue, status: "approved" },
    orderBy: { periodStart: "desc" },
    include: {
      archetypes: { orderBy: { games: "desc" } },
      matchups: { where: { grain: "color-pair" }, orderBy: { games: "desc" }, take: 60 },
    },
  });
  if (!snapshot) return null;

  const ageDays = (Date.now() - snapshot.periodEnd.getTime()) / 86_400_000;
  return {
    source: snapshot.source,
    queue: snapshot.queue,
    era: snapshot.era,
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
    totalGames: snapshot.totalGames,
    uniquePlayers: snapshot.uniquePlayers,
    // The page renders last-known-good with a banner rather than an error.
    stale: ageDays > 10,
    archetypes: snapshot.archetypes,
    matchups: snapshot.matchups,
  };
}

export default async function handler(req, res) {
  try {
    const data = await getCurrentMeta({ queue: req.query.queue || "core-bo1" });
    if (!data) return res.status(200).json({ empty: true });
    return res.status(200).json(data);
  } catch (err) {
    console.error("[meta/current] failed:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to load meta" });
  }
}
