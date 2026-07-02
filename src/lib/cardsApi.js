// -----------------------------------------------------------------------------
// Lorcast card-API layer
// -----------------------------------------------------------------------------
// Extracted verbatim from src/App.jsx (Phase 5.2 audit). Module-scope constants
// and functions for fetching cards from the Lorcast API, card normalization, and
// ability extraction. No behavior change.

// Canonical ability names you expose in the UI
export const ABILITIES_CANON = [
  "Alert", "Bodyguard", "Boost", "Challenger", "Evasive", "Reckless", "Resist", "Rush",
  "Shift", "Sing Together", "Singer", "Support", "Vanish", "Ward"
];

export function normalizeAbilityToken(s) {
  // "Singer 5" -> "singer", "Resist +2" -> "resist"
  return String(s).toLowerCase().replace(/\s*[\+\-]?\d+.*$/, "").trim();
}

export function extractAbilities(raw) {
  const text = String(
    raw?.oracle_text || raw?.rules_text || raw?.text || raw?.Body_Text || ""
  );

  const fromArrays = [
    ...(Array.isArray(raw?.keywords) ? raw.keywords : []),
    ...(Array.isArray(raw?.ability_keywords) ? raw.ability_keywords : []),
    ...(Array.isArray(raw?.abilities) ? raw.abilities : []),
    ...(raw?.Abilities ? [raw.Abilities] : []), // Lorcast sometimes uses this
  ];

  // scan text as a fallback
  const fromText = ABILITIES_CANON.filter(a =>
    text.toLowerCase().includes(a.toLowerCase())
  );

  // merge + normalize for matching + keep a pretty version too
  const pretty = Array.from(new Set([...fromArrays, ...fromText].map(String)));
  const index  = new Set(pretty.map(normalizeAbilityToken)); // lowercase, no numbers

  return { pretty, index };
}

export function normalizedType(raw) {
  const t = `${raw?.type_line || raw?.type || ""}`.toLowerCase();
  if (t.includes("character")) return "Character";
  if (t.includes("location"))  return "Location";
  if (t.includes("item"))      return "Item";
  if (t.includes("song"))      return "Song";     // Action — Song
  if (t.includes("action"))    return "Action";
  return "Other";
}

export function normalizeSetMeta(raw) {
  console.log('[normalizeSetMeta] Raw set data:', {
    set_code: raw?.set_code,
    setCode: raw?.setCode,
    set: raw?.set,
    Set_Code: raw?.Set_Code,
    'set.code': raw?.set?.code,
    set_name: raw?.set_name,
    setName: raw?.setName,
    Set_Name: raw?.Set_Name,
    'set.name': raw?.set?.name,
    set_num: raw?.set_num,
    setNum: raw?.setNum,
    Set_Num: raw?.Set_Num,
    'set.num': raw?.set?.num
  });

  const code =
    (raw?.set_code ?? raw?.setCode ?? raw?.set ?? raw?.Set_Code ?? raw?.set?.code ?? "")
      .toString().toUpperCase();

  const name =
    (raw?.set_name ?? raw?.setName ?? raw?.Set_Name ?? raw?.set?.name ?? "")
      .toString();

  const numRaw =
    raw?.set_num ?? raw?.setNum ?? raw?.Set_Num ?? raw?.set?.num ?? null;

  const num = numRaw == null ? null : Number(numRaw);

  const result = { code, name, num };
  console.log('[normalizeSetMeta] Normalized result:', result);
  return result;
}

// -----------------------------------------------------------------------------
// Single Source of Truth - API Configuration & Helpers
// -----------------------------------------------------------------------------

// Bases + defaults
export const LORCAST_BASE = "https://api.lorcast.com/v0";
export const DEFAULT_Q = "";
export const ALL_QUERY = "ink:amber or ink:amethyst or ink:emerald or ink:ruby or ink:sapphire or ink:steel or ink:colorless"; // Working query that returns cards
export const APP_VERSION = "1.0.1-lorcast-monolith+api";

