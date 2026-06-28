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

export default { getById, getByName };
