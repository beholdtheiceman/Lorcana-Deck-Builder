import { getById } from "./cards.js";

/**
 * Builds the grounding context string handed to the LLM (or stored alongside an
 * agent import) for a single game review.
 *
 * It renders, in order:
 *   1. A header (perspective player + result + game number + matchup).
 *   2. The matchup primer (verdict / gameplan / mustKill / mistakes / keyCards).
 *   3. A card oracle glossary for every card referenced by the game log (and the
 *      primer's key cards), each shown as "Name — <oracle bodyText>". Any id the
 *      oracle does not know is rendered as "unknown — do not infer".
 *   4. The rendered game log.
 *
 * The parsed replay shape is intentionally treated defensively because the
 * Phase 3 parser may emit slightly different field names across sources.
 *
 * @returns {Promise<string>}
 */
export async function buildReviewContext({ replay, primer, gameNumber } = {}) {
  const parsed = (replay && replay.parsed) || {};
  const game = findGame(parsed, gameNumber);

  const perspective =
    pick(game, ["player", "perspective", "playerName", "hero"]) ??
    (replay && replay.playerName) ??
    "unknown";
  const result =
    pick(game, ["result", "matchResult", "outcome"]) ??
    (replay && replay.matchResult) ??
    "unknown";

  const entries = logEntriesOf(game);

  // Collect every card id referenced by the log, in first-seen order.
  const referenced = [];
  const seen = new Set();
  const addId = (id) => {
    if (typeof id === "string" && id && !seen.has(id)) {
      seen.add(id);
      referenced.push(id);
    }
  };
  for (const e of entries) for (const id of cardIdsOf(e)) addId(id);

  // Primer key cards are referenced too; include their ids in the glossary.
  const keyCards = Array.isArray(primer && primer.keyCards) ? primer.keyCards : [];
  for (const kc of keyCards) addId(kc && kc.id);

  // Resolve oracle text for every referenced card once.
  const oracle = new Map();
  await Promise.all(
    referenced.map(async (id) => {
      oracle.set(id, await renderCard(id));
    })
  );

  const out = [];
  out.push("=== GAME REVIEW CONTEXT ===");
  out.push(`Perspective player: ${perspective}`);
  out.push(`Result: ${result}`);
  if (gameNumber != null) out.push(`Game: ${gameNumber}`);
  if (primer) {
    const da = primer.deckArchetype ?? "?";
    const va = primer.vsArchetype ?? "?";
    out.push(`Matchup: ${da} vs ${va}`);
  }
  out.push("");

  out.push("--- MATCHUP PRIMER ---");
  if (primer) {
    if (primer.verdict) out.push(`Verdict: ${primer.verdict}`);
    if (primer.confidence) out.push(`Confidence: ${primer.confidence}`);
    if (primer.gameplan) out.push(`Game plan: ${primer.gameplan}`);
    if (primer.mustKill) out.push(`Must-kill: ${primer.mustKill}`);
    if (primer.mistakes) out.push(`Common mistakes: ${primer.mistakes}`);
    if (keyCards.length) {
      out.push("Key cards:");
      for (const kc of keyCards) {
        const name = (kc && kc.name) || (kc && kc.id) || "unknown";
        const note = kc && kc.note ? ` — ${kc.note}` : "";
        out.push(`  - ${name}${note}`);
      }
    }
  } else {
    out.push("(no primer supplied)");
  }
  out.push("");

  out.push("--- CARD ORACLE (cards referenced this game) ---");
  if (referenced.length) {
    for (const id of referenced) out.push(oracle.get(id));
  } else {
    out.push("(no cards referenced)");
  }
  out.push("");

  out.push("--- GAME LOG ---");
  if (entries.length) {
    for (const e of entries) out.push(renderEntry(e, oracle));
  } else {
    out.push("(empty game log)");
  }

  return out.join("\n");
}

/** Resolve a card id to "Name — <bodyText>", or "unknown — do not infer". */
async function renderCard(id) {
  let card = null;
  try {
    card = await getById(id);
  } catch {
    card = null;
  }
  if (!card) return "unknown — do not infer";
  const name = card.name ?? "unknown";
  const body = card.bodyText ?? card.body ?? "";
  return `${name} — ${body}`.trimEnd();
}

/** Select the game matching gameNumber from a parsed replay, defensively. */
function findGame(parsed, gameNumber) {
  const games =
    (Array.isArray(parsed.games) && parsed.games) ||
    (Array.isArray(parsed.matches) && parsed.matches) ||
    null;
  if (!games || games.length === 0) {
    // Treat the parsed object itself as a single game.
    return parsed || {};
  }
  if (gameNumber != null) {
    const byField = games.find((g) => g && Number(g.gameNumber) === Number(gameNumber));
    if (byField) return byField;
    const byIndex = games[Number(gameNumber) - 1];
    if (byIndex) return byIndex;
  }
  return games[0];
}

/** Extract the ordered log entries from a game, across possible field names. */
function logEntriesOf(game) {
  if (!game || typeof game !== "object") return [];
  const log = game.log || game.events || game.lines || game.plays || game.turns;
  return Array.isArray(log) ? log : [];
}

/** Collect card ids referenced by a single log entry. */
function cardIdsOf(entry) {
  const ids = [];
  if (!entry || typeof entry !== "object") return ids;
  const push = (v) => {
    if (typeof v === "string") ids.push(v);
    else if (v && typeof v === "object" && typeof v.id === "string") ids.push(v.id);
  };
  if (entry.cardId != null) push(entry.cardId);
  if (entry.card != null) push(entry.card);
  if (Array.isArray(entry.cardIds)) entry.cardIds.forEach(push);
  if (Array.isArray(entry.cards)) entry.cards.forEach(push);
  return ids;
}

/** Render one log entry as a single line, appending referenced card names. */
function renderEntry(entry, oracle) {
  if (entry == null) return "";
  if (typeof entry === "string") return entry;

  const turn = entry.turn ?? entry.t ?? entry.turnNumber;
  const player = entry.player ?? entry.actor ?? entry.who ?? entry.side;
  const action =
    entry.action ?? entry.text ?? entry.description ?? entry.event ?? entry.desc ?? "";

  const ids = cardIdsOf(entry);
  const cardNames = ids
    .map((id) => {
      const label = oracle.get(id);
      // Glossary label is "Name — body"; surface just the name inline.
      const name = label ? label.split(" — ")[0] : id;
      return name;
    })
    .filter(Boolean);

  const head = [];
  if (turn != null) head.push(`T${turn}`);
  if (player) head.push(String(player));
  const prefix = head.length ? `${head.join(" ")}: ` : "";
  const cards = cardNames.length ? ` [cards: ${cardNames.join(", ")}]` : "";
  const body = action || (ids.length ? "" : JSON.stringify(entry));
  return `${prefix}${body}${cards}`.trimEnd();
}

/** Return the first present, non-empty value among keys. */
function pick(obj, keys) {
  if (!obj || typeof obj !== "object") return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (v != null && v !== "") return v;
  }
  return undefined;
}
