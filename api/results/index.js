import { z } from "zod";
import { prisma } from "../_lib/db.js";
import { withAuth } from "../_lib/withAuth.js";
import { readJson } from "../_lib/http.js";

/**
 * Tournament result sync (M5).
 *
 * GET  /api/results?hubId=  -> list a hub's results (newest event first)
 * POST /api/results         -> import a normalized batch of results
 *
 * Live PlayHub / Melee fetching is an external-credentialed concern; this
 * endpoint accepts the *normalized* shape those sources (or the image-standings
 * importer) map into, and dedupes per hub by (source, externalId).
 */

const ResultSchema = z.object({
  source: z.enum(["playhub", "melee", "manual", "image"]).default("manual"),
  externalId: z.string().max(120).nullish(),
  eventName: z.string().min(1).max(200),
  eventDate: z.string().datetime().nullish(),
  playerName: z.string().max(120).nullish(),
  deckArchetype: z.string().max(120).nullish(),
  placement: z.number().int().min(1).nullish(),
  record: z.string().max(40).nullish(),
});

const ImportSchema = z.object({
  hubId: z.string().min(1),
  results: z.array(ResultSchema).min(1).max(500),
});

export default withAuth(async (req, res, session) => {
  const userId = session.uid;

  if (req.method === "GET") {
    const hubId = req.query.hubId;
    if (!hubId) return res.status(400).json({ error: "hubId is required" });
    await assertHubMember(hubId, userId, res);
    if (res.writableEnded) return;

    const results = await prisma.tournamentResult.findMany({
      where: { hubId },
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
      take: 500,
    });
    return res.status(200).json(results);
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body ?? (await readJson(req));
  const parsed = ImportSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const { hubId, results } = parsed.data;

  await assertHubMember(hubId, userId, res);
  if (res.writableEnded) return;

  let imported = 0;
  let skipped = 0;
  for (const r of results) {
    const data = {
      hubId,
      addedById: userId,
      source: r.source,
      externalId: r.externalId ?? null,
      eventName: r.eventName.trim(),
      eventDate: r.eventDate ? new Date(r.eventDate) : null,
      playerName: r.playerName?.trim() || null,
      deckArchetype: r.deckArchetype?.trim() || null,
      placement: r.placement ?? null,
      record: r.record?.trim() || null,
    };

    // Dedupe rows that carry an externalId; otherwise just insert.
    if (data.externalId) {
      await prisma.tournamentResult.upsert({
        where: { hubId_source_externalId: { hubId, source: data.source, externalId: data.externalId } },
        update: data,
        create: data,
      });
      imported++;
    } else {
      await prisma.tournamentResult.create({ data });
      imported++;
    }
  }

  return res.status(201).json({ imported, skipped });
});

/** Writes a 403 response if the user is not owner/member of the hub. */
async function assertHubMember(hubId, userId, res) {
  const hub = await prisma.hub.findFirst({
    where: { id: hubId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true },
  });
  if (!hub) res.status(403).json({ error: "Forbidden" });
}
