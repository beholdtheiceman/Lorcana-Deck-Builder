// api/_lib/cards.js
// Server-side Card Oracle. Reads public/data/cards.min.json from disk once at
// module scope and caches it (same pattern as _lib/db.js caching prisma).
// Exposes getById(id) and getByName(name).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// api/_lib/cards.js -> repo root is two levels up.
const CARDS_PATH = join(__dirname, "..", "..", "public", "data", "cards.min.json");

const g = globalThis;

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function loadOnce() {
  if (g.__cardsOracle) return g.__cardsOracle;

  let map = {};
  try {
    map = JSON.parse(readFileSync(CARDS_PATH, "utf8"));
  } catch (err) {
    // Non-fatal: oracle simply returns null for every lookup.
    console.error("[cards] failed to load cards.min.json:", err.message);
    map = {};
  }

  const byName = {};
  for (const id of Object.keys(map)) {
    const card = map[id];
    const withId = { id, ...card };
    const full = normalizeName(card.name);
    if (full) byName[full] = withId;
    const dash = full.indexOf(" - ");
    if (dash > 0) {
      const short = full.slice(0, dash);
      if (short && !byName[short]) byName[short] = withId;
    }
  }

  g.__cardsOracle = { map, byName };
  return g.__cardsOracle;
}

/** Look up a card by id ("<setNum>-<cardNumber>", e.g. "10-60"). */
export function getById(id) {
  if (id == null) return null;
  const { map } = loadOnce();
  const card = map[String(id)];
  return card ? { id: String(id), ...card } : null;
}

/** Look up a card by (case-insensitive) full or short name. */
export function getByName(name) {
  if (!name) return null;
  const { byName } = loadOnce();
  return byName[normalizeName(name)] || null;
}

/**
 * Filtered scan over the full oracle (3k cards — a plain scan is cheap).
 * All filters are optional and AND together; `name`/`text`/`keyword` are
 * case-insensitive substring matches.
 *
 * @param {object} filters
 * @param {string} [filters.name]      substring match against card name
 * @param {string} [filters.color]     substring match against ink color(s)
 * @param {string} [filters.type]      exact match against type (Character/Item/Action/Location/Song)
 * @param {string} [filters.keyword]   substring match against a keyword ability (e.g. "Evasive", "Shift")
 * @param {string} [filters.text]      substring match against oracle/body text
 * @param {number} [filters.minCost]
 * @param {number} [filters.maxCost]
 * @param {number} [filters.limit=15]
 * @returns {Array<object>} cards (each includes `id`), best-relevance first
 */
export function searchCards({ name, color, type, keyword, text, minCost, maxCost, limit = 15 } = {}) {
  const { map } = loadOnce();
  const nameNorm = name ? normalizeName(name) : null;
  const colorNorm = color ? String(color).toLowerCase() : null;
  const typeNorm = type ? String(type).toLowerCase() : null;
  const kwNorm = keyword ? normalizeName(keyword) : null;
  const textNorm = text ? String(text).toLowerCase() : null;

  const results = [];
  for (const id of Object.keys(map)) {
    const card = map[id];
    if (nameNorm && !normalizeName(card.name).includes(nameNorm)) continue;
    if (colorNorm && !String(card.color || "").toLowerCase().includes(colorNorm)) continue;
    if (typeNorm && String(card.type || "").toLowerCase() !== typeNorm) continue;
    if (kwNorm && !(card.keywords || []).some((k) => normalizeName(k).includes(kwNorm))) continue;
    if (textNorm && !String(card.bodyText || "").toLowerCase().includes(textNorm)) continue;
    if (minCost != null && (card.cost ?? -1) < minCost) continue;
    if (maxCost != null && (card.cost ?? Infinity) > maxCost) continue;
    results.push({ id, ...card });
  }

  results.sort((a, b) => {
    if (nameNorm) {
      const an = normalizeName(a.name) === nameNorm ? 0 : normalizeName(a.name).startsWith(nameNorm) ? 1 : 2;
      const bn = normalizeName(b.name) === nameNorm ? 0 : normalizeName(b.name).startsWith(nameNorm) ? 1 : 2;
      if (an !== bn) return an - bn;
    }
    return String(a.name).localeCompare(String(b.name));
  });

  return results.slice(0, Math.max(1, Math.min(limit, 50)));
}

export default { getById, getByName, searchCards };
