// Pure card/deck helpers shared by App.jsx and src/components/*.
// First slice extracted in M5; the rest extracted verbatim from App.jsx in H9
// (breaking the App.jsx <-> DeckPresentationView circular import).
// No React, no side effects.

// Card types (simplified). "Song" represents "Action - Song" cards from the API.
export const CARD_TYPES = ["Character", "Action", "Item", "Location", "Song"];

/** Best-effort image URL for a card across the various API field shapes. */
export function getCardImg(card) {
  // Use multiple image sources for better compatibility
  const u = card.image_url || card._imageFromAPI || card.image || "";
  return u;
}

// Missing constant - add fallback image
const FALLBACK_IMG = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQyMCIgdmlld0JveD0iMCAwIDMwMCA0MjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDIwIiBmaWxsPSIjMmQzNzQ4Ii8+CjxyZWN0IHg9IjUiIHk9IjUiIHdpZHRoPSIyOTAiIGhlaWdodD0iNDEwIiBzdHJva2U9IiM3MTgwOTYiIHN0cm9rZS13aWR0aD0iMiIvPgo8dGV4dCB4PSIxNTAiIHk9IjIxMCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE2IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Q2FyZDwvdGV4dD4KPC9zdmc+";

// --- Role & text helpers ---
const rx = (p) => new RegExp(p, "i");
const RX_DRAW = rx("(draw|draws|draw a card|draw two|card advantage|gain\\s+a\\s+card|gain\\s+cards|add.*to.*hand|put.*(?:a\\s+card|cards?).*into\\s+your\\s+hand)");
const RX_SEARCH = rx("(search|look at|reveal|scry|find|choose.*card.*hand|choose.*put.*hand|select.*card.*hand|put.*on top|put.*on bottom|shuffle|arrange)");
const RX_REMOVAL = rx("(banish|deal.*damage|return .* to (their|its) hand|exert target|put.*opposing.*into.*inkwell|put.*chosen opposing.*into)");
const RX_RAMP = rx("(reduce(s)? cost|play .* for free|gain ink|inkwell.*able|put.*into.*your.*inkwell|put.*of yours.*into.*inkwell)");
const RX_SONG = rx("\\bSong\\b|Action\\s*[-—]\\s*Song");
const RX_SINGER = rx("\\bSinger\\b");

const textOf = c => (c?.text || c?.rulesText || c?.Body_Text || "").toString();

const ROLE_ORDER = [
  "Questers",
  "Ramp / Cost",
  "Draw / Dig",
  "Interaction",
  "Buff / Support",
  "Defenders / Walls",
  "Tempo / Aggro Tools",
  "Combo Pieces",
  "Utility"
];

function rolesForCard(card) {
  const t = textOf(card);
  const type = (card?.type || "").toLowerCase();
  const lore = Number(card?.lore || card?._raw?.Lore || card?._raw?.lore || card?._raw?.loreValue || 0);
  const cost = Number(card?.cost || 0);
  const name = card.name || "";
  const willpower = Number(card?.willpower || card?._raw?.Willpower || card?._raw?.willpower || 0);
  const strength = Number(card?.strength || card?._raw?.Strength || card?._raw?.strength || 0);
  
  // Get keywords/abilities from multiple possible sources
  const keywords = [];
  if (card.keywords && Array.isArray(card.keywords)) {
    keywords.push(...card.keywords);
  }
  if (card.abilities && Array.isArray(card.abilities)) {
    keywords.push(...card.abilities);
  }
  // Also check text for keyword patterns
  const keywordText = t.toLowerCase();
  if (/\bambush\b/i.test(keywordText)) keywords.push("Ambush");
  if (/\brush\b/i.test(keywordText)) keywords.push("Rush");
  if (/\bevasive\b/i.test(keywordText)) keywords.push("Evasive");
  if (/\bbodyguard\b/i.test(keywordText)) keywords.push("Bodyguard");
  if (/\bward\b/i.test(keywordText)) keywords.push("Ward");
  if (/\bsupport\b/i.test(keywordText)) keywords.push("Support");

  const roles = [];

  // Handle special overrides first - EXPANDED
  const OVERRIDES = {
    "Scar - Mastermind": ["Draw / Dig"],
    "Strength of a Raging Fire": ["Interaction"],
    "Let the Storm Rage On": ["Ramp / Cost"],
    // Removed Hades override - should be detected by improved RX_REMOVAL regex
  };
  if (OVERRIDES[name]) return OVERRIDES[name];

  const isDraw = RX_DRAW.test(t) || RX_SEARCH.test(t);
  const isRamp = RX_RAMP.test(t);
  const isRemoval = RX_REMOVAL.test(t);
  const isSupport = /gets \+\d+|gain strength|gain willpower/i.test(t) || keywords.includes("Support");
  const isWall = willpower >= 5 || keywords.includes("Bodyguard");
  const isAggro = (cost <= 3 && strength >= 3) || keywords.includes("Rush");
  const isTempo = keywords.includes("Ambush") || keywords.includes("Evasive");
  const isCombo = /each time|loop|whenever|copy|combo|repeat/i.test(t);
  const isUtility = /reveal|shuffle|look at opponent|toolbox/i.test(t);
  const isQuest = lore >= 2 && type.includes("character");
  const isDefensive = keywords.includes("Ward") || keywords.includes("Bodyguard");

  // Add roles based on card properties
  if (isQuest) roles.push("Questers");
  if (isRamp) roles.push("Ramp / Cost");
  if (isDraw) roles.push("Draw / Dig");
  if (isRemoval) roles.push("Interaction");
  if (isSupport) roles.push("Buff / Support");
  if (isWall || isDefensive) roles.push("Defenders / Walls");
  if (isAggro && isTempo) {
    roles.push("Tempo / Aggro Tools"); // Both tempo and aggro
  } else if (isAggro) {
    roles.push("Tempo / Aggro Tools"); // Pure aggro
  } else if (isTempo) {
    roles.push("Tempo / Aggro Tools"); // Pure tempo
  }
  if (isCombo) roles.push("Combo Pieces");
  if (roles.length === 0 || isUtility) roles.push("Utility");

  return roles;
}

