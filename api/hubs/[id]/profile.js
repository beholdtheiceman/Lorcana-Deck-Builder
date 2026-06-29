import { z } from "zod";
import { prisma } from "../../_lib/db.js";
import { withAuth } from "../../_lib/withAuth.js";
import { readJson } from "../../_lib/http.js";
import { requireHubMember } from "../../_lib/hubAuth.js";

// Each field is optional so callers can patch just the bits they changed.
const archetypeList = z.array(z.string().trim().min(1).max(120)).max(50);
const ProfileSchema = z.object({
  displayName: z.string().trim().max(80).nullish(),
  petDecks: archetypeList.optional(),
  pilots: archetypeList.optional(),
  notes: z.string().max(4000).nullish(),
});

// PATCH /api/hubs/:id/profile -> a member edits their own hub profile.
// Flat model: any member may edit their own profile; nobody else's.
export default withAuth(async (req, res, session) => {
  const userId = session.uid;
  const { id: hubId } = req.query;
  if (!hubId) return res.status(400).json({ error: "Hub id is required" });

  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Membership gate (also rejects the owner, who has no HubMember profile row).
  if (!(await requireHubMember(hubId, userId, res))) return;

  const body = req.body ?? (await readJson(req));
  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const p = parsed.data;

  // The caller edits only their own membership row for this hub.
  const membership = await prisma.hubMember.findUnique({
    where: { hubId_userId: { hubId, userId } },
    select: { id: true },
  });
  if (!membership) {
    // Owners (and anyone without a membership row) have no editable profile.
    return res.status(403).json({ error: "No editable profile in this hub" });
  }

  const data = {};
  if (p.displayName !== undefined) data.displayName = p.displayName?.trim() || null;
  if (p.petDecks !== undefined) data.petDecks = p.petDecks;
  if (p.pilots !== undefined) data.pilots = p.pilots;
  if (p.notes !== undefined) data.notes = p.notes?.trim() || null;

  const updated = await prisma.hubMember.update({
    where: { id: membership.id },
    data,
    select: {
      id: true,
      userId: true,
      displayName: true,
      petDecks: true,
      pilots: true,
      notes: true,
      joinedAt: true,
      user: { select: { id: true, email: true } },
    },
  });

  return res.status(200).json({
    id: updated.id,
    userId: updated.userId,
    email: updated.user?.email ?? null,
    displayName: updated.displayName,
    petDecks: updated.petDecks ?? [],
    pilots: updated.pilots ?? [],
    notes: updated.notes,
    joinedAt: updated.joinedAt,
    isOwner: false,
  });
});
