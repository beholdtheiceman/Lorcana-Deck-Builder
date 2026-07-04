// api/_lib/deckContext.js
// Turns a parsed replay's decklist (array of "set-num" card ids, one entry per
// copy) into (a) a compact deck section for the LLM review context and (b) an
// objective deck profile (colors, curve, type mix) used to help the model —
// and the auto-primer — understand what the deck is trying to do.
//
// Deliberately computes only verifiable facts in code; strategic interpretation
// (archetype naming, game plan) is left to the model, which sees this summary.

import { getById, getByName } from "./cards.js";

const normName = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Resolve one card id against the oracle, cross-checked against an evidence
 * name when one exists (duels.ink logs carry both cardId and cardName; the two
 * sources use different collector numbering for some sets, so an id is only
 * trusted when it agrees with the name — the name is authoritative).
 *
 * @returns {{card: object|null, corrected: boolean}}
 */
export function resolveWithEvidence(id, evidenceName) {
  const oracleCard = getById(id);
  if (evidenceName) {
    if (oracleCard && normName(oracleCard.name) === normName(evidenceName)) {
      return { card: oracleCard, corrected: false };
    }
    // Id disagrees with (or is unknown to) the oracle — trust the name.
    return { card: getByName(evidenceName), corrected: oracleCard != null };
  }
  return { card: oracleCard ?? getByName(id), corrected: false };
}

/**
 * Aggregate a decklist (["11-38", "11-38", "10-55", ...]) into unique cards
 * with counts, resolving each id through the card oracle.
 *
 * @param {string[]} decklist  one array element per physical copy
 * @param {Map<string,string>} [evidence]  id → card name pairs observed in the
 *   game log, used to detect and correct id-numbering mismatches between the
 *   replay source and the local card data. Deck cards from a set where a
 *   mismatch was observed, and which never appeared in the log themselves,
 *   are flagged `unverified` and excluded from the profile aggregates.
 * @returns {{
 *   cards: Array<{id:string, count:number, card:object|null, unverified?:boolean}>,
 *   totalCards: number, unknownIds: string[], unverifiedCount: number,
 *   colors: string[], avgCost: number|null,
 *   curve: Record<string, number>, typeCounts: Record<string, number>,
 *   inkableCount: number, profiledCards: number
 * }|null} null when the decklist is empty/absent
 */
export function summarizeDecklist(decklist, evidence) {
  if (!Array.isArray(decklist) || decklist.length === 0) return null;

  const byId = new Map();
  for (const id of decklist) {
    if (typeof id !== "string" || !id) continue;
    byId.set(id, (byId.get(id) ?? 0) + 1);
  }
  if (byId.size === 0) return null;

  // Any id in the evidence map (deck or opponent) whose oracle lookup
  // contradicts the replay's own name marks that whole set as suspect.
  const suspectSets = new Set();
  if (evidence) {
    for (const [id, name] of evidence) {
      const oracleCard = getById(id);
      if (oracleCard && normName(oracleCard.name) !== normName(name)) {
        suspectSets.add(id.split("-")[0]);
      }
    }
  }

  const cards = [];
  const unknownIds = [];
  for (const [id, count] of byId) {
    const evidenceName = evidence?.get(id);
    const { card } = resolveWithEvidence(id, evidenceName);
    if (!card) unknownIds.push(id);
    cards.push({ id, count, card, hasEvidence: Boolean(evidenceName) });
  }

  // Ink identity established by evidence-verified cards. A legal deck has at
  // most 2 inks, so once two are confirmed, an unverified card resolving
  // outside them is misidentified (id numbering differs between sources).
  const cardColors = (card) =>
    card?.color ? String(card.color).split(/[-/]/).map((c) => c.trim()).filter(Boolean) : [];
  const verifiedColors = new Set();
  for (const c of cards) {
    if (c.hasEvidence && c.card) for (const col of cardColors(c.card)) verifiedColors.add(col);
  }

  // Ids that never appeared in the log cannot be trusted when (a) their set's
  // numbering is known-misaligned, or (b) their color falls outside the deck's
  // verified ink pair — mark them so render + profile treat them honestly.
  let unverifiedCount = 0;
  for (const c of cards) {
    if (!c.hasEvidence) {
      const suspectSet = suspectSets.has(c.id.split("-")[0]);
      const offColor =
        verifiedColors.size === 2 &&
        c.card &&
        !cardColors(c.card).every((col) => verifiedColors.has(col));
      if (suspectSet || offColor) {
        c.unverified = true;
        unverifiedCount += c.count;
      }
    }
    delete c.hasEvidence;
  }

  const colors = new Set();
  const curve = {};
  const typeCounts = {};
  let totalCards = 0;
  let costSum = 0;
  let costN = 0;
  let inkableCount = 0;
  let profiledCards = 0;

  for (const { count, card, unverified } of cards) {
    totalCards += count;
    // Unverified identities would corrupt the profile (e.g. a 3-ink "deck").
    if (!card || unverified) continue;
    profiledCards += count;
    if (card.color) {
      // color may be "Ruby" or "Amber-Steel" style dual strings.
      for (const c of String(card.color).split(/[-/]/)) if (c) colors.add(c.trim());
    }
    if (typeof card.cost === "number") {
      const bucket = card.cost >= 7 ? "7+" : String(card.cost);
      curve[bucket] = (curve[bucket] ?? 0) + count;
      costSum += card.cost * count;
      costN += count;
    }
    const type = card.type || "Other";
    typeCounts[type] = (typeCounts[type] ?? 0) + count;
    if (card.inkable) inkableCount += count;
  }

  // Stable ordering for rendering: by cost, then name.
  cards.sort((a, b) => {
    const ca = a.card?.cost ?? 99;
    const cb = b.card?.cost ?? 99;
    if (ca !== cb) return ca - cb;
    return String(a.card?.name ?? a.id).localeCompare(String(b.card?.name ?? b.id));
  });

  return {
    cards,
    totalCards,
    unknownIds,
    unverifiedCount,
    profiledCards,
    colors: [...colors].sort(),
    avgCost: costN ? Math.round((costSum / costN) * 100) / 100 : null,
    curve,
    typeCounts,
    inkableCount,
  };
}

