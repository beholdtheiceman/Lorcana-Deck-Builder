import { z } from "zod";
import { prisma } from "../_lib/db.js";
import { withAuth } from "../_lib/withAuth.js";
import { readJson } from "../_lib/http.js";
import { postDiscord } from "../_lib/discord.js";

const CreateSchema = z.object({
  hubId: z.string().min(1),
  title: z.string().min(1).max(160),
  startsAt: z.string().datetime(),          // ISO-8601
  location: z.string().max(200).nullish(),
  kind: z.string().max(40).nullish(),
  notes: z.string().max(4000).nullish(),
});

// GET  /api/events?hubId=  -> list a hub's events (soonest first), hub-member only
// POST /api/events         -> create an event (fires a Discord notification if configured)
export default withAuth(async (req, res, session) => {
  const userId = session.uid;

  if (req.method === "GET") {
    const hubId = req.query.hubId;
    if (!hubId) return res.status(400).json({ error: "hubId is required" });
    await assertHubMember(hubId, userId, res);
    if (res.writableEnded) return;

    const events = await prisma.event.findMany({
      where: { hubId },
      orderBy: { startsAt: "asc" },
    });
    return res.status(200).json(events);
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body ?? (await readJson(req));
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const data = parsed.data;

  // Membership check also loads the webhook URL for the notification.
  const hub = await prisma.hub.findFirst({
    where: { id: data.hubId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true, name: true, discordWebhookUrl: true },
  });
  if (!hub) return res.status(403).json({ error: "Forbidden" });

  const event = await prisma.event.create({
    data: {
      hubId: data.hubId,
      createdById: userId,
      title: data.title.trim(),
      startsAt: new Date(data.startsAt),
      location: data.location?.trim() || null,
      kind: data.kind?.trim() || null,
      notes: data.notes?.trim() || null,
    },
  });

  // Fire-and-forget Discord notification (never blocks/breaks the response).
  const when = event.startsAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const lines = [
    `📅 **New event in ${hub.name}: ${event.title}**`,
    `🕒 ${when}`,
    event.location ? `📍 ${event.location}` : null,
    event.kind ? `🏷️ ${event.kind}` : null,
  ].filter(Boolean);
  await postDiscord(hub.discordWebhookUrl, lines.join("\n"));

  return res.status(201).json(event);
});

/** Writes a 403 response if the user is not owner/member of the hub. */
async function assertHubMember(hubId, userId, res) {
  const hub = await prisma.hub.findFirst({
    where: { id: hubId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true },
  });
  if (!hub) res.status(403).json({ error: "Forbidden" });
}
