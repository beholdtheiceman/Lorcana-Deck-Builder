// api/_lib/agentTools.js
//
// Tool definitions + dispatcher for the "Ask AI" agent (see api/_lib/agent.js).
// Each tool is a small, single-purpose read against either the local card
// oracle (global, no auth) or the Prisma DB (scoped to hubs the calling user
// belongs to, or decks they own / are linked to via a hub). Tools never throw
// for "not found" / "forbidden" cases — they return a plain `{ error }` object
// so the model can relay it to the user instead of the request failing.

import { prisma } from "./db.js";
import { getByName, searchCards as oracleSearchCards } from "./cards.js";
import { listKnowledge, readKnowledge } from "./agentKnowledge.js";
import { getCurrentMeta } from "../meta/current.js";
import {
  namedPairsFromDeckData,
  summarizeNamedCards,
  renderDeckSection,
} from "./deckContext.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function requireHub(hubId, userId) {
  if (!hubId) return null;
  return prisma.hub.findFirst({
    where: { id: hubId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true, name: true },
  });
}

/** Resolve a free-text player name (e.g. "Larry") to candidate user ids within a hub. */
async function resolvePlayerUserIds(hubId, player) {
  if (!player) return null;
  const [members, users] = await Promise.all([
    prisma.hubMember.findMany({
      where: { hubId, displayName: { contains: player, mode: "insensitive" } },
      select: { userId: true },
    }),
    prisma.user.findMany({
      where: { email: { contains: player, mode: "insensitive" } },
      select: { id: true },
    }),
  ]);
  return [...new Set([...members.map((m) => m.userId), ...users.map((u) => u.id)])];
}

function formatCard(c) {
  return {
    id: c.id,
    name: c.name,
    cost: c.cost,
    color: c.color,
    type: c.type,
    strength: c.strength,
    willpower: c.willpower,
    lore: c.lore,
    inkable: c.inkable,
    keywords: c.keywords,
    text: c.bodyText,
  };
}

function deckSummaryLite(deck) {
  const pairs = namedPairsFromDeckData(deck.data);
  const { summary } = summarizeNamedCards(pairs);
  return {
    id: deck.id,
    title: deck.title,
    updatedAt: deck.updatedAt,
    cardCount: summary?.totalCards ?? 0,
    colors: summary?.colors ?? [],
  };
}

