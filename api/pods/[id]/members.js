import { z } from "zod";
import { prisma } from "../../_lib/db.js";
import { withAuth } from "../../_lib/withAuth.js";
import { readJson } from "../../_lib/http.js";
import { requireHubMember, getHubMembership } from "../../_lib/hubAuth.js";

const BodySchema = z.object({
  memberId: z.string().min(1), // userId to add/remove
});

// POST   /api/pods/:id/members -> add a hub member to the pod
// DELETE /api/pods/:id/members -> remove a member from the pod
// Any hub member may manage pod membership (flat model).
export default withAuth(async (req, res, session) => {
  const userId = session.uid;
  const { id: podId } = req.query;
  if (!podId) return res.status(400).json({ error: "Pod id is required" });

  const pod = await prisma.pod.findUnique({ where: { id: podId }, select: { hubId: true } });
  if (!pod) return res.status(404).json({ error: "Pod not found" });

  if (!(await requireHubMember(pod.hubId, userId, res))) return;

  const body = req.body ?? (await readJson(req));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const { memberId } = parsed.data;

  if (req.method === "POST") {
    // The person being added must belong to the same hub.
    if (!(await getHubMembership(pod.hubId, memberId))) {
      return res.status(400).json({ error: "That user is not in this hub" });
    }
    const created = await prisma.podMember.upsert({
      where: { podId_memberId: { podId, memberId } },
      create: { podId, memberId },
      update: {},
      include: { member: { select: { id: true, email: true } } },
    });
    return res.status(201).json({
      id: created.id,
      memberId: created.memberId,
      email: created.member?.email ?? null,
    });
  }

  if (req.method === "DELETE") {
    await prisma.podMember.deleteMany({ where: { podId, memberId } });
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "POST, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
});