function detectSynergies(cards) {
  const names = new Set(cards.map(c => (c.name || "").toLowerCase()));
  const has = (n) => names.has(n.toLowerCase());

  const found = [];
  if (has("Magic Broom") && has("Merlin - Goat")) found.push("Loop: Magic Broom + Merlin – Goat");
  if (cards.some(c => RX_SONG.test(c?.type)) && cards.some(c => RX_SINGER.test(textOf(c))))
    found.push("Songs + Singer discount package");
  if (cards.some(c => (c.subname || "").includes("Shift")) || cards.some(c => /Shift\s+\d+/i.test(textOf(c))))
    found.push("Shift lines present (check base ↔ floodborn counts)");
  return found;
}

// Uniform attempt to compute cost from card structure
function getCost(card) {
  return card?.cost ?? card?.ink_cost ?? card?.inkCost ?? 0;
}

// Uniform attempt to compute ink colors for card
function getInks(card) {
  console.log('[getInks Debug] Input card:', { 
    name: card?.name, 
    ink: card?.ink, 
    inks: card?.inks, 
    inkColor: card?.inkColor, 
    inkColors: card?.inkColors,
    _rawInk: card?._raw?.Ink,
    _rawInkColor: card?._raw?.Ink_Color,
    _rawColor: card?._raw?.Color,
    _rawColors: card?._raw?.Colors
  });
  
  // Accept arrays || single strings:
  if (Array.isArray(card?.ink)) return card.ink;
  if (Array.isArray(card?.inks)) return card.inks;
  if (typeof card?.ink === "string") return [card.ink];
  if (typeof card?.inkColor === "string") return [card.inkColor];
  if (Array.isArray(card?.inkColors)) return card.inkColors;
  
  // Try to get from _raw data if available
  if (card?._raw?.Ink) {
    const rawInk = card._raw.Ink;
    if (Array.isArray(rawInk)) return rawInk;
    if (typeof rawInk === "string") return [rawInk];
  }
  
  if (card?._raw?.Ink_Color) {
    const rawInkColor = card._raw.Ink_Color;
    if (Array.isArray(rawInkColor)) return rawInkColor;
    if (typeof rawInkColor === "string") return [rawInkColor];
  }
  
  if (card?._raw?.Color) {
    const rawColor = card._raw.Color;
    if (Array.isArray(rawColor)) return rawColor;
    if (typeof rawColor === "string") return [rawColor];
  }
  
  if (card?._raw?.Colors) {
    const rawColors = card._raw.Colors;
    if (Array.isArray(rawColors)) return rawColors;
    if (typeof rawColors === "string") return [rawColors];
  }
  
  // Try to extract from text if no explicit ink data
  if (card?.text) {
    const inkColors = ["Amber", "Amethyst", "Emerald", "Ruby", "Sapphire", "Steel"];
    const foundInks = inkColors.filter(ink => 
      card.text.toLowerCase().includes(ink.toLowerCase())
    );
    if (foundInks.length > 0) {
      console.log('[getInks Debug] Extracted inks from text for', card.name, ':', foundInks);
      return foundInks;
    }
  }
  
  const result = [];
  console.log('[getInks Debug] Returning empty array for card:', card?.name);
  return result;
}

function deckKey(card) {
  // Uniqueness by set+number fallback; prefer id when stable
  return card?.id || `${card?.set}-${card?.number}`;
}

// Normalize card types to handle Songs and other subtypes consistently.
// Shared at module scope so every component (DeckPresentationPopup, AppInner's
// generateDeckImage, etc.) sees the same definition instead of relying on a
// per-component closure that isn't in scope elsewhere.
function normalizedType(card) {
  const rawType =
    card.type ||
    card._raw?.type ||
    card._raw?.type_line ||
    "";

  const sub = (card.subtypes || card._raw?.subtypes || []).map(String);
  const kws = (card.keywords || card._raw?.keywords || []).map(String);

  const hay = `${rawType} ${sub.join(" ")} ${kws.join(" ")}`.toLowerCase();

  // Many feeds mark Songs as Action + Song (subtype/keyword/type_line)
  if (hay.includes("song")) return "Song";
  if (hay.includes("character")) return "Character";
  if (hay.includes("item")) return "Item";
  if (hay.includes("location")) return "Location";
  if (hay.includes("action")) return "Action";
  return card.type || "Other";
}


export {
  FALLBACK_IMG,
  ROLE_ORDER,
  rolesForCard,
  detectSynergies,
  getCost,
  getInks,
  deckKey,
  normalizedType,
};
