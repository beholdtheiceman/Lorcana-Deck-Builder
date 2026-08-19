import { PrismaClient } from "@prisma/client";
import { parseDuelsMeta } from "./metaAdapters/duelsPlatform.js";

const prisma = globalThis.__prisma ?? new PrismaClient();
if (!globalThis.__prisma) globalThis.__prisma = prisma;

const BASE = "https://duels.ink/api/stats/meta";

// Identify ourselves so duels.ink can throttle or block cleanly.
const USER_AGENT = "UninkableDeckBuilder/1.0 (+https://uninkabledeckbuilder.com)";

export const QUEUES = ["core-bo1", "core-bo3"];

export async function fetchDuelsMeta({ queue, period = "all_time", era = "current" }) {
  const url = `${BASE}?queue=${encodeURIComponent(queue)}&period=${period}&era=${era}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!res.ok) throw new Error(`duels.ink returned ${res.status} for ${queue}`);
  return res.json();
}

/** Persist one parsed snapshot. Idempotent on (source, queue, era, periodStart). */
export async function persistSnapshot({ snapshot, archetypes, matchups }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.metaSnapshot.findUnique({
      where: {
        source_queue_era_periodStart: {
          source: snapshot.source,
          queue: snapshot.queue,
          era: snapshot.era,
          periodStart: snapshot.periodStart,
        },
      },
    });

    // Never clobber an approved snapshot with a fresh pending pull.
    if (existing?.status === "approved") return { id: existing.id, skipped: true };

    if (existing) {
      await tx.metaArchetype.deleteMany({ where: { snapshotId: existing.id } });
      await tx.metaMatchup.deleteMany({ where: { snapshotId: existing.id } });
      await tx.metaSnapshot.update({ where: { id: existing.id }, data: { ...snapshot, capturedAt: new Date() } });
    }

    const row = existing ?? (await tx.metaSnapshot.create({ data: snapshot }));
    await tx.metaArchetype.createMany({ data: archetypes.map((a) => ({ ...a, snapshotId: row.id })) });
    await tx.metaMatchup.createMany({ data: matchups.map((m) => ({ ...m, snapshotId: row.id })) });
    return { id: row.id, skipped: false };
  });
}

/** Pull every configured queue. One request per queue. */
export async function syncAllQueues() {
  const results = [];
  for (const queue of QUEUES) {
    try {
      const raw = await fetchDuelsMeta({ queue });
      // Throws DuelsMetaShapeError before any write if the shape drifted.
      const parsed = parseDuelsMeta(raw, { queue });
      const { id, skipped } = await persistSnapshot(parsed);
      results.push({ queue, ok: true, snapshotId: id, skipped });
    } catch (err) {
      // One queue failing must not abort the others or delete anything.
      console.error(`[meta-sync] ${queue} failed:`, err?.message ?? err);
      results.push({ queue, ok: false, error: String(err?.message ?? err) });
    }
  }
  return { syncedAt: new Date().toISOString(), results };
}
