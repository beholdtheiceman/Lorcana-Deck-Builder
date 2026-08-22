import { normalizeAbilityToken } from "../cardsApi.js";
import { getCost } from "../cardUtils.js";
import { LS_KEYS, loadLS, saveLS } from "../storage.js";

const RARITIES = ["Common", "Uncommon", "Rare", "Super Rare", "Legendary"];
const LEGACY_TO_LORCAST = {
  TFC: "1", ROC: "2", IAT: "3", URS: "4", SSK: "5", AZS: "6", ARI: "7", ROJ: "8", FAB: "9", WITW: "10", WSP: "11", WLD: "12", AOV: "13", D100: "D100"
};
const INK_ORDER = ["Amber","Amethyst","Emerald","Ruby","Sapphire","Steel"];
const SET_CODE_ORDER = ["1","2","3","4","5","6","7","8","9","10","11","12","13","D100"];

function primaryInk(card){
  const ink = (Array.isArray(card.inks) && card.inks[0]) || card.ink || card._raw?.ink || "";
  return String(ink);
}
function collectorParts(card){
  const raw = String(card.number ?? card.collector_number ?? card._raw?.collector_number ?? "");
  const m = raw.match(/^(\d+)([A-Za-z]*)$/);
  return { num: m ? parseInt(m[1],10) : Number.MAX_SAFE_INTEGER, suf: m ? String(m[2]).toLowerCase() : "" };
}
function cardComparator(a, b) {
  const ia = INK_ORDER.indexOf(primaryInk(a));
  const ib = INK_ORDER.indexOf(primaryInk(b));
  if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  const ac = String(a.setCode || "").toUpperCase();
  const bc = String(b.setCode || "").toUpperCase();
  const an = /^\d+$/.test(ac) ? Number(ac) : null;
  const bn = /^\d+$/.test(bc) ? Number(bc) : null;
  if (an != null && bn != null && an !== bn) return bn - an;
  if (an != null && bn == null) return -1;
  if (an == null && bn != null) return 1;
  if (an == null && bn == null) {
    const sa = SET_CODE_ORDER.indexOf(ac);
    const sb = SET_CODE_ORDER.indexOf(bc);
    if (sa !== sb) return (sb === -1 ? -1 : sb) - (sa === -1 ? -1 : sa);
  }
  const ca = collectorParts(a);
  const cb = collectorParts(b);
  if (ca.num !== cb.num) return ca.num - cb.num;
  if (ca.suf !== cb.suf) return String(ca.suf) < String(cb.suf) ? -1 : 1;
  const nameA = String(a.name || "");
  const nameB = String(b.name || "");
  return nameA.localeCompare(nameB);
}
function getCardInks(card) {
  if (Array.isArray(card.inks) && card.inks.length) return new Set(card.inks.map(s => String(s).trim()));
  if (typeof card.Color === "string" && card.Color.length) return new Set(card.Color.split(",").map(s => String(s).trim()));
  return new Set();
}
function matchesInkFilter(card, selectedInks) {
  const selCount = selectedInks.size;
  if (selCount === 0) return true;
  const inks = getCardInks(card);
  const cardCount = inks.size;
  if (selCount === 1) {
    const [only] = [...selectedInks];
    return inks.has(only);
  }
  if (selCount === 2) {
    if (cardCount === 1) {
      const [a, b] = [...selectedInks];
      return inks.has(a) || inks.has(b);
    }
    if (cardCount === 2) {
      for (const ink of selectedInks) if (!inks.has(ink)) return false;
      return true;
    }
    return false;
  }
  if (cardCount === 1) {
    for (const ink of selectedInks) if (inks.has(ink)) return true;
    return false;
  }
  if (cardCount === 2) {
    for (const ink of inks) if (!selectedInks.has(ink)) return false;
    return true;
  }
  return false;
}

