import { z } from "zod";
import { prisma } from "./_lib/db.js";
import { withAuth } from "./_lib/withAuth.js";
import { readJson } from "./_lib/http.js";
import { requireHubMember } from "./_lib/hubAuth.js";
import { getBudgetStatus, recordUsage } from "./_lib/llmBudget.js";
import { runAgent } from "./_lib/agent.js";
import { resolveDeckAttachment } from "./_lib/askDeckAttachment.js";
import { MAX_DECK_TEXT_CHARS } from "./_lib/deckTextParse.js";

const AskSchema = z.object({
  question: z.string().min(1).max(1000),
  hubId: z.string().min(1).optional(),
  deck: z
    .union([
      z.object({ deckId: z.string().min(1) }),
      z.object({ text: z.string().min(1).max(MAX_DECK_TEXT_CHARS) }),
    ])
    .optional(),
});

// POST /api/ask
// Body: { question: string, hubId?: string }
//
// The app-wide Ask AI endpoint. Card lookups and questions about the user's
// own saved decks work with no hubId at all. Passing hubId hints the agent at
// a specific Team Hub for team-scoped questions (stats, reviews, primers,
// meta reports, tournament results) — the model still decides which tools to
// call, this just tells it which hub "your team" refers to. When hubId is
// given, this hub's monthly AI budget gates the call and is billed for it,
// same as before; hub-less questions aren't billed against any hub budget.
export default withAuth(async (req, res, session) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(501).json({ error: "AI advisor is not configured. Set ANTHROPIC_API_KEY." });
  }

  const userId = session.uid;
  const body = req.body ?? (await readJson(req));
  const parsed = AskSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const { question, hubId, deck } = parsed.data;

  let hubHint = null;
  if (hubId) {
    const hub = await requireHubMember(hubId, userId, res);
    if (!hub) return; // 403 already sent

    const budget = await getBudgetStatus(hubId);
    if (budget.exceeded) {
      return res.status(429).json({
        error:
          `Monthly AI budget reached for this hub ` +
          `(${budget.used.toLocaleString()} / ${budget.budget.toLocaleString()} tokens). ` +
          `The hub owner can raise it in the Reviews tab.`,
      });
    }

    const full = await prisma.hub.findUnique({ where: { id: hubId }, select: { name: true } });
    hubHint = { id: hubId, name: full?.name ?? "your hub" };
  }

  const deckResolved = await resolveDeckAttachment(deck, { userId, hubId });
  if (deckResolved.error) {
    return res.status(deckResolved.status).json({
      error: deckResolved.error,
      ...(deckResolved.deckWarnings?.length ? { deckWarnings: deckResolved.deckWarnings } : {}),
    });
  }
  const { deckSection, deckWarnings } = deckResolved;
  const fullQuestion = deckSection
    ? `${deckSection}\n\n(The question below is about the attached deck unless it says otherwise.)\n\nQuestion: ${question}`
    : question;

  const { answer, usage, toolLog, hubIdsTouched } = await runAgent({ question: fullQuestion, userId, hubHint });

  if (hubId) {
    await recordUsage(hubId, userId, "ask", usage);
  }

  return res.status(200).json({
    answer,
    ...(deckWarnings.length > 0 ? { deckWarnings } : {}),
    toolsUsed: [...new Set(toolLog.map((t) => t.tool))],
    hubsConsulted: hubIdsTouched,
  });
});
