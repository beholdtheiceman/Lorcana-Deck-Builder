import { deckKey } from '../cardUtils.js'

export function parseCSVImport(csv) {
  const lines = csv.split('\n').map(line => line.trim()).filter(line => line);
  const deck = { entries: {} };
  
  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const columns = line.split(',').map(col => col.replace(/^"|"$/g, ''));
    
    if (columns.length >= 7) {
      const [name, set, number, cost, type, rarity, count] = columns;
      const card = { name, set, number, cost: parseInt(cost), type, rarity };
      const key = deckKey(card);
      deck.entries[key] = { card, count: parseInt(count) };
    }
  }
  
  return deck;
}