export async function apiSearchCards({
  q,
  page = 1,
  pageSize = 24,
  inks = [],
  types = [],
  sets = [],
  costs = [],
  keywords = [],
  archetypes = [],
  format = "",
}) {
  // ----- Prefer Lorcast -----
  try {
    // Lorcast uses /cards/search and expects a single q expression.
    // Keep it simple and feed the text query; advanced filters can be folded into q later.
    const params = new URLSearchParams({
      q: (q && q.trim()) || DEFAULT_Q,  // default so it never returns empty on first try
      per_page: String(pageSize),
      page: String(page),
      unique: "cards",
      order: "set",
      dir: "asc",
    });
    const url = `${LORCAST_BASE}/cards/search?${params.toString()}`;
    console.log("[API] Lorcast search:", url);
    const res = await fetch(url, { headers: { Accept: "application/json" }, mode: "cors" });
    if (res.ok) {
      const json = await res.json();
      
      // Safe debugging - wrapped in try-catch to prevent any interference
      try {
        console.log('[API] Raw API response structure:', {
          hasData: !!json?.data,
          dataLength: json?.data?.length,
          hasResults: !!json?.results,
          resultsLength: json?.results?.length,
          totalCards: json?.total_cards,
          keys: Object.keys(json || {})
        });
      } catch (debugError) {
        console.warn('[API] Debug logging failed:', debugError);
      }
      
      const cards = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
      const total = Number(json?.total_cards ?? cards.length);
      const mapped = cards
        .map(c => normalizeLorcast(c)) // <<— you already have this
        .map(card => ({
          id: card.id,
          name: card.name,
          // normalized set fields you can rely on
          set: card.setCode,        // use the code as your canonical "set"
          setCode: card.setCode,
          setName: card.setName,
          setNum: card.setNum,
          number: card.number,
          cost: card.cost,
          inks: Array.isArray(card.inks) ? card.inks : [card.inks].filter(Boolean),
          type: Array.isArray(card.types) ? card.types.join("/") : card.types,
          classifications: card.classifications,
          rarity: card.rarity,
          image_url: card.image,
          text: card.text,
          // abilities/keywords (you normalize these already)
          keywords: card.abilities,
          abilities: card.abilities,
          _abilitiesIndex: card._abilitiesIndex,
          _source: card._source,
          _raw: card._raw,
        }))
        .filter(c => c.image_url);
      console.log(`[API] Lorcast returned ${mapped.length}/${total}`);
      if (mapped.length > 0) return { cards: mapped, total };
    }
  } catch (e) {
    console.warn("[API] Lorcast search failed, falling back to Lorcana-API:", e);
  }

  // Fallback disabled for now to avoid undefined URL issues.
  // If Lorcast fails, return an empty result so the UI can handle it gracefully.
  return { cards: [], total: 0 };
}

export function buildLorcastURL(q) {
  const query = (q && q.trim()) ? q.trim() : ALL_QUERY;
  const params = new URLSearchParams({
    q: query,
    unique: "cards",
  });
  return `${LORCAST_BASE}/cards/search?${params.toString()}`;
}

export async function fetchLorcast(q, _page = 1, _perPage = 250, signal) {
  const res = await fetch(buildLorcastURL(q), { headers: { Accept: "application/json" }, mode: "cors", signal });
  if (!res.ok) throw new Error(`Lorcast ${res.status}`);
  const json = await res.json();
  const list = Array.isArray(json?.results) ? json.results : [];
  return { list, total: list.length, source: "lorcast" };
}



/* removed buildLorcanaApiURL for Lorcast-only */


/* removed fetchLorcanaApi for Lorcast-only */


export async function fetchCardsPreferred(q, { page = 1, perPage = 250, signal } = {}) {
  try {
    return await fetchLorcast(q, page, perPage, signal);
  } catch (e) {
    console.warn("[fetchCardsPreferred] Lorcast failed:", e);
    return { list: [], total: 0, source: "lorcast" };
  }
}