function defaultFilterState() {
  return {
    text: "",
    inks: new Set(),
    rarities: new Set(),
    types: new Set(),
    sets: new Set(),
    classifications: new Set(),
    abilities: new Set(),
    selectedCosts: new Set(),
    inkable: "any",
    sortBy: "ink-set-number",
    sortDir: "asc",
    setNumber: "",
    franchise: "",
    gamemode: "",
    loreMin: "",
    loreMax: "",
    willpowerMin: "",
    willpowerMax: "",
    strengthMin: "",
    strengthMax: "",
  };
}
export const initialFilterState = () => {
  const saved = loadLS(LS_KEYS.FILTERS, null);
  return saved ? hydrateFilterState(saved) : defaultFilterState();
};
export function serializeFilterState(state) {
  const { showInkablesOnly, showUninkablesOnly, showFilterPanel, _resetTimestamp, ...rest } = state;
  return {
    ...rest,
    inks: Array.from(state.inks || []),
    rarities: Array.from(state.rarities || []),
    types: Array.from(state.types || []),
    sets: Array.from(state.sets || []),
    classifications: Array.from(state.classifications || []),
    abilities: Array.from(state.abilities || []),
    selectedCosts: Array.from(state.selectedCosts || []),
    inkable: state.inkable === "yes" || state.inkable === "no" ? state.inkable : "any",
    setNumber: state.setNumber || "",
    franchise: state.franchise || "",
    gamemode: state.gamemode || "",
    loreMin: state.loreMin || "",
    loreMax: state.loreMax || "",
    willpowerMin: state.willpowerMin || "",
    willpowerMax: state.willpowerMax || "",
    strengthMin: state.strengthMin || "",
    strengthMax: state.strengthMax || "",
  };
}
export function hydrateFilterState(raw) {
  const { showInkablesOnly, showUninkablesOnly, showFilterPanel, _resetTimestamp, ...rest } = raw;
  const inkable = raw.inkable === "yes" || raw.inkable === "no"
    ? raw.inkable
    : showUninkablesOnly === true ? "no" : showInkablesOnly === true ? "yes" : "any";
  return {
    ...rest,
    inks: new Set(raw.inks || []),
    rarities: new Set(raw.rarities || []),
    types: new Set(raw.types || []),
    sets: new Set(raw.sets || []),
    classifications: new Set(raw.classifications || []),
    abilities: new Set(raw.abilities || []),
    selectedCosts: new Set(raw.selectedCosts || []),
    inkable,
    setNumber: raw.setNumber || "",
    franchise: raw.franchise || "",
    gamemode: raw.gamemode || "",
    loreMin: raw.loreMin || "",
    loreMax: raw.loreMax || "",
    willpowerMin: raw.willpowerMin || "",
    willpowerMax: raw.willpowerMax || "",
    strengthMin: raw.strengthMin || "",
    strengthMax: raw.strengthMax || "",
  };
}
export function filterReducer(state, action) {
  switch (action.type) {
    case "SET_TEXT": return persist({ ...state, text: action.text || "" });
    case "TOGGLE_INK": {
      const inks = new Set(state.inks instanceof Set ? state.inks : new Set());
      if (inks.has(action.ink)) inks.delete(action.ink); else inks.add(action.ink);
      return persist({ ...state, inks });
    }
    case "TOGGLE_COST": {
      const selectedCosts = new Set(state.selectedCosts instanceof Set ? state.selectedCosts : new Set());
      if (selectedCosts.has(action.cost)) selectedCosts.delete(action.cost); else selectedCosts.add(action.cost);
      return persist({ ...state, selectedCosts });
    }
    case "TOGGLE_CLASSIFICATION": {
      const classifications = new Set(state.classifications instanceof Set ? state.classifications : new Set());
      if (classifications.has(action.classification)) classifications.delete(action.classification); else classifications.add(action.classification);
      return persist({ ...state, classifications });
    }
    case "TOGGLE_ABILITY": {
      if (!action.ability || typeof action.ability !== "string" || !action.ability.trim()) {
        console.warn("[FilterReducer] Attempted to add invalid ability:", action.ability);
        return state;
      }
      const abilities = new Set(state.abilities instanceof Set ? state.abilities : new Set());
      if (abilities.has(action.ability)) abilities.delete(action.ability); else abilities.add(action.ability);
      return persist({ ...state, abilities });
    }
    case "TOGGLE_RARITY": {
      const rarities = new Set(state.rarities instanceof Set ? state.rarities : new Set());
      if (rarities.has(action.rarity)) rarities.delete(action.rarity); else rarities.add(action.rarity);
      return persist({ ...state, rarities });
    }
    case "TOGGLE_TYPE": {
      const types = new Set(state.types instanceof Set ? state.types : new Set());
      if (types.has(action.cardType)) types.delete(action.cardType); else types.add(action.cardType);
      return persist({ ...state, types });
    }
    case "TOGGLE_SET": {
      const sets = new Set(state.sets instanceof Set ? state.sets : new Set());
      if (sets.has(action.setCode)) sets.delete(action.setCode); else sets.add(action.setCode);
      return persist({ ...state, sets });
    }
    case "SET_INKABLE":
      return persist({ ...state, inkable: action.value === "yes" || action.value === "no" ? action.value : "any" });
    case "SET_SORT":
      return persist({ ...state, sortBy: action.sortBy || state.sortBy, sortDir: action.sortDir || state.sortDir });
    case "SET_SET_NUMBER": return persist({ ...state, setNumber: action.value || "" });
    case "SET_FRANCHISE": return persist({ ...state, franchise: action.value || "" });
    case "SET_GAMEMODE": return persist({ ...state, gamemode: action.value || "" });
    case "SET_LORE_RANGE":
      return persist({ ...state, loreMin: action.min !== undefined ? action.min : state.loreMin, loreMax: action.max !== undefined ? action.max : state.loreMax });
    case "SET_WILLPOWER_RANGE":
      return persist({ ...state, willpowerMin: action.min !== undefined ? action.min : state.willpowerMin, willpowerMax: action.max !== undefined ? action.max : state.willpowerMax });
    case "SET_ABILITIES": {
      const abilities = action.abilities instanceof Set ? action.abilities : new Set(action.abilities || []);
      return persist({ ...state, abilities });
    }
    case "SET_STRENGTH_RANGE":
      return persist({ ...state, strengthMin: action.min !== undefined ? action.min : state.strengthMin, strengthMax: action.max !== undefined ? action.max : state.strengthMax });
    case "RESET":
      localStorage.removeItem(LS_KEYS.FILTERS);
      return persist(defaultFilterState());
    default: return state;
  }
  function persist(next) {
    saveLS(LS_KEYS.FILTERS, serializeFilterState(next));
    return next;
  }
}
export function countActiveFilters(state) {
  if (!state || typeof state !== "object") return 0;
  const hasValues = value => value instanceof Set ? value.size > 0 : Array.isArray(value) ? value.length > 0 : false;
  const hasText = value => typeof value === "string" ? value.trim().length > 0 : Boolean(value);
  return [
    hasText(state.text),
    hasValues(state.inks),
    hasValues(state.rarities),
    hasValues(state.types),
    hasValues(state.sets),
    hasValues(state.classifications),
    hasValues(state.abilities),
    hasValues(state.selectedCosts),
    state.inkable !== undefined && state.inkable !== "any",
    hasText(state.setNumber),
    hasText(state.franchise),
    hasText(state.gamemode),
    hasText(state.loreMin) || hasText(state.loreMax),
    hasText(state.willpowerMin) || hasText(state.willpowerMax),
    hasText(state.strengthMin) || hasText(state.strengthMax),
  ].filter(Boolean).length;
}
function rarityWeight(r) {
  const idx = RARITIES.findIndex((x) => x.toLowerCase() === (r || "").toLowerCase());
  return idx === -1 ? 999 : idx;
}

