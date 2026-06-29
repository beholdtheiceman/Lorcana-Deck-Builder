import { z } from "zod";
import { prisma } from "../../_lib/db.js";
import { withAuth } from "../../_lib/withAuth.js";
import { readJson } from "../../_lib/http.js";
import { requireHubMember } from "../../_lib/hubAuth.js";

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const withMembers = { members: { include: { member: { select: { id: true, email: true } } } } };

// GET  /api/hubs/:id/pods -> list a hub's practice pods + members
// POST /api/hubs/:id/pods -> create a pod (any member)
export default withAuth(async (req, res, session) => {
  const userId = session.uid;
  const { id: hubId } = req.query;
  if (!hubId) return res.status(400).json({ error: "Hub id is required" });

  if (!(await requireHubMember(hubId, userId, res))) return;

  if (req.method === "GET") {
    const pods = await prisma.pod.findMany({
      where: { hubId },
      orderBy: { createdAt: "asc" },
      include: withMembers,
    });
    return res.status(200).json(pods.map(serialize));
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body ?? (await readJson(req));
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const pod = await prisma.pod.create({
    data: { hubId, name: parsed.data.name.trim() },
    include: withMembers,
  });

  return res.status(201).json(serialize(pod));
});

export function serialize(p) {
  return {
    id: p.id,
    hubId: p.hubId,
    name: p.name,
    createdAt: p.createdAt,
    members: (p.members ?? []).map((m) => ({
      id: m.id,
      memberId: m.memberId,
      email: m.member?.email ?? null,
    })),
  };
}
