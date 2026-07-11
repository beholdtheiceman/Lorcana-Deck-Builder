// -----------------------------------------------------------------------------
// Server-side Lorcast catalog ingest (ADDITIVE).
// -----------------------------------------------------------------------------
// Fetches the full Lorcana card catalog from the Lorcast API and mirrors it into
// the local `Card` table (prisma/schema.prisma). Nothing in the live app reads
// from this table yet — the client still fetches cards directly from Lorcast via
// src/lib/cardsApi.js. This is a nightly server-side mirror for a future local
// card-search path.
//
// Catalog enumeration matches Lorcast's documented shape (verified live):
//   GET /v0/sets                 -> { results: [ { id, code, name, ... } ] }
//   GET /v0/sets/{code}/cards    -> [ <card>, <card>, ... ]  (bare array)
// -----------------------------------------------------------------------------

import { prisma } from "./db.js";

const LORCAST_BASE = "https://api.lorcast.com/v0";

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Lorcast ${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

// Coerce to a finite number or null (resilient to missing/garbage fields).
function num(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Map a raw Lorcast card object onto the Prisma `Card` model's fields.
 * The whole raw object is preserved in `raw` for future fields.
 * Optional fields are nulled when absent.
 */
export function mapLorcastToCard(raw) {
  const setObj = raw?.set && typeof raw.set === "object" ? raw.set : {};
  const setCode = String(setObj.code ?? raw?.set ?? "").toUpperCase();
  const setNum = /^\d+$/.test(setCode) ? Number(setCode) : null;

  const dig = raw?.image_uris?.digital || {};
  const imageUrl = dig.large || dig.normal || dig.small || null;

  let inks = [];
  if (Array.isArray(raw?.inks) && raw.inks.length) inks = raw.inks.map(String);
  else if (raw?.ink) inks = [String(raw.ink)];

  const type = Array.isArray(raw?.type)
    ? raw.type.join("/")
    : raw?.type != null
    ? String(raw.type)
    : null;

  return {
    id: String(raw?.id),
    name: raw?.name != null ? String(raw.name) : "",
    version: raw?.version != null ? String(raw.version) : null,
    setCode,
    setNum,
    number: raw?.collector_number != null ? String(raw.collector_number) : null,
    cost: num(raw?.cost),
    inks,
    type,
    rarity: raw?.rarity != null ? String(raw.rarity) : null,
    inkable: Boolean(raw?.inkwell ?? raw?.inkable ?? false),
    text: raw?.text != null ? String(raw.text) : null,
    lore: num(raw?.lore),
    strength: num(raw?.strength),
    willpower: num(raw?.willpower),
    imageUrl,
    raw,
  };
}

/**
 * Fetch the full Lorcast catalog and upsert each card into the local `Card`
 * table. Returns a summary { fetched, upserted }.
 */
export async function ingestCards() {
  const setsJson = await fetchJson(`${LORCAST_BASE}/sets`);
  const sets = Array.isArray(setsJson?.results)
    ? setsJson.results
    : Array.isArray(setsJson)
    ? setsJson
    : [];

  // Collect a de-duped list of raw cards across every set.
  const rawCards = [];
  const seen = new Set();
  for (const set of sets) {
    const code = set?.code ?? set?.id;
    if (!code) continue;
    const cardsJson = await fetchJson(
      `${LORCAST_BASE}/sets/${encodeURIComponent(String(code))}/cards`
    );
    const list = Array.isArray(cardsJson?.results)
      ? cardsJson.results
      : Array.isArray(cardsJson)
      ? cardsJson
      : [];
    for (const c of list) {
      const id = c?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      rawCards.push(c);
    }
  }

  let upserted = 0;
  for (const raw of rawCards) {
    const data = mapLorcastToCard(raw);
    if (!data.id || data.id === "undefined") continue;
    await prisma.card.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
    upserted++;
  }

  return { fetched: rawCards.length, upserted };
}
