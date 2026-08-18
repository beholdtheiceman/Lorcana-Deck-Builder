/**
 * Pure adapter: raw duels.ink /api/stats/meta payload -> normalized rows.
 *
 * No network, no DB. duels.ink offers no stability contract, so this validates
 * aggressively and throws rather than emitting partial rows — a partial write is
 * worse than no write.
 */

export class DuelsMetaShapeError extends Error {
  constructor(message) {
    super(message);
    this.name = "DuelsMetaShapeError";
  }
}

const REQUIRED_TOP_LEVEL = ["meta", "activity", "colorPairs", "matchups", "profiles"];

function labelColors(colors) {
  return colors.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join("/");
}

function pairKey(colors) {
  return [...colors].sort().join("/");
}

export function parseDuelsMeta(raw, { queue }) {
  if (!raw || typeof raw !== "object") {
    throw new DuelsMetaShapeError("payload is not an object");
  }
  for (const key of REQUIRED_TOP_LEVEL) {
    if (!raw[key]) throw new DuelsMetaShapeError(`missing required key "${key}"`);
  }
  const week = raw.meta.currentWeek;
  if (!week?.startDate || !week?.endDate) {
    throw new DuelsMetaShapeError("missing meta.currentWeek.startDate/endDate");
  }
  const era = raw.meta.eras?.currentEra?.key;
  if (!era) throw new DuelsMetaShapeError("missing meta.eras.currentEra.key");
  if (typeof raw.activity.totalGames !== "number") {
    throw new DuelsMetaShapeError("missing activity.totalGames");
  }

  const snapshot = {
    source: "duels.ink",
    queue,
    era,
    periodStart: new Date(`${week.startDate}T00:00:00.000Z`),
    periodEnd: new Date(`${week.endDate}T00:00:00.000Z`),
    totalGames: raw.activity.totalGames,
    uniquePlayers: raw.activity.uniquePlayers ?? null,
    payload: raw,
  };

  const archetypes = [
    ...raw.colorPairs.map((p) => ({
      externalId: `pair:${pairKey(p.colors)}`,
      archetypeId: null,
      name: labelColors(p.colors),
      colors: p.colors,
      games: p.games,
      winRate: p.winRate,
      playRate: p.playRate ?? null,
      firstPlayerWinRate: p.firstPlayerWinRate ?? null,
      centroidCards: null,
      cardLift: null,
    })),
    ...raw.profiles.map((p) => ({
      externalId: p.id,
      archetypeId: p.archetypeId ?? null,
      // archetypeName is null for small unnamed clusters — fall back to the shape name.
      name: p.archetypeName ?? p.name ?? labelColors(p.colors ?? []),
      colors: p.colors ?? [],
      games: p.gamesPlayed,
      winRate: p.winRate,
      playRate: null,
      firstPlayerWinRate: null,
      centroidCards: p.centroidCounts ?? null,
      cardLift: p.cardLift ?? null,
    })),
  ];

  const matchups = [
    ...raw.matchups.map((m) => ({
      grain: "color-pair",
      keyA: pairKey(m.colorsA),
      keyB: pairKey(m.colorsB),
      games: m.games,
      winRate: m.winRate,
      firstPlayerWinRate: m.firstPlayerWinRate ?? null,
    })),
    ...(raw.archetypeMatchups ?? []).map((m) => ({
      grain: "archetype",
      keyA: m.archetypeIdA,
      keyB: m.archetypeIdB,
      games: m.games,
      winRate: m.winRate,
      firstPlayerWinRate: m.firstPlayerWinRate ?? null,
    })),
  ];

  return { snapshot, archetypes, matchups };
}
