import { z } from "zod";
import { prisma } from "../../_lib/db.js";
import { withAuth } from "../../_lib/withAuth.js";
import { readJson } from "../../_lib/http.js";
import { requireHubMember } from "../../_lib/hubAuth.js";

const RsvpSchema = z.object({
  status: z.enum(["yes", "no", "maybe"]),
});

// PUT /api/practices/:id/rsvp -> set the caller's RSVP for a practice (upsert).
export default withAuth(async (req, res, session) => {
  const userId = session.uid;
  const { id: practiceId } = req.query;
  if (!practiceId) return res.status(400).json({ error: "Practice id is required" });

  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const practice = await prisma.practice.findUnique({
    where: { id: practiceId },
    select: { hubId: true },
  });
  if (!practice) return res.status(404).json({ error: "Practice not found" });

  if (!(await requireHubMember(practice.hubId, userId, res))) return;

  const body = req.body ?? (await readJson(req));
  const parsed = RsvpSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const rsvp = await prisma.practiceRsvp.upsert({
    where: { practiceId_memberId: { practiceId, memberId: userId } },
    create: { practiceId, memberId: userId, status: parsed.data.status },
    update: { status: parsed.data.status },
    include: { member: { select: { id: true, email: true } } },
  });

  return res.status(200).json({
    memberId: rsvp.memberId,
    email: rsvp.member?.email ?? null,
    status: rsvp.status,
  });
});
