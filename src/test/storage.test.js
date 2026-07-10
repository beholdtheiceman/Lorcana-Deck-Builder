import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LS_KEYS, loadLS, saveLS } from '../lib/storage.js';

// jsdom (configured in vite.config.js `test.environment`) provides a real
// localStorage, so we exercise the helpers against it directly and clear
// between tests.
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LS_KEYS', () => {
  it('exposes the expected storage-key shape', () => {
    expect(LS_KEYS).toMatchObject({
      DECK: expect.any(String),
      DECKS: expect.any(String),
      CURRENT_DECK_ID: expect.any(String),
      FILTERS: expect.any(String),
      CACHE_IMG: expect.any(String),
      CACHE_CARDS: expect.any(String),
    });
  });
});

describe('saveLS / loadLS round-trip', () => {
  it('round-trips an object through saveLS then loadLS', () => {
    const value = { a: 1, b: ['x', 'y'], nested: { z: true } };
    saveLS('round.trip.key', value);
    expect(loadLS('round.trip.key', null)).toEqual(value);
  });

  it('round-trips primitive values', () => {
    saveLS('num.key', 42);
    expect(loadLS('num.key', 0)).toBe(42);
  });
});

describe('loadLS fallback behavior', () => {
  it('returns the fallback when the key is missing', () => {
    const fallback = { default: true };
    expect(loadLS('does.not.exist', fallback)).toBe(fallback);
  });

  it('returns the fallback (does not throw) on corrupted JSON', () => {
    // Write invalid JSON straight to localStorage, bypassing saveLS.
    localStorage.setItem('corrupt.key', '{ not valid json ]');
    const fallback = ['safe'];
    expect(() => loadLS('corrupt.key', fallback)).not.toThrow();
    expect(loadLS('corrupt.key', fallback)).toBe(fallback);
  });
});

describe('saveLS error handling', () => {
  it('swallows quota / setItem errors instead of throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('exceeded quota', 'QuotaExceededError');
    });
    expect(() => saveLS('quota.key', { big: 'payload' })).not.toThrow();
  });
});
