import { z } from "zod";
import { prisma } from "../_lib/db.js";
import { withAuth } from "../_lib/withAuth.js";
import { readJson } from "../_lib/http.js";
import { requireHubMember } from "../_lib/hubAuth.js";
import { serialize } from "../hubs/[id]/practices.js";

const PatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  startsAt: z.string().datetime().nullish(),
  focus: z.string().max(4000).nullish(),
});

const withRsvps = { rsvps: { include: { member: { select: { id: true, email: true } } } } };

// PATCH  /api/practices/:id -> edit a practice (any hub member; flat model)
// DELETE /api/practices/:id -> delete a practice (creator or hub owner)
export default withAuth(async (req, res, session) => {
  const userId = session.uid;
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Practice id is required" });

  const practice = await prisma.practice.findUnique({ where: { id } });
  if (!practice) return res.status(404).json({ error: "Practice not found" });

  const hub = await requireHubMember(practice.hubId, userId, res);
  if (!hub) return;

  if (req.method === "PATCH") {
    const body = req.body ?? (await readJson(req));
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
    const p = parsed.data;

    const data = {};
    if (p.title !== undefined) data.title = p.title.trim();
    if (p.startsAt !== undefined) data.startsAt = p.startsAt ? new Date(p.startsAt) : null;
    if (p.focus !== undefined) data.focus = p.focus?.trim() || null;

    const updated = await prisma.practice.update({ where: { id }, data, include: withRsvps });
    return res.status(200).json(serialize(updated));
  }

  if (req.method === "DELETE") {
    if (practice.createdById !== userId && hub.ownerId !== userId) {
      return res.status(403).json({ error: "Only the creator or hub owner can delete this practice" });
    }
    await prisma.practice.delete({ where: { id } });
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
});