// Comprehensive abilities normalization helper
// This function extracts abilities from ALL possible sources in Lorcast data:
// 1. Keywords array (e.g., ["Bodyguard", "Ward"])
// 2. Abilities array (e.g., ["Support", "Rush"])
// 3. Abilities string (e.g., "Shift 5, Bodyguard")
// 4. Text scanning for known ability keywords
// 5. Special handling for complex abilities like "Shift 5"
export function normalizeAbilities(card) {
  // Define all known Lorcana ability keywords
  const KNOWN_ABILITIES = [
    "Bodyguard", "Evasive", "Resist", "Ward", "Shift", "Support", 
    "Challenger", "Reckless", "Rush", "Singer", "Vanish", "Villain",
    "Hero", "Princess", "Queen", "King", "Prince", "Dragon", "Fairy",
    "Mermaid", "Pirate", "Royal", "Ally", "Enemy", "Friend", "Foe",
    "Guard", "Scout", "Warrior", "Mage", "Archer", "Knight", "Paladin",
    "Rogue", "Wizard", "Cleric", "Fighter", "Monk", "Ranger", "Sorcerer",
    "Warlock", "Bard", "Druid", "Barbarian", "Artificer", "Blood Hunter"
  ];

  // Collect abilities from all possible sources
  const abilities = new Set();

  // 1. From Keywords array
  if (Array.isArray(card.keywords)) {
    card.keywords.forEach(k => {
      if (k && typeof k === 'string' && k.trim()) {
        abilities.add(k.trim());
      }
    });
  }

  // 2. From Abilities array
  if (Array.isArray(card.Abilities)) {
    card.Abilities.forEach(a => {
      if (a && typeof a === 'string' && a.trim()) {
        abilities.add(a.trim());
      }
    });
  }

  // 3. From Abilities string (comma-separated)
  if (typeof card.Abilities === 'string' && card.Abilities.trim()) {
    card.Abilities.split(',').forEach(a => {
      if (a && a.trim()) {
        abilities.add(a.trim());
      }
    });
  }

  // 4. From abilities array (lowercase)
  if (Array.isArray(card.abilities)) {
    card.abilities.forEach(a => {
      if (a && typeof a === 'string' && a.trim()) {
        abilities.add(a.trim());
      }
    });
  }

  // 5. From text fields - scan for ability keywords
  const textFields = [
    card.text,
    card.Body_Text,
    card.body_text,
    card.oracle_text,
    card.rules_text
  ].filter(Boolean);

  textFields.forEach(text => {
    if (typeof text === 'string') {
      // Split text into words and check for known abilities
      const words = text.split(/[^A-Za-z]+/);
      words.forEach(word => {
        if (KNOWN_ABILITIES.includes(word)) {
          abilities.add(word);
        }
      });
    }
  });

  // 6. Special handling for Shift (often appears as "Shift 5" or similar)
  if (card.text && typeof card.text === 'string') {
    const shiftMatch = card.text.match(/Shift\s+\d+/i);
    if (shiftMatch) {
      abilities.add('Shift');
    }
  }

  const result = Array.from(abilities);
  
  // Debug logging for abilities normalization
  if (result.length > 0) {
    console.log(`[normalizeAbilities] Found abilities for ${card.name}:`, result);
  }
  
  return result;
}

