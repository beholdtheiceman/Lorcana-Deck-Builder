import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../../_lib/db.js";
import { withAuth } from "../../_lib/withAuth.js";
import { readJson } from "../../_lib/http.js";
import { requireHubMember } from "../../_lib/hubAuth.js";
import { getBudgetStatus, recordUsage } from "../../_lib/llmBudget.js";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1500;
const MAX_CONTEXT_CHARS = 50000;

const AskSchema = z.object({
  question: z.string().min(1).max(1000),
});

const SYSTEM_PROMPT =
  "You are a Lorcana meta advisor for this competitive team. " +
  "Answer questions about the current meta, deck matchups, and strategy. " +
  "Ground every claim in the team data provided (match results, primers, reports). " +
  "If the data is insufficient to answer confidently, say so clearly rather than guessing. " +
  "Be concise and direct — these are competitive players, not beginners.";

// POST /api/hubs/:id/ask
// Body: { question: string }
// Returns: { answer: string }
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

  if (!(await requireHubMember(hubId, userId, res))) return;

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
  const { question } = parsed.data;

  const [recentGames, recentReports, primers] = await Promise.all([
    prisma.playtestGame.findMany({
      where: { hubId },
      orderBy: { playedAt: "desc" },
      take: 100,
      select: { deckArchetype: true, vsArchetype: true, result: true, onPlay: true, lesson: true },
    }),
    prisma.metaReport.findMany({
      where: { hubId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { title: true, body: true, createdAt: true },
    }),
    prisma.primer.findMany({
      where: { hubId },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { deckArchetype: true, vsArchetype: true, verdict: true, confidence: true, gameplan: true, mustKill: true },
    }),
  ]);

  let context = buildContext(recentGames, recentReports, primers);
  if (context.length > MAX_CONTEXT_CHARS) {
    context = context.slice(0, MAX_CONTEXT_CHARS) + "\n…[context truncated]";
  }

  const userMessage = `Question: ${question}\n\n=== TEAM DATA ===\n${context}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.3,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  await recordUsage(hubId, userId, "meta-ask", response.usage);

  const answer = (response.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  return res.status(200).json({ answer });
});

function buildContext(games, reports, primers) {
  const parts = [];

  if (games.length > 0) {
    const matchups = {};
    for (const g of games) {
      const key = `${g.deckArchetype} vs ${g.vsArchetype}`;
      if (!matchups[key]) matchups[key] = { wins: 0, losses: 0 };
      if (g.result === "W") matchups[key].wins++;
      else matchups[key].losses++;
    }
    parts.push("## Matchup Win Rates");
    for (const [matchup, s] of Object.entries(matchups)) {
      const total = s.wins + s.losses;
      const pct = Math.round((s.wins / total) * 100);
      parts.push(`- ${matchup}: ${s.wins}W-${s.losses}L (${pct}%, n=${total})`);
    }

    const lessons = games.filter((g) => g.lesson).slice(0, 15);
    if (lessons.length > 0) {
      parts.push("\n## Game Notes");
      lessons.forEach((g) => parts.push(`- ${g.deckArchetype} vs ${g.vsArchetype} (${g.result}): ${g.lesson}`));
    }
  }

  if (primers.length > 0) {
    parts.push("\n## Matchup Primers");
    for (const p of primers) {
      parts.push(`### ${p.deckArchetype} vs ${p.vsArchetype} — ${p.verdict ?? "?"} (${p.confidence ?? "?"})`);
      if (p.gameplan) parts.push(`Gameplan: ${p.gameplan.slice(0, 500)}`);
      if (p.mustKill) parts.push(`Must kill: ${p.mustKill.slice(0, 300)}`);
    }
  }

  if (reports.length > 0) {
    parts.push("\n## Recent Meta Reports");
    for (const r of reports) {
      parts.push(`### ${r.title}`);
      const snippet = r.body.length > 1000 ? r.body.slice(0, 1000) + "…" : r.body;
      parts.push(snippet);
    }
  }

  return parts.join("\n");
}
