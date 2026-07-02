import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCardImageUrl,
  generateLorcastURL,
  getCORSProxyUrl,
  generateAlternativeImageUrls,
  resetFailedImageCache,
} from '../lib/images.js';
import { LS_KEYS, loadLS } from '../lib/storage.js';

// NOTE: DOM/canvas-heavy helpers (createCanvasImage, generateLocalCardImage,
// createSimpleCardImage) and the network/Image-based loaders (tryLoadImage,
// tryLoadImageWithCORSFallback, tryLoadImageWithBetterCORS, getWorkingImageUrl,
// getAlternativeCORSProxyUrl) are intentionally NOT tested here: jsdom's
// <canvas> has no real 2d context and these paths depend on live image/network
// loading, so any assertion would exercise environment quirks rather than the
// units' intended behavior.

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getCardImageUrl', () => {
  it('returns the placeholder for a null card', () => {
    expect(getCardImageUrl(null)).toBe('/img/placeholders/card.avif');
  });

  it('prefers a canonical Lorcast id (crd_ prefix)', () => {
    expect(getCardImageUrl({ id: 'crd_abc', name: 'X' })).toBe(
      'https://cards.lorcast.io/card/digital/large/crd_abc.avif'
    );
  });

  it('falls back to a direct imageUrl / image_url field', () => {
    expect(getCardImageUrl({ id: 'x', imageUrl: 'https://cdn/x.png', name: 'X' })).toBe(
      'https://cdn/x.png'
    );
    expect(getCardImageUrl({ id: 'x', image_url: 'https://cdn/y.png', name: 'Y' })).toBe(
      'https://cdn/y.png'
    );
  });
});

describe('generateLorcastURL', () => {
  it('returns null for non-object input', () => {
    expect(generateLorcastURL(null)).toBeNull();
    expect(generateLorcastURL('str')).toBeNull();
  });

  it('prefers an existing http imageUrl', () => {
    expect(generateLorcastURL({ name: 'X', imageUrl: 'https://cdn/x.avif' })).toBe(
      'https://cdn/x.avif'
    );
  });

  it('builds a URL from card id when no imageUrl present', () => {
    expect(generateLorcastURL({ name: 'X', id: 'crd_123' })).toBe(
      'https://cards.lorcast.io/card/digital/large/crd_123.avif'
    );
  });

  it('builds a URL from setId + cardNum as a last resort', () => {
    expect(generateLorcastURL({ name: 'X', setId: 'tfc', cardNum: '7' })).toBe(
      'https://cards.lorcast.io/card/digital/large/crd_TFC_007.avif'
    );
  });
});

describe('getCORSProxyUrl', () => {
  it('proxies cards.lorcast.io URLs', () => {
    const src = 'https://cards.lorcast.io/card/digital/large/crd_1.avif';
    expect(getCORSProxyUrl(src)).toBe(`https://cors.bridged.cc/${src}`);
  });

  it('leaves non-lorcast URLs untouched', () => {
    expect(getCORSProxyUrl('https://example.com/x.png')).toBe('https://example.com/x.png');
    expect(getCORSProxyUrl('')).toBe('');
  });
});

describe('generateAlternativeImageUrls', () => {
  it('returns [] for non-object input', () => {
    expect(generateAlternativeImageUrls(null)).toEqual([]);
  });

  it('builds a deduped list of http URLs from id + set/number', () => {
    const urls = generateAlternativeImageUrls({
      id: 'crd_abc',
      set: 'tfc',
      number: '7',
      name: 'X',
    });
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every(u => u.startsWith('http'))).toBe(true);
    expect(new Set(urls).size).toBe(urls.length); // no duplicates
    expect(urls).toContain('https://cards.lorcast.io/card/digital/large/crd_abc.avif');
    // set/number padded + uppercased in the composed fallback
    expect(urls).toContain('https://cards.lorcast.io/card/digital/large/crd_TFC_007.avif');
  });
});

describe('resetFailedImageCache', () => {
  it('removes FAILED entries, keeps good ones, and reports the count', () => {
    localStorage.setItem(
      LS_KEYS.CACHE_IMG,
      JSON.stringify({ a: 'FAILED', b: 'https://ok/1.png', c: 'FAILED' })
    );
    const removed = resetFailedImageCache();
    expect(removed).toBe(2);
    const cache = loadLS(LS_KEYS.CACHE_IMG, {});
    expect(cache).toEqual({ b: 'https://ok/1.png' });
  });

  it('returns 0 when there are no failed entries', () => {
    localStorage.setItem(LS_KEYS.CACHE_IMG, JSON.stringify({ a: 'https://ok/1.png' }));
    expect(resetFailedImageCache()).toBe(0);
  });
});
