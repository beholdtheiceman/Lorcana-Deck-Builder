import { z } from "zod";
import { prisma } from "../../_lib/db.js";
import { withAuth } from "../../_lib/withAuth.js";
import { readJson } from "../../_lib/http.js";
import { requireHubMember } from "../../_lib/hubAuth.js";

const tagList = z.array(z.string().trim().min(1).max(40)).max(20);
const CreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().min(1).max(50000),
  tags: tagList.optional(),
});

// GET  /api/hubs/:id/reports        -> list a hub's meta reports (newest first)
//      ?tag=meta                    -> filter to reports carrying that tag
// POST /api/hubs/:id/reports        -> post a meta report (any member)
export default withAuth(async (req, res, session) => {
  const userId = session.uid;
  const { id: hubId } = req.query;
  if (!hubId) return res.status(400).json({ error: "Hub id is required" });

  if (!(await requireHubMember(hubId, userId, res))) return;

  if (req.method === "GET") {
    const tag = typeof req.query.tag === "string" ? req.query.tag.trim() : "";
    const reports = await prisma.metaReport.findMany({
      where: { hubId, ...(tag ? { tags: { has: tag } } : {}) },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { id: true, email: true } } },
    });
    return res.status(200).json(reports.map(serialize));
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body ?? (await readJson(req));
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const data = parsed.data;

  const report = await prisma.metaReport.create({
    data: {
      hubId,
      authorId: userId,
      title: data.title.trim(),
      body: data.body,
      tags: data.tags ?? [],
    },
    include: { author: { select: { id: true, email: true } } },
  });

  return res.status(201).json(serialize(report));
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
