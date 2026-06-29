import { z } from "zod";
import { prisma } from "../_lib/db.js";
import { withAuth } from "../_lib/withAuth.js";
import { readJson } from "../_lib/http.js";
import { requireHubMember } from "../_lib/hubAuth.js";

const CreateSchema = z.object({
  hubId: z.string().min(1),
  deckId: z.string().min(1).nullish(),
  deckArchetype: z.string().min(1).max(120),
  vsArchetype: z.string().min(1).max(120),
  result: z.enum(["W", "L"]),
  onPlay: z.boolean().nullish(),
  format: z.string().max(40).nullish(),
  lesson: z.string().max(4000).nullish(),
});

// GET  /api/playtest?hubId=  -> list a hub's logged games (newest first), hub-member only
// POST /api/playtest         -> log a practice game
export default withAuth(async (req, res, session) => {
  const userId = session.uid;

  if (req.method === "GET") {
    const hubId = req.query.hubId;
    if (!hubId) return res.status(400).json({ error: "hubId is required" });
    if (!(await requireHubMember(hubId, userId, res))) return;

    const games = await prisma.playtestGame.findMany({
      where: { hubId },
      orderBy: { playedAt: "desc" },
      include: { loggedBy: { select: { id: true, email: true } } },
    });
    return res.status(200).json(games);
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body ?? (await readJson(req));
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const data = parsed.data;

  if (!(await requireHubMember(data.hubId, userId, res))) return;

  // If a deck is linked, make sure it exists (the FK is SetNull, so a bad id
  // would otherwise surface as an opaque 500).
  if (data.deckId) {
    const deck = await prisma.deck.findUnique({ where: { id: data.deckId }, select: { id: true } });
    if (!deck) return res.status(400).json({ error: "Linked deck not found" });
  }

  const game = await prisma.playtestGame.create({
    data: {
      hubId: data.hubId,
      loggedById: userId,
      deckId: data.deckId ?? null,
      deckArchetype: data.deckArchetype.trim(),
      vsArchetype: data.vsArchetype.trim(),
      result: data.result,
      onPlay: data.onPlay ?? null,
      format: data.format?.trim() || null,
      lesson: data.lesson?.trim() || null,
    },
  });

  return res.status(201).json(game);
});
