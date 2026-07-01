import { describe, it, expect } from 'vitest';
import {
  getCost,
  generateTextExport,
  generateSimpleTextExport,
  generateCSVExport,
  exportDeck,
} from '../utils/deckExport.js';

const makeCard = (overrides = {}) => ({
  name: 'Test Card',
  set: 'TFC',
  number: '42',
  type: 'Character',
  rarity: 'Common',
  cost: 3,
  ...overrides,
});

const makeDeck = (entries = {}) => ({
  name: 'Test Deck',
  format: 'Standard',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-06-01T00:00:00.000Z',
  total: Object.values(entries).reduce((s, e) => s + e.count, 0),
  entries,
});

describe('getCost', () => {
  it('reads cost field', () => expect(getCost({ cost: 5 })).toBe(5));
  it('falls back to ink_cost', () => expect(getCost({ ink_cost: 4 })).toBe(4));
  it('falls back to inkCost', () => expect(getCost({ inkCost: 2 })).toBe(2));
  it('returns 0 for null', () => expect(getCost(null)).toBe(0));
  it('returns 0 when no cost fields', () => expect(getCost({})).toBe(0));
  it('prefers cost over ink_cost', () => expect(getCost({ cost: 1, ink_cost: 9 })).toBe(1));
});

describe('generateSimpleTextExport', () => {
  it('lists cards as "count name" sorted alphabetically', () => {
    const deck = makeDeck({
      b: { count: 2, card: makeCard({ name: 'Beta' }) },
      a: { count: 1, card: makeCard({ name: 'Alpha' }) },
    });
    const out = generateSimpleTextExport(deck);
    expect(out).toBe('1 Alpha\n2 Beta');
  });

  it('excludes entries with count 0', () => {
    const deck = makeDeck({
      a: { count: 0, card: makeCard({ name: 'Gone' }) },
      b: { count: 3, card: makeCard({ name: 'Kept' }) },
    });
    expect(generateSimpleTextExport(deck)).toBe('3 Kept');
  });

  it('returns empty string for empty deck', () => {
    expect(generateSimpleTextExport(makeDeck({}))).toBe('');
  });
});

describe('generateCSVExport', () => {
  it('has header row', () => {
    const out = generateCSVExport(makeDeck({}));
    expect(out.split('\n')[0]).toBe('Name,Set,Number,Cost,Type,Rarity,Count');
  });

  it('formats a card row correctly', () => {
    const card = makeCard({ name: 'My Card', set: 'S1', number: '7', type: 'Action', rarity: 'Rare', cost: 2 });
    const deck = makeDeck({ x: { count: 4, card } });
    const lines = generateCSVExport(deck).split('\n');
    expect(lines[1]).toBe('"My Card","S1","7","2","Action","Rare","4"');
  });

  it('excludes zero-count entries', () => {
    const deck = makeDeck({ a: { count: 0, card: makeCard() } });
    expect(generateCSVExport(deck).split('\n')).toHaveLength(1);
  });
});

describe('generateTextExport', () => {
  it('includes deck name and format', () => {
    const deck = makeDeck({ a: { count: 2, card: makeCard({ cost: 3 }) } });
    const out = generateTextExport(deck);
    expect(out).toContain('Test Deck');
    expect(out).toContain('Standard');
  });

  it('groups cards by cost', () => {
    const deck = makeDeck({
      a: { count: 1, card: makeCard({ name: 'Cheap', cost: 1 }) },
      b: { count: 1, card: makeCard({ name: 'Pricey', cost: 5 }) },
    });
    const out = generateTextExport(deck);
    expect(out.indexOf('Cost 1')).toBeLessThan(out.indexOf('Cost 5'));
    expect(out).toContain('1x Cheap');
    expect(out).toContain('1x Pricey');
  });
});

describe('exportDeck', () => {
  const deck = makeDeck({ a: { count: 1, card: makeCard({ name: 'Card A', cost: 1 }) } });

  it('defaults to JSON', () => {
    const out = exportDeck(deck);
    expect(() => JSON.parse(out)).not.toThrow();
    expect(JSON.parse(out).name).toBe('Test Deck');
  });

  it('txt format delegates to generateTextExport', () => {
    expect(exportDeck(deck, 'txt')).toContain('Test Deck');
    expect(exportDeck(deck, 'txt')).toContain('Standard');
  });

  it('simple-txt format gives "count name" lines', () => {
    expect(exportDeck(deck, 'simple-txt')).toBe('1 Card A');
  });

  it('csv format has header', () => {
    expect(exportDeck(deck, 'csv').startsWith('Name,Set')).toBe(true);
  });

  it('unknown format falls back to JSON', () => {
    const out = exportDeck(deck, 'unknown');
    expect(() => JSON.parse(out)).not.toThrow();
  });
});
