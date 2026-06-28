import { z } from "zod";
import { prisma } from "../_lib/db.js";
import { withAuth } from "../_lib/withAuth.js";
import { readJson } from "../_lib/http.js";
import { getBudgetStatus } from "../_lib/llmBudget.js";

const SetSchema = z.object({
  hubId: z.string().min(1),
  // null or 0 = unlimited; otherwise a positive monthly token cap
  monthlyTokenBudget: z.number().int().min(0).max(100_000_000).nullable(),
});

// GET  /api/hubs/llm-budget?hubId=  -> month-to-date usage + budget (hub member)
// POST /api/hubs/llm-budget         -> set the monthly token budget (hub owner)
export default withAuth(async (req, res, session) => {
  const userId = session.uid;

  if (req.method === "GET") {
    const hubId = req.query.hubId;
    if (!hubId) return res.status(400).json({ error: "hubId is required" });
    const member = await prisma.hub.findFirst({
      where: { id: hubId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      select: { id: true, ownerId: true },
    });
    if (!member) return res.status(403).json({ error: "Forbidden" });
    const status = await getBudgetStatus(hubId);
    return res.status(200).json({ ...status, isOwner: member.ownerId === userId });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body ?? (await readJson(req));
  const parsed = SetSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const { hubId, monthlyTokenBudget } = parsed.data;

  const hub = await prisma.hub.findFirst({
    where: { id: hubId, ownerId: userId },
    select: { id: true },
  });
  if (!hub) return res.status(403).json({ error: "Only the hub owner can set the AI budget" });

  await prisma.hub.update({
    where: { id: hubId },
    data: { llmMonthlyTokenBudget: monthlyTokenBudget },
  });

  const status = await getBudgetStatus(hubId);
  return res.status(200).json({ ...status, isOwner: true });
});
