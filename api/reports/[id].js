import { z } from "zod";
import { prisma } from "../_lib/db.js";
import { withAuth } from "../_lib/withAuth.js";
import { readJson } from "../_lib/http.js";
import { requireHubMember } from "../_lib/hubAuth.js";

const tagList = z.array(z.string().trim().min(1).max(40)).max(20);
// Partial update: only the provided fields change.
const PatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().min(1).max(50000).optional(),
  tags: tagList.optional(),
});

// GET    /api/reports/:id -> read one report (any hub member)
// PATCH  /api/reports/:id -> edit a report (any hub member; flat model)
// DELETE /api/reports/:id -> delete a report (author or hub owner)
export default withAuth(async (req, res, session) => {
  const userId = session.uid;
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Report id is required" });

  const report = await prisma.metaReport.findUnique({
    where: { id },
    include: { author: { select: { id: true, email: true } } },
  });
  if (!report) return res.status(404).json({ error: "Report not found" });

  const hub = await requireHubMember(report.hubId, userId, res);
  if (!hub) return;

  if (req.method === "GET") {
    return res.status(200).json(serialize(report));
  }

  if (req.method === "PATCH") {
    const body = req.body ?? (await readJson(req));
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
    const p = parsed.data;

    const data = {};
    if (p.title !== undefined) data.title = p.title.trim();
    if (p.body !== undefined) data.body = p.body;
    if (p.tags !== undefined) data.tags = p.tags;

    const updated = await prisma.metaReport.update({
      where: { id },
      data,
      include: { author: { select: { id: true, email: true } } },
    });
    return res.status(200).json(serialize(updated));
  }

  if (req.method === "DELETE") {
    if (report.authorId !== userId && hub.ownerId !== userId) {
      return res.status(403).json({ error: "Only the author or hub owner can delete this report" });
    }
    await prisma.metaReport.delete({ where: { id } });
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
});

function serialize(r) {
  return {
    id: r.id,
    hubId: r.hubId,
    title: r.title,
    body: r.body,
    tags: r.tags ?? [],
    authorId: r.authorId,
    authorEmail: r.author?.email ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}
