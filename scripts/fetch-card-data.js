/**
 * Lorcana Card Data Fetcher
 * Run once (and whenever new sets drop) to pull fresh card data from LorcanaJSON.
 *
 * Usage:
 *   node scripts/fetch-card-data.js
 *
 * Outputs:
 *   src/data/cards.json          - Full card database (raw)
 *   src/data/card-summary.json   - Condensed version optimized for agent use
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

const CARD_DATA_URL = 'https://lorcanajson.org/files/current/en/allCards.json';

async function fetchCards() {
  console.log('Fetching card data from lorcanajson.org...');

  const res = await fetch(CARD_DATA_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

  const data = await res.json();
  const cards = data.cards ?? data;

  console.log(`Fetched ${cards.length} cards.`);

  // Save raw
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(DATA_DIR, 'cards.json'),
    JSON.stringify(data, null, 2)
  );
  console.log('✓ Saved src/data/cards.json');

  // Build condensed summary for agent use
  const summary = cards.map(card => ({
    id: card.id,
    name: card.name,
    subtitle: card.subtitle ?? null,
    fullName: card.subtitle ? `${card.name} - ${card.subtitle}` : card.name,
    inkColor: card.color,
    inkable: card.inkable ?? card.ink_convertible,
    cost: card.cost,
    type: card.type,
    strength: card.strength ?? null,
    willpower: card.willpower ?? null,
    lore: card.lore ?? null,
    rarity: card.rarity,
    set: card.setCode ?? card.set ?? null,
    setNumber: card.number ?? null,
    keywords: extractKeywords(card),
    abilities: card.abilities?.map(a => ({
      name: a.name ?? null,
      type: a.type ?? null,
      text: a.fullText ?? a.effect ?? null,
    })) ?? [],
    flavorText: card.flavorText ?? null,
  }));

  fs.writeFileSync(
    path.join(DATA_DIR, 'card-summary.json'),
    JSON.stringify(summary, null, 2)
  );
  console.log('✓ Saved src/data/card-summary.json');

  // Print quick stats
  const byColor = {};
  const bySet = {};
  for (const c of summary) {
    byColor[c.inkColor] = (byColor[c.inkColor] ?? 0) + 1;
    bySet[c.set] = (bySet[c.set] ?? 0) + 1;
  }
  console.log('\nCards by ink color:', byColor);
  console.log('Cards by set:', bySet);
  console.log('\nDone! Re-run this script whenever a new set releases.');
}

function extractKeywords(card) {
  const known = [
    'Shift', 'Evasive', 'Rush', 'Ward', 'Bodyguard', 'Challenger',
    'Support', 'Reckless', 'Resist', 'Sing Together', 'Voiceless',
    'Puppy', 'Princeling',
  ];
  const text = [
    ...(card.abilities ?? []).map(a => a.fullText ?? a.effect ?? ''),
    card.fullText ?? '',
  ].join(' ');

  return known.filter(kw => text.includes(kw));
}

fetchCards().catch(err => {
  console.error('Error fetching card data:', err.message);
  process.exit(1);
});
