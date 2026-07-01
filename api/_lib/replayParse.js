import JSZip from "jszip";
import { gunzipSync } from "node:zlib";

/**
 * Lorcana replay parser — supports multiple input formats:
 *   .match-replay.zip  — zip containing match.json + game-NN_*.replay.gz files
 *   .replay.gz         — single gzip-compressed per-game replay (duels-replay-v1)
 *   .json              — raw match or game JSON object
 *
 * All paths normalize to: { games[], perspectivePlayer, playerNames, matchWinner, matchScore, source }
 *
 * Per-game replay shape (duels-replay-v1, decompressed):
 *   { format, gameId, perspective (1|2), playerNames, winner, victoryReason,
 *     turnCount, decklist: ["11-38",...], baseSnapshot, frames[], logs[] }
 *
 *   frames[]: { seq, actionType, player (1|2), turnNumber, takenAction, patch[] }
 *   takenAction shapes:
 *     PLAY_CARD:        { cardId, cardName, cardType, source }
 *     QUEST:            { cardId, cardName, loreGained, newLoreTotal }
 *     ATTACK:           { type:"CHALLENGE", attackerName, defenderName, defenderBanished, attackerBanished }
 *     ADD_TO_INK/BOOST/ACTIVATE_ABILITY: { cardId, cardName }
 */

const SUPPORTED_MATCH_FORMATS = new Set(["duels-match-replay-v1"]);

// -------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------

/**
 * Universal entry point. Accepts .match-replay.zip, a single .replay.gz,
 * or a raw JSON match/game buffer. Dispatches by magic bytes.
 * @param {Buffer|Uint8Array|ArrayBuffer} buffer
 * @param {string} [filename]  optional hint (not relied on for dispatch)
 */
export async function parseReplayBuffer(buffer, filename = "") {
  if (!buffer) throw new Error("parseReplayBuffer: empty buffer");
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  const fmt = sniffFormat(buf);
  if (fmt === "zip") return parseReplayZip(buf);
  if (fmt === "gz")  return parseSingleGameGz(buf);
  if (fmt === "json") return parseSingleGameJson(buf.toString("utf8"));

  throw new Error(
    `Unrecognized replay format — expected a .zip, .gz, or .json file` +
    (filename ? ` (got: ${filename})` : "")
  );
}

/** Parse a .match-replay.zip directly (kept as named export). */
export async function parseReplayZip(buffer) {
  if (!buffer) throw new Error("parseReplayZip: empty buffer");
  const zip = await JSZip.loadAsync(buffer);

  const matchFile = zip.file("match.json");
  if (!matchFile) throw new Error("parseReplayZip: match.json not found in archive");

  let match;
  try {
    match = JSON.parse(await matchFile.async("string"));
  } catch {
    throw new Error("parseReplayZip: match.json is not valid JSON");
  }

  if (!SUPPORTED_MATCH_FORMATS.has(match.format)) {
    throw new Error(`parseReplayZip: unsupported format "${match.format ?? "unknown"}"`);
  }

  return summarizeMatchZip(zip, match);
}

// -------------------------------------------------------------------
// Format detection
// -------------------------------------------------------------------

function sniffFormat(buf) {
  // GZ: 1f 8b
  if (buf[0] === 0x1f && buf[1] === 0x8b) return "gz";
  // ZIP: PK (50 4b)
  if (buf[0] === 0x50 && buf[1] === 0x4b) return "zip";
  // JSON: starts with { or [ (possibly after BOM/whitespace)
  const head = buf.slice(0, 4).toString("utf8").trimStart();
  if (head[0] === "{" || head[0] === "[") return "json";
  return "unknown";
}

// -------------------------------------------------------------------
// Single .replay.gz
// -------------------------------------------------------------------

function parseSingleGameGz(buf) {
  let json;
  try {
    json = gunzipSync(buf).toString("utf8");
  } catch {
    throw new Error("parseSingleGameGz: failed to decompress — not a valid gzip file");
  }
  return parseSingleGameJson(json);
}

// -------------------------------------------------------------------
// Raw JSON (single game or match object)
// -------------------------------------------------------------------

function parseSingleGameJson(json) {
  let obj;
  try {
    obj = JSON.parse(json);
  } catch {
    throw new Error("parseSingleGameJson: not valid JSON");
  }

  // Looks like a match-level object.
  if (obj.format === "duels-match-replay-v1" || (obj.games && !obj.frames)) {
    return wrapMatchObject(obj);
  }

  // Treat as a single per-game replay (has frames[]).
  const myNum = obj.perspective ?? 1;
  const oppNum = myNum === 1 ? 2 : 1;
  const pNames = obj.playerNames || {};
  const myName = pNames[String(myNum)] ?? "Player 1";
  const oppName = pNames[String(oppNum)] ?? "Player 2";

  const game = normalizeGame(obj, { gameNumber: 1 }, myNum, myName, oppName);

  return {
    games: [game],
    perspectivePlayer: myName,
    playerNames: { me: myName, opp: oppName },
    matchWinner: null,
    matchScore: null,
    source: "duels.ink",
  };
}

