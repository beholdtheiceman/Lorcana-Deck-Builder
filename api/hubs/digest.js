import { prisma } from "../_lib/db.js";
import { postDiscord } from "../_lib/discord.js";

// Accept an explicit DIGEST_SECRET or Vercel's auto-injected CRON_SECRET.
const DIGEST_SECRET = process.env.DIGEST_SECRET || process.env.CRON_SECRET;

function fmt(iso) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

async function buildDigest(hub) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [games, practices, reports] = await Promise.all([
    prisma.playTestGame.findMany({
      where: { hubId: hub.id, createdAt: { gte: weekAgo } },
      select: { result: true, deckArchetype: true, vsArchetype: true },
    }),
    prisma.practice.findMany({
      where: { hubId: hub.id, startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 3,
      select: { title: true, startsAt: true },
    }),
    prisma.metaReport.findMany({
      where: { hubId: hub.id, createdAt: { gte: weekAgo } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { title: true, tags: true },
    }),
  ]);

  const lines = [`📊 **Weekly digest — ${hub.name}**`, ""];

  // Win rate section
  if (games.length === 0) {
    lines.push("🎮 No games logged this week.");
  } else {
    const wins = games.filter((g) => g.result === "W").length;
    const pct = Math.round((wins / games.length) * 100);
    lines.push(`🎮 **${games.length} games** this week · ${pct}% win rate (${wins}W–${games.length - wins}L)`);

    // Top matchups by volume
    const matchups = {};
    for (const g of games) {
      const k = `${g.deckArchetype} vs ${g.vsArchetype}`;
      if (!matchups[k]) matchups[k] = { w: 0, total: 0 };
      if (g.result === "W") matchups[k].w++;
      matchups[k].total++;
    }
    const top = Object.entries(matchups)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 2);
    if (top.length) {
      lines.push("  Top matchups:");
      for (const [name, s] of top) {
        lines.push(`  • ${name} — ${Math.round((s.w / s.total) * 100)}% (${s.w}W–${s.total - s.w}L)`);
      }
    }
  }

  lines.push("");

  // Upcoming practices
  if (practices.length === 0) {
    lines.push("📅 No upcoming practices scheduled.");
  } else {
    lines.push("📅 **Upcoming practices:**");
    for (const p of practices) {
      lines.push(`  • ${p.title} · ${fmt(p.startsAt)}`);
    }
  }

  lines.push("");

  // Recent reports
  if (reports.length === 0) {
    lines.push("📝 No new reports this week.");
  } else {
    lines.push("📝 **New reports:**");
    for (const r of reports) {
      const tagStr = r.tags?.length ? ` [${r.tags.slice(0, 3).join(", ")}]` : "";
      lines.push(`  • ${r.title}${tagStr}`);
    }
  }

  return lines.join("\n");
}

export default async function handler(req, res) {
  // Accept GET (Vercel cron injects Authorization: Bearer <CRON_SECRET>) or
  // a manual POST with the same token for ad-hoc testing.
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  // Fail closed: if no secret is configured, reject rather than run publicly.
  if (!DIGEST_SECRET || token !== DIGEST_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const hubs = await prisma.hub.findMany({
    where: { discordWebhookUrl: { not: null } },
    select: { id: true, name: true, discordWebhookUrl: true },
  });

  let sent = 0;
  for (const hub of hubs) {
    try {
      const message = await buildDigest(hub);
      const ok = await postDiscord(hub.discordWebhookUrl, message);
      if (ok) sent++;
    } catch (err) {
      console.error(`[digest] hub ${hub.id} failed:`, err?.message ?? err);
    }
  }

  return res.status(200).json({ hubs: hubs.length, sent });
}
