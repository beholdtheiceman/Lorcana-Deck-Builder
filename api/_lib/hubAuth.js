import { prisma } from "./db.js";

/**
 * Team Hub access control. The model is flat: the only check is membership.
 * Anyone who owns a hub or is a HubMember is an equal contributor — there is
 * no role hierarchy. (Owner-only actions like removing members / deleting the
 * hub stay gated at their own call sites with an explicit `hub.ownerId` check.)
 *
 * These consolidate the per-endpoint "is this user in this hub?" lookups that
 * were previously copy-pasted across the playtest/event/report handlers.
 */

/**
 * Pure lookup: returns the hub `{ id, ownerId }` when `userId` owns it or is a
 * member, otherwise `null`. Does not touch the response.
 */
export async function getHubMembership(hubId, userId) {
  if (!hubId || !userId) return null;
  return prisma.hub.findFirst({
    where: { id: hubId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true, ownerId: true },
  });
}

/**
 * Membership gate for serverless handlers. Returns the hub `{ id, ownerId }`
 * when the user may access it; otherwise writes a 403 and returns `null`.
 *
 * Usage inside a withAuth handler:
 *   const hub = await requireHubMember(hubId, session.uid, res);
 *   if (!hub) return; // 403 already sent
 */
export async function requireHubMember(hubId, userId, res) {
  const hub = await getHubMembership(hubId, userId);
  if (!hub) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return hub;
}