/**
 * Render the "--- YOUR DECK ---" section handed to the review model.
 * Compact one-line-per-card format; full card text lives in the shared
 * card-oracle glossary (deck ids are merged into it by the caller).
 */
export function renderDeckSection(summary, title = "YOUR DECK") {
  if (!summary) return null;
  const out = [];
  out.push(`--- ${title} (${summary.totalCards} cards) ---`);

  const profile = [];
  if (summary.colors.length) profile.push(`Inks: ${summary.colors.join("/")}`);
  if (summary.avgCost != null) profile.push(`Avg cost: ${summary.avgCost}`);
  if (summary.profiledCards) {
    profile.push(`Inkable: ${summary.inkableCount}/${summary.profiledCards}`);
  }
  if (profile.length) out.push(profile.join(" · "));
  if (summary.unverifiedCount > 0) {
    out.push(
      `NOTE: ${summary.unverifiedCount} card(s) below are marked (unverified) — their ids use a ` +
        `numbering scheme that disagreed with local card data for that set, and they never ` +
        `appeared in the log. Profile stats above cover only the ${summary.profiledCards} verified cards. ` +
        `Do not build claims on unverified identities.`
    );
  }

  const curveOrder = ["0", "1", "2", "3", "4", "5", "6", "7+"];
  const curveBits = curveOrder
    .filter((k) => summary.curve[k])
    .map((k) => `${k}:${summary.curve[k]}`);
  if (curveBits.length) out.push(`Curve: ${curveBits.join(" ")}`);

  const typeBits = Object.entries(summary.typeCounts).map(([t, n]) => `${t}: ${n}`);
  if (typeBits.length) out.push(`Types: ${typeBits.join(" · ")}`);

  out.push("Cards:");
  for (const { id, count, card, unverified } of summary.cards) {
    if (card && !unverified) {
      const bits = [];
      if (typeof card.cost === "number") bits.push(`${card.cost} ink`);
      if (card.type) bits.push(card.type);
      if (typeof card.lore === "number" && card.lore > 0) bits.push(`${card.lore} lore`);
      if (typeof card.strength === "number" && typeof card.willpower === "number") {
        bits.push(`${card.strength}/${card.willpower}`);
      }
      out.push(`  ${count}x ${card.name}${bits.length ? ` (${bits.join(", ")})` : ""}`);
    } else if (card && unverified) {
      out.push(`  ${count}x ${card.name}? (id ${id} — unverified)`);
    } else {
      out.push(`  ${count}x ${id} (not found in oracle)`);
    }
  }
  if (summary.unknownIds.length) {
    out.push(`(${summary.unknownIds.length} card id(s) could not be resolved)`);
  }
  return out.join("\n");
}

