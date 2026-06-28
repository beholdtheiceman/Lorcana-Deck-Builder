import JSZip from "jszip";
import { gunzipSync } from "node:zlib";

/**
 * Lorcana ".match-replay.zip" parser.
 *
 * !!! IMPORTANT — UNVERIFIED FORMAT !!!
 * This parser is written against the *documented* duels match-replay layout.
 * No real sample replay was available at implementation time, so every field
 * path, enum value, and event shape below is a best-effort guess and MUST be
 * validated against a real exported replay before being trusted in production.
 * Where the real format diverges, adjust the field accessors in
 * `normalizeGameV1` / `summarizeV1` rather than the public contract.
 *
 * Expected archive layout (documented):
 *   match.json                      -> match-level metadata
 *   game-01_<slug>.replay.gz        -> gzip-compressed per-game event log (JSON)
 *   game-02_<slug>.replay.gz
 *   ...
 *
 * match.json (documented "duels-match-replay-v1"):
 *   {
 *     "format": "duels-match-replay-v1",
 *     "matchId": "abc123",
 *     "gameFormat": "Core",                 // Core | Infinity
 *     "source": "duels.ink",
 *     "perspectivePlayer": "Larry",         // whose POV "me" refers to
 *     "players": [{ "name": "Larry", "seat": 0 }, { "name": "Opp", "seat": 1 }],
 *     "result": { "winner": "Larry", "score": "2-1" },
 *     "cardRefs": { "0": "10-60", "1": "6-200", ... }  // ref index -> setNum-cardNum
 *   }
 *
 * Each decompressed game .replay (documented):
 *   {
 *     "gameNumber": 1,
 *     "winner": "Larry",
 *     "victoryReason": "lore",            // lore | deckout | concede
 *     "turns": 14,
 *     "cardRefs": { ... },                // optional per-game override of match cardRefs
 *     "loreCurve": { "Larry": [0,1,3,..], "Opp": [0,0,2,..] },
 *     "decklists": { "Larry": [{card:0}, {card:1}, ...], "Opp": [...] },
 *     "events": [
 *       { "turn": 1, "player": "Larry", "type": "play",  "card": {card:0} },
 *       { "turn": 1, "player": "Larry", "type": "quest", "card": {card:3} },
 *       ...
 *     ]
 *   }
 */

const SUPPORTED_FORMATS = new Set(["duels-match-replay-v1"]);

/**
 * Resolve a `{card:N}` reference (or a bare index / already-resolved string)
 * to a "setNum-cardNum" id using the provided cardRefs map. Returns null when
 * it cannot be resolved so callers can decide how to handle gaps.
 */
function resolveCardRef(ref, cardRefs) {
  if (ref == null) return null;
  // Already a resolved id like "10-60".
  if (typeof ref === "string") {
    return cardRefs[ref] ?? ref;
  }
  // Bare numeric index.
  if (typeof ref === "number") {
    return cardRefs[String(ref)] ?? null;
  }
  // Documented `{card:N}` shape.
  if (typeof ref === "object" && "card" in ref) {
    return cardRefs[String(ref.card)] ?? null;
  }
  return null;
}

/** Determine "me"/"opp" mapping from the perspective player name. */
function sidesFor(players, perspectivePlayer) {
  const names = (players || []).map((p) => (typeof p === "string" ? p : p?.name)).filter(Boolean);
  const me = perspectivePlayer && names.includes(perspectivePlayer) ? perspectivePlayer : names[0] ?? null;
  const opp = names.find((n) => n !== me) ?? null;
  return { me, opp };
}

/** Build the loreCurve {me,opp} arrays from a game's per-player curves. */
function loreCurveFor(game, me, opp) {
  const curves = game.loreCurve || {};
  return {
    me: Array.isArray(curves[me]) ? curves[me] : [],
    opp: Array.isArray(curves[opp]) ? curves[opp] : [],
  };
}

/** Normalize one decompressed game object into the summary game shape. */
function normalizeGameV1(game, matchCardRefs, sides) {
  // Per-game cardRefs (if present) override/extend the match-level map.
  const cardRefs = { ...matchCardRefs, ...(game.cardRefs || {}) };
  const { me, opp } = sides;

  const decklistRaw = (game.decklists && game.decklists[me]) || [];
  const decklistMe = decklistRaw
    .map((ref) => resolveCardRef(ref, cardRefs))
    .filter((id) => id != null);

  const events = (game.events || []).map((ev) => ({
    turn: ev.turn ?? null,
    player: ev.player ?? null,
    type: ev.type ?? null,
    card: resolveCardRef(ev.card, cardRefs),
  }));

  return {
    gameNumber: game.gameNumber ?? null,
    winner: game.winner ?? null,
    victoryReason: game.victoryReason ?? null,
    turns: game.turns ?? null,
    loreCurve: loreCurveFor(game, me, opp),
    decklistMe,
    events,
  };
}

/**
 * Parse a .match-replay.zip buffer into a normalized summary.
 *
 * @param {Buffer|Uint8Array|ArrayBuffer} buffer raw zip bytes
 * @returns {Promise<{ games: Array, perspectivePlayer: string|null }>}
 */
export async function parseReplayZip(buffer) {
  if (!buffer) throw new Error("parseReplayZip: empty buffer");

  const zip = await JSZip.loadAsync(buffer);

  const matchFile = zip.file("match.json");
  if (!matchFile) throw new Error("parseReplayZip: match.json not found in archive");

  let match;
  try {
    match = JSON.parse(await matchFile.async("string"));
  } catch (err) {
    throw new Error("parseReplayZip: match.json is not valid JSON");
  }

  // Version branch. Only v1 is documented/handled today.
  if (!SUPPORTED_FORMATS.has(match.format)) {
    throw new Error(`parseReplayZip: unsupported replay format "${match.format ?? "unknown"}"`);
  }

  return summarizeV1(zip, match);
}

async function summarizeV1(zip, match) {
  const matchCardRefs = match.cardRefs || {};
  const perspectivePlayer = match.perspectivePlayer ?? null;
  const sides = sidesFor(match.players, perspectivePlayer);

  // Collect game-NN_*.replay.gz entries, sorted by game number.
  const gameEntries = [];
  zip.forEach((relativePath, entry) => {
    if (/(^|\/)game-\d+.*\.replay\.gz$/i.test(relativePath)) {
      const m = relativePath.match(/game-(\d+)/i);
      gameEntries.push({ path: relativePath, entry, num: m ? parseInt(m[1], 10) : 0 });
    }
  });
  gameEntries.sort((a, b) => a.num - b.num);

  const games = [];
  for (const { entry } of gameEntries) {
    const gz = await entry.async("nodebuffer");
    let game;
    try {
      game = JSON.parse(gunzipSync(gz).toString("utf8"));
    } catch (err) {
      // Skip a corrupt/unparseable game rather than failing the whole match.
      continue;
    }
    games.push(normalizeGameV1(game, matchCardRefs, sides));
  }

  return { games, perspectivePlayer };
}
