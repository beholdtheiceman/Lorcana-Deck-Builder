// -----------------------------------------------------------------------------
// Local storage helpers
// -----------------------------------------------------------------------------

export const LS_KEYS = {
  DECK: "lorcana.deck.v1",
  DECKS: "lorcana.decks.v2", // New: Multiple decks storage
  CURRENT_DECK_ID: "lorcana.currentDeckId.v2", // New: Current deck ID
  FILTERS: "lorcana.filters.v1",
  CACHE_IMG: "lorcana.imageCache.v1",
  CACHE_CARDS: "lorcana.cardsCache.v1",
};

export function loadLS(key, fallback) {
  try {
    console.log('[loadLS] Loading key:', key);
    const v = localStorage.getItem(key);
    console.log('[loadLS] Raw value from localStorage:', v);
    const result = v ? JSON.parse(v) : fallback;
    console.log('[loadLS] Parsed result:', result);
    return result;
  } catch (error) {
    console.error('[loadLS] Error loading from localStorage:', error);
    return fallback;
  }
}

export function saveLS(key, value) {
  try {
    console.log('[saveLS] Saving key:', key, 'with value:', value);
    localStorage.setItem(key, JSON.stringify(value));
    console.log('[saveLS] Successfully saved to localStorage');
  } catch (error) {
    console.error('[saveLS] Error saving to localStorage:', error);
  }
}