// -------------------------------------------------------------------
// Bare match object (no zip, game files may be embedded or stubs)
// -------------------------------------------------------------------

function wrapMatchObject(match) {
  const myNum = match.perspective ?? 1;
  const oppNum = myNum === 1 ? 2 : 1;
  const pNames = match.playerNames || {};
  const myName = pNames[String(myNum)] ?? "Player 1";
  const oppName = pNames[String(oppNum)] ?? "Player 2";

  const games = (match.games || []).map((g, i) => {
    if (Array.isArray(g.frames)) {
      return normalizeGame(g, g, myNum, myName, oppName);
    }
    // Metadata-only stub — skeleton with no events.
    return {
      gameNumber: g.gameNumber ?? i + 1,
      winner: g.winner === myNum ? myName : g.winner === oppNum ? oppName : null,
      victoryReason: g.victoryReason ?? null,
      result: g.winner === myNum ? "W" : g.winner === oppNum ? "L" : null,
      turnCount: 0,
      loreCurve: [],
      decklistMe: [],
      events: [],
      logs: [],
      deckArchetype: null,
      vsArchetype: null,
      playerNames: { me: myName, opp: oppName },
    };
  });

  const lastMeta = (match.games || []).slice(-1)[0];
  const score = lastMeta?.matchScoreAfter
    ? `${lastMeta.matchScoreAfter.player1}-${lastMeta.matchScoreAfter.player2}`
    : null;
  const mw = match.matchWinner;
  const matchWinner = mw === myNum ? myName : mw === oppNum ? oppName : null;

  return {
    games,
    perspectivePlayer: myName,
    playerNames: { me: myName, opp: oppName },
    matchWinner,
    matchScore: score,
    source: "duels.ink",
  };
}

// -------------------------------------------------------------------
// .match-replay.zip internals
// -------------------------------------------------------------------

async function summarizeMatchZip(zip, match) {
  const myNum = match.perspective ?? 1;
  const oppNum = myNum === 1 ? 2 : 1;
  const pNames = match.playerNames || {};
  const myName = pNames[String(myNum)] ?? `Player ${myNum}`;
  const oppName = pNames[String(oppNum)] ?? `Player ${oppNum}`;

  const gameEntries = [];
  zip.forEach((relativePath, entry) => {
    if (/(^|\/)game-\d+.*\.replay\.gz$/i.test(relativePath)) {
      const m = relativePath.match(/game-(\d+)/i);
      gameEntries.push({ entry, num: m ? parseInt(m[1], 10) : 0 });
    }
  });
  gameEntries.sort((a, b) => a.num - b.num);

  const matchGamesMeta = match.games || [];
  const games = [];
  for (let i = 0; i < gameEntries.length; i++) {
    const gz = await gameEntries[i].entry.async("nodebuffer");
    let gameData;
    try {
      gameData = JSON.parse(gunzipSync(gz).toString("utf8"));
    } catch {
      continue;
    }
    games.push(normalizeGame(gameData, matchGamesMeta[i] ?? {}, myNum, myName, oppName));
  }

  const lastMeta = matchGamesMeta[matchGamesMeta.length - 1];
  const score = lastMeta?.matchScoreAfter
    ? `${lastMeta.matchScoreAfter.player1}-${lastMeta.matchScoreAfter.player2}`
    : null;
  const mw = match.matchWinner;
  const matchWinner = mw === myNum ? myName : mw === oppNum ? oppName : null;

  return {
    games,
    perspectivePlayer: myName,
    playerNames: { me: myName, opp: oppName },
    matchWinner,
    matchScore: score,
    source: "duels.ink",
  };
}

// -------------------------------------------------------------------
// Core game normalizer — shared by all paths
// -------------------------------------------------------------------