function winPct(wins, losses) {
  const total = wins + losses;
  return total > 0 ? Math.round((wins / total) * 100) : null;
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function toolListKnowledge() {
  return listKnowledge();
}

async function toolReadKnowledge({ file } = {}) {
  if (!file) return { error: "file is required" };
  return readKnowledge(file);
}

async function toolSearchCards(input = {}) {
  const matches = oracleSearchCards({ ...input, limit: input.limit ?? 12 });
  return { count: matches.length, cards: matches.map(formatCard) };
}

async function toolGetCard({ name } = {}) {
  if (!name) return { error: "name is required" };
  const exact = getByName(name);
  if (exact) return { card: formatCard(exact) };
  const matches = oracleSearchCards({ name, limit: 5 });
  if (matches.length === 0) return { error: `No card found matching "${name}".` };
  return { note: "No exact match — closest matches", matches: matches.map(formatCard) };
}

async function toolListMyHubs(_input, ctx) {
  const hubs = await prisma.hub.findMany({
    where: { OR: [{ ownerId: ctx.userId }, { members: { some: { userId: ctx.userId } } }] },
    select: { id: true, name: true, ownerId: true },
  });
  return { hubs: hubs.map((h) => ({ id: h.id, name: h.name, role: h.ownerId === ctx.userId ? "owner" : "member" })) };
}

async function toolListMyDecks({ query } = {}, ctx) {
  const decks = await prisma.deck.findMany({
    where: { userId: ctx.userId, ...(query ? { title: { contains: query, mode: "insensitive" } } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  return { decks: decks.map(deckSummaryLite) };
}

async function toolGetDeck({ deckId } = {}, ctx) {
  if (!deckId) return { error: "deckId is required" };
  const deck = await prisma.deck.findUnique({
    where: { id: deckId },
    include: { user: { select: { email: true } } },
  });
  if (!deck) return { error: "Deck not found." };

  let allowed = deck.userId === ctx.userId;
  if (!allowed) {
    // Team-visible when logged as a practice game inside a hub this user belongs to.
    const linked = await prisma.playtestGame.findFirst({
      where: {
        deckId,
        hub: { OR: [{ ownerId: ctx.userId }, { members: { some: { userId: ctx.userId } } }] },
      },
      select: { id: true },
    });
    allowed = Boolean(linked);
  }
  if (!allowed) return { error: "You don't have access to that deck." };

  const pairs = namedPairsFromDeckData(deck.data);
  const { summary, warnings } = summarizeNamedCards(pairs);
  return {
    id: deck.id,
    title: deck.title,
    owner: deck.user?.email ?? "unknown",
    updatedAt: deck.updatedAt,
    decklist: summary ? renderDeckSection(summary, deck.title) : "(empty deck)",
    warnings: warnings?.length ? warnings : undefined,
  };
}

async function toolTeamStats({ hubId, deckArchetype, vsArchetype, player } = {}, ctx) {
  const hub = await requireHub(hubId, ctx.userId);
  if (!hub) return { error: "You are not a member of that hub (or hubId was missing/invalid)." };

  const playerIds = player ? await resolvePlayerUserIds(hubId, player) : null;
  if (playerIds && playerIds.length === 0) {
    return { _hubId: hubId, matchups: [], byArchetype: [], sampleSize: 0, note: `No hub member matched "${player}".` };
  }

  const where = {
    hubId,
    ...(deckArchetype ? { deckArchetype: { contains: deckArchetype, mode: "insensitive" } } : {}),
    ...(vsArchetype ? { vsArchetype: { contains: vsArchetype, mode: "insensitive" } } : {}),
    ...(playerIds ? { loggedById: { in: playerIds } } : {}),
  };
  const games = await prisma.playtestGame.findMany({
    where,
    select: { deckArchetype: true, vsArchetype: true, result: true },
    take: 1000,
  });

  const matchupMap = new Map(); // "deck vs opp" -> {wins, losses}
  const archetypeMap = new Map(); // deck -> {wins, losses}
  for (const g of games) {
    const mKey = `${g.deckArchetype} vs ${g.vsArchetype}`;
    const m = matchupMap.get(mKey) ?? { deckArchetype: g.deckArchetype, vsArchetype: g.vsArchetype, wins: 0, losses: 0 };
    if (g.result === "W") m.wins++; else m.losses++;
    matchupMap.set(mKey, m);

    const a = archetypeMap.get(g.deckArchetype) ?? { deckArchetype: g.deckArchetype, wins: 0, losses: 0 };
    if (g.result === "W") a.wins++; else a.losses++;
    archetypeMap.set(g.deckArchetype, a);
  }

  const matchups = [...matchupMap.values()]
    .map((m) => ({ ...m, winRate: winPct(m.wins, m.losses), games: m.wins + m.losses }))
    .sort((a, b) => b.games - a.games);

  const byArchetype = [...archetypeMap.values()]
    .map((a) => ({ ...a, winRate: winPct(a.wins, a.losses), games: a.wins + a.losses }))
    .sort((a, b) => (b.winRate ?? -1) - (a.winRate ?? -1) || b.games - a.games);

  return { _hubId: hubId, sampleSize: games.length, matchups, byArchetype };
}

async function toolSearchTeamReviews({ hubId, player, deckArchetype, vsArchetype, result } = {}, ctx) {
  const hub = await requireHub(hubId, ctx.userId);
  if (!hub) return { error: "You are not a member of that hub (or hubId was missing/invalid)." };

  const where = {
    hubId,
    ...(player ? { player: { contains: player, mode: "insensitive" } } : {}),
    ...(deckArchetype ? { deckArchetype: { contains: deckArchetype, mode: "insensitive" } } : {}),
    ...(vsArchetype ? { vsArchetype: { contains: vsArchetype, mode: "insensitive" } } : {}),
    ...(result ? { result: /^w/i.test(result) ? "W" : "L" } : {}),
  };
  const reviews = await prisma.review.findMany({ where, orderBy: { createdAt: "desc" }, take: 10 });

  return {
    _hubId: hubId,
    count: reviews.length,
    reviews: reviews.map((r) => ({
      id: r.id,
      player: r.player,
      deckArchetype: r.deckArchetype,
      vsArchetype: r.vsArchetype,
      result: r.result,
      gameNumber: r.gameNumber,
      createdAt: r.createdAt,
      recap: (r.recap || "").slice(0, 900),
      leakTags: r.leakTags,
      decisionPoints: (Array.isArray(r.lines) ? r.lines : []).slice(0, 4),
    })),
  };
}

async function toolSearchPrimers({ hubId, deckArchetype, vsArchetype } = {}, ctx) {
  const hub = await requireHub(hubId, ctx.userId);
  if (!hub) return { error: "You are not a member of that hub (or hubId was missing/invalid)." };

  const where = {
    hubId,
    ...(deckArchetype ? { deckArchetype: { contains: deckArchetype, mode: "insensitive" } } : {}),
    ...(vsArchetype ? { vsArchetype: { contains: vsArchetype, mode: "insensitive" } } : {}),
  };
  const primers = await prisma.primer.findMany({ where, orderBy: { updatedAt: "desc" }, take: 10 });

  return {
    _hubId: hubId,
    primers: primers.map((p) => ({
      deckArchetype: p.deckArchetype,
      vsArchetype: p.vsArchetype,
      verdict: p.verdict,
      confidence: p.confidence,
      gameplan: (p.gameplan || "").slice(0, 600),
      mustKill: (p.mustKill || "").slice(0, 300),
    })),
  };
}

async function toolSearchMetaReports({ hubId, query } = {}, ctx) {
  const hub = await requireHub(hubId, ctx.userId);
  if (!hub) return { error: "You are not a member of that hub (or hubId was missing/invalid)." };

  const where = {
    hubId,
    ...(query
      ? { OR: [{ title: { contains: query, mode: "insensitive" } }, { body: { contains: query, mode: "insensitive" } }] }
      : {}),
  };
  const reports = await prisma.metaReport.findMany({ where, orderBy: { createdAt: "desc" }, take: 8 });

  return {
    _hubId: hubId,
    reports: reports.map((r) => ({
      title: r.title,
      tags: r.tags,
      createdAt: r.createdAt,
      body: (r.body || "").slice(0, 1200),
    })),
  };
}

async function toolSearchTournamentResults({ hubId, player, deckArchetype, eventName } = {}, ctx) {
  const hub = await requireHub(hubId, ctx.userId);
  if (!hub) return { error: "You are not a member of that hub (or hubId was missing/invalid)." };

  const where = {
    hubId,
    ...(player ? { playerName: { contains: player, mode: "insensitive" } } : {}),
    ...(deckArchetype ? { deckArchetype: { contains: deckArchetype, mode: "insensitive" } } : {}),
    ...(eventName ? { eventName: { contains: eventName, mode: "insensitive" } } : {}),
  };
  const results = await prisma.tournamentResult.findMany({
    where,
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    take: 20,
  });

  return {
    _hubId: hubId,
    results: results.map((r) => ({
      eventName: r.eventName,
      eventDate: r.eventDate,
      playerName: r.playerName,
      deckArchetype: r.deckArchetype,
      placement: r.placement,
      record: r.record,
    })),
  };
}

// The archetypes table holds two different KINDS of row at different resolutions:
// color-pair aggregates (externalId "pair:...") and individual deck shapes within
// them. Sorting both on one games axis interleaves them, and a deck shape is a
// SUBSET of its pair's games — so presenting them in one list invites the model to
// answer "strongest color pair" with a deck name. Split them explicitly.
const isColorPair = (a) => a.externalId.startsWith("pair:");

const metaRow = (a) => ({
  name: a.name,
  colors: a.colors,
  games: a.games,
  winRate: a.winRate,
  playRate: a.playRate,
  firstPlayerWinRate: a.firstPlayerWinRate,
});

async function toolGetCurrentMeta(input) {
  const data = await getCurrentMeta({ queue: input.queue || "core-bo1" });
  if (!data) return { error: "No approved meta snapshot is available yet." };
  return {
    source: data.source,
    queue: data.queue,
    era: data.era,
    period: `${data.periodStart.toISOString().slice(0, 10)} to ${data.periodEnd.toISOString().slice(0, 10)}`,
    totalGames: data.totalGames,
    uniquePlayers: data.uniquePlayers,
    stale: data.stale,
    colorPairs: data.archetypes.filter(isColorPair).slice(0, 15).map(metaRow),
    decks: data.archetypes.filter((a) => !isColorPair(a)).slice(0, 15).map(metaRow),
    matchups: data.matchups.slice(0, 30).map((m) => ({
      a: m.keyA,
      b: m.keyB,
      games: m.games,
      winRate: m.winRate,
    })),
  };
}


// ---------------------------------------------------------------------------
// Tool specs (Anthropic tool-use schema) + dispatcher
// ---------------------------------------------------------------------------

export const TOOL_SPECS = [
  {
    name: "list_knowledge",
    description:
      "List the Lorcana strategy knowledge files (the lorcana-knowledge base: meta archetypes, matchup " +
      "guide, role theory, synergy theory, archetype playbooks, game-state evaluation, gameplay heuristics, " +
      "tech cards, set changelog) with a note on when to read each. Call this to decide which file(s) to open " +
      "for a strategic question (deck building, meta, matchups, gameplay, tech).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "read_knowledge",
    description:
      "Read one strategy knowledge file by name (from list_knowledge) and get its full text. Consult the " +
      "relevant file(s) BEFORE answering any strategic question — e.g. read role-theory.md first for gameplay/" +
      "sequencing, matchup-guide.md for matchup reads and primers, meta-archetypes.md for meta questions, " +
      "tech-cards.md for tech includes. Ground strategic claims in this content, not from memory.",
    input_schema: {
      type: "object",
      properties: {
        file: { type: "string", description: 'Exact filename from list_knowledge, e.g. "matchup-guide.md"' },
      },
      required: ["file"],
    },
  },
  {
    name: "search_cards",
    description:
      "Search the Lorcana card oracle by name/color/type/keyword ability/cost/text. Use this to find cards " +
      "matching loose criteria, or when get_card doesn't find an exact name.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Substring match against card name" },
        color: { type: "string", description: "Ink color, e.g. Amber, Amethyst, Emerald, Ruby, Sapphire, Steel" },
        type: { type: "string", description: "Character, Item, Action, Location, or Song" },
        keyword: { type: "string", description: "Keyword ability, e.g. Evasive, Shift, Bodyguard, Rush, Ward" },
        text: { type: "string", description: "Substring match against the card's oracle/body text" },
        minCost: { type: "number" },
        maxCost: { type: "number" },
        limit: { type: "number", description: "Max results, default 12, max 50" },
      },
    },
  },
  {
    name: "get_card",
    description: "Look up one specific card by its exact (or close) name and return its full oracle text and stats.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string", description: "Card name, e.g. \"Kida - Crystal Scion\"" } },
      required: ["name"],
    },
  },
  {
    name: "list_my_hubs",
    description:
      "List the Team Hubs the current user belongs to (id, name, role). Call this before a hub-scoped tool " +
      "(team_stats, search_team_reviews, search_primers, search_meta_reports, search_tournament_results) when " +
      "no hub id has been given in context and the question implies a specific team, or when it's ambiguous " +
      "which hub the user means. Do NOT call this for general questions about the game or the meta — those " +
      "are answered globally by get_current_meta, and asking the user to pick a hub for them is wrong.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_my_decks",
    description: "List the current user's own saved decks (title, card count, colors), optionally filtered by title.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Optional substring filter on deck title" } },
    },
  },
  {
    name: "get_deck",
    description:
      "Get the full decklist (every card + count, curve, colors) for one saved deck by id. Works for the " +
      "user's own decks, or a teammate's deck that's been logged in a practice game within a shared hub.",
    input_schema: {
      type: "object",
      properties: { deckId: { type: "string" } },
      required: ["deckId"],
    },
  },
  {
    name: "team_stats",
    description:
      "Aggregate ONE HUB'S OWN logged practice games (PlaytestGame) into win rates — either by specific " +
      "matchup (deckArchetype vs vsArchetype) or overall by archetype. This is the team's private practice " +
      "record, a handful of games logged by hub members — NOT the competitive meta. For how decks are " +
      "performing in the game at large ('best deck', 'top performing deck', 'what's winning'), use " +
      "get_current_meta instead. Only use this when the user is asking about their own team's results. " +
      "Optionally filter to one player's games by name.",
    input_schema: {
      type: "object",
      properties: {
        hubId: { type: "string", description: "Required — the Team Hub id" },
        deckArchetype: { type: "string", description: "Substring filter on the team's deck archetype" },
        vsArchetype: { type: "string", description: "Substring filter on the opponent's archetype" },
        player: { type: "string", description: "Substring match on a hub member's display name or email" },
      },
      required: ["hubId"],
    },
  },
  {
    name: "search_team_reviews",
    description:
      "Search a hub's replay reviews (per-game recaps with decision points and 'leak' tags) by player, " +
      "deck archetype, opponent archetype, and/or result. This is the source for 'how did <player> do vs <X>' " +
      "questions when a review of that game exists.",
    input_schema: {
      type: "object",
      properties: {
        hubId: { type: "string", description: "Required — the Team Hub id" },
        player: { type: "string" },
        deckArchetype: { type: "string" },
        vsArchetype: { type: "string" },
        result: { type: "string", description: "\"W\" or \"L\"" },
      },
      required: ["hubId"],
    },
  },
  {
    name: "search_primers",
    description: "Search a hub's matchup primers (gameplan, must-kill targets, verdict/confidence) by archetype.",
    input_schema: {
      type: "object",
      properties: {
        hubId: { type: "string", description: "Required — the Team Hub id" },
        deckArchetype: { type: "string" },
        vsArchetype: { type: "string" },
      },
      required: ["hubId"],
    },
  },
  {
    name: "search_meta_reports",
    description: "Search a hub's shared meta reports / write-ups (tournament reports, meta reads, tech choices) by keyword.",
    input_schema: {
      type: "object",
      properties: {
        hubId: { type: "string", description: "Required — the Team Hub id" },
        query: { type: "string", description: "Keyword to match against report title/body" },
      },
      required: ["hubId"],
    },
  },
  {
    name: "get_current_meta",
    description:
      "Get the current competitive meta snapshot. Returns TWO SEPARATE lists: `colorPairs` (ink-pair " +
      "aggregates like Amber/Emerald — use these for 'best color pair' questions) and `decks` (individual " +
      "deck shapes WITHIN those pairs, like Princess Aggro — a deck's games are a subset of its pair's, so " +
      "never compare the two lists as peers or sum them). Both carry win rate, play rate, first-player win " +
      "rate and sample size, alongside the period covered, the set era, and the data source. " +
      "This is LIVE data and it OVERRIDES the static knowledge files — meta-archetypes.md, matchup-guide.md " +
      "and tech-cards.md are pinned to an older set and may contradict it. Call this before answering any " +
      "question about what is strong, popular, or winning right now. When you cite a figure from it, state " +
      "the date range and sample size so the user knows how current and how well-supported it is. Not " +
      "hub-scoped — this is global data, no hub id needed, and it is the right tool even when the user " +
      "belongs to several hubs. Covers 'best/top performing deck', 'what's winning', 'what should I play', " +
      "'the meta', and recent-timeframe phrasings like 'this week' or 'last week' — the snapshot is weekly, " +
      "so say which week it covers rather than refusing.",
    input_schema: {
      type: "object",
      properties: {
        queue: {
          type: "string",
          description: 'Which queue to read: "core-bo1" (default) or "core-bo3".',
        },
      },
    },
  },
  {
    name: "search_tournament_results",
    description: "Search a hub's synced tournament results (event, player, archetype, placement, record).",
    input_schema: {
      type: "object",
      properties: {
        hubId: { type: "string", description: "Required — the Team Hub id" },
        player: { type: "string" },
        deckArchetype: { type: "string" },
        eventName: { type: "string" },
      },
      required: ["hubId"],
    },
  },
];

const HANDLERS = {
  list_knowledge: toolListKnowledge,
  read_knowledge: toolReadKnowledge,
  search_cards: toolSearchCards,
  get_card: toolGetCard,
  list_my_hubs: toolListMyHubs,
  list_my_decks: toolListMyDecks,
  get_deck: toolGetDeck,
  team_stats: toolTeamStats,
  search_team_reviews: toolSearchTeamReviews,
  search_primers: toolSearchPrimers,
  search_meta_reports: toolSearchMetaReports,
  get_current_meta: toolGetCurrentMeta,
  search_tournament_results: toolSearchTournamentResults,
};

/** Dispatch one tool call. Never throws for user-facing "not found"/"forbidden" — those come back as { error }. */
export async function runTool(name, input, ctx) {
  const handler = HANDLERS[name];
  if (!handler) return { error: `Unknown tool "${name}"` };
  return handler(input ?? {}, ctx);
}