/**
 * Compact "Nx Card Name" list (one per line) — used by the auto-primer call,
 * where the full stats/curve rendering would be wasted tokens.
 */
export function renderCompactDeckList(summary) {
  if (!summary) return null;
  return summary.cards
    .map(({ id, count, card, unverified }) =>
      card && !unverified ? `${count}x ${card.name}` : `${count}x ${card ? `${card.name}?` : id} (unverified)`
    )
    .join("\n");
}

/**
 * Collect the opponent's revealed cards from a normalized game's events —
 * the honest limit of what a replay can know about the opposing deck.
 * Returns [{key, name, timesSeen}] sorted by first appearance, or [].
 */
export function collectOpponentRevealed(game) {
  const events = Array.isArray(game?.events) ? game.events : [];
  const seen = new Map(); // key -> {key, name, timesSeen}
  const note = (key, name) => {
    if (!key) return;
    const prev = seen.get(key);
    if (prev) prev.timesSeen += 1;
    else seen.set(key, { key, name: name || key, timesSeen: 1 });
  };

  for (const e of events) {
    if (!e || typeof e !== "object") continue;
    if (e.player === "opp") {
      // Any action by the opponent reveals the card involved.
      note(e.cardId ?? e.card, e.card);
      // Their challenge reveals their attacker (cardId/card already covers it),
      // and if WE are challenging, the defender below handles the reveal.
    } else if (e.type === "challenge") {
      // Our challenge reveals the opponent's defender.
      note(e.defenderCardId ?? e.target, e.target);
    }
  }
  return [...seen.values()];
}

/**
 * Summarize a deck given as name+count pairs (saved-deck entries or a parsed
 * pasted list). Names resolve through the oracle; resolved cards are expanded
 * to their oracle ids and fed through summarizeDecklist so all profile math
 * and rendering stay in one place. Unresolved names with an explicit count
 * stay in the deck via the unknown-id path; count-less lines that don't
 * resolve are dropped — they're section headers, not cards.
 *
 * @param {Array<{name:string, count:number, implicit?:boolean}>} pairs
 * @returns {{summary: object|null, warnings: string[]}}
 */
export function summarizeNamedCards(pairs) {
  const ids = [];
  const warnings = [];
  for (const { name, count, implicit } of pairs ?? []) {
    if (!name || !Number.isFinite(count) || count < 1) continue;
    const card = getByName(name);
    if (!card) {
      if (implicit) {
        warnings.push(`Skipped line: "${name}"`);
        continue;
      }
      warnings.push(`Card not found: "${name}"`);
      for (let i = 0; i < count; i++) ids.push(name);
      continue;
    }
    for (let i = 0; i < count; i++) ids.push(card.id);
  }
  return { summary: summarizeDecklist(ids), warnings };
}

/**
 * Extract name+count pairs from a saved Deck row's `data` JSON
 * ({ entries: { [key]: { card, count } } }). Malformed entries are skipped.
 */
export function namedPairsFromDeckData(data) {
  const entries = data?.entries;
  if (!entries || typeof entries !== "object") return [];
  const pairs = [];
  for (const e of Object.values(entries)) {
    const name = e?.card?.name;
    const count = Number(e?.count) || 0;
    if (name && count > 0) pairs.push({ name, count });
  }
  return pairs;
}

/** Render the "--- OPPONENT REVEALED CARDS ---" section, or null when empty. */
export function renderOpponentSection(revealed) {
  if (!Array.isArray(revealed) || revealed.length === 0) return null;
  const out = [];
  out.push(`--- OPPONENT REVEALED CARDS (${revealed.length} unique — partial info; their full deck is unknown) ---`);
  for (const r of revealed) {
    // Name-first: the replay's own card name is authoritative (ids can use a
    // different collector numbering than local data for some sets).
    const card = getByName(r.name) ?? getById(r.key) ?? getByName(r.key);
    const name = card?.name ?? r.name;
    out.push(`  ${name}${r.timesSeen > 1 ? ` (seen ${r.timesSeen}x)` : ""}`);
  }
  return out.join("\n");
}
