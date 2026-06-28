// scripts/update-cards.mjs
// Re-fetches the LorcanaJSON bulk card dataset and rebuilds
// public/data/cards.min.json as an id-keyed, minified map.
//
// Usage: node scripts/update-cards.mjs   (wired as `npm run cards:update`)
//
// Each entry is keyed by "<setNum>-<cardNumber>" (e.g. "10-60") and the value is:
//   { name, cost, inkable, strength, willpower, lore, color, type, bodyText, keywords }

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public", "data");
const OUT_FILE = join(OUT_DIR, "cards.min.json");

const SOURCE_URL = "https://lorcanajson.org/files/current/en/allCards.json";

/**
 * Transform a raw LorcanaJSON card record into the compact oracle shape.
 * Returns null when the record cannot be keyed.
 */
export function transformCard(c) {
  // setNum comes from setCode ("1".."12", "Q1", "Q2"); cardNumber from number.
  const setNum = c.setCode != null ? String(c.setCode) : null;
  const cardNumber = c.number != null ? String(c.number) : null;
  if (!setNum || !cardNumber) return null;

  const id = `${setNum}-${cardNumber}`;

  // Dual-ink cards expose a `colors` array; single-ink use `color`.
  const color =
    Array.isArray(c.colors) && c.colors.length ? c.colors.join("-") : c.color || "";

  const value = {
    name: c.fullName || c.name || "",
    cost: c.cost ?? null,
    inkable: !!c.inkwell,
    strength: c.strength ?? null,
    willpower: c.willpower ?? null,
    lore: c.lore ?? null,
    color,
    type: c.type || "",
    bodyText: c.fullText || "",
    keywords: Array.isArray(c.keywordAbilities) ? c.keywordAbilities : [],
  };

  return [id, value];
}

export function buildMap(dataset) {
  const cards = Array.isArray(dataset) ? dataset : dataset.cards || [];
  const map = {};
  for (const c of cards) {
    const pair = transformCard(c);
    if (pair) map[pair[0]] = pair[1];
  }
  return map;
}

async function main() {
  console.log(`[cards:update] Fetching ${SOURCE_URL} ...`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch dataset: HTTP ${res.status} ${res.statusText}`);
  }
  const dataset = await res.json();
  const map = buildMap(dataset);
  const count = Object.keys(map).length;
  if (count === 0) throw new Error("Transformed 0 cards — aborting (bad dataset?).");

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(map), "utf8");
  console.log(`[cards:update] Wrote ${count} cards -> ${OUT_FILE}`);
}

// Only run when invoked directly (not when imported for the helpers above).
const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main().catch((err) => {
    console.error("[cards:update] ERROR:", err.message);
    process.exit(1);
  });
}
