import { z } from "zod";
import { prisma } from "../../_lib/db.js";
import { withAuth } from "../../_lib/withAuth.js";
import { readJson } from "../../_lib/http.js";
import { requireHubMember } from "../../_lib/hubAuth.js";

const AttendanceSchema = z.object({
  going: z.boolean(),
  bringing: z.string().trim().max(200).nullish(),
});

// PUT /api/events/:id/attendance -> set the caller's attendance (upsert).
export default withAuth(async (req, res, session) => {
  const userId = session.uid;
  const { id: eventId } = req.query;
  if (!eventId) return res.status(400).json({ error: "Event id is required" });

  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { hubId: true },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });

  if (!(await requireHubMember(event.hubId, userId, res))) return;

  const body = req.body ?? (await readJson(req));
  const parsed = AttendanceSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const bringing = parsed.data.bringing?.trim() || null;

  const att = await prisma.eventAttendance.upsert({
    where: { eventId_memberId: { eventId, memberId: userId } },
    create: { eventId, memberId: userId, going: parsed.data.going, bringing },
    update: { going: parsed.data.going, bringing },
    include: { member: { select: { id: true, email: true } } },
  });

  return res.status(200).json({
    memberId: att.memberId,
    email: att.member?.email ?? null,
    going: att.going,
    bringing: att.bringing,
  });
});
