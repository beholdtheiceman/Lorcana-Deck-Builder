import { deckKey } from "../cardUtils.js";
import { toPayload } from "../deckPayload.js";
import { createNewDeck, loadAllDecks, DECK_RULES } from "./storage.js";

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const initialDeckState = () => {
  const { decks, currentDeckId } = loadAllDecks();
  return decks[currentDeckId] || createNewDeck("Untitled Deck");
};

function deckReducer(state, action) {
  switch (action.type) {
    case "SET_NAME": {
      const name = action.name || "Untitled Deck";
      const next = { ...state, name, updatedAt: Date.now() };
      return next;
    }
    case "RESET": {
      const next = createNewDeck("Untitled Deck");
      return next;
    }
    case "IMPORT_STATE": {
      const next = action.deck || createNewDeck("Imported Deck");
      return next;
    }
    case "ADD": {
      const { card, count = 1 } = action;
      const key = deckKey(card);
      const existing = state.entries[key]?.count || 0;
      const nextCount = clamp(existing + count, 0, DECK_RULES.MAX_COPIES);
      const nextEntries = { ...state.entries };
      if (nextCount <= 0) {
        // Decremented to zero — remove the entry instead of keeping a ghost.
        delete nextEntries[key];
      } else {
        nextEntries[key] = {
          card,
          count: nextCount,
        };
      }
      const newTotal =
        Object.values(nextEntries).reduce((a, b) => a + (b?.count || 0), 0) || 0;
      const next = { ...state, entries: nextEntries, total: newTotal, updatedAt: Date.now() };
      return next;
    }
    case "SET_COUNT": {
      const { card, count } = action;
      const key = deckKey(card);
      const nextEntries = { ...state.entries };
      const clamped = clamp(count, 0, DECK_RULES.MAX_COPIES);
      if (clamped <= 0) {
        // Count 0 means the card is out of the deck — drop the entry entirely.
        // Keeping it produced ghost "0x" rows in saved decks (My Decks page).
        delete nextEntries[key];
      } else {
        nextEntries[key] = { card, count: clamped };
      }
      const newTotal = Object.values(nextEntries).reduce((a, b) => a + (b?.count || 0), 0);
      const next = { ...state, entries: nextEntries, total: newTotal, updatedAt: Date.now() };
      return next;
    }
    case "REMOVE": {
      const { card } = action;
      const key = deckKey(card);
      const nextEntries = { ...state.entries };
      delete nextEntries[key];
      const newTotal = Object.values(nextEntries).reduce((a, b) => a + (b?.count || 0), 0);
      const next = { ...state, entries: nextEntries, total: newTotal, updatedAt: Date.now() };
      return next;
    }
    case "UPDATE_METADATA": {
      const next = { ...state, ...action.updates, updatedAt: Date.now() };
      return next;
    }
    case "SWITCH_DECK": {
      const newState = action.deck || state;
      return newState;
    }
    case "UPDATE_DECK": {
      const next = { ...state, ...action.deck, updatedAt: Date.now() };
      return next;
    }
    default:
      return state;
  }
}

export function getDeckPayload(deckState) {
  return toPayload(deckState);
}

export { initialDeckState, deckReducer };
