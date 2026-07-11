import { z } from "zod";
import { prisma } from "../_lib/db.js";
import { withAuth } from "../_lib/withAuth.js";
import { readJson } from "../_lib/http.js";
import { requireHubMember } from "../_lib/hubAuth.js";
import { serialize } from "../hubs/[id]/pods.js";

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const withMembers = { members: { include: { member: { select: { id: true, email: true } } } } };

// PATCH  /api/pods/:id -> rename a pod (any hub member; flat model)
// DELETE /api/pods/:id -> delete a pod (creator or hub owner)
export default withAuth(async (req, res, session) => {
  const userId = session.uid;
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Pod id is required" });

  const pod = await prisma.pod.findUnique({ where: { id }, select: { hubId: true, createdById: true } });
  if (!pod) return res.status(404).json({ error: "Pod not found" });

  const hub = await requireHubMember(pod.hubId, userId, res);
  if (!hub) return;

  if (req.method === "PATCH") {
    const body = req.body ?? (await readJson(req));
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
    const updated = await prisma.pod.update({
      where: { id },
      data: { name: parsed.data.name.trim() },
      include: withMembers,
    });
    return res.status(200).json(serialize(updated));
  }

  if (req.method === "DELETE") {
    // Mirror Practice: only the pod's creator or the hub owner may delete it
    // (previously any hub member could delete any pod).
    if (pod.createdById !== userId && hub.ownerId !== userId) {
      return res.status(403).json({ error: "Only the creator or hub owner can delete this pod" });
    }
    await prisma.pod.delete({ where: { id } });
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
});
