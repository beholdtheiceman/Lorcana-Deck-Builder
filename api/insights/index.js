import { prisma } from "../_lib/db.js";
import { withAuth } from "../_lib/withAuth.js";
import { z } from "zod";

const querySchema = z.object({
  hubId: z.string().min(1, "hubId is required"),
  player: z.string().min(1).optional(),
});

/**
 * GET /api/insights?hubId=&player=
 *
 * Aggregates Review.leakTags for a hub into frequency counts, overall and
 * per matchup (vsArchetype). Optionally filtered to a single player.
 *
 * Returns:
 *   {
 *     leaks: [{ tag, count }],                                   // overall, desc by count
 *     byMatchup: [{ vsArchetype, leaks: [{ tag, count }] }]      // per-matchup, desc
 *   }
 */
export default withAuth(async (req, res, session) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const { hubId, player } = parsed.data;

  const userId = session.uid;

  // Membership check: requester must be owner or member of the hub.
  const hub = await prisma.hub.findFirst({
    where: { id: hubId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true },
  });
  if (!hub) return res.status(403).json({ error: "Forbidden" });

  const reviews = await prisma.review.findMany({
    where: {
      hubId,
      ...(player ? { player } : {}),
    },
    select: { vsArchetype: true, leakTags: true },
  });

  // Overall tag frequency.
  const overall = new Map();
  // Per-matchup tag frequency: vsArchetype -> Map(tag -> count).
  const matchups = new Map();

  for (const review of reviews) {
    const tags = Array.isArray(review.leakTags) ? review.leakTags : [];
    if (tags.length === 0) continue;

    const matchupKey = review.vsArchetype && review.vsArchetype.trim() ? review.vsArchetype : "Unknown";
    if (!matchups.has(matchupKey)) matchups.set(matchupKey, new Map());
    const matchupCounts = matchups.get(matchupKey);

    for (const rawTag of tags) {
      if (rawTag == null) continue;
      const tag = String(rawTag).trim();
      if (!tag) continue;
      overall.set(tag, (overall.get(tag) || 0) + 1);
      matchupCounts.set(tag, (matchupCounts.get(tag) || 0) + 1);
    }
  }

  const toSortedList = (map) =>
    [...map.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  const leaks = toSortedList(overall);

  const byMatchup = [...matchups.entries()]
    .map(([vsArchetype, counts]) => ({ vsArchetype, leaks: toSortedList(counts) }))
    .sort((a, b) => {
      const aTotal = a.leaks.reduce((t, l) => t + l.count, 0);
      const bTotal = b.leaks.reduce((t, l) => t + l.count, 0);
      return bTotal - aTotal || a.vsArchetype.localeCompare(b.vsArchetype);
    });

  return res.status(200).json({ leaks, byMatchup });
});