export function normalizeLorcast(c) {
  console.log('[normalizeLorcast] Raw card data:', {
    name: c.name,
    set: c.set,
    ink: c.ink,
    inks: c.inks,
    type: c.type,
    rarity: c.rarity,
    _fullSet: c.set,
    _fullType: c.type,
    Abilities: c.Abilities,
    abilities: c.abilities,
    keywords: c.keywords,
    Body_Text: c.Body_Text,
    body_text: c.body_text,
    text: c.text
  });
  
  const dig = c?.image_uris?.digital || {};
  const image =
    dig.large || dig.normal || dig.small ||
    c?.image_uris?.large || c?.image_uris?.normal || c?.image_uris?.small || "";

  const typeList = Array.isArray(c.type) ? c.type : (typeof c.type === "string" ? [c.type] : []);
  
  // Robust ink handling - try multiple sources
  let inks = [];
  if (Array.isArray(c.inks) && c.inks.length > 0) {
    inks = c.inks;
  } else if (Array.isArray(c.ink) && c.ink.length > 0) {
    inks = c.ink;
  } else if (c.ink) {
    inks = [c.ink];
  } else if (c.color) {
    inks = [c.color];
  } else if (c.colors) {
    inks = Array.isArray(c.colors) ? c.colors : [c.colors];
  }
  
  // Use Lorcast's set object directly (set.code is "1", "2", "D100", etc.)
  const rawSet = c.set || {};
  const setCode = String(rawSet.code ?? rawSet).toUpperCase(); // "1", "2", "D100"
  const setName = String(rawSet.name ?? "");
  const setNum = /^\d+$/.test(setCode) ? Number(setCode) : null; // 1, 2, 3… else null (e.g. "D100")
  
  // Extract abilities using the new helper
  const { pretty: abilities, index: _abilitiesIndex } = extractAbilities(c);
  
      // Use the version field directly from the API for subtitle
    const baseName = c.name;
    const subname = c.version;
    
    // Debug: Log the extraction
    if (subname) {
      console.log(`[normalizeLorcast] Using version for "${c.name}": baseName="${baseName}", subname="${subname}"`);
    }
    
    const result = {
      id: c.id || c.collector_number || c.name,
      name: c.name,
      baseName,                    // <-- Base name (without subtitle)
      subname,                     // <-- Subtitle from version field
      // NORMALIZED set fields using Lorcast's actual model:
      set: setCode || setName || (setNum != null ? String(setNum) : ""),
      setCode: setCode,           // canonical key for filters/sort ("1", "2", "D100")
      setName: setName,           // nice label ("The First Chapter")
      setNum: setNum,            // numeric if possible, else null (1, 2, 3...)
      number: c.collector_number,
      types: typeList,
      classifications: Array.isArray(c.classifications) ? c.classifications : [],
      rarity: c.rarity,
      cost: c.cost ?? c.ink_cost,
      inks: inks,
      text: c.oracle_text || c.text || c.body_text || c.Body_Text || c.rules_text || "",
      keywords: abilities, // Use the pretty abilities list
      abilities: abilities, // Use the pretty abilities list
      _abilitiesIndex: _abilitiesIndex, // Add the normalized index for filtering
      image,
      _source: "lorcast",
      _raw: c,
      // Preserve inkable flag for proper detection - prioritize inkwell field
      inkable: Boolean(c.inkable ?? c.inkwell ?? c.can_be_ink ?? c.Inkable ?? false),
    };
  
  console.log('[normalizeLorcast] Normalized result:', {
    name: result.name,
    set: result.set,
    setCode: result.setCode,
    setNum: result.setNum,
    inks: result.inks,
    type: result.types,
    text: result.text,
    keywords: result.keywords
  });
  
  return result;
}

export function normalizeLorcanaApi(c) {
  // Use the new normalized helpers
  const setMeta = normalizeSetMeta(c);
  const cardType = normalizedType(c);
  
  // Extract abilities using the new helper
  const { pretty: abilities, index: _abilitiesIndex } = extractAbilities(c);
  
  return {
    id: c._id || c.id || c.card_id || c.name,
    name: c.name,
    // NORMALIZED set fields you can rely on everywhere:
    set: setMeta.code,           // e.g. "TFC"
    setCode: setMeta.code,       // e.g. "TFC"
    setName: setMeta.name,       // e.g. "The First Chapter"
    setNum: setMeta.num,         // numeric series index if present
    number: c.card_num || c.collector_number,
    types: c.types || [],
    rarity: c.rarity,
    cost: c.ink_cost ?? c.cost,
    inks: c.ink || c.inks || [],
    text: c.Body_Text || c.body_text || c.text || "",
    keywords: abilities, // Use the pretty abilities list
    abilities: abilities, // Use the pretty abilities list
    _abilitiesIndex: _abilitiesIndex, // Add the normalized abilities index
    image: c.image || c.imageUrl || "",
    _source: "lorcana-api",
    _raw: c,
  };
}

