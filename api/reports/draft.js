import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../_lib/db.js";
import { withAuth } from "../_lib/withAuth.js";
import { readJson } from "../_lib/http.js";
import { requireHubMember } from "../_lib/hubAuth.js";
import { getBudgetStatus, recordUsage } from "../_lib/llmBudget.js";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 3000;
const MAX_CONTEXT_CHARS = 40000;

const DraftSchema = z.object({
  hubId: z.string().min(1),
  prompt: z.string().min(1).max(2000),
});

const SYSTEM_PROMPT =
  "You are a Lorcana competitive analyst writing a team meta report. " +
  "Write in clear, direct prose aimed at players who want to improve. " +
  "Ground every claim in the match data and reports provided. " +
  "If the data does not support a claim, note the uncertainty. " +
  "Format the report in markdown with a title line (# Title), then sections as needed.";

// POST /api/reports/draft
// Body: { hubId, prompt }
// Returns: { title, body } — a markdown draft the client pre-fills into the report editor
export default withAuth(async (req, res, session) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(501).json({ error: "LLM report drafting is not configured. Set ANTHROPIC_API_KEY." });
  }

  const userId = session.uid;
  const body = req.body ?? (await readJson(req));
  const parsed = DraftSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { hubId, prompt } = parsed.data;
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

  const [recentGames, recentReports] = await Promise.all([
    prisma.playtestGame.findMany({
      where: { hubId },
      orderBy: { playedAt: "desc" },
      take: 50,
      select: { deckArchetype: true, vsArchetype: true, result: true, onPlay: true, lesson: true },
    }),
    prisma.metaReport.findMany({
      where: { hubId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { title: true, body: true, tags: true, createdAt: true },
    }),
  ]);

  let context = buildContext(recentGames, recentReports);
  if (context.length > MAX_CONTEXT_CHARS) {
    context = context.slice(0, MAX_CONTEXT_CHARS) + "\n…[context truncated]";
  }

  const userInstruction =
    `Write a meta report in response to this request: "${prompt}"\n\n` +
    `Use the team data below as your primary source. Start with a markdown title (# …) then the report body.\n\n` +
    `=== TEAM DATA ===\n${context}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.4,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userInstruction }],
  });

  await recordUsage(hubId, userId, "report-draft", response.usage);

  const text = (response.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const lines = text.split("\n");
  let title = "AI Draft";
  let bodyLines = lines;
  const titleLine = lines.findIndex((l) => l.startsWith("# "));
  if (titleLine !== -1) {
    title = lines[titleLine].replace(/^#\s*/, "").trim();
    bodyLines = lines.slice(titleLine + 1);
  }

  return res.status(200).json({ title, body: bodyLines.join("\n").trim() });
});

function buildContext(games, reports) {
  const parts = [];

  if (games.length > 0) {
    const matchups = {};
    for (const g of games) {
      const key = `${g.deckArchetype} vs ${g.vsArchetype}`;
      if (!matchups[key]) matchups[key] = { wins: 0, losses: 0 };
      if (g.result === "W") matchups[key].wins++;
      else matchups[key].losses++;
    }
    parts.push("## Matchup Win Rates (last 50 games)");
    for (const [matchup, { wins, losses }] of Object.entries(matchups)) {
      const total = wins + losses;
      const pct = total > 0 ? Math.round((wins / total) * 100) : 0;
      parts.push(`- ${matchup}: ${wins}W-${losses}L (${pct}%)`);
    }

    const lessons = games.filter((g) => g.lesson).slice(0, 10);
    if (lessons.length > 0) {
      parts.push("\n## Recent Game Notes");
      lessons.forEach((g) => parts.push(`- ${g.deckArchetype} vs ${g.vsArchetype} (${g.result}): ${g.lesson}`));
    }
  }

  if (reports.length > 0) {
    parts.push("\n## Recent Team Reports");
    for (const r of reports) {
      parts.push(`### ${r.title}`);
      const snippet = r.body.length > 1500 ? r.body.slice(0, 1500) + "…" : r.body;
      parts.push(snippet);
    }
  }

  return parts.join("\n");
}