export function applyFilters(cards, filters) {
  // Safety check: ensure filters object exists and has required properties
  if (!filters || typeof filters !== 'object') {
    console.warn('[applyFilters] Filters object is missing or invalid, returning all cards');
    return cards.slice();
  }
  
  let list = cards.slice();

  // Only apply text filter if there's actual search text
  if (filters.text && filters.text.trim()) {
    const q = filters.text.toLowerCase().trim();

    list = list.filter((c) => {
      // Search in multiple fields based on Lorcast structure
      const searchableFields = [
        c.name,
        c.text,
        c.type,
        c.rarity,
        c.set,
        // Also search in raw data fields
        c._raw?.type,
        c._raw?.rarity,
        c._raw?.set?.code,
        c._raw?.set?.name
      ].filter(Boolean); // Remove undefined/null values
      
      return searchableFields.some(field =>
        String(field).toLowerCase().includes(q)
      );
    });
  }

  if (filters.inks && filters.inks.size) {
    // Ensure inks is a Set
    if (!(filters.inks instanceof Set)) {
      console.warn('filters.inks is not a Set, converting...', filters.inks);
      filters.inks = new Set(filters.inks || []);
    }
    
    // Use the new improved ink filtering logic
    list = list.filter(card => matchesInkFilter(card, filters.inks));
  }

  if (filters.rarities && filters.rarities.size) {
    // Ensure rarities is a Set
    if (!(filters.rarities instanceof Set)) {
      console.warn('filters.rarities is not a Set, converting...', filters.rarities);
      filters.rarities = new Set(filters.rarities || []);
    }
    list = list.filter((c) => filters.rarities.has(c.rarity));
  }

  if (filters.types && filters.types.size) {
    // Ensure types is a Set
    if (!(filters.types instanceof Set)) {
      console.warn('filters.types is not a Set, converting...', filters.types);
      filters.types = new Set(filters.types || []);
    }
    
    
    list = list.filter((c) => {
      // Get card types from multiple sources based on Lorcast structure
      let cardTypes = [];
      
      // First try the normalized type field
      if (c.type) {
        cardTypes = Array.isArray(c.type) ? c.type : [c.type];
      }
      // Then try the types array field
      else if (Array.isArray(c.types) && c.types.length > 0) {
        cardTypes = c.types;
      }
      // Then try the raw data from Lorcast API
      else if (Array.isArray(c._raw?.type) && c._raw.type.length > 0) {
        cardTypes = c._raw.type;
      }
      else if (c._raw?.type) {
        cardTypes = [c._raw.type];
      }
      
      // Normalize to an array of strings — some cards have non-string/nested type
      // data, which crashed `type.toLowerCase()` below and white-screened the app.
      cardTypes = (Array.isArray(cardTypes) ? cardTypes : [cardTypes]).flat().map((t) => String(t ?? ""));

      // Special handling for Song type - check if it's an Action - Song
      if (filters.types.has("Song")) {
        // If Song is selected, include cards with type "Action - Song" or "Song"
        // Also check the text field for song-related content
        const isSong = cardTypes.some(type => 
          type === "Action - Song" || 
          type === "Song" ||
          type.toLowerCase().includes("song")
        ) || (c.text && c.text.toLowerCase().includes("song"));
        
        if (isSong) {
          return true;
        }
      }
      
      // For all other types, check if they match any of the card's types
      return Array.from(filters.types).some(selectedType => {
        if (selectedType === "Song") {
          // Skip Song here since we handled it above
          return false;
        }
        
        const matches = cardTypes.some(cardType => 
          cardType === selectedType ||
          cardType.toLowerCase() === selectedType.toLowerCase() ||
          cardType.toLowerCase().includes(selectedType.toLowerCase())
        );
        
        if (matches) {
        }
        
        return matches;
      });
    });
    
  }

  // --- SETS filter: match by Lorcast code OR name OR numeric series (with legacy mapping) ---
  if (filters.sets && filters.sets.size) {
    const sel = Array.from(filters.sets);

    // normalize selection
    const wantedCodes = new Set(
      sel.map(s => String(s).trim().toUpperCase())
         // map legacy like TFC/ROC → "1"/"2"
         .map(s => LEGACY_TO_LORCAST[s] || s)                  // keep "1","2","D100" as-is
         .filter(s => /^[0-9]+$/.test(s) || s === "D100")      // Lorcast codes
    );

    const wantedNames = new Set(
      sel.map(s => String(s).trim().toLowerCase())
         .filter(s => s.length > 3)
    );

    const wantedNums = new Set(
      sel.map(s => Number(String(s).trim()))
         .filter(n => Number.isInteger(n) && n >= 0)
    );


    list = list.filter(c => {
      const code = (c.setCode || c.set || c._raw?.set?.code || c._raw?.set_code || "")
        .toString().toUpperCase().trim();        // "1","2","D100"
      const name = (c.setName || c._raw?.set?.name || c._raw?.set_name || "")
        .toString().toLowerCase().trim();
      const num  = c.setNum ??
                   (typeof c._raw?.set?.num === "number" ? c._raw.set.num : null) ??
                   (Number.isFinite(Number(c._raw?.set_num)) ? Number(c._raw.set_num) : null);

      // match by Lorcast code
      if (code && wantedCodes.has(code)) return true;

      // also accept legacy chips that slipped through directly (e.g., "TFC")
      if (LEGACY_TO_LORCAST[code] && wantedCodes.has(LEGACY_TO_LORCAST[code])) return true;

      // match by name or numeric series
      if (name && wantedNames.has(name)) return true;
      if (num != null && wantedNums.has(num)) return true;

      return false;
    });

  }

  // Cost filter - check if any costs are selected
  if (filters.selectedCosts && filters.selectedCosts.size > 0) {
    // Ensure selectedCosts is a Set
    if (!(filters.selectedCosts instanceof Set)) {
      console.warn('filters.selectedCosts is not a Set, converting...', filters.selectedCosts);
      filters.selectedCosts = new Set(filters.selectedCosts || []);
    }
    
    list = list.filter((c) => {
      const cost = getCost(c);
      // Handle 10+ cost cards (cost 10 and above)
      const normalizedCost = cost >= 10 ? 10 : cost;
      // Add safety check before calling .has()
      if (!(filters.selectedCosts instanceof Set)) {
        console.warn('selectedCosts is still not a Set after conversion, skipping cost filter');
        return true;
      }
      return filters.selectedCosts.has(normalizedCost);
    });
  }

  // Classifications filter
  if (filters.classifications && filters.classifications.size > 0) {
    // Ensure classifications is a Set
    if (!(filters.classifications instanceof Set)) {
      console.warn('filters.classifications is not a Set, converting...', filters.classifications);
      filters.classifications = new Set(filters.classifications || []);
    }
    
    list = list.filter((card) => {
      // Get classifications from multiple sources based on Lorcast structure
      let cardClassifications = [];
      
      // First try the normalized classifications field
      if (Array.isArray(card.classifications) && card.classifications.length > 0) {
        cardClassifications = card.classifications;
      }
      // Then try the raw data from Lorcast API
      else if (Array.isArray(card._raw?.classifications) && card._raw.classifications.length > 0) {
        cardClassifications = card._raw.classifications;
      }
      else if (card._raw?.classifications) {
        cardClassifications = [card._raw.classifications];
      }
      // Fallback to subtypes or other fields
      else if (Array.isArray(card._raw?.subtypes) && card._raw.subtypes.length > 0) {
        cardClassifications = card._raw.subtypes;
      }
      
      
      return cardClassifications.some(classification => 
        filters.classifications.has(classification) ||
        Array.from(filters.classifications).some(filterClass => 
          classification.toLowerCase() === filterClass.toLowerCase() ||
          classification.toLowerCase().includes(filterClass.toLowerCase())
        )
      );
    });
  }

  // --- Abilities filter (match ANY selected ability) ---
  if (filters.abilities && filters.abilities.size) {
    const wanted = Array.from(filters.abilities).map(normalizeAbilityToken); // to "evasive", "singer"
    
    list = list.filter(card => {
      // prefer the precomputed index
      if (card._abilitiesIndex && card._abilitiesIndex.size) {
        const matches = wanted.some(w => card._abilitiesIndex.has(w));
        if (matches) {
        }
        return matches;
      }
      // fallback to text if index missing (shouldn't happen after mapping)
      const t = String(card.text || "").toLowerCase();
      const matches = wanted.some(w => t.includes(w));
      if (matches) {
      }
      return matches;
    });
  }

  // Handle inkable/uninkable filters
  if (filters.inkable === "yes" || filters.inkable === "no") {
    list = list.filter((c) => {
      // Check multiple sources for inkable status based on Lorcast structure
      let isInkable = false;
      
      // First try the normalized inkable field
      if (typeof c.inkable === "boolean") {
        isInkable = c.inkable;
      }
      // Then try the raw data from Lorcast API
      else if (typeof c._raw?.inkable === "boolean") {
        isInkable = c._raw.inkable;
      }
      else if (typeof c._raw?.Inkable === "boolean") {
        isInkable = c._raw.Inkable;
      }
      else if (typeof c._raw?.inkwell === "boolean") {
        isInkable = c._raw.inkwell;
      }
      // Fallback to text-based detection
      else {
        isInkable = /inkable/i.test(c.text || "");
      }
      
      return filters.inkable === "yes" ? isInkable : !isInkable;
    });
  }

  // New filters
  if (filters.setNumber && filters.setNumber.trim()) {
    list = list.filter((c) => String(c.number || "") === filters.setNumber.trim());
  }

  if (filters.franchise && filters.franchise.trim()) {
    list = list.filter((c) => {
      // Check multiple sources for franchise based on Lorcast structure
      let cardFranchise = "";
      
      // First try the normalized franchise field
      if (c.franchise) {
        cardFranchise = c.franchise;
      }
      // Then try the raw data from Lorcast API
      else if (c._raw?.franchise) {
        cardFranchise = c._raw.franchise;
      }
      else if (c._raw?.Franchise) {
        cardFranchise = c._raw.Franchise;
      }
      
      
      return String(cardFranchise).toLowerCase() === filters.franchise.trim().toLowerCase();
    });
  }

  // Apply legality filter using set-based logic (same approach as sets filter)
  if (filters.gamemode && filters.gamemode.trim()) {
    
    if (filters.gamemode === "Core Constructed") {
      // Core Constructed: only allow sets 9+ (exclude sets 1-8)
      const allowedSetNums = new Set([9, 10, 11, 12, 13]); // Core Constructed: sets 9+
      
      list = list.filter((c) => {
        // Try multiple sources for set number information (same as sets filter)
        const setNum = c.setNum ?? 
                       (typeof c._raw?.set?.num === "number" ? c._raw.set.num : null) ??
                       (Number.isFinite(Number(c._raw?.set_num)) ? Number(c._raw.set_num) : null);
        
        if (setNum === null) {
          // If we can't determine the set number, allow the card through (permissive)
          return true;
        }
        
        if (allowedSetNums.has(setNum)) {
          return true; // Allow sets 5+
        } else {
          return false;
        }
      });
      
    }
    // Infinity mode: no filtering needed, show all cards
    else if (filters.gamemode === "Infinity") {
    }
  }



  if (filters.loreMin || filters.loreMax) {
    list = list.filter((c) => {
      // Check multiple sources for lore based on Lorcast structure
      let lore = 0;
      
      // First try the normalized lore field
      if (typeof c.lore === "number") {
        lore = c.lore;
      }
      // Then try the raw data from Lorcast API
      else if (typeof c._raw?.lore === "number") {
        lore = c._raw.lore;
      }
      else if (typeof c._raw?.Lore === "number") {
        lore = c._raw.Lore;
      }
      
      
      const loreMin = Number(filters.loreMin) || 0;
      const loreMax = Number(filters.loreMax) || 999;
      
      if (filters.loreMin && lore < loreMin) return false;
      if (filters.loreMax && lore > loreMax) return false;
      return true;
    });
  }

  if (filters.willpowerMin || filters.willpowerMax) {
    list = list.filter((c) => {
      // Check multiple sources for willpower based on Lorcast structure
      let willpower = 0;
      
      // First try the normalized willpower field
      if (typeof c.willpower === "number") {
        willpower = c.willpower;
      }
      // Then try the raw data from Lorcast API
      else if (typeof c._raw?.willpower === "number") {
        willpower = c._raw.willpower;
      }
      else if (typeof c._raw?.Willpower === "number") {
        willpower = c._raw.Willpower;
      }
      
      
      const willpowerMin = Number(filters.willpowerMin) || 0;
      const willpowerMax = Number(filters.willpowerMax) || 999;
      
      if (filters.willpowerMin && willpower < willpowerMin) return false;
      if (filters.willpowerMax && willpower > willpowerMax) return false;
      return true;
    });
  }

  if (filters.strengthMin || filters.strengthMax) {
    list = list.filter((c) => {
      // Check multiple sources for strength based on Lorcast structure
      let strength = 0;
      
      // First try the normalized strength field
      if (typeof c.strength === "number") {
        strength = c.strength;
      }
      // Then try the raw data from Lorcast API
      else if (typeof c._raw?.strength === "number") {
        strength = c._raw.strength;
      }
      else if (typeof c._raw?.Strength === "number") {
        strength = c._raw.Strength;
      }
      
      
      const strengthMin = Number(filters.strengthMin) || 0;
      const strengthMax = Number(filters.strengthMax) || 999;
      
      if (filters.strengthMin && strength < strengthMin) return false;
      if (filters.strengthMax && strength > strengthMax) return false;
      return true;
    });
  }



  list.sort((a, b) => {
    const dir = filters.sortDir === "desc" ? -1 : 1;

    switch (filters.sortBy) {
              case "set-ink-number": {
          // Use the consistent comparison function (set → ink → card number)
          const result = cardComparator(a, b);
          return result * dir;
        }
      case "cost":
        return (getCost(a) - getCost(b)) * dir;
      case "set": {
        const sa = `${a.set}-${a.number}`;
        const sb = `${b.set}-${b.number}`;
        return sa.localeCompare(sb) * dir;
      }
      case "ink-set-number": {
        // Use the consistent comparison function (ink → set → card number)
        const result = cardComparator(a, b);
        return result * dir;
      }
      case "rarity":
        return (rarityWeight(a.rarity) - rarityWeight(b.rarity)) * dir;
      case "name":
      default:
        return a.name.localeCompare(b.name) * dir;
    }
  });

  return list;
}