export function normalizeCards(list, source) {
  return source === "lorcast" ? list.map(normalizeLorcast) : list.map(normalizeLorcanaApi);
}

// -----------------------------------------------------------------------------
// ONE definitive fetchAllCards that RETURNS AN ARRAY and uses DEFAULT_Q
export async function fetchAllCards({ signal } = {}) {
  try {
    const { list, total, source } = await fetchCardsPreferred(DEFAULT_Q, { page: 1, perPage: 2000, signal });
    const normalized = normalizeCards(list, source);
    console.log(`[API] Loaded ${normalized.length}/${total} cards from ${source}`);
    
    // Safe debugging: Check if we're getting cards with subnames
    try {
      const cardsWithSubnames = normalized.filter(card => card.name && card.name.includes(' - '));
      console.log(`[API] Cards with subnames found: ${cardsWithSubnames.length}`);
      if (cardsWithSubnames.length > 0) {
        console.log('[API] Sample subname cards:', cardsWithSubnames.slice(0, 5).map(c => c.name));
      }
    } catch (debugError) {
      console.warn('[API] Subname detection debug failed:', debugError);
    }
    
    const mapped = normalized.map(card => ({
      id: card.id,
      name: card.name,
      // CRITICAL: Preserve baseName and subname for subtitle matching
      baseName: card.baseName,
      subname: card.subname,
      // NORMALIZED set fields you can rely on everywhere:
      set: card.set,           // e.g. "TFC"
      setCode: card.setCode,   // e.g. "TFC"
      setName: card.setName,   // e.g. "The First Chapter"
      setNum: card.setNum,     // numeric series index if present
      number: card.number,
      cost: card.cost,
      inks: Array.isArray(card.inks) ? card.inks : [card.inks].filter(Boolean),
      type: Array.isArray(card.types) ? card.types.join("/") : card.types,
      rarity: card.rarity,
      image_url: card.image,
      _source: card._source,
      _raw: card._raw,
      // Preserve additional fields that might be needed for filtering
      text: card.text,
      classifications: card.classifications,
      keywords: card.keywords,
      abilities: card.keywords, // Now contains comprehensive abilities from all sources
      _abilitiesIndex: card._abilitiesIndex, // Preserve the normalized abilities index
      franchise: card.franchise,
      gamemode: card.gamemode,
      inkable: card.inkable,
      lore: card.lore,
      willpower: card.willpower,
      strength: card.strength
    }));
    
    // Debug: Check if abilities are being extracted correctly
    const sample = mapped.find(x => x.name && x._abilitiesIndex?.size);
    if (sample) {
      console.log("[DBG] Sample abilities", sample.name, sample._abilitiesIndex, sample.abilities);
    } else {
      console.log("[DBG] No cards with abilities index found");
    }
    
    // Debug: Check if set fields are being normalized correctly
    const setSample = mapped.find(x => x.name && x.set);
    if (setSample) {
      console.log("[DBG] Set fields sample", setSample.name, setSample.set, setSample.setName, setSample.setNum);
    } else {
      console.log("[DBG] No cards with set fields found");
    }
    
    // Debug: Check if baseName and subname are being preserved
    const subnameSample = mapped.find(x => x.name && x.subname);
    if (subnameSample) {
      console.log("[DBG] Subname sample", subnameSample.name, "baseName:", subnameSample.baseName, "subname:", subnameSample.subname);
    } else {
      console.log("[DBG] No cards with subname fields found");
    }
    
    return mapped;
  } catch (e) {
    console.error("[API] Unified fetch failed:", e);
    return [];
  }
}

export function removeDuplicateCards(cards) {
  const seen = new Set();
  const uniqueCards = [];
  
  for (const card of cards) {
    if (!card || typeof card !== 'object') continue;
    
    // Create a unique identifier for the card
    const cardId = card.id || `${card.set || 'unknown'}-${card.number || 'unknown'}-${card.name || 'unknown'}`;
    
    if (!seen.has(cardId)) {
      seen.add(cardId);
      uniqueCards.push(card);
    }
  }
  
  return uniqueCards;
}

