import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ABILITIES_CANON,
  LORCAST_BASE,
  ALL_QUERY,
  normalizeAbilityToken,
  normalizeSetMeta,
  normalizedType,
  normalizeLorcast,
  normalizeCard,
  removeDuplicateCards,
  buildLorcastURL,
} from '../lib/cardsApi.js';

// Silence the module's heavy console logging so test output stays readable.
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('normalizeAbilityToken', () => {
  it('strips trailing numeric qualifiers and lowercases', () => {
    expect(normalizeAbilityToken('Singer 5')).toBe('singer');
    expect(normalizeAbilityToken('Resist +2')).toBe('resist');
    expect(normalizeAbilityToken('Shift 3')).toBe('shift');
  });

  it('canonicalizes plain ability names against ABILITIES_CANON', () => {
    // Every canonical multi-word-free token should normalize to its lowercase form.
    for (const ability of ABILITIES_CANON) {
      expect(normalizeAbilityToken(ability)).toBe(ability.toLowerCase());
    }
  });
});

describe('normalizedType', () => {
  it('maps type_line substrings to canonical categories', () => {
    expect(normalizedType({ type_line: 'Character - Hero' })).toBe('Character');
    expect(normalizedType({ type: 'Location' })).toBe('Location');
    expect(normalizedType({ type: 'Action - Song' })).toBe('Song');
    expect(normalizedType({ type: 'Item' })).toBe('Item');
  });

  it('falls back to Other for unknown types', () => {
    expect(normalizedType({ type: 'Widget' })).toBe('Other');
    expect(normalizedType({})).toBe('Other');
  });
});

describe('normalizeSetMeta', () => {
  it('reads a flat set_code and normalizes casing', () => {
    const meta = normalizeSetMeta({ set_code: 'tfc', set_name: 'The First Chapter', set_num: '1' });
    expect(meta).toEqual({ code: 'TFC', name: 'The First Chapter', num: 1 });
  });

  it('returns null num when unparseable/absent', () => {
    const meta = normalizeSetMeta({ set_code: 'tfc' });
    expect(meta.code).toBe('TFC');
    expect(meta.num).toBeNull();
  });

  // SUSPECTED BUG (observed behavior locked in): the `code` resolution chain is
  //   raw?.set_code ?? raw?.setCode ?? raw?.set ?? raw?.Set_Code ?? raw?.set?.code
  // When `raw.set` is a nested object it is non-null, so `?? raw?.set` short-circuits
  // and returns the OBJECT before `raw?.set?.code` is ever reached — stringifying to
  // "[OBJECT OBJECT]". `name`/`num` read `raw?.set?.name`/`raw?.set?.num` correctly.
  // Test asserts current (buggy) behavior; do NOT treat this as intended.
  it('mis-handles a nested set object for code (documents suspected bug)', () => {
    const meta = normalizeSetMeta({ set: { code: 'tfc', name: 'The First Chapter', num: '1' } });
    expect(meta.code).toBe('[OBJECT OBJECT]');
    expect(meta.name).toBe('The First Chapter');
    expect(meta.num).toBe(1);
  });
});

describe('normalizeLorcast field mapping', () => {
  const raw = {
    id: 'crd_abc123',
    name: 'Elsa',
    version: 'Snow Queen',
    set: { code: '1', name: 'The First Chapter' },
    collector_number: '42',
    cost: 4,
    ink: 'Amber',
    type: 'Character',
    rarity: 'Legendary',
    oracle_text: 'Bodyguard (This character may enter play exerted.)',
    inkwell: true,
  };

  it('maps core identity + set fields', () => {
    const card = normalizeLorcast(raw);
    expect(card.id).toBe('crd_abc123');
    expect(card.name).toBe('Elsa');
    expect(card.baseName).toBe('Elsa');
    expect(card.subname).toBe('Snow Queen');
    expect(card.setCode).toBe('1');
    expect(card.setName).toBe('The First Chapter');
    expect(card.setNum).toBe(1);
    expect(card.number).toBe('42');
    expect(card.cost).toBe(4);
    expect(card.rarity).toBe('Legendary');
    expect(card.types).toEqual(['Character']);
    expect(card.inks).toEqual(['Amber']);
    expect(card._source).toBe('lorcast');
    expect(card.inkable).toBe(true);
  });

  it('extracts abilities from oracle_text', () => {
    const card = normalizeLorcast(raw);
    expect(card.abilities).toContain('Bodyguard');
    expect(card._abilitiesIndex.has('bodyguard')).toBe(true);
    expect(card.text).toContain('Bodyguard');
  });

  it('yields null setNum for non-numeric set codes (e.g. promo D100)', () => {
    const card = normalizeLorcast({ ...raw, set: { code: 'D100', name: 'Promo' } });
    expect(card.setCode).toBe('D100');
    expect(card.setNum).toBeNull();
  });
});

describe('normalizeCard field mapping', () => {
  it('splits display name into baseName/subname and maps fields', () => {
    const card = normalizeCard({
      id: 'crd_xyz',
      name: 'Mickey Mouse - Brave Little Tailor',
      set: { code: 'TFC', name: 'The First Chapter' },
      cost: 8,
      ink: 'Steel',
      type: 'Character',
      Image: 'https://example.com/mickey.avif',
    });
    expect(card.id).toBe('crd_xyz');
    expect(card.baseName).toBe('Mickey Mouse');
    expect(card.subname).toBe('Brave Little Tailor');
    expect(card.set).toBe('TFC');
    expect(card.setName).toBe('The First Chapter');
    expect(card.cost).toBe(8);
    expect(card.inks).toEqual(['Steel']);
    expect(card.image_url).toBe('https://example.com/mickey.avif');
  });

  it('returns null for invalid input or missing name', () => {
    expect(normalizeCard(null)).toBeNull();
    expect(normalizeCard('not an object')).toBeNull();
    expect(normalizeCard({ cost: 1 })).toBeNull();
  });
});

describe('removeDuplicateCards', () => {
  it('dedupes by id, keeping first occurrence', () => {
    const out = removeDuplicateCards([
      { id: 'a', name: 'First' },
      { id: 'a', name: 'Dup' },
      { id: 'b', name: 'Second' },
    ]);
    expect(out).toHaveLength(2);
    expect(out.map(c => c.name)).toEqual(['First', 'Second']);
  });

  it('falls back to set-number-name composite key when id is absent', () => {
    const out = removeDuplicateCards([
      { set: 'TFC', number: '1', name: 'X' },
      { set: 'TFC', number: '1', name: 'X' },
      { set: 'TFC', number: '2', name: 'X' },
    ]);
    expect(out).toHaveLength(2);
  });

  it('skips null / non-object entries', () => {
    const out = removeDuplicateCards([null, undefined, 'str', { id: 'a' }]);
    expect(out).toEqual([{ id: 'a' }]);
  });
});

describe('buildLorcastURL', () => {
  it('uses the trimmed query when one is provided', () => {
    const url = buildLorcastURL('  elsa  ');
    expect(url.startsWith(`${LORCAST_BASE}/cards/search?`)).toBe(true);
    expect(url).toContain('q=elsa');
    expect(url).toContain('unique=cards');
  });

  it('falls back to ALL_QUERY when q is empty', () => {
    const url = buildLorcastURL('');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('q')).toBe(ALL_QUERY);
    expect(parsed.searchParams.get('unique')).toBe('cards');
  });
});
