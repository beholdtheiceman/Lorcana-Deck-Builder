import { PrismaClient } from "@prisma/client";

const prisma = globalThis.__prisma ?? new PrismaClient();
if (!globalThis.__prisma) globalThis.__prisma = prisma;

/** Normalize "Amber/Emerald" or "emerald/amber" to the stored key "amber/emerald". */
export function normalizePairKey(input) {
  return String(input || "")
    .split("/")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join("/");
}

/**
 * Re-orient stored matchup rows so the requested pair is always side A.
 *
 * Rows are stored ONCE with keys sorted alphabetically, and `winRate` is always
 * side A's. So "amber/amethyst vs amber/emerald = 47.94" is AMETHYST's win rate —
 * reading it as Amber/Emerald's would invert every second row and look perfectly
 * plausible while being exactly wrong.
 *
 * `firstPlayerWinRate` is deliberately dropped on inverted rows: it is side A's
 * win rate when on the play, and the complement is NOT (100 - x) because it is
 * conditioned on a different subset of games. Showing a guessed number here would
 * be worse than showing none.
 */
export function orientMatchups(rows, pairKey) {
  return rows
    .map((m) => {
      const isA = m.keyA === pairKey;
      const isB = m.keyB === pairKey;
      if (!isA && !isB) return null;
      const mirror = isA && isB;
      return {
        opponent: mirror ? pairKey : isA ? m.keyB : m.keyA,
        mirror,
        games: m.games,
        winRate: isA ? m.winRate : Number((100 - m.winRate).toFixed(2)),
        // Only meaningful when we did not flip sides. See note above.
        firstPlayerWinRate: isA ? m.firstPlayerWinRate : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.winRate - a.winRate);
}

export async function getPairDetail({ queue = "core-bo1", pair } = {}) {
  const pairKey = normalizePairKey(pair);
  if (!pairKey.includes("/")) return { error: "pair must be two inks, e.g. amber/emerald" };

  const snapshot = await prisma.metaSnapshot.findFirst({
    where: { queue, status: "approved" },
    orderBy: { periodStart: "desc" },
    include: {
      archetypes: true,
      matchups: { where: { grain: "color-pair" } },
    },
  });
  if (!snapshot) return null;

  const self = snapshot.archetypes.find((a) => a.externalId === `pair:${pairKey}`);
  if (!self) return { error: `No data for pair "${pairKey}" in this snapshot` };

  // Deck shapes whose colors match this pair. archetypeName is often null, so the
  // adapter already fell back to the shape name — just don't re-derive it here.
  // Several shapes share one archetype (four separate "Elinor Circle" clusters in
  // the first live snapshot), so list them once with a sample-weighted win rate —
  // repeating a name four times with four different numbers reads as a bug, and a
  // plain average would let a 1,000-game shape outweigh a 90,000-game one.
  const shapes = snapshot.archetypes.filter(
    (a) => !a.externalId.startsWith("pair:") && normalizePairKey((a.colors || []).join("/")) === pairKey,
  );
  const grouped = new Map();
  for (const a of shapes) {
    const key = a.archetypeId || a.name;
    const g = grouped.get(key) ?? { name: a.name, games: 0, wins: 0, shapes: 0 };
    g.games += a.games;
    g.wins += (a.winRate / 100) * a.games;
    g.shapes += 1;
    grouped.set(key, g);
  }
  const decks = [...grouped.values()]
    .map((g) => ({
      name: g.name,
      games: g.games,
      winRate: g.games ? Number(((g.wins / g.games) * 100).toFixed(2)) : null,
      shapes: g.shapes,
    }))
    .sort((a, b) => b.games - a.games);

  // pairCardLift lives only in the raw payload — the adapter writes null into the
  // cardLift column for pair rows. Read it from the payload rather than forcing a
  // re-sync, which would also mean re-approving the snapshot.
  const rawLift = snapshot.payload?.pairCardLift?.[pairKey] ?? [];
  const cardIds = rawLift.map((c) => c.cardId).filter(Boolean);
  const cards = cardIds.length
    ? await prisma.card.findMany({
        where: {
          OR: cardIds.map((id) => {
            const [setCode, number] = String(id).split("-");
            return { setCode, number };
          }),
        },
        select: { setCode: true, number: true, name: true, version: true, cost: true, inks: true, imageUrl: true },
      })
    : [];
  const byId = new Map(cards.map((c) => [`${c.setCode}-${c.number}`, c]));

  const cardLift = rawLift
    .map((c) => {
      const card = byId.get(String(c.cardId));
      return {
        cardId: c.cardId,
        // Unresolved ids still render — a missing card is a data gap, not a reason
        // to hide a real lift figure.
        name: card ? `${card.name}${card.version ? ` - ${card.version}` : ""}` : c.cardId,
        cost: card?.cost ?? null,
        inks: card?.inks ?? [],
        imageUrl: card?.imageUrl ?? null,
        lift: c.lift,
        presence: c.presence,
        winRateWith: c.winRateWith,
        gamesWith: c.gamesWith,
      };
    })
    .sort((a, b) => b.lift - a.lift);

  return {
    pair: pairKey,
    queue: snapshot.queue,
    era: snapshot.era,
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
    source: snapshot.source,
    stats: {
      games: self.games,
      winRate: self.winRate,
      playRate: self.playRate,
      firstPlayerWinRate: self.firstPlayerWinRate,
    },
    matchups: orientMatchups(snapshot.matchups, pairKey),
    decks,
    cardLift,
  };
}

export default async function handler(req, res) {
  try {
    const data = await getPairDetail({ queue: req.query.queue || "core-bo1", pair: req.query.pair });
    if (!data) return res.status(200).json({ empty: true });
    if (data.error) return res.status(400).json(data);
    return res.status(200).json(data);
  } catch (err) {
    console.error("[meta/pair] failed:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to load pair detail" });
  }
}