// Simplified card processing - just return cards as-is
export function processAndNormalizeCards(cards) {
  if (!Array.isArray(cards) || cards.length === 0) {
    console.warn('[API] No cards to process');
    return [];
  }
  
  console.log(`[API] Processing ${cards.length} cards (no validation)`);
  
  // Just return the cards directly without complex validation
  return cards;
}

export function normalizeCard(raw) {
  if (!raw || typeof raw !== 'object') {
    console.warn('[normalizeCard] Invalid raw data:', raw);
    return null;
  }
  
  if (!raw.name && !raw.title) {
    console.warn('[normalizeCard] Card missing name/title:', raw);
    return null;
  }
  
  // Handle both Lorcana-API.com and Lorcast formats
  let imageUrl = null;
  
  // Try Lorcana-API.com format first
  if (raw.Image || raw.image || raw.ImageUrl || raw.ImageURL || raw.Images) {
    imageUrl = raw.Image || raw.image || raw.ImageUrl || raw.ImageURL || 
               (raw.Images && (raw.Images.Full || raw.Images.full || raw.Images.Normal));
  }
  // Fallback to Lorcast format
  else if (raw.image_uris && raw.image_uris.digital) {
    const dig = raw.image_uris.digital;
    imageUrl = dig.large || dig.normal || dig.small;
  }
  // Try other common fields
  else if (raw.image_url || raw.image) {
    imageUrl = raw.image_url || raw.image;
  }
  // Try Lorcast API Image field
  else if (raw.Image) {
    imageUrl = raw.Image;
  }
  
  const displayName = raw.name || raw.Name || raw.title || raw.Title || "Unknown Card";
  
  // Extract baseName and subname from display name (split on hyphen/en dash/em dash)
  const parts = displayName.split(/\s*[-–—]\s*/);
  const baseName = parts[0]?.trim() || displayName;
  const subname = parts[1]?.trim() || null;
  
  const setCode = raw.set?.code || raw.set || raw.set_code || raw.setCode || raw.setName || raw.Set_ID || "Unknown";
  const collectorNo = raw.collector_number || raw.number || raw.no || raw.Card_Num || 0;
  const cost = raw.cost ?? raw.ink_cost ?? raw.inkCost ?? raw.Cost ?? 0;
  const inks = raw.ink ? [raw.ink] : (raw.Color ? raw.Color.split(',').map(c => c.trim()) : []);
  const type = Array.isArray(raw.type) ? raw.type.join("/") : (raw.type || raw.Type || "Unknown");
  const rarity = raw.rarity || raw.rarityLabel || raw.Rarity || "Unknown";
  const text = raw.text || raw.rules_text || raw.abilityText || raw.rules || raw.abilities || raw.Body_Text || "";
  
  const id = raw.id || raw._id || raw.Unique_ID || `${setCode}-${collectorNo}-${displayName}`;
  
  return {
    id,
    name: displayName,        // Keep exact from API
    baseName,                 // <-- New: extracted base name
    subname,                  // <-- New: extracted subtitle
    set: setCode,
    setName: raw.set?.name || raw.Set_Name || undefined,
    number: collectorNo,
    cost,
    inks,
    type,
    rarity,
    text,
    classifications: raw.classifications || raw.Classifications || raw.subtypes || [],
    keywords: raw.keywords || raw.Abilities || raw.abilities || [],
    // Store the image URL directly without processing
    image_url: imageUrl, // This now handles both API formats
    _raw: raw,
    // Additional fields
    franchise: raw.franchise || raw.Franchise || "",
    gamemode: raw.gamemode || raw.Gamemode || "",
    inkable: Boolean(raw.inkable ?? raw.can_be_ink ?? raw.Inkable ?? raw.inkwell ?? false),
    lore: raw.lore || raw.Lore || 0,
    willpower: raw.willpower || raw.Willpower || 0,
    strength: raw.strength || raw.Strength || 0,
    setNum: raw.setNum || raw.Set_Num || undefined,
  };
}
