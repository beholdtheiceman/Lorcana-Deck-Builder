import { z } from "zod";
import { prisma } from "../_lib/db.js";
import { withAuth } from "../_lib/withAuth.js";
import { readJson } from "../_lib/http.js";

const DISCORD_RE = /^https:\/\/(?:[\w-]+\.)?discord(?:app)?\.com\/api\/webhooks\//i;

const Schema = z.object({
  hubId: z.string().min(1),
  // empty string clears the webhook; otherwise must be a Discord webhook URL
  webhookUrl: z.string().refine((v) => v === "" || DISCORD_RE.test(v), {
    message: "Must be a Discord webhook URL",
  }),
});

// POST /api/hubs/webhook { hubId, webhookUrl } -> set/clear the hub's Discord
// webhook. Hub owner only. Pass "" to clear.
export default withAuth(async (req, res, session) => {
  const userId = session.uid;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body ?? (await readJson(req));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const { hubId, webhookUrl } = parsed.data;

  const hub = await prisma.hub.findFirst({
    where: { id: hubId, ownerId: userId },
    select: { id: true },
  });
  if (!hub) return res.status(403).json({ error: "Only the hub owner can configure the webhook" });

  await prisma.hub.update({
    where: { id: hubId },
    data: { discordWebhookUrl: webhookUrl || null },
  });

  return res.status(200).json({ ok: true, configured: Boolean(webhookUrl) });
});
