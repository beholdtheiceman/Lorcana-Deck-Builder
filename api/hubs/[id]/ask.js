import { z } from "zod";
import { prisma } from "../../_lib/db.js";
import { withAuth } from "../../_lib/withAuth.js";
import { readJson } from "../../_lib/http.js";
import { requireHubMember } from "../../_lib/hubAuth.js";
import { getBudgetStatus, recordUsage } from "../../_lib/llmBudget.js";
import { runAgent } from "../../_lib/agent.js";
import { resolveDeckAttachment } from "../../_lib/askDeckAttachment.js";
import { MAX_DECK_TEXT_CHARS } from "../../_lib/deckTextParse.js";

const AskSchema = z.object({
  question: z.string().min(1).max(1000),
  deck: z
    .union([
      z.object({ deckId: z.string().min(1) }),
      z.object({ text: z.string().min(1).max(MAX_DECK_TEXT_CHARS) }),
    ])
    .optional(),
});

// POST /api/hubs/:id/ask
// Body: { question: string, deck?: {deckId} | {text} }
// Returns: { answer: string, deckWarnings?: string[] }
//
// Hub-scoped shortcut over the same multi-tool agent behind /api/ask (card
// oracle, decks, team stats, reviews, primers, reports, tournament results —
// see api/_lib/agent.js and api/_lib/agentTools.js). This hub's id is passed
// to the agent as a hint so "our team" / "my matchups" resolve to it without
// the caller needing to say which hub. Kept as its own route (rather than
// folding callers into /api/ask) so the Team Hub widget/page's existing
// request contract keeps working unchanged.
export default withAuth(async (req, res, session) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(501).json({ error: "AI advisor is not configured. Set ANTHROPIC_API_KEY." });
  }

  const userId = session.uid;
  const { id: hubId } = req.query;
  if (!hubId) return res.status(400).json({ error: "Hub id is required" });

  const hub = await requireHubMember(hubId, userId, res);
  if (!hub) return; // 403 already sent

  const budgetStatus = await getBudgetStatus(hubId);
  if (budgetStatus.exceeded) {
    return res.status(429).json({
      error:
        `Monthly AI budget reached for this hub ` +
        `(${budgetStatus.used.toLocaleString()} / ${budgetStatus.budget.toLocaleString()} tokens). ` +
        `The hub owner can raise it in the Reviews tab.`,
    });
  }

  const body = req.body ?? (await readJson(req));
  const parsed = AskSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const { question, deck } = parsed.data;

  const deckResolved = await resolveDeckAttachment(deck, { userId, hubId });
  if (deckResolved.error) {
    return res.status(deckResolved.status).json({
      error: deckResolved.error,
      ...(deckResolved.deckWarnings?.length ? { deckWarnings: deckResolved.deckWarnings } : {}),
    });
  }
  const { deckSection, deckWarnings } = deckResolved;

  const full = await prisma.hub.findUnique({ where: { id: hubId }, select: { name: true } });
  const hubHint = { id: hubId, name: full?.name ?? "your hub" };

  const fullQuestion = deckSection
    ? `${deckSection}\n\n(The question below is about the attached deck unless it says otherwise.)\n\nQuestion: ${question}`
    : question;

  const { answer, usage } = await runAgent({ question: fullQuestion, userId, hubHint });

  await recordUsage(hubId, userId, "ask", usage);

  return res.status(200).json({
    answer,
    ...(deckWarnings.length > 0 ? { deckWarnings } : {}),
  });
});