function normalizeGame(game, gameMeta, myPlayerNum, myName, oppName) {
  const frames = game.frames || [];
  const meNum = game.perspective ?? myPlayerNum;
  const oppNum = meNum === 1 ? 2 : 1;

  const decklistMe = Array.isArray(game.decklist) ? [...game.decklist] : [];

  const INCLUDE_TYPES = new Set(["PLAY_CARD", "QUEST", "ATTACK", "ADD_TO_INK", "BOOST", "ACTIVATE_ABILITY"]);
  const events = [];

  for (const frame of frames) {
    const ta = frame.takenAction;
    if (!ta) continue;
    const actionType = frame.actionType || ta.type || "";
    if (!INCLUDE_TYPES.has(actionType)) continue;

    const playerLabel = frame.player === meNum ? "me" : "opp";

    if (actionType === "ATTACK") {
      const aName = ta.attackerName ?? ta.attackerCardId ?? "?";
      const dName = ta.defenderName ?? ta.defenderCardId ?? "?";
      const outcome =
        ta.defenderBanished && ta.attackerBanished ? "both banished" :
        ta.defenderBanished ? "defender banished" :
        ta.attackerBanished ? "attacker banished" : "no banishment";
      events.push({
        turn: frame.turnNumber,
        player: playerLabel,
        type: "challenge",
        action: `challenged ${dName} with ${aName} (${outcome})`,
        card: aName,
        target: dName,
        attackerBanished: ta.attackerBanished ?? false,
        defenderBanished: ta.defenderBanished ?? false,
      });
    } else if (actionType === "QUEST") {
      const cardName = ta.cardName ?? ta.cardId ?? "?";
      events.push({
        turn: frame.turnNumber,
        player: playerLabel,
        type: "quest",
        action: `quested with ${cardName} (+${ta.loreGained ?? "?"} lore, total: ${ta.newLoreTotal ?? "?"})`,
        card: cardName,
        loreGained: ta.loreGained,
        newLoreTotal: ta.newLoreTotal,
      });
    } else {
      const cardName = ta.cardName ?? ta.cardId ?? "?";
      const verb =
        actionType === "PLAY_CARD" ? "played" :
        actionType === "ADD_TO_INK" ? "inked" :
        actionType === "BOOST" ? "boosted" :
        actionType === "ACTIVATE_ABILITY" ? "activated ability of" :
        actionType.toLowerCase();
      events.push({
        turn: frame.turnNumber,
        player: playerLabel,
        type: actionType.toLowerCase(),
        action: `${verb} ${cardName}`,
        card: cardName,
      });
    }
  }

  // Lore curve from QUEST newLoreTotal values.
  const loreTotals = { me: {}, opp: {} };
  for (const frame of frames) {
    const ta = frame.takenAction;
    if (!ta || frame.actionType !== "QUEST" || ta.newLoreTotal == null) continue;
    const side = frame.player === meNum ? "me" : "opp";
    loreTotals[side][frame.turnNumber] = ta.newLoreTotal;
  }

  const turnCount = game.turnCount ?? frames.reduce((max, f) => Math.max(max, f.turnNumber || 0), 0);
  const loreCurve = [];
  let lastMe = 0, lastOpp = 0;
  for (let t = 1; t <= turnCount; t++) {
    if (loreTotals.me[t] != null) lastMe = loreTotals.me[t];
    if (loreTotals.opp[t] != null) lastOpp = loreTotals.opp[t];
    loreCurve.push({ turn: t, you: lastMe, opp: lastOpp });
  }

  // Detect ink colors from card data embedded in PLAY_CARD patches.
  const myColors = new Set();
  const oppColors = new Set();
  for (const frame of frames) {
    if (frame.actionType !== "PLAY_CARD") continue;
    for (const op of frame.patch || []) {
      if (op.op === "add" && Array.isArray(op.value?.colors)) {
        const target = frame.player === meNum ? myColors : oppColors;
        for (const c of op.value.colors) target.add(c);
      }
    }
  }
  const colorsToArchetype = (colors) => {
    if (!colors.size) return null;
    return [...colors].map((c) => c.charAt(0).toUpperCase() + c.slice(1)).sort().join("/");
  };

  const logs = (game.logs || []).map((l) => ({
    turn: l.turnNumber,
    player: l.player === meNum ? "me" : "opp",
    type: l.type,
    message: l.message,
  }));

  const winnerNum = game.winner ?? gameMeta.winner ?? null;
  const result = winnerNum === meNum ? "W" : winnerNum === oppNum ? "L" : null;

  return {
    gameNumber: gameMeta.gameNumber ?? null,
    winner: winnerNum === meNum ? myName : winnerNum === oppNum ? oppName : null,
    victoryReason: game.victoryReason ?? gameMeta.victoryReason ?? null,
    result,
    turnCount,
    loreCurve,
    decklistMe,
    events,
    logs,
    deckArchetype: colorsToArchetype(myColors),
    vsArchetype: colorsToArchetype(oppColors),
    playerNames: { me: myName, opp: oppName },
  };
}
