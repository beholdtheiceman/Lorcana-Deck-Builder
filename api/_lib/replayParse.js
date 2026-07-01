import JSZip from "jszip";
import { gunzipSync } from "node:zlib";

/**
 * Lorcana ".match-replay.zip" parser — validated against real replay files.
 *
 * Archive layout:
 *   match.json                      -> match-level metadata (duels-match-replay-v1)
 *   game-01_<slug>.replay.gz        -> gzip-compressed per-game replay (duels-replay-v1)
 *   game-02_<slug>.replay.gz
 *
 * match.json shape:
 *   { format, matchId, perspective (1|2), playerNames: {"1":"..","2":".."},
 *     matchWinner, matchFormat, games: [{gameNumber, winner, victoryReason, matchScoreAfter}] }
 *
 * Per-game replay shape (decompressed):
 *   { format:"duels-replay-v1", gameId, perspective (1|2), playerNames, winner,
 *     victoryReason, turnCount, decklist: ["11-38","12-46",...], baseSnapshot, frames, logs }
 *
 *   frames[]: { seq, actionType, player (1|2), turnNumber, takenAction, patch }
 *   takenAction shapes by actionType:
 *     PLAY_CARD:   { type, player, cardId, cardName, cardType, source }
 *     QUEST:       { type, player, cardId, cardName, loreGained, newLoreTotal }
 *     ATTACK:      { type:"CHALLENGE", player, attackerName, defenderName,
 *                    defenderBanished, attackerBanished }
 *     ADD_TO_INK:  { type, player, cardId, cardName }
 *     BOOST:       { type, player, cardId, cardName }
 *     ACTIVATE_ABILITY: { type, player, cardId, cardName }
 *
 *   logs[]: { id, timestamp, turnNumber, player, type, message, cardRefs?, data? }
 */

const SUPPORTED_FORMATS = new Set(["duels-match-replay-v1"]);

/**
 * Parse a .match-replay.zip buffer into a normalized summary.
 * @param {Buffer|Uint8Array|ArrayBuffer} buffer
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
  } catch {
    throw new Error("parseReplayZip: match.json is not valid JSON");
  }

  if (!SUPPORTED_FORMATS.has(match.format)) {
    throw new Error(`parseReplayZip: unsupported replay format "${match.format ?? "unknown"}"`);
  }

  return summarizeV1(zip, match);
}

async function summarizeV1(zip, match) {
  const myPlayerNum = match.perspective ?? 1;
  const oppPlayerNum = myPlayerNum === 1 ? 2 : 1;
  const playerNames = match.playerNames || {};
  const myName = playerNames[String(myPlayerNum)] ?? `Player ${myPlayerNum}`;
  const oppName = playerNames[String(oppPlayerNum)] ?? `Player ${oppPlayerNum}`;

  // Collect game-NN_*.replay.gz entries sorted by game number.
  const gameEntries = [];
  zip.forEach((relativePath, entry) => {
    if (/(^|\/)game-\d+.*\.replay\.gz$/i.test(relativePath)) {
      const m = relativePath.match(/game-(\d+)/i);
      gameEntries.push({ path: relativePath, entry, num: m ? parseInt(m[1], 10) : 0 });
    }
  });
  gameEntries.sort((a, b) => a.num - b.num);

  const matchGamesMeta = match.games || [];
  const games = [];
  for (let i = 0; i < gameEntries.length; i++) {
    const { entry } = gameEntries[i];
    const gz = await entry.async("nodebuffer");
    let gameData;
    try {
      gameData = JSON.parse(gunzipSync(gz).toString("utf8"));
    } catch {
      continue;
    }
    const gameMeta = matchGamesMeta[i] ?? {};
    games.push(normalizeGame(gameData, gameMeta, myPlayerNum, myName, oppName));
  }

  const lastGame = matchGamesMeta[matchGamesMeta.length - 1];
  const score = lastGame?.matchScoreAfter
    ? `${lastGame.matchScoreAfter.player1}-${lastGame.matchScoreAfter.player2}`
    : null;
  const mw = match.matchWinner;
  const matchWinner = mw === myPlayerNum ? myName : mw === oppPlayerNum ? oppName : null;

  return {
    games,
    perspectivePlayer: myName,
    playerNames: { me: myName, opp: oppName },
    matchWinner,
    matchScore: score,
    source: "duels.ink",
  };
}

function normalizeGame(game, gameMeta, myPlayerNum, myName, oppName) {
  const frames = game.frames || [];
  const meNum = game.perspective ?? myPlayerNum;
  const oppNum = meNum === 1 ? 2 : 1;

  // Decklist — only my deck is visible in POV replay.
  const decklistMe = Array.isArray(game.decklist) ? [...game.decklist] : [];

  // Build events from takenAction on each frame.
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
      const outcome = ta.defenderBanished && ta.attackerBanished
        ? "both banished"
        : ta.defenderBanished
        ? "defender banished"
        : ta.attackerBanished
        ? "attacker banished"
        : "no banishment";
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

  // Lore curve: track per-turn lore totals from QUEST frames.
  const loreTotals = { me: {}, opp: {} };
  for (const frame of frames) {
    const ta = frame.takenAction;
    if (!ta || frame.actionType !== "QUEST" || ta.newLoreTotal == null) continue;
    const side = frame.player === meNum ? "me" : "opp";
    loreTotals[side][frame.turnNumber] = ta.newLoreTotal;
  }

  const turnCount =
    game.turnCount ??
    frames.reduce((max, f) => Math.max(max, f.turnNumber || 0), 0);

  const loreCurve = [];
  let lastMe = 0;
  let lastOpp = 0;
  for (let t = 1; t <= turnCount; t++) {
    if (loreTotals.me[t] != null) lastMe = loreTotals.me[t];
    if (loreTotals.opp[t] != null) lastOpp = loreTotals.opp[t];
    loreCurve.push({ turn: t, you: lastMe, opp: lastOpp });
  }

  // Detect ink colors from PLAY_CARD patch additions.
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
    return [...colors]
      .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
      .sort()
      .join("/");
  };

  // Human-readable log lines from the logs array.
  const logs = (game.logs || []).map((l) => ({
    turn: l.turnNumber,
    player: l.player === meNum ? "me" : "opp",
    type: l.type,
    message: l.message,
  }));

  const winnerNum = game.winner ?? gameMeta.winner ?? null;
  const result = winnerNum === meNum ? "W" : winnerNum === oppNum ? "L" : null;

  return {
    gameNumber: gameMeta.gameNumber ?? null, // from match.json games[] array
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
