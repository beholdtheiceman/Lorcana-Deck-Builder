// src/utils/cardOracle.js
// Client-side Card Oracle. Lazily fetches /data/cards.min.json (once) and
// caches it, then resolves cards by id ("<setNum>-<cardNumber>", e.g. "10-60")
// or by name. Use enrichDeck() to merge oracle data into deck entries.

let _cache = null; // id -> card object
let _byName = null; // normalized name -> card object (with id attached)
let _loadPromise = null;

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function buildNameIndex(map) {
  const idx = {};
  for (const id of Object.keys(map)) {
    const card = map[id];
    const withId = { id, ...card };
    const full = normalizeName(card.name);
    if (full) idx[full] = withId;
    // Also index the short name (before " - ") so "Mickey Mouse" can resolve.
    const dash = full.indexOf(" - ");
    if (dash > 0) {
      const short = full.slice(0, dash);
      if (short && !idx[short]) idx[short] = withId;
    }
  }
  return idx;
}

/**
 * Ensure the dataset is loaded. Returns the id-keyed map.
 * Safe to call repeatedly; the fetch happens at most once.
 */
export async function load() {
  if (_cache) return _cache;
  if (_loadPromise) return _loadPromise;
  _loadPromise = fetch("/data/cards.min.json")
    .then((res) => {
      if (!res.ok) throw new Error(`cardOracle: HTTP ${res.status}`);
      return res.json();
    })
    .then((map) => {
      _cache = map;
      _byName = buildNameIndex(map);
      return _cache;
    })
    .catch((err) => {
      // Reset so a later call can retry.
      _loadPromise = null;
      throw err;
    });
  return _loadPromise;
}

/** Look up a card by id ("<setNum>-<cardNumber>"). Returns card+{id} or null. */
export async function getById(id) {
  if (id == null) return null;
  const map = await load();
  const card = map[String(id)];
  return card ? { id: String(id), ...card } : null;
}

/** Look up a card by (case-insensitive) full or short name. Returns card+{id} or null. */
export async function getByName(name) {
  if (!name) return null;
  await load();
  return _byName[normalizeName(name)] || null;
}

/**
 * Enrich a list of deck entries with oracle data.
 * Each entry may carry an `id`/`cardId` ("<setNum>-<cardNumber>") and/or a
 * `name`. Returns new entries with a `card` field (oracle data, or null).
 * @param {Array<object>} entries
 * @returns {Promise<Array<object>>}
 */
export async function enrichDeck(entries) {
  if (!Array.isArray(entries)) return [];
  const map = await load();
  return entries.map((entry) => {
    const id = entry.id ?? entry.cardId ?? entry.cardID;
    let card = id != null ? map[String(id)] : null;
    if (card) card = { id: String(id), ...card };
    if (!card && entry.name) card = _byName[normalizeName(entry.name)] || null;
    return { ...entry, card: card || null };
  });
}

export default { load, getById, getByName, enrichDeck };
