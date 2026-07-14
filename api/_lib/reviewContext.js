import { getById, getByName } from "./cards.js";
import { buildKnowledgeBundle } from "./agentKnowledge.js";
import {
  summarizeDecklist,
  renderDeckSection,
  collectOpponentRevealed,
  renderOpponentSection,
  resolveWithEvidence,
} from "./deckContext.js";

// The tool-less review model can't fetch knowledge, so we inject the reasoning
// frameworks the coach prompt tells it to use (role assignment, board reading,
// in-game heuristics). role-theory is first (highest priority, smallest); the
// bundle is capped so it can't crowd the game log out of the context budget.
const REVIEW_FRAMEWORK_FILES = [
  "role-theory.md",
  "game-state-evaluation.md",
  "gameplay-heuristics.md",
];
const FRAMEWORK_CAP = 22000;

/**
 * Builds the grounding context string handed to the LLM (or stored alongside an
 * agent import) for a single game review.
 *
 * It renders, in order:
 *   1. A header (perspective player + result + game number + matchup).
 *   2. The matchup primer (verdict / gameplan / mustKill / mistakes / keyCards).
 *   3. The player's full deck list (from the replay's decklist) + a profile
 *      (inks, curve, type mix), and the opponent's revealed cards.
 *   4. A card oracle glossary for every card referenced by the game log, the
 *      player's deck, and the primer's key cards, each shown as
 *      "Name — <oracle bodyText>".
 *   5. The rendered game log. When maxChars is given, the EARLIEST log entries
 *      are elided to fit — the endgame is where reviews are decided, so the
 *      tail is always preserved.
 *
 * The parsed replay shape is intentionally treated defensively because the
 * Phase 3 parser may emit slightly different field names across sources.
 *
 * @returns {Promise<string>}
 */
export async function buildReviewContext({ replay, primer, gameNumber, maxChars } = {}) {
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

  // id → name pairs the replay itself asserts (drawn from ALL games of the
  // match, not just this one) — used to detect id-numbering mismatches
  // between the replay source and local card data.
  const evidence = collectNameEvidence(parsed, game);

  // The player's deck list (duels.ink replays carry it as "set-num" ids).
  const deckSummary = summarizeDecklist(game && game.decklistMe, evidence);
  // Deck cards belong in the glossary too — the coach must know what the
  // player was drawing toward, not just what hit the table. Cards whose
  // identity could not be verified are excluded: wrong card text is worse
  // than no card text.
  if (deckSummary) {
    for (const { id, unverified } of deckSummary.cards) {
      if (!unverified) addId(id);
    }
  }

  // The opponent's revealed cards (the honest limit of what a replay knows).
  const oppRevealed = collectOpponentRevealed(game);
  for (const r of oppRevealed) addId(r.key);

  // Primer key cards are referenced too; include their ids in the glossary.
  const keyCards = Array.isArray(primer && primer.keyCards) ? primer.keyCards : [];
  for (const kc of keyCards) addId(kc && kc.id);

  // Resolve oracle text for every referenced card once.
  const oracle = new Map();
  await Promise.all(
    referenced.map(async (id) => {
      oracle.set(id, await renderCard(id, evidence.get(id)));
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
    if (primer.role) out.push(`Role (perspective player): ${primer.role}`);
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

  // Reasoning frameworks the review model must apply (it can't fetch them).
  const frameworks = buildKnowledgeBundle(REVIEW_FRAMEWORK_FILES, { totalCap: FRAMEWORK_CAP });
  if (frameworks.trim()) {
    out.push("--- STRATEGY FRAMEWORKS (apply these; do not judge decisions in a vacuum) ---");
    out.push(frameworks.trim());
    out.push("");
  }

  const deckSection = renderDeckSection(deckSummary);
  if (deckSection) {
    out.push(deckSection);
    out.push("");
  }

  const oppSection = renderOpponentSection(oppRevealed);
  if (oppSection) {
    out.push(oppSection);
    out.push("");
  }

  out.push("--- CARD ORACLE (cards in this game and the player's deck) ---");
  if (referenced.length) {
    for (const id of referenced) out.push(oracle.get(id));
  } else {
    out.push("(no cards referenced)");
  }
  out.push("");

  out.push("--- GAME LOG ---");
  const logLines = entries.length
    ? entries.map((e) => renderEntry(e, oracle))
    : ["(empty game log)"];

  // Budget-aware log assembly: when the context would overflow, drop the
  // EARLIEST log lines (the endgame decides reviews) rather than the tail.
  if (typeof maxChars === "number" && maxChars > 0) {
    const fixed = out.join("\n").length + 1; // +1 for the joining newline
    let logBudget = maxChars - fixed - 80; // headroom for the elision marker
    const total = logLines.reduce((n, l) => n + l.length + 1, 0);
    if (total > logBudget) {
      const kept = [];
      let used = 0;
      for (let i = logLines.length - 1; i >= 0; i--) {
        const cost = logLines[i].length + 1;
        if (used + cost > logBudget) break;
        kept.unshift(logLines[i]);
        used += cost;
      }
      const dropped = logLines.length - kept.length;
      out.push(`[… ${dropped} early log entries elided to fit the context budget …]`);
      out.push(...kept);
      return out.join("\n");
    }
  }
  out.push(...logLines);

  return out.join("\n");
}

/**
 * Resolve a card id to "Name — <bodyText>". When the replay supplied a name
 * for this id (evidence), the id is only trusted if it agrees with the name —
 * some sources number sets differently than local card data.
 */
async function renderCard(id, evidenceName) {
  let card = null;
  try {
    card = resolveWithEvidence(id, evidenceName).card;
  } catch {
    card = null;
  }
  if (!card) {
    return `${evidenceName ?? id} — (not found in oracle — do not infer card text)`;
  }
  const name = card.name ?? "unknown";
  const body = card.bodyText ?? card.body ?? "";
  return `${name} — ${body}`.trimEnd();
}

/**
 * Collect id → name assertions from the replay's own events, across every
 * game of the match (a card unplayed in this game may have been played in
 * another, and the decklist is the same).
 */
function collectNameEvidence(parsed, currentGame) {
  const evidence = new Map();
  const note = (id, name) => {
    if (typeof id === "string" && id && typeof name === "string" && name && !evidence.has(id)) {
      evidence.set(id, name);
    }
  };
  const games =
    (Array.isArray(parsed && parsed.games) && parsed.games) ||
    (Array.isArray(parsed && parsed.matches) && parsed.matches) ||
    [currentGame];
  for (const g of games) {
    for (const e of logEntriesOf(g)) {
      if (!e || typeof e !== "object") continue;
      note(e.cardId, e.card);
      note(e.attackerCardId, e.card);
      note(e.defenderCardId, e.target);
    }
  }
  return evidence;
}

/** Select the game matching gameNumber from a parsed replay, defensively. */
export function findGame(parsed, gameNumber) {
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
  const hasCardId = typeof entry.cardId === "string" && entry.cardId;
  if (entry.cardId != null) push(entry.cardId);
  // entry.card is the same card's display name; only collect it when there's no
  // resolvable id, to avoid a duplicate unresolvable glossary row.
  if (!hasCardId && entry.card != null) push(entry.card);
  if (typeof entry.attackerCardId === "string" && entry.attackerCardId) push(entry.attackerCardId);
  if (typeof entry.defenderCardId === "string" && entry.defenderCardId) push(entry.defenderCardId);
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
