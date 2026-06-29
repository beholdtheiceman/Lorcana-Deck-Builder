import { z } from "zod";
import { prisma } from "../../_lib/db.js";
import { withAuth } from "../../_lib/withAuth.js";
import { readJson } from "../../_lib/http.js";
import { requireHubMember } from "../../_lib/hubAuth.js";

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  startsAt: z.string().datetime().nullish(),   // ISO-8601 or null
  focus: z.string().max(4000).nullish(),
});

// GET  /api/hubs/:id/practices -> list a hub's practices (soonest first) + RSVPs
// POST /api/hubs/:id/practices -> post a practice session (any member)
export default withAuth(async (req, res, session) => {
  const userId = session.uid;
  const { id: hubId } = req.query;
  if (!hubId) return res.status(400).json({ error: "Hub id is required" });

  if (!(await requireHubMember(hubId, userId, res))) return;

  if (req.method === "GET") {
    const practices = await prisma.practice.findMany({
      where: { hubId },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
      include: { rsvps: { include: { member: { select: { id: true, email: true } } } } },
    });
    return res.status(200).json(practices.map(serialize));
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body ?? (await readJson(req));
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const data = parsed.data;

  const practice = await prisma.practice.create({
    data: {
      hubId,
      createdById: userId,
      title: data.title.trim(),
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      focus: data.focus?.trim() || null,
    },
    include: { rsvps: { include: { member: { select: { id: true, email: true } } } } },
  });

  return res.status(201).json(serialize(practice));
});

export function serialize(p) {
  return {
    id: p.id,
    hubId: p.hubId,
    title: p.title,
    startsAt: p.startsAt,
    focus: p.focus,
    createdById: p.createdById,
    createdAt: p.createdAt,
    rsvps: (p.rsvps ?? []).map((r) => ({
      memberId: r.memberId,
      email: r.member?.email ?? null,
      status: r.status,
    })),
  };
}
