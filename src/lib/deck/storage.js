import { LS_KEYS, loadLS, saveLS } from "../storage.js";

const DECK_RULES = {
  MIN_SIZE: 60,
  MAX_SIZE: 60,
  MAX_COPIES: 4,
};


// Generate unique deck ID
function generateDeckId() {
  return `deck_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Enhanced deck structure
function createNewDeck(name = "Untitled Deck") {
  return {
    id: generateDeckId(),
    name: String(name).trim() || "Untitled Deck",
    entries: {},
    total: 0,
    createdAt: Date.now(),
    updatedAt: null, // Will be set when explicitly saved
    description: "",
    tags: [],
    format: "Lorcana", // Standard, Limited, etc.
    notes: ""
  };
}

// Load all decks from storage
function loadAllDecks() {
  try {
    const decks = loadLS(LS_KEYS.DECKS, {});
    const currentDeckId = loadLS(LS_KEYS.CURRENT_DECK_ID, null);
    
    // Return empty decks if none exist - no default deck creation
    return { decks, currentDeckId };
  } catch (error) {
    console.error('[loadAllDecks] Error loading decks:', error);
    return { decks: {}, currentDeckId: null };
  }
}

// Save all decks to storage
function saveAllDecks(decks) {
  try {
    saveLS(LS_KEYS.DECKS, decks);
  } catch (error) {
    console.error('[saveAllDecks] Error saving decks:', error);
  }
}

// Save current deck ID
function saveCurrentDeckId(deckId) {
  try {
    saveLS(LS_KEYS.CURRENT_DECK_ID, deckId);
  } catch (error) {
    console.error('[saveCurrentDeckId] Error saving current deck ID:', error);
  }
}

// Get deck by ID
function getDeckById(decks, deckId) {
  return decks[deckId] || null;
}

// Update deck metadata
function updateDeckMetadata(decks, deckId, updates) {
  if (!decks[deckId]) return decks;
  
  const updatedDecks = { ...decks };
  updatedDecks[deckId] = {
    ...updatedDecks[deckId],
    ...updates,
    updatedAt: Date.now()
  };
  
  saveAllDecks(updatedDecks);
  return updatedDecks;
}

// Delete deck
function deleteDeck(decks, deckId) {
  if (!decks[deckId]) return decks;
  
  const updatedDecks = { ...decks };
  delete updatedDecks[deckId];
  
  saveAllDecks(updatedDecks);
  return updatedDecks;
}

// Duplicate deck
function duplicateDeck(decks, deckId, newName = null) {
  const originalDeck = decks[deckId];
  if (!originalDeck) return decks;
  
  const newDeck = {
    ...originalDeck,
    id: generateDeckId(),
    name: newName || `${originalDeck.name} (Copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  const updatedDecks = { ...decks, [newDeck.id]: newDeck };
  saveAllDecks(updatedDecks);
  return updatedDecks;
}

export {
  DECK_RULES,
  generateDeckId,
  createNewDeck,
  loadAllDecks,
  saveAllDecks,
  saveCurrentDeckId,
  getDeckById,
  updateDeckMetadata,
  deleteDeck,
  duplicateDeck,
};
