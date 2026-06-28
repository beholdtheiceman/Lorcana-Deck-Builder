import { prisma } from "./db.js";

/** First instant of the current UTC month. */
function monthStart() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/**
 * Returns this hub's AI budget status for the current calendar month.
 * `budget` is the hub's monthly token cap (null/<=0 means unlimited).
 */
export async function getBudgetStatus(hubId) {
  const hub = await prisma.hub.findUnique({
    where: { id: hubId },
    select: { llmMonthlyTokenBudget: true },
  });
  const budget = hub?.llmMonthlyTokenBudget ?? null;

  const agg = await prisma.llmUsage.aggregate({
    where: { hubId, createdAt: { gte: monthStart() } },
    _sum: { inputTokens: true, outputTokens: true },
  });
  const used = (agg._sum.inputTokens ?? 0) + (agg._sum.outputTokens ?? 0);

  const unlimited = budget == null || budget <= 0;
  const remaining = unlimited ? null : Math.max(0, budget - used);
  return { budget, used, remaining, unlimited, exceeded: !unlimited && used >= budget };
}

/** Records the token cost of one generation against the hub's monthly ledger. */
export async function recordUsage(hubId, userId, kind, usage) {
  await prisma.llmUsage.create({
    data: {
      hubId,
      userId: userId ?? null,
      kind,
      inputTokens: usage?.input_tokens ?? 0,
      outputTokens: usage?.output_tokens ?? 0,
    },
  });
}
