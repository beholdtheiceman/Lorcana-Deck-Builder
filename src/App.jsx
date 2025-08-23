// React & ecosystem -----------------------------------------------------------
import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  Fragment,
  createContext,
  useContext,
} from "react";

console.log('[React Import] React object:', React);
console.log('[React Import] createContext function:', createContext);
console.log('[React Import] useContext function:', useContext);

// If recharts is available in your project; it's optional. Remove if not used.
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

// Icons (lucide-react) - optional; replace with your icon lib || inline SVGs
// import { Search, Filter, Settings, X, Download, Upload } from "lucide-react";

// Authentication components
import AuthButton from './components/AuthButton';

// Ink colors supported by the filters. Feel free to expand.
const INK_COLORS = ["Amber", "Amethyst", "Emerald", "Ruby", "Sapphire", "Steel"];

// Rarity options sample
const RARITIES = ["Common", "Uncommon", "Rare", "Super Rare", "Legendary"];

// Card types (simplified). Adjust to your schema.
// Note: "Song" represents "Action - Song" cards from the API
const CARD_TYPES = ["Character", "Action", "Item", "Location", "Song"];

// Card classifications (Lorcana character classifications)
const CLASSIFICATIONS = [
  "Ally", "Captain", "Detective", "Dreamborn", "Floodborn", "Hyena", "Inventor", 
  "King", "Mentor", "Pirate", "Princess", "Queen", "Robot", "Storyborn", "Titan",
  "Alien", "Broom", "Deity", "Dragon", "Fairy", "Hero", "Illusion", "Knight", "Madrigal", 
  "Musketeer", "Prince", "Puppy", "Racer", "Seven Dwarfs", "Sorcerer", "Tigger", "Villain"
];

// Canonical ability names you expose in the UI
const ABILITIES_CANON = [
  "Bodyguard", "Challenger", "Evasive", "Reckless", "Resist", "Rush",
  "Shift", "Singer", "Support", "Ward", "Vanish"
];

// Legacy ABILITIES constant for backward compatibility
const ABILITIES = ABILITIES_CANON;

// Missing constant - add fallback image
const FALLBACK_IMG = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQyMCIgdmlld0JveD0iMCAwIDMwMCA0MjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDIwIiBmaWxsPSIjMmQzNzQ4Ii8+CjxyZWN0IHg9IjUiIHk9IjUiIHdpZHRoPSIyOTAiIGhlaWdodD0iNDEwIiBzdHJva2U9IiM3MTgwOTYiIHN0cm9rZS13aWR0aD0iMiIvPgo8dGV4dCB4PSIxNTAiIHk9IjIxMCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE2IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Q2FyZDwvdGV4dD4KPC9zdmc+";

function normalizeAbilityToken(s) {
  // "Singer 5" -> "singer", "Resist +2" -> "resist"
  return String(s).toLowerCase().replace(/\s*[\+\-]?\d+.*$/, "").trim();
}

function extractAbilities(raw) {
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

function normalizedType(raw) {
  const t = `${raw?.type_line || raw?.type || ""}`.toLowerCase();
  if (t.includes("character")) return "Character";
  if (t.includes("location"))  return "Location";
  if (t.includes("item"))      return "Item";
  if (t.includes("song"))      return "Song";     // Action — Song
  if (t.includes("action"))    return "Action";
  return "Other";
}

function normalizedSetCode(raw) {
  return String(
    raw?.set || raw?.set_code || raw?.setCode || raw?.set?.code || ""
  ).toUpperCase();
}

function normalizeSetMeta(raw) {
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

// New filter constants
// const FRANCHISES = ["Bolt", "Disney", "Pixar", "Marvel", "Star Wars", "Indiana Jones"]; // Commented out - no longer used
const GAMEMODES = ["Lorcana", "Limited", "Constructed"];
const INKABLE_OPTIONS = ["Any", "Inkable", "Non-Inkable"];

// Legacy code mapping for UI compatibility (TFC ↔ "1", ROC ↔ "2", etc.)
const LEGACY_TO_LORCAST = {
  TFC: "1", ROC: "2", IAT: "3", URS: "4", SSK: "5", AZS: "6", ARI: "7", ROJ: "8", D100: "D100"
};
const LORCAST_TO_LEGACY = Object.fromEntries(
  Object.entries(LEGACY_TO_LORCAST).map(([k, v]) => [v, k])
);

// Sets (official Lorcana set names with comprehensive filtering options)
const SETS = [
  { code: "TFC", name: "The First Chapter", shortName: "TFC", setNum: 1 },
  { code: "ROC", name: "Rise of the Floodborn", shortName: "ROC", setNum: 2 },
  { code: "IAT", name: "Into the Inklands", shortName: "IAT", setNum: 3 },
  { code: "URS", name: "Ursula's Return", shortName: "URS", setNum: 4 },
  { code: "SSK", name: "Shimmering Skies", shortName: "SSK", setNum: 5 },
  { code: "AZS", name: "Azurite Sea", shortName: "AZS", setNum: 6 },
  { code: "ARI", name: "Archazia's Island", shortName: "ARI", setNum: 7 },
  { code: "ROJ", name: "Reign of Jafar", shortName: "ROJ", setNum: 8 },
];

// Set order for consistent sorting (ink → set → set number → card number)
const SET_ORDER = ["TFC", "ROC", "IAT", "URS", "SSK", "AZS", "ARI", "ROJ"];

// Helper function to get set info by set number
function getSetByNumber(setNum) {
  return SETS.find(set => set.setNum === setNum);
}

// Helper function to get set info by code
function getSetByCode(code) {
  return SETS.find(set => set.code === code);
}

// Robust card comparison function that doesn't rely on set_num
const INK_ORDER = ["Amber","Amethyst","Emerald","Ruby","Sapphire","Steel"];
const SET_CODE_ORDER = ["1","2","3","4","5","6","7","8","D100"]; // extend as new sets arrive

function primaryInk(card){
  return (Array.isArray(card.inks) && card.inks[0]) || card.ink || card._raw?.ink || "";
}

function collectorParts(card){
  const raw = (card.number ?? card.collector_number ?? card._raw?.collector_number ?? "").toString();
  const m = raw.match(/^(\d+)([A-Za-z]*)$/);
  return { num: m ? parseInt(m[1],10) : Number.MAX_SAFE_INTEGER, suf: m ? m[2].toLowerCase() : "" };
}



function cardComparator(a, b) {
  // 1) Ink
  const ia = INK_ORDER.indexOf(primaryInk(a)), ib = INK_ORDER.indexOf(primaryInk(b));
  if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);

  // 2) Set: prefer numeric code, else explicit order list
  const ac = (a.setCode || "").toUpperCase();
  const bc = (b.setCode || "").toUpperCase();
  const an = /^\d+$/.test(ac) ? Number(ac) : null;
  const bn = /^\d+$/.test(bc) ? Number(bc) : null;
  if (an != null && bn != null && an !== bn) return an - bn;

  const sa = SET_CODE_ORDER.indexOf(ac), sb = SET_CODE_ORDER.indexOf(bc);
  if (sa !== sb) return (sa === -1 ? 999 : sa) - (sb === -1 ? 999 : sb);

  // 3) Collector number (numeric then suffix)
  const ca = collectorParts(a), cb = collectorParts(b);
  if (ca.num !== cb.num) return ca.num - cb.num;
  if (ca.suf !== cb.suf) return ca.suf < cb.suf ? -1 : 1;

  // 4) Name tiebreaker
  return String(a.name).localeCompare(String(b.name));
}

// Helper to extract normalized set code and name from any card
function getSetCodeAndName(card) {
  const code =
    (card.setCode || card.set || card._raw?.set?.code || card._raw?.set_code || "")
      .toString().toUpperCase().trim();
  const name =
    (card.setName || card._raw?.set?.name || card._raw?.set_name || "")
      .toString().toLowerCase().trim();
  return { code, name };
}

// -----------------------------------------------------------------------------
// Utility helpers
// -----------------------------------------------------------------------------

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// Comprehensive data validation and quality assessment
function validateCardData(card) {
  if (!card || typeof card !== 'object') {
    return { isValid: false, issues: ['Not an object'] };
  }
  
  const issues = [];
  
  // Essential fields validation
  if (!card.name && !card.title) {
    issues.push('Missing name/title');
  }
  
  if (!card.set && !card.set_code && !card.setName) {
    issues.push('Missing set information');
  }
  
  if (!card.number && !card.collector_number && !card.no) {
    issues.push('Missing card number');
  }
  
  // Image data validation
  if (!card.image_uris || !card.image_uris.digital) {
    issues.push('Missing image data');
  }
  
  // Data quality scoring
  let qualityScore = 100;
  if (issues.length > 0) {
    qualityScore = Math.max(0, 100 - (issues.length * 20));
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    qualityScore,
    hasEssentialData: !issues.includes('Missing name/title') && 
                     !issues.includes('Missing set information') && 
                     !issues.includes('Missing card number')
  };
}

// Batch validation for multiple cards
function validateCardBatch(cards) {
  if (!Array.isArray(cards)) {
    return { validCards: [], invalidCards: [], summary: { total: 0, valid: 0, invalid: 0, qualityScore: 0 } };
  }
  
  const validCards = [];
  const invalidCards = [];
  let totalQualityScore = 0;
  
  cards.forEach((card, index) => {
    const validation = validateCardData(card);
    
    if (validation.isValid) {
      validCards.push(card);
      totalQualityScore += validation.qualityScore;
    } else {
      invalidCards.push({ card, validation, index });
    }
  });
  
  const summary = {
    total: cards.length,
    valid: validCards.length,
    invalid: invalidCards.length,
    qualityScore: validCards.length > 0 ? Math.round(totalQualityScore / validCards.length) : 0
  };
  
  return { validCards, invalidCards, summary };
}

// Enhanced error handling with retry logic
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Fetch] Attempt ${attempt}/${maxRetries} for: ${url}`);
      
      const response = await fetch(url, options);
      
      if (response.ok) {
        return response;
      }
      
      // Handle specific HTTP errors
      if (response.status === 429) {
        // Rate limited - wait longer before retry
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`[Fetch] Rate limited, waiting ${waitTime}ms before retry`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      if (response.status >= 500) {
        // Server error - retry with exponential backoff
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.log(`[Fetch] Server error ${response.status}, waiting ${waitTime}ms before retry`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // Client errors (4xx) shouldn't be retried
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      
    } catch (error) {
      lastError = error;
      console.warn(`[Fetch] Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        // Wait before retry with exponential backoff
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.log(`[Fetch] Waiting ${waitTime}ms before retry ${attempt + 1}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw new Error(`Failed after ${maxRetries} attempts. Last error: ${lastError?.message}`);
}

function debounce(fn, delay) {
  let t = null;
  return (...args) => {
    window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), delay);
  };
}

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const k = keyFn(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {});
}

function sum(arr, sel = (x) => x) {
  return arr.reduce((a, b) => a + sel(b), 0);
}

function average(arr, sel = (x) => x) {
  if (!arr.length) return 0;
  return sum(arr, sel) / arr.length;
}

function toTitleCase(str) {
  return (str || "")
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Uniform attempt to compute cost from card structure
function getCost(card) {
  return card?.cost ?? card?.ink_cost ?? card?.inkCost ?? 0;
}

// Get primary ink color for sorting (first ink in the array)
function getPrimaryInk(card) {
  console.log('[getPrimaryInk] Card:', card?.name, 'inks:', card?.inks, 'ink:', card?.ink, '_raw:', card?._raw);
  
  if (Array.isArray(card?.inks) && card.inks.length > 0) {
    console.log('[getPrimaryInk] Using inks array:', card.inks[0]);
    return card.inks[0];
  }
  if (card?.ink) {
    const result = Array.isArray(card.ink) ? card.ink[0] : card.ink;
    console.log('[getPrimaryInk] Using ink field:', result);
    return result;
  }
  
  // Try to get from _raw data
  if (card?._raw?.ink) {
    const result = Array.isArray(card._raw.ink) ? card._raw.ink[0] : card._raw.ink;
    console.log('[getPrimaryInk] Using _raw.ink:', result);
    return result;
  }
  
  console.log('[getPrimaryInk] No ink found, returning empty string');
  return "";
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

// Normalize inks from either Lorcast (card.inks array) or lorcana-api (Color string)
function getCardInks(card) {
  if (Array.isArray(card.inks) && card.inks.length) {
    return new Set(card.inks.map(s => s.trim()));
  }
  if (typeof card.Color === "string" && card.Color.length) {
    return new Set(card.Color.split(",").map(s => s.trim()));
  }
  return new Set(); // fallback
}

// selectedInks is a Set<string> from your UI
function matchesInkFilter(card, selectedInks) {
  const selCount = selectedInks.size;
  if (selCount === 0) return true;

  const inks = getCardInks(card);
  const cardCount = inks.size;

  // 1 ink selected: include mono or dual that contain it
  if (selCount === 1) {
    const [only] = [...selectedInks];
    return inks.has(only);
  }

  // 2 inks selected:
  // - include mono cards that match either of the two
  // - include dual ONLY if exactly those two inks
  if (selCount === 2) {
    if (cardCount === 1) {
      // mono: match either selected ink
      const [a, b] = [...selectedInks];
      return inks.has(a) || inks.has(b);
    }
    if (cardCount === 2) {
      // dual: must match both selected inks exactly
      for (const ink of selectedInks) {
        if (!inks.has(ink)) return false;
      }
      return true;
    }
    return false;
  }

  // 3+ inks selected (Lorcana is mono/dual): fall back to mono that match any selected ink
  // (Duals can't match exactly, so only allow if both inks ⊆ selected set — optional)
  if (cardCount === 1) {
    for (const ink of selectedInks) if (inks.has(ink)) return true;
    return false;
  }
  if (cardCount === 2) {
    // Optional: allow duals only if both inks are within the selected set
    for (const ink of inks) if (!selectedInks.has(ink)) return false;
    return true;
  }
  return false;
}

// Try to format a code+number (e.g., set code and card number) into a consistent slug
function safeSlug(...parts) {
  return parts
    .filter(Boolean)
    .join("-")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .toLowerCase();
}

// --- Helper: safely encode image URLs (spaces, apostrophes, etc.) ---
function encodeImageURL(u) {
  if (typeof u !== 'string') return u;
  try {
    // encodeURI keeps protocol and slashes but encodes spaces, etc.
    let enc = encodeURI(u);
    // Also encode apostrophes explicitly (encodeURI leaves them)
    enc = enc.replace(/'/g, '%27');
    return enc;
  } catch {
    return u;
  }
}

// Global image loading function for batch operations with CORS handling
function tryLoadImage(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timeout = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      console.warn(`[Image Load] Timeout for: ${imageUrl}`);
      reject(new Error('Image load timeout'));
    }, 5000); // Increased timeout
    
    img.onload = () => {
      clearTimeout(timeout);
      console.log(`[Image Load] Success: ${imageUrl}`);
      resolve(imageUrl);
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      console.warn(`[Image Load] Failed: ${imageUrl}`);
      reject(new Error('Image failed to load'));
    };
    
    // Simple CORS handling
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
  });
}

// Enhanced image loading with CORS fallback
async function tryLoadImageWithCORSFallback(imageUrl, originalUrl = null) {
  try {
    // First try with the current URL (which might be proxied)
    return await tryLoadImage(imageUrl);
  } catch (error) {
    console.warn(`[CORS Fallback] Primary image load failed: ${imageUrl}`, error.message);
    
    // If we have an original URL and the current one is proxied, try the original
    if (originalUrl && imageUrl !== originalUrl) {
      try {
        console.log(`[CORS Fallback] Trying original URL: ${originalUrl}`);
        return await tryLoadImage(originalUrl);
      } catch (fallbackError) {
        console.warn(`[CORS Fallback] Original URL also failed: ${originalUrl}`, fallbackError.message);
      }
    }
    
    // If all else fails, try alternative CORS proxies
    const alternativeProxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`,
      `https://cors-anywhere.herokuapp.com/${imageUrl}`,
      `https://thingproxy.freeboard.io/fetch/${imageUrl}`
    ];
    
    for (const proxyUrl of alternativeProxies) {
      try {
        console.log(`[CORS Fallback] Trying alternative proxy: ${proxyUrl}`);
        return await tryLoadImage(proxyUrl);
      } catch (proxyError) {
        console.warn(`[CORS Fallback] Proxy failed: ${proxyUrl}`, proxyError.message);
      }
    }
    
    // If everything fails, throw the original error
    throw error;
  }
}

// Better CORS handling function
async function tryLoadImageWithBetterCORS(imageUrl) {
  // Strategy 1: Try direct loading with crossOrigin
  try {
    console.log(`[CORS Strategy] Attempting direct load with crossOrigin: ${imageUrl}`);
    return await tryLoadImage(imageUrl);
  } catch (error) {
    console.warn(`[CORS Strategy] Direct load failed: ${imageUrl}`, error.message);
  }
  
  // Strategy 2: Try with a more reliable CORS proxy
  const reliableProxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`,
    `https://cors.bridged.cc/${imageUrl}`,
    `https://cors-anywhere.herokuapp.com/${imageUrl}`
  ];
  
  for (const proxyUrl of reliableProxies) {
    try {
      console.log(`[CORS Strategy] Trying reliable proxy: ${proxyUrl}`);
      return await tryLoadImage(proxyUrl);
    } catch (proxyError) {
      console.warn(`[CORS Strategy] Proxy failed: ${proxyUrl}`, proxyError.message);
    }
  }
  
  // Strategy 3: Try to fetch the image as a blob and create a local URL
  try {
    console.log(`[CORS Strategy] Attempting blob fetch: ${imageUrl}`);
    const response = await fetch(imageUrl, { 
      mode: 'cors',
      credentials: 'omit'
    });
    if (response.ok) {
      const blob = await response.blob();
      const localUrl = URL.createObjectURL(blob);
      console.log(`[CORS Strategy] Blob fetch successful, created local URL: ${localUrl}`);
      return localUrl;
    }
  } catch (blobError) {
    console.warn(`[CORS Strategy] Blob fetch failed: ${imageUrl}`, blobError.message);
  }
  
  // If all strategies fail, throw an error
  throw new Error(`All CORS strategies failed for: ${imageUrl}`);
}

// Working solution: Try multiple image sources to find one that works
async function getWorkingImageUrl(card) {
  if (!card) return null;
  
  // Strategy 1: Try to construct a working URL from the card data
  if (card.set && card.number) {
    const setCode = card.set.toString().toUpperCase();
    const cardNumber = card.number.toString().padStart(3, '0');
    
    // Try different URL patterns that might work
    const urlPatterns = [
      `https://api.lorcast.com/v0/cards/${setCode}/${cardNumber}/image`,
      `https://api.lorcast.com/v0/images/${setCode}/${cardNumber}.jpg`,
      `https://api.lorcast.com/v0/images/${setCode}-${cardNumber}.jpg`,
      `https://api.lorcast.com/v0/cards/${setCode}-${cardNumber}/image`
    ];
    
    for (const url of urlPatterns) {
      try {
        console.log(`[Image Source] Trying URL pattern: ${url}`);
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
          console.log(`[Image Source] Found working URL: ${url}`);
          return url;
        }
      } catch (error) {
        console.warn(`[Image Source] URL pattern failed: ${url}`, error.message);
      }
    }
  }
  
  // Strategy 2: If we have an original image URL, try to use it with different approach
  if (card._originalImageUrl) {
    console.log(`[Image Source] Using original URL as fallback: ${card._originalImageUrl}`);
    return card._originalImageUrl;
  }
  
  // Strategy 3: Return null and let the component handle it with a placeholder
  console.warn(`[Image Source] No working image URL found for card: ${card.name}`);
  return null;
}

// Simple, reliable image proxy solution (from App (7).jsx)
function proxyImageUrl(src) {
  if (!src) return "";
  try {
    const u = new URL(src);
    // Avoid double-proxying
    if (u.hostname.includes("weserv.nl")) return src;
  } catch {
    // ignore bad URLs; still try to proxy
  }
  // Use weserv.nl to bypass hotlink/CORS and normalize sizing
  // This is the same approach that works in App (7).jsx
  return `https://images.weserv.nl/?url=${encodeURIComponent(src)}&output=jpg`;
}

// New approach: Generate local placeholder images with card data
function generateLocalCardImage(card) {
  if (!card || typeof card !== 'object') return null;
  
  try {
    // Create a canvas-based image with card information
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size (standard card dimensions)
    canvas.width = 300;
    canvas.height = 420;
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Card border
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    
    // Card name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.textAlign = 'center';
    
    // Wrap text if too long
    const maxWidth = canvas.width - 40;
    const words = (card.name || 'Unknown Card').split(' ');
    let line = '';
    let y = 80;
    
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, canvas.width / 2, y);
        line = words[n] + ' ';
        y += 25;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, canvas.width / 2, y);
    
    // Card details
    y += 40;
    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = '#cccccc';
    
    if (card.set) {
      ctx.fillText(`Set: ${card.set}`, canvas.width / 2, y);
      y += 20;
    }
    
    if (card.number) {
      ctx.fillText(`#${card.number}`, canvas.width / 2, y);
      y += 20;
    }
    
    if (card.type) {
      ctx.fillText(`Type: ${card.type}`, canvas.width / 2, y);
      y += 20;
    }
    
    if (card.cost !== undefined) {
      ctx.fillText(`Cost: ${card.cost}`, canvas.width / 2, y);
      y += 20;
    }
    
    // Convert canvas to data URL
    const dataUrl = canvas.toDataURL('image/png');
    console.log(`[Local Image] Generated local image for ${card.name}`);
    
    return dataUrl;
    
  } catch (error) {
    console.error(`[Local Image] Failed to generate local image for ${card.name}:`, error);
    return null;
  }
}

// Simple fallback image generator for when the main one fails
function createSimpleCardImage(card) {
  if (!card || typeof card !== 'object') return null;
  
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = 300;
    canvas.height = 420;
    
    // Simple background
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Simple border
    ctx.strokeStyle = '#718096';
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    
    // Card name (simple)
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(card.name || 'Card', canvas.width / 2, canvas.height / 2);
    
    const dataUrl = canvas.toDataURL('image/png');
    console.log(`[Simple Image] Generated simple image for ${card.name}`);
    
    return dataUrl;
    
  } catch (error) {
    console.error(`[Simple Image] Failed to generate simple image for ${card.name}:`, error);
    return null;
  }
}

// Working CORS solution: Use a reliable CORS proxy service
function getCORSProxyUrl(originalUrl) {
  if (!originalUrl || !originalUrl.includes('cards.lorcast.io')) {
    return originalUrl;
  }
  
  // Use a reliable CORS proxy service
  // This will fetch the image server-side and serve it with proper CORS headers
  const proxyUrl = `https://cors.bridged.cc/${originalUrl}`;
  
  console.log(`[CORS Proxy] Converting URL: ${originalUrl} -> ${proxyUrl}`);
  return proxyUrl;
}

// Alternative CORS proxy if the first one fails
function getAlternativeCORSProxyUrl(originalUrl) {
  if (!originalUrl || !originalUrl.includes('cards.lorcast.io')) {
    return originalUrl;
  }
  
  // Alternative proxy services
  const proxyServices = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}`,
    `https://cors-anywhere.herokuapp.com/${originalUrl}`,
    `https://thingproxy.freeboard.io/fetch/${originalUrl}`
  ];
  
  // Return the first one for now - the image component can try others if it fails
  const proxyUrl = proxyServices[0];
  
  console.log(`[CORS Proxy] Using alternative proxy: ${originalUrl} -> ${proxyUrl}`);
  return proxyUrl;
}

// Alternative approach: Create a canvas-based image to bypass CORS
function createCanvasImage(imageUrl) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        // Convert canvas to blob URL
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            console.log(`[Canvas CORS] Successfully created canvas image: ${url}`);
            resolve(url);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        }, 'image/jpeg', 0.9);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image into canvas'));
    };
    
    img.src = imageUrl;
  });
}

// New function: Generate clean Lorcast URLs from card data
function generateLorcastURL(card) {
  if (!card || typeof card !== 'object') {
    console.warn(`[URL Generation] Invalid card object:`, card);
    return null;
  }
  
  // Be more lenient - allow cards without names to still try to generate URLs
  if (!card.name) {
    console.warn(`[URL Generation] Card missing name, attempting to generate URL anyway:`, card);
  }
  
  // Try to use existing _imageFromAPI if it exists and looks valid
  if (card._imageFromAPI && typeof card._imageFromAPI === 'string' && card._imageFromAPI.startsWith('http')) {
    // Clean up the existing URL
    let cleanURL = card._imageFromAPI;
    
    // Remove any query parameters
    cleanURL = cleanURL.split('?')[0];
    
    // Clean up common URL issues
    cleanURL = cleanURL
      .replace(/\s+/g, '%20')  // Replace spaces with %20
      .replace(/'/g, '%27')    // Replace apostrophes with %27
      .replace(/"/g, '%22')    // Replace quotes with %22
      .replace(/!/g, '%21')    // Replace exclamation marks with %21
      .replace(/\?/g, '%3F')   // Replace question marks with %3F
      .replace(/&/g, '%26')    // Replace ampersands with %26
      .replace(/=/g, '%3D')    // Replace equals with %3D
      .replace(/#/g, '%23');   // Replace hash with %23
    
    console.log(`[URL Generation] Cleaned existing URL for ${card.name}:`, {
      original: card._imageFromAPI,
      cleaned: cleanURL
    });
    
    return cleanURL;
  }
  
  // Generate fallback URL from card data using the correct Lorcast API structure
  if (card.set && card.number) {
    // According to the official API docs, image URLs should be:
    // https://cards.lorcast.io/card/digital/{size}/{card_id}.avif
    // But we need the card ID, not just set/number
    
    // Try to construct a URL using the card ID if available
    if (card.id) {
      const imageUrl = `https://cards.lorcast.io/card/digital/large/${card.id}.avif`;
      console.log(`[URL Generation] Generated image URL using card ID for ${card.name}:`, imageUrl);
      return imageUrl;
    }
    
    // Fallback: try to construct URL using set and number (less reliable)
    const setCode = card.set.toString().toUpperCase();
    const cardNumber = card.number.toString().padStart(3, '0');
    
    // These are the correct URL patterns according to the API docs
    const urlPatterns = [
      `https://cards.lorcast.io/card/digital/large/crd_${setCode}_${cardNumber}.avif`,
      `https://cards.lorcast.io/card/digital/normal/crd_${setCode}_${cardNumber}.avif`,
      `https://cards.lorcast.io/card/digital/small/crd_${setCode}_${cardNumber}.avif`
    ];
    
    console.log(`[URL Generation] Generated fallback URLs for ${card.name}:`, urlPatterns);
    
    // Return the large size first
    return urlPatterns[0];
  }
  
  console.warn(`[URL Generation] Could not generate URL for card: ${card.name}`, card);
  return null;
}

// Enhanced function to generate multiple alternative image URLs
function generateAlternativeImageUrls(card) {
  if (!card || typeof card !== 'object') {
    return [];
  }
  
  const urls = [];
  
  // If we have an existing image URL, add it first
  if (card._imageFromAPI && typeof card._imageFromAPI === 'string' && card._imageFromAPI.startsWith('http')) {
    urls.push(card._imageFromAPI);
  }
  
  // Generate URLs based on card data using the correct Lorcast API structure
  if (card.set && card.number) {
    const setCode = card.set.toString().toUpperCase();
    const cardNumber = card.number.toString().padStart(3, '0');
    
    // Multiple URL patterns to try using the correct API structure
    const patterns = [
      // Primary: Use card ID if available (most reliable)
      card.id ? `https://cards.lorcast.io/card/digital/large/${card.id}.avif` : null,
      card.id ? `https://cards.lorcast.io/card/digital/normal/${card.id}.avif` : null,
      card.id ? `https://cards.lorcast.io/card/digital/small/${card.id}.avif` : null,
      
      // Fallback: Construct URLs using set and number
      `https://cards.lorcast.io/card/digital/large/crd_${setCode}_${cardNumber}.avif`,
      `https://cards.lorcast.io/card/digital/normal/crd_${setCode}_${cardNumber}.avif`,
      `https://cards.lorcast.io/card/digital/small/crd_${setCode}_${cardNumber}.avif`,
      
      // Alternative domains (if main domain fails)
      `https://api.lorcast.com/v0/cards/${setCode}/${cardNumber}/image`,
      `https://lorcast.com/images/${setCode}/${cardNumber}.jpg`
    ].filter(Boolean); // Remove null values
    
    urls.push(...patterns);
  }
  
  // Remove duplicates and invalid URLs
  const uniqueUrls = [...new Set(urls)].filter(url => 
    url && typeof url === 'string' && url.startsWith('http')
  );
  
  console.log(`[Alternative URLs] Generated ${uniqueUrls.length} URLs for ${card.name}:`, uniqueUrls);
  return uniqueUrls;
}

// New function: Reset failed image cache entries
function resetFailedImageCache() {
  try {
    const cache = loadLS(LS_KEYS.CACHE_IMG, {});
    let resetCount = 0;
    
    // Find and remove all 'FAILED' entries
    Object.keys(cache).forEach(key => {
      if (cache[key] === 'FAILED') {
        delete cache[key];
        resetCount++;
      }
    });
    
    // Save the cleaned cache
    saveLS(LS_KEYS.CACHE_IMG, cache);
    
    console.log(`[Cache Reset] Reset ${resetCount} failed image cache entries`);
    return resetCount;
  } catch (error) {
    console.error('[Cache Reset] Error resetting failed cache:', error);
    return 0;
  }
}

// -----------------------------------------------------------------------------
// Lorcast Image Resolver
// -----------------------------------------------------------------------------

/**
 * Create candidate image URLs for a given card using Lorcast patterns.
 * We try combinations based on set code/number/name, then different extensions.
 * Your data model may vary; adjust accessors to match your fields.
 */

// -----------------------------------------------------------------------------
// Data Fetch Adapter
// -----------------------------------------------------------------------------

/**
 * Plug in your primary metadata source here. This adapter supports:
 *  - Local JSON via /cards.json
 *  - Remote API via ENV || config
 *  - Optional Lorcast API if provided
 *
 * It returns a normalized shape:
 *   {
 *     id, name, set, number, cost, inks: [],
 *     type, rarity, text, image (resolved lazily),
 *     ...original
 *   }
 */

// -----------------------------------------------------------------------------
// Single Source of Truth - API Configuration & Helpers
// -----------------------------------------------------------------------------

// Bases + defaults
const LORCAST_BASE = "https://api.lorcast.com/v0";
const DEFAULT_Q = "";
const ALL_QUERY = "ink:amber or ink:amethyst or ink:emerald or ink:ruby or ink:sapphire or ink:steel or ink:colorless"; // Fabled
const APP_VERSION = "1.0.1-lorcast-monolith+api";

async function apiSearchCards({
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

function buildLorcastURL(q) {
  const query = (q && q.trim()) ? q.trim() : ALL_QUERY;
  const params = new URLSearchParams({
    q: query,
    unique: "cards",
  });
  return `${LORCAST_BASE}/cards/search?${params.toString()}`;
}

async function fetchLorcast(q, _page = 1, _perPage = 250, signal) {
  const res = await fetch(buildLorcastURL(q), { headers: { Accept: "application/json" }, mode: "cors", signal });
  if (!res.ok) throw new Error(`Lorcast ${res.status}`);
  const json = await res.json();
  const list = Array.isArray(json?.results) ? json.results : [];
  return { list, total: list.length, source: "lorcast" };
}



/* removed buildLorcanaApiURL for Lorcast-only */


/* removed fetchLorcanaApi for Lorcast-only */


async function fetchCardsPreferred(q, { page = 1, perPage = 250, signal } = {}) {
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
function normalizeAbilities(card) {
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

function normalizeLorcast(c) {
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
  
  const result = {
    id: c.id || c.collector_number || c.name,
    name: c.name,
    // NORMALIZED set fields using Lorcast's actual model:
    set: setCode || setName || (setNum != null ? String(setNum) : ""),
    setCode: setCode,           // canonical key for filters/sort ("1", "2", "D100")
    setName: setName,           // nice label ("The First Chapter")
    setNum: setNum,            // numeric if possible, else null (1, 2, 3...)
    number: c.collector_number,
    types: typeList,
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

function normalizeLorcanaApi(c) {
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

function normalizeCards(list, source) {
  return source === "lorcast" ? list.map(normalizeLorcast) : list.map(normalizeLorcanaApi);
}

// -----------------------------------------------------------------------------
// ONE definitive fetchAllCards that RETURNS AN ARRAY and uses DEFAULT_Q
async function fetchAllCards({ signal } = {}) {
  try {
    const { list, total, source } = await fetchCardsPreferred(DEFAULT_Q, { page: 1, perPage: 100, signal });
    const normalized = normalizeCards(list, source);
    console.log(`[API] Loaded ${normalized.length}/${total} cards from ${source}`);
    
    const mapped = normalized.map(card => ({
      id: card.id,
      name: card.name,
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
    
    return mapped;
  } catch (e) {
    console.error("[API] Unified fetch failed:", e);
    return [];
  }
}

async function fetchAllCardsFallback({ signal } = {}) {
  try {
    console.log('[API] Fallback using unified fetch...');
    const { list, total, source } = await fetchCardsPreferred(DEFAULT_Q, { page: 1, perPage: 100, signal });
    const normalized = normalizeCards(list, source);
    console.log(`[API] Fallback loaded ${normalized.length}/${total} cards from ${source}`);
    
    const mapped = normalized.map(card => ({
      id: card.id,
      name: card.name,
      // NORMALIZED set fields you can rely on everywhere:
      set: card.set,           // e.g. "TFC"
      setNum: card.setNum,     // numeric series index if present
      setName: card.setName,   // e.g. "The First Chapter"
      setCode: card.setCode,   // e.g. "TFC"
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
    
    return mapped;
  } catch (error) {
    console.error('[API] Fallback failed:', error);
    return [];
  }
}

function removeDuplicateCards(cards) {
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
function processAndNormalizeCards(cards) {
  if (!Array.isArray(cards) || cards.length === 0) {
    console.warn('[API] No cards to process');
    return [];
  }
  
  console.log(`[API] Processing ${cards.length} cards (no validation)`);
  
  // Just return the cards directly without complex validation
  return cards;
}


function normalizeCard(raw) {
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
  
  const name = raw.name || raw.title || "Unknown Card";
  const setCode = raw.set?.code || raw.set || raw.set_code || raw.setCode || raw.setName || "Unknown";
  const collectorNo = raw.collector_number || raw.number || raw.no || 0;
  const cost = raw.cost ?? raw.ink_cost ?? raw.inkCost ?? 0;
  const inks = raw.ink ? [raw.ink] : [];
  const type = Array.isArray(raw.type) ? raw.type.join("/") : (raw.type || "Unknown");
  const rarity = raw.rarity || raw.rarityLabel || "Unknown";
  const text = raw.text || raw.rules_text || raw.abilityText || raw.rules || raw.abilities || "";
  
  const id = raw.id || raw._id || `${setCode}-${collectorNo}-${name}`;
  
  return {
    id,
    name,
    set: setCode,
    setName: raw.set?.name || undefined,
    number: collectorNo,
    cost,
    inks,
    type,
    rarity,
    text,
    classifications: raw.classifications || raw.subtypes || [],
    keywords: raw.keywords || raw.abilities || [],
    // Store the image URL directly without processing
    image_url: imageUrl, // This now handles both API formats
    _raw: raw,
    // Additional fields
    franchise: raw.franchise || raw.Franchise || "",
    gamemode: raw.gamemode || raw.Gamemode || "",
    inkable: raw.inkwell || raw.inkable || raw.Inkable || false,
    lore: raw.lore || raw.Lore || 0,
    willpower: raw.willpower || raw.Willpower || 0,
    strength: raw.strength || raw.Strength || 0,
  };
}


// -----------------------------------------------------------------------------
// Local storage & caching
// -----------------------------------------------------------------------------

const LS_KEYS = {
  DECK: "lorcana.deck.v1",
  DECKS: "lorcana.decks.v2", // New: Multiple decks storage
  CURRENT_DECK_ID: "lorcana.currentDeckId.v2", // New: Current deck ID
  FILTERS: "lorcana.filters.v1",
  CACHE_IMG: "lorcana.imageCache.v1",
  CACHE_CARDS: "lorcana.cardsCache.v1",
};

function loadLS(key, fallback) {
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

function saveLS(key, value) {
  try {
    console.log('[saveLS] Saving key:', key, 'with value:', value);
    localStorage.setItem(key, JSON.stringify(value));
    console.log('[saveLS] Successfully saved to localStorage');
  } catch (error) {
    console.error('[saveLS] Error saving to localStorage:', error);
  }
}

// -----------------------------------------------------------------------------
// Toasts
// -----------------------------------------------------------------------------

const ToastContext = createContext({ addToast: () => {} });

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = "info", timeout = 3000) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, timeout);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed right-4 bottom-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-3 py-2 rounded-xl shadow-lg text-sm ${
              t.type === "error"
                ? "bg-red-900/80 text-red-100 border border-red-700"
                : t.type === "success"
                ? "bg-emerald-900/80 text-emerald-100 border border-emerald-700"
                : "bg-gray-800/80 text-gray-100 border border-gray-700"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function useToasts() {
  return useContext(ToastContext);
}

// -----------------------------------------------------------------------------
// Enhanced Deck Management
// -----------------------------------------------------------------------------

/**
 * Deck constraints (simplified; adjust to your house rules if needed):
 * - Max deck size: 60
 * - Min deck size: 60
 * - Max 4 copies per unique card (by id || by set+number)
 */
const DECK_RULES = {
  MIN_SIZE: 60,
  MAX_SIZE: 60,
  MAX_COPIES: 4,
};

function deckKey(card) {
  // Uniqueness by set+number fallback; prefer id when stable
  return card?.id || `${card?.set}-${card?.number}`;
}

// Generate unique deck ID
function generateDeckId() {
  return `deck_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Enhanced deck structure
function createNewDeck(name = "Untitled Deck") {
  return {
    id: generateDeckId(),
    name: name.trim() || "Untitled Deck",
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
    console.log('[saveAllDecks] Saved decks to localStorage');
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

// Export deck to various formats
function exportDeck(deck, format = 'json') {
  switch (format) {
    case 'json':
      return JSON.stringify(deck, null, 2);
    case 'txt':
      return generateTextExport(deck);
    case 'simple-txt':
      return generateSimpleTextExport(deck);
    case 'csv':
      return generateCSVExport(deck);
    default:
      return JSON.stringify(deck, null, 2);
  }
}

// Generate text export
function generateTextExport(deck) {
  const lines = [
    `${deck.name}`,
    `Format: ${deck.format}`,
    `Created: ${new Date(deck.createdAt).toLocaleDateString()}`,
    `Updated: ${new Date(deck.updatedAt).toLocaleDateString()}`,
    `Total Cards: ${deck.total}`,
    '',
    'Cards:',
    ''
  ];
  
  // Group by cost
  const entries = Object.values(deck.entries).filter(e => e.count > 0);
  const groupedByCost = groupBy(entries, (e) => getCost(e.card));
  
  Object.keys(groupedByCost)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .forEach(cost => {
      lines.push(`Cost ${cost}:`);
      groupedByCost[cost].forEach(entry => {
        const card = entry.card;
        lines.push(`  ${entry.count}x ${card.name} (${card.set} #${card.number})`);
      });
      lines.push('');
    });
  
  return lines.join('\n');
}

// Generate simple text export (matches import format)
function generateSimpleTextExport(deck) {
  const lines = [];
  
  // Get all entries with count > 0, sorted by card name
  const entries = Object.values(deck.entries)
    .filter(e => e.count > 0)
    .sort((a, b) => a.card.name.localeCompare(b.card.name));
  
  entries.forEach(entry => {
    lines.push(`${entry.count} ${entry.card.name}`);
  });
  
  return lines.join('\n');
}

// Generate CSV export
function generateCSVExport(deck) {
  const lines = ['Name,Set,Number,Cost,Type,Rarity,Count'];
  
  const entries = Object.values(deck.entries).filter(e => e.count > 0);
  entries.forEach(entry => {
    const card = entry.card;
    lines.push(`"${card.name}","${card.set}","${card.number}","${getCost(card)}","${card.type}","${card.rarity}","${entry.count}"`);
  });
  
  return lines.join('\n');
}

// Import deck from various formats
function importDeck(data, format = 'json') {
  try {
    let deck;
    
    switch (format) {
      case 'json':
        deck = typeof data === 'string' ? JSON.parse(data) : data;
        break;
      case 'txt':
        deck = parseTextImport(data);
        break;
      case 'csv':
        deck = parseCSVImport(data);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
    
    // Validate and normalize deck structure
    if (!deck.entries || typeof deck.entries !== 'object') {
      throw new Error('Invalid deck structure: missing entries');
    }
    
    // Ensure deck has required fields
    const normalizedDeck = {
      id: generateDeckId(),
      name: deck.name || "Imported Deck",
      entries: deck.entries,
      total: Object.values(deck.entries).reduce((sum, entry) => sum + (entry.count || 0), 0),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      description: deck.description || "",
      tags: deck.tags || [],
      format: deck.format || "Lorcana",
      notes: deck.notes || ""
    };
    
    return normalizedDeck;
  } catch (error) {
    console.error('[importDeck] Error importing deck:', error);
    throw error;
  }
}

// Parse text import (enhanced implementation)
function parseTextImport(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid text input');
  }
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  if (lines.length === 0) {
    throw new Error('No valid lines found in text input');
  }
  
  const deck = { entries: {} };
  let validCards = 0;
  let totalCards = 0;
  let skippedLines = 0;
  
  lines.forEach((line, index) => {
    // Skip empty lines and comments (lines starting with # or //)
    if (!line || line.startsWith('#') || line.startsWith('//')) {
      skippedLines++;
      return;
    }
    
    // Handle format: "4 Rafiki - Mystical Fighter"
    const simpleMatch = line.match(/^(\d+)\s+(.+)$/);
    if (simpleMatch) {
      const [, count, cardName] = simpleMatch;
      const countNum = parseInt(count);
      
      if (countNum > 0 && cardName.trim()) {
        totalCards += countNum;
        // Try to find the card in the current card database
        const foundCard = findCardByName(cardName.trim());
        if (foundCard) {
          const key = deckKey(foundCard);
          deck.entries[key] = { card: foundCard, count: countNum };
          validCards++;
        } else {
          // If card not found, create a placeholder entry
          const placeholderCard = { 
            name: cardName.trim(), 
            set: "Unknown", 
            number: "?", 
            cost: 0,
            inks: [],
            type: "Unknown",
            rarity: "Unknown",
            text: "",
            classifications: [],
            keywords: [],
            image_url: "",
            _raw: {}
          };
          const key = deckKey(placeholderCard);
          deck.entries[key] = { card: placeholderCard, count: countNum };
          validCards++;
        }
      } else {
        console.warn(`[parseTextImport] Invalid count or card name on line ${index + 1}: "${line}"`);
        skippedLines++;
      }
    } else {
      // Handle legacy format: "2x Card Name (Set #123)"
      const legacyMatch = line.match(/^(\d+)x\s+(.+?)\s+\((.+?)\s+#(\d+)\)$/);
      if (legacyMatch) {
        const [, count, name, set, number] = legacyMatch;
        const card = { name, set, number };
        const key = deckKey(card);
        deck.entries[key] = { card, count: parseInt(count) };
        validCards++;
        totalCards += parseInt(count);
      } else {
        console.warn(`[parseTextImport] Unrecognized format on line ${index + 1}: "${line}"`);
        skippedLines++;
      }
    }
  });
  
  if (validCards === 0) {
    throw new Error('No valid cards found in text input');
  }
  
  console.log(`[parseTextImport] Successfully parsed ${validCards} unique cards, ${totalCards} total cards (skipped ${skippedLines} lines)`);
  return deck;
}

// Helper function to find a card by name in the current card database
function findCardByName(cardName) {
  // This will be populated when cards are loaded
  if (window.getCurrentCards) {
    const cards = window.getCurrentCards();
    // Try exact match first
    let found = cards.find(card => card.name === cardName);
    if (found) return found;
    
    // Try case-insensitive match
    found = cards.find(card => card.name.toLowerCase() === cardName.toLowerCase());
    if (found) return found;
    
    // Try partial match (card name contains the search term)
    found = cards.find(card => 
      card.name.toLowerCase().includes(cardName.toLowerCase()) ||
      cardName.toLowerCase().includes(card.name.toLowerCase())
    );
    if (found) return found;
  }
  
  return null;
}

// Parse CSV import (basic implementation)
function parseCSVImport(csv) {
  const lines = csv.split('\n').map(line => line.trim()).filter(line => line);
  const deck = { entries: {} };
  
  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const columns = line.split(',').map(col => col.replace(/^"|"$/g, ''));
    
    if (columns.length >= 7) {
      const [name, set, number, cost, type, rarity, count] = columns;
      const card = { name, set, number, cost: parseInt(cost), type, rarity };
      const key = deckKey(card);
      deck.entries[key] = { card, count: parseInt(count) };
    }
  }
  
  return deck;
}

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
      nextEntries[key] = {
        card,
        count: nextCount,
      };
      const newTotal =
        Object.values(nextEntries).reduce((a, b) => a + (b?.count || 0), 0) || 0;
      const next = { ...state, entries: nextEntries, total: newTotal, updatedAt: Date.now() };
      return next;
    }
    case "SET_COUNT": {
      const { card, count } = action;
      const key = deckKey(card);
      const nextEntries = { ...state.entries };
      nextEntries[key] = {
        card,
        count: clamp(count, 0, DECK_RULES.MAX_COPIES)
      };
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
      console.log('[deckReducer] SWITCH_DECK action:', action);
      console.log('[deckReducer] Current state:', state);
      console.log('[deckReducer] New deck:', action.deck);
      const newState = action.deck || state;
      console.log('[deckReducer] Returning new state:', newState);
      return newState;
    }
    default:
      return state;
  }
}



// -----------------------------------------------------------------------------
// Filters state
// -----------------------------------------------------------------------------

const initialFilterState = () => {
  console.log('[initialFilterState] Called');
  const saved = loadLS(LS_KEYS.FILTERS, null);
  console.log('[initialFilterState] Loaded from localStorage:', saved);
  if (saved) {
    console.log('[initialFilterState] Using saved state, hydrating...');
    return hydrateFilterState(saved);
  }
  
  console.log('[initialFilterState] No saved state, creating default state');
    const defaultState = {
    text: "",
    inks: new Set(),
    rarities: new Set(),
    types: new Set(),
    sets: new Set(),
    classifications: new Set(),  // Changed from subtypes
    abilities: new Set(),
    selectedCosts: new Set(), // No costs selected by default - show all cards
    showInkablesOnly: false,
    showUninkablesOnly: false,
    sortBy: "ink-set-number",
    sortDir: "asc",
    showFilterPanel: false,
    // New filters
    setNumber: "",
    franchise: "",
    gamemode: "",
    loreMin: "",
    loreMax: "",
    willpowerMin: "",
    willpowerMax: "",
    strengthMin: "",
    strengthMax: "",
    _resetTimestamp: Date.now(), // Force re-render
  };
  console.log('[initialFilterState] Created default state:', defaultState);
  return defaultState;
};

function serializeFilterState(state) {
  console.log('[serializeFilterState] Called with state:', state);
  const serialized = {
    ...state,
    inks: Array.from(state.inks || []),
    rarities: Array.from(state.rarities || []),
    types: Array.from(state.types || []),
    sets: Array.from(state.sets || []),
    classifications: Array.from(state.classifications || []),
    abilities: Array.from(state.abilities || []),
    selectedCosts: Array.from(state.selectedCosts || []), // Add missing selectedCosts serialization
    showFilterPanel: state.showFilterPanel || false,
    // New filters
    setNumber: state.setNumber || "",
    franchise: state.franchise || "",
    gamemode: state.gamemode || "",
    loreMin: state.loreMin || "",
    loreMax: state.loreMax || "",
    willpowerMin: state.willpowerMin || "",
    willpowerMax: state.willpowerMax || "",
    strengthMin: state.strengthMin || "",
    strengthMax: state.strengthMax || "",
    _resetTimestamp: state._resetTimestamp || Date.now(),
  };
  console.log('[serializeFilterState] Serialized result:', serialized);
  return serialized;
}

function hydrateFilterState(raw) {
  console.log('[hydrateFilterState] Called with raw data:', raw);
  const hydrated = {
    ...raw,
    inks: new Set(raw.inks || []),
    rarities: new Set(raw.rarities || []),
    types: new Set(raw.types || []),
    sets: new Set(raw.sets || []),
    classifications: new Set(raw.classifications || []),
    abilities: new Set(raw.abilities || []),
    selectedCosts: new Set(raw.selectedCosts || []), // Add missing selectedCosts hydration
    showFilterPanel: raw.showFilterPanel || false,
    // New filters
    setNumber: raw.setNumber || "",
    franchise: raw.franchise || "",
    gamemode: raw.gamemode || "",
    loreMin: raw.loreMin || "",
    loreMax: raw.loreMax || "",
    willpowerMin: raw.willpowerMin || "",
    willpowerMax: raw.willpowerMax || "",
    strengthMin: raw.strengthMin || "",
    strengthMax: raw.strengthMax || "",
    _resetTimestamp: raw._resetTimestamp || Date.now(),
  };
  console.log('[hydrateFilterState] Hydrated result:', hydrated);
  return hydrated;
}

function filterReducer(state, action) {
  switch (action.type) {
    case "SET_TEXT":
      return persist({ ...state, text: action.text || "" });
    case "TOGGLE_INK": {
      // Ensure inks is a Set before operating on it
      const currentInks = state.inks instanceof Set ? state.inks : new Set();
      const inks = new Set(currentInks);
      if (inks.has(action.ink)) inks.delete(action.ink);
      else inks.add(action.ink);
      return persist({ ...state, inks });
    }
    case "TOGGLE_COST": {
      // Ensure selectedCosts is a Set before operating on it
      const currentSelectedCosts = state.selectedCosts instanceof Set ? state.selectedCosts : new Set();
      const selectedCosts = new Set(currentSelectedCosts);
      if (selectedCosts.has(action.cost)) selectedCosts.delete(action.cost);
      else selectedCosts.add(action.cost);
      return persist({ ...state, selectedCosts });
    }
    case "TOGGLE_CLASSIFICATION": {
      // Ensure classifications is a Set before operating on it
      const currentClassifications = state.classifications instanceof Set ? state.classifications : new Set();
      const classifications = new Set(currentClassifications);
      if (classifications.has(action.classification)) classifications.delete(action.classification);
      else classifications.add(action.classification);
      return persist({ ...state, classifications });
    }
    case "TOGGLE_ABILITY": {
      // Prevent empty strings from being added to abilities
      if (!action.ability || typeof action.ability !== 'string' || !action.ability.trim()) {
        console.warn('[FilterReducer] Attempted to add invalid ability:', action.ability);
        return state;
      }
      
      // Ensure abilities is a Set before operating on it
      const currentAbilities = state.abilities instanceof Set ? state.abilities : new Set();
      const abilities = new Set(currentAbilities);
      if (abilities.has(action.ability)) abilities.delete(action.ability);
      else abilities.add(action.ability);
      return persist({ ...state, abilities });
    }
    case "TOGGLE_RARITY": {
      // Ensure rarities is a Set before operating on it
      const currentRarities = state.rarities instanceof Set ? state.rarities : new Set();
      const rarities = new Set(currentRarities);
      if (rarities.has(action.rarity)) rarities.delete(action.rarity);
      else rarities.add(action.rarity);
      return persist({ ...state, rarities });
    }
    case "TOGGLE_TYPE": {
      // Ensure types is a Set before operating on it
      const currentTypes = state.types instanceof Set ? state.types : new Set();
      const types = new Set(currentTypes);
      if (types.has(action.cardType)) types.delete(action.cardType);
      else types.add(action.cardType);
      return persist({ ...state, types });
    }
    case "TOGGLE_SET": {
      // Ensure sets is a Set before operating on it
      const currentSets = state.sets instanceof Set ? state.sets : new Set();
      const sets = new Set(currentSets);
      if (sets.has(action.setCode)) sets.delete(action.setCode);
      else sets.add(action.setCode);
      return persist({ ...state, sets });
    }

    case "SET_SHOW_INKABLES": {
      return persist({ ...state, showInkablesOnly: !!action.value });
    }
    case "SET_SHOW_UNINKABLES": {
      return persist({ ...state, showUninkablesOnly: !!action.value });
    }
    case "SET_SORT": {
      return persist({
        ...state,
        sortBy: action.sortBy || state.sortBy,
        sortDir: action.sortDir || state.sortDir,
      });
    }
    // New filter actions
    case "SET_SET_NUMBER":
      return persist({ ...state, setNumber: action.value || "" });
    case "SET_FRANCHISE":
      return persist({ ...state, franchise: action.value || "" });
    case "SET_GAMEMODE":
      return persist({ ...state, gamemode: action.value || "" });
    case "SET_INKABLE":
      return persist({ ...state, inkable: action.value || "" });
    case "SET_LORE_RANGE":
      return persist({ 
        ...state, 
        loreMin: action.min !== undefined ? action.min : state.loreMin,
        loreMax: action.max !== undefined ? action.max : state.loreMax
      });
    case "SET_WILLPOWER_RANGE":
      return persist({ 
        ...state, 
        willpowerMin: action.min !== undefined ? action.min : state.willpowerMin,
        willpowerMax: action.max !== undefined ? action.max : state.willpowerMax
      });
    case "SET_ABILITIES":
      // Ensure abilities is a Set
      const abilities = action.abilities instanceof Set ? action.abilities : new Set(action.abilities || []);
      return persist({ ...state, abilities });
    case "SET_STRENGTH_RANGE":
      return persist({ 
        ...state, 
        strengthMin: action.min !== undefined ? action.min : state.strengthMin,
        strengthMax: action.max !== undefined ? action.max : state.strengthMax
      });
    case "RESET": {
      console.log('[FilterReducer] RESET action received, creating new state');
      console.log('[FilterReducer] Current state before reset:', state);
      // Clear localStorage first, then create fresh state
      localStorage.removeItem(LS_KEYS.FILTERS);
      const next = {
        text: "",
        inks: new Set(),
        rarities: new Set(),
        types: new Set(),
        sets: new Set(),
        classifications: new Set(),
        abilities: new Set(),
        selectedCosts: new Set(), // No costs selected by default - show all cards
        showInkablesOnly: false,
        showUninkablesOnly: false,
        sortBy: "ink-set-number",
        sortDir: "asc",
        showFilterPanel: state.showFilterPanel, // Keep panel open/closed state
        setNumber: "",
        franchise: "",
        gamemode: "",
        loreMin: "",
        loreMax: "",
        willpowerMin: "",
        willpowerMax: "",
        strengthMin: "",
        strengthMax: "",
        _resetTimestamp: Date.now(), // Force re-render
      };
      console.log('[FilterReducer] New state created:', next);
      console.log('[FilterReducer] About to persist and return new state');
      return persist(next);
    }
    case "TOGGLE_PANEL": {
      return persist({ ...state, showFilterPanel: !state.showFilterPanel });
    }
    default:
      return state;
  }

  function persist(next) {
    console.log('[FilterReducer] persist function called with:', next);
    const serialized = serializeFilterState(next);
    console.log('[FilterReducer] Serialized state:', serialized);
    saveLS(LS_KEYS.FILTERS, serialized);
    console.log('[FilterReducer] State saved to localStorage, returning:', next);
    return next;
  }
}

// -----------------------------------------------------------------------------
// Card image cache context
// -----------------------------------------------------------------------------

console.log('[Context] Creating ImageCacheContext...');
const ImageCacheContext = createContext();
console.log('[Context] ImageCacheContext created:', ImageCacheContext);

function ImageCacheProvider({ children }) {
  console.log('[ImageCacheProvider] Initializing...');
  const [cache, setCache] = useState(() => loadLS(LS_KEYS.CACHE_IMG, {}));
  const [cacheVersion, setCacheVersion] = useState(0);
  
  useEffect(() => {
    console.log('[ImageCacheProvider] Cache updated, saving to localStorage');
    saveLS(LS_KEYS.CACHE_IMG, cache);
  }, [cache]);

  const get = useCallback((key) => cache[key], [cache]);
  const put = useCallback((key, value) => {
    setCache((c) => ({ ...c, [key]: value }));
    setCacheVersion(v => v + 1); // Increment version to trigger re-renders
  }, []);
  const putFailed = useCallback((key) => {
    setCache((c) => ({ ...c, [key]: 'FAILED' }));
    setCacheVersion(v => v + 1); // Increment version to trigger re-renders
  }, []);

  const value = useMemo(() => ({ get, put, putFailed, cache, cacheVersion }), [get, put, putFailed, cache, cacheVersion]);

  console.log('[ImageCacheProvider] About to render with value:', value);

  return (
    <ImageCacheContext.Provider value={value}>
      {children}
    </ImageCacheContext.Provider>
  );
}

// Debug component to trace context
function ContextDebugger() {
  const context = useContext(ImageCacheContext);
  console.log('[ContextDebugger] Context value:', context);
  return null; // This component doesn't render anything
}

function useImageCache() {
  console.log('[useImageCache] Hook called');
  const context = useContext(ImageCacheContext);
  console.log('[useImageCache] Context value:', context);
  if (!context) {
    console.error('[useImageCache] Context is null/undefined - this will cause the error');
    throw new Error('useImageCache must be used within ImageCacheProvider');
  }
  return context;
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

// Header & topbar -------------------------------------------------------------

function TopBar({ deckName, onRename, onResetDeck, onExport, onImport, onPrint, onDeckPresentation, onSaveDeck, onToggleFilters, searchText, onSearchChange, onNewDeck, onDeckManager }) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 bg-gray-900/70 border-b border-gray-800 sticky top-0 z-40 backdrop-blur">
      <div className="flex items-center gap-2">
        <input
          className="bg-transparent text-xl font-semibold outline-none border-b border-gray-700 focus:border-emerald-400 transition px-1"
          value={deckName}
          onChange={(e) => onRename(e.target.value)}
        />
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-300">
          v{APP_VERSION}
        </span>
      </div>

      {/* Search bar - always visible */}
      <div className="flex-1 max-w-md mx-4">
        <input
          className="w-full px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 outline-none focus:border-emerald-400"
          placeholder="Search cards by name, text, etc."
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2">

        <button
          className="px-3 py-1.5 rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700"
          onClick={onToggleFilters}
          title="Toggle filters (Ctrl+F)"
        >
          Filters
        </button>
        <button
          className="px-3 py-1.5 rounded-xl bg-blue-900 border border-blue-700 hover:bg-blue-800"
          onClick={onDeckManager}
          title="Manage decks"
        >
          Decks
        </button>
        <button
          className="px-3 py-1.5 rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700"
          onClick={onNewDeck}
          title="Start fresh deck"
        >
          New
        </button>
        <button
          className="px-3 py-1.5 rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700"
          onClick={onImport}
          title="Import deck JSON"
        >
          Import
        </button>
        
        {/* Authentication Button */}
        <div className="ml-4 border-l border-gray-700 pl-4">
          <AuthButton />
        </div>
      </div>
    </div>
  );
}

// Filter panel ---------------------------------------------------------------

function FilterPanel({ state, dispatch, onDone, onSearchChange }) {
  return (
    <div className="p-3 bg-gray-900/50 border-b border-gray-800">
      <div className="flex items-center gap-2 mb-2">
        <input
          className="w-full px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 outline-none focus:border-emerald-400"
          placeholder="Search cards by name, text, etc."
          value={state.text}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <button
          className="px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700"
          onClick={() => {
            console.log('[Reset Button] Clicked, dispatching RESET action');
            console.log('[Reset Button] Current filter state before reset:', state);
            console.log('[Reset Button] Dispatching RESET action...');
            dispatch({ type: "RESET" });
            console.log('[Reset Button] RESET action dispatched');
          }}
        >
          Reset
        </button>
        <button
          className="px-3 py-2 rounded-xl bg-emerald-900 border border-emerald-700 hover:bg-emerald-800"
          onClick={onDone}
        >
          Done
        </button>
      </div>

      {/* Inkable Checkboxes - Top Priority */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <fieldset className="bg-gray-900 rounded-xl p-3 border border-gray-800">
          <legend className="text-sm text-gray-300">Inkable Status</legend>
          <div className="flex flex-col gap-2 mt-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={state.showInkablesOnly}
                onChange={(e) => dispatch({ type: "SET_SHOW_INKABLES", value: e.target.checked })}
              />
              <span>Show only inkables</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={state.showUninkablesOnly}
                onChange={(e) => dispatch({ type: "SET_SHOW_UNINKABLES", value: e.target.checked })}
              />
              <span>Show only uninkables</span>
            </label>
          </div>
        </fieldset>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Ink Colors */}
        <fieldset className="bg-gray-900 rounded-xl p-3 border border-gray-800">
          <legend className="text-sm text-gray-300">Ink Colors</legend>
          <div className="flex flex-wrap gap-2 mt-2">
            {INK_COLORS.map((ink) => (
              <TogglePill
                key={ink}
                label={ink}
                active={state.inks.has(ink)}
                onClick={() => dispatch({ type: "TOGGLE_INK", ink })}
              />
            ))}
          </div>
        </fieldset>

        {/* 2. Cost Selection */}
        <fieldset className="bg-gray-900 rounded-xl p-3 border border-gray-800">
          <legend className="text-sm text-gray-300">Cost</legend>
          <div className="flex flex-wrap gap-2 mt-2">
            {Array.from({ length: 11 }, (_, i) => (
              <TogglePill
                key={i}
                label={i === 0 ? "0" : i === 10 ? "10+" : String(i)}
                active={state.selectedCosts instanceof Set ? state.selectedCosts.has(i) : false}
                onClick={() => dispatch({ type: "TOGGLE_COST", cost: i })}
              />
            ))}
          </div>
        </fieldset>

        {/* 3. Types */}
        <fieldset className="bg-gray-900 rounded-xl p-3 border border-gray-800">
          <legend className="text-sm text-gray-300">Types</legend>
          <div className="text-xs text-gray-400 mb-2">Song = Action - Song cards</div>
          <div className="flex flex-wrap gap-2 mt-2">
            {CARD_TYPES.map((t) => (
              <TogglePill
                key={t}
                label={t}
                active={state.types.has(t)}
                onClick={() => dispatch({ type: "TOGGLE_TYPE", cardType: t })}
              />
            ))}
          </div>
        </fieldset>

        {/* 4. Lore Range */}
        <fieldset className="bg-gray-900 rounded-xl p-3 border border-gray-800">
          <legend className="text-sm text-gray-300">Lore Range</legend>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              className="w-20 px-2 py-1 rounded-lg bg-gray-800 border border-gray-700"
              placeholder="Min"
              min="0"
              value={state.loreMin}
              onChange={(e) => dispatch({ type: "SET_LORE_RANGE", min: parseInt(e.target.value || 0) })}
            />
            <span className="text-gray-400">to</span>
            <input
              type="number"
              className="w-20 px-2 py-1 rounded-lg bg-gray-800 border border-gray-700"
              placeholder="Max"
              min="0"
              value={state.loreMax}
              onChange={(e) => dispatch({ type: "SET_LORE_RANGE", max: parseInt(e.target.value || 0) })}
            />
          </div>
        </fieldset>

        {/* 5. Strength Range */}
        <fieldset className="bg-gray-900 rounded-xl p-3 border border-gray-800">
          <legend className="text-sm text-gray-300">Strength Range</legend>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              className="w-20 px-2 py-1 rounded-lg bg-gray-800 border border-gray-700"
              placeholder="Min"
              min="0"
              value={state.strengthMin}
              onChange={(e) => dispatch({ type: "SET_STRENGTH_RANGE", min: parseInt(e.target.value || 0) })}
            />
            <span className="text-gray-400">to</span>
            <input
              type="number"
              className="w-20 px-2 py-1 rounded-lg bg-gray-800 border border-gray-700"
              placeholder="Max"
              min="0"
              value={state.strengthMax}
              onChange={(e) => dispatch({ type: "SET_STRENGTH_RANGE", max: parseInt(e.target.value || 0) })}
            />
          </div>
        </fieldset>

        {/* 6. Willpower Range */}
        <fieldset className="bg-gray-900 rounded-xl p-3 border border-gray-800">
          <legend className="text-sm text-gray-300">Willpower Range</legend>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              className="w-20 px-2 py-1 rounded-lg bg-gray-800 border border-gray-700"
              placeholder="Min"
              min="0"
              value={state.willpowerMin}
              onChange={(e) => dispatch({ type: "SET_WILLPOWER_RANGE", min: parseInt(e.target.value || 0) })}
            />
            <span className="text-gray-400">to</span>
            <input
              type="number"
              className="w-20 px-2 py-1 rounded-lg bg-gray-800 border border-gray-700"
              placeholder="Max"
              min="0"
              value={state.willpowerMax}
              onChange={(e) => dispatch({ type: "SET_WILLPOWER_RANGE", max: parseInt(e.target.value || 0) })}
            />
          </div>
        </fieldset>

        {/* 7. Rarity */}
        <fieldset className="bg-gray-900 rounded-xl p-3 border border-gray-800">
          <legend className="text-sm text-gray-300">Rarity</legend>
          <div className="flex flex-wrap gap-2 mt-2">
            {RARITIES.map((rar) => (
              <TogglePill
                key={rar}
                label={rar}
                active={state.rarities.has(rar)}
                onClick={() => dispatch({ type: "TOGGLE_RARITY", rarity: rar })}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="bg-gray-900 rounded-xl p-3 border border-gray-800">
          <legend className="text-sm text-gray-300">Sets</legend>
          <div className="space-y-3">
            {/* Set Selection */}
            <div>
              <div className="text-xs text-gray-400 mb-2">Select Sets:</div>
              <div className="flex flex-wrap gap-2">
                {SETS.map((s) => (
                  <TogglePill
                    key={s.code}
                    label={s.name}
                    active={state.sets.has(s.code)}
                    onClick={() => dispatch({ type: "TOGGLE_SET", setCode: s.code })}
                  />
                ))}
              </div>
            </div>
            
            {/* Set Number Filter */}
            <div>
              <div className="text-xs text-gray-400 mb-2">Card Number:</div>
              <input
                type="text"
                className="w-full px-2 py-1 rounded-lg bg-gray-800 border border-gray-700 text-sm"
                placeholder="e.g., 1, 2, 3..."
                value={state.setNumber}
                onChange={(e) => dispatch({ type: "SET_SET_NUMBER", value: e.target.value })}
              />
            </div>
            
            {/* Quick Set Actions */}
            <div className="flex gap-2">
              <button
                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded border border-gray-600"
                onClick={() => {
                  // Select all sets
                  SETS.forEach(s => {
                    if (!state.sets.has(s.code)) {
                      dispatch({ type: "TOGGLE_SET", setCode: s.code });
                    }
                  });
                }}
              >
                Select All
              </button>
              <button
                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded border border-gray-600"
                onClick={() => {
                  // Clear all sets
                  state.sets.forEach(setCode => {
                    dispatch({ type: "TOGGLE_SET", setCode });
                  });
                }}
              >
                Clear All
              </button>
            </div>
            
            {/* Debug Button */}
            <button
              className="mt-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
              onClick={() => {
                console.log('[Debug] Current sets state:', state.sets);
                console.log('[Debug] SETS constant:', SETS);
              }}
            >
              Debug Sets (Console)
            </button>
          </div>
        </fieldset>

        <fieldset className="bg-gray-900 rounded-xl p-3 border border-gray-800">
          <legend className="text-sm text-gray-300">Classifications</legend>
          <div className="flex flex-wrap gap-2 mt-2">
            {CLASSIFICATIONS.map((classification) => (
              <TogglePill
                key={classification}
                label={classification}
                active={state.classifications.has(classification)}
                onClick={() => dispatch({ type: "TOGGLE_CLASSIFICATION", classification })}
              />
            ))}
          </div>
        </fieldset>

                <fieldset className="bg-gray-900 rounded-xl p-3 border border-gray-800">
          <legend className="text-sm text-gray-300">Abilities</legend>
          <div className="flex flex-wrap gap-2 mt-2">
            {ABILITIES.map((ability) => (
              <TogglePill
                key={ability}
                label={ability}
                active={state.abilities.has(ability)}
                onClick={() => dispatch({ type: "TOGGLE_ABILITY", ability: ability })}
              />
            ))}
          </div>
          <button
            className="mt-2 px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
            onClick={() => {
              console.log('[Debug] Current abilities state:', state.abilities);
              dispatch({ type: "RESET" });
            }}
          >
            Reset Filters (Debug)
          </button>
        </fieldset>



        <fieldset className="bg-gray-900 rounded-xl p-3 border border-gray-800">
          <legend className="text-sm text-gray-300">Gamemode</legend>
          <select
            className="w-full px-2 py-1 rounded-lg bg-gray-800 border border-gray-700"
            value={state.gamemode}
            onChange={(e) => dispatch({ type: "SET_GAMEMODE", value: e.target.value })}
          >
            <option value="">Any</option>
            {GAMEMODES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </fieldset>




      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">

        {/* Sort section hidden but functionality preserved */}
        {/* <fieldset className="bg-gray-900 rounded-xl p-3 border border-gray-800">
          <legend className="text-sm text-gray-300">Sort</legend> */}
          <div className="flex items-center gap-2 mt-2">
            <select
              className="px-2 py-1 rounded-lg bg-gray-800 border border-gray-700"
              value={state.sortBy}
              onChange={(e) => dispatch({ type: "SET_SORT", sortBy: e.target.value })}
            >
              <option value="set-ink-number">Set → Ink → Number</option>
              <option value="name">Name</option>
              <option value="cost">Cost</option>
              <option value="set">Set</option>
              <option value="rarity">Rarity</option>
            </select>
            <select
              className="px-2 py-1 rounded-lg bg-gray-800 border border-gray-700"
              value={state.sortDir}
              onChange={(e) => dispatch({ type: "SET_SORT", sortDir: e.target.value })}
            >
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </select>
          </div>
        {/* </fieldset> */}
      </div>
    </div>
  );
}

function TogglePill({ label, active, onClick }) {
  return (
    <button
      className={`px-3 py-1.5 rounded-full border text-sm ${
        active
          ? "bg-emerald-900/80 border-emerald-700 text-emerald-100"
          : "bg-gray-800 border-gray-700 text-gray-200"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

// Card grid ------------------------------------------------------------------

function CardGrid({ cards, onAdd, onInspect, deck }) {
  // Filter out only completely invalid cards, be more lenient
  const validCards = cards.filter(card => card && typeof card === 'object');
  if (validCards.length !== cards.length) {
    console.warn(`[CardGrid] Filtered out ${cards.length - validCards.length} completely invalid cards`);
  }
  
  // Get deck count for each card
  const getDeckCount = (card) => {
    const key = deckKey(card);
    return deck?.entries?.[key]?.count || 0;
  };
  
  return (
    <div className="space-y-3 p-3">
      {/* Show message if no valid cards */}
      {validCards.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <div className="text-lg mb-2">No valid cards found</div>
          <div className="text-sm">Please check your data source or try refreshing the page</div>
        </div>
      )}
      
      {/* Show all cards at once - no infinite scroll */}
      {validCards.length > 0 && (
        <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
          {validCards.map((c) => (
            <div key={deckKey(c)}>
              <CardTile 
                card={c} 
                onAdd={(card, count = 1) => onAdd(card, count)} 
                onInspect={() => onInspect(c)}
                deckCount={getDeckCount(c)}
              />
            </div>
          ))}
        </div>
      )}
      
      {/* Card count indicator */}
      {validCards.length > 0 && (
        <div className="text-center py-4 text-gray-500">
          Showing {validCards.length} cards
        </div>
      )}
    </div>
  );
}

// Simple image function that works exactly like App (7).jsx
function getCardImg(card) {
  // Use the normalized image field (as suggested by ChatGPT)
  const u = card.image || card.image_url || "";
  return u; // or: `https://images.weserv.nl/?url=${encodeURIComponent(u)}&output=jpg`;
}

function CardTile({ card, onAdd, onInspect, deckCount = 0 }) {
  if (!card || typeof card !== 'object' || !card.name) {
    console.warn('[CardTile] Invalid card object, showing fallback:', card);
    return (
      <div className="group relative bg-gray-900 rounded-xl border border-gray-800 overflow-hidden w-full h-96 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="text-sm mb-2">Invalid Card</div>
          <div className="text-xs">Missing or corrupted data</div>
        </div>
      </div>
    );
  }
  
  // Use the simple image approach like the HTML file
  const img = card.image_url; // Direct access, no complex processing
  
  return (
    <div className="group relative overflow-hidden hover:scale-105 transition-all duration-200 cursor-pointer w-full h-64">
      {img ? (
        <img
          src={img}
          alt={card.name}
          className="w-full h-full object-contain rounded-lg hover:shadow-lg transition-all duration-200"
          loading="lazy"
          onClick={onInspect}
        />
      ) : (
        <div className="w-full h-full bg-gray-800 rounded-lg flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="text-xs mb-2">No image</div>
            <div className="text-xs">{card.name}</div>
          </div>
        </div>
      )}
      
      {/* Add/Remove buttons with card count - always visible to prevent layout shifts */}
      <div className="absolute bottom-1 left-1 right-1 flex items-center justify-center gap-2">
        {/* Card count display */}
        <div className="bg-black/90 backdrop-blur-sm rounded-md px-2 py-1 min-w-[2.5rem] text-center border border-gray-600/50">
          <div className="text-xs font-bold text-white">
            {deckCount}/4
          </div>
        </div>
        
        <button
          className="w-6 h-6 rounded-full bg-emerald-900/90 border border-emerald-700 text-emerald-100 text-xs hover:bg-emerald-800 flex items-center justify-center transition-colors"
          onClick={(e) => { e.stopPropagation(); onAdd(card, 1); }}
          title="Add to deck"
        >
          +
        </button>
        
        <button
          className={`w-6 h-6 rounded-full border text-xs flex items-center justify-center transition-colors ${
            deckCount > 0 
              ? 'bg-red-900/90 border-red-700 text-red-100 hover:bg-red-800 cursor-pointer' 
              : 'bg-gray-900/50 border-gray-600 text-gray-500 cursor-not-allowed'
          }`}
          onClick={(e) => { 
            e.stopPropagation(); 
            if (deckCount > 0) onAdd(card, -1); 
          }}
          title={deckCount > 0 ? "Remove from deck" : "No cards to remove"}
          disabled={deckCount === 0}
        >
          -
        </button>
      </div>
    </div>
  );
}

// Deck Manager Component
// -----------------------------------------------------------------------------

function DeckManager({ isOpen, onClose, decks, currentDeckId, onSwitchDeck, onNewDeck, onDeleteDeck, onDuplicateDeck, onExportDeck, onImportDeck }) {
  const [selectedDeckId, setSelectedDeckId] = useState(currentDeckId);
  const [showNewDeckForm, setShowNewDeckForm] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [exportFormat, setExportFormat] = useState("json");
  const [importFormat, setImportFormat] = useState("json");
  const [importData, setImportData] = useState("");

  // Only fix selectedDeckId if it's invalid - don't override user selections
  useEffect(() => {
    // If selectedDeckId is invalid (null, undefined, or points to a non-existent deck)
    // AND there are decks available, then set a valid selectedDeckId.
    if (Object.keys(decks).length > 0 && (!selectedDeckId || !decks[selectedDeckId])) {
      // Prioritize currentDeckId if it's valid, otherwise pick the first available deck
      const fallbackDeckId = currentDeckId && decks[currentDeckId] ? currentDeckId : Object.keys(decks)[0];
      console.log('[DeckManager] Fixing invalid selectedDeckId. Setting to fallback:', fallbackDeckId);
      setSelectedDeckId(fallbackDeckId);
    }
  }, [currentDeckId, decks, selectedDeckId]);

  // Additional safety check: ensure selectedDeckId is always valid
  useEffect(() => {
    if (selectedDeckId && !decks[selectedDeckId] && Object.keys(decks).length > 0) {
      console.log('[DeckManager] Safety check: selectedDeckId is invalid, fixing...');
      const firstDeckId = Object.keys(decks)[0];
      setSelectedDeckId(firstDeckId);
    }
  }, [selectedDeckId, decks]);

  if (!isOpen) return null;

  const currentDeck = decks[currentDeckId];
  const selectedDeck = decks[selectedDeckId];
  
  // Debug logging
  console.log('[DeckManager] Debug info:', {
    currentDeckId,
    selectedDeckId,
    decksKeys: Object.keys(decks),
    currentDeck: currentDeck?.name,
    selectedDeck: selectedDeck?.name,
    selectedDeckExists: !!selectedDeck
  });

  const handleNewDeck = () => {
    if (newDeckName.trim()) {
      onNewDeck(newDeckName.trim());
      setNewDeckName("");
      setShowNewDeckForm(false);
    }
  };

  const handleExport = () => {
    if (!selectedDeck) return;
    
    const exportData = exportDeck(selectedDeck, exportFormat);
    const blob = new Blob([exportData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Handle file extension for different formats
    let fileExtension = exportFormat;
    if (exportFormat === 'simple-txt') {
      fileExtension = 'txt';
    }
    
    a.download = `${selectedDeck.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${fileExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (!importData.trim()) return;
    
    try {
      const importedDeck = importDeck(importData, importFormat);
      onImportDeck(importedDeck);
      setImportData("");
      onClose();
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    }
  };
  
  const handleImportWithWarnings = () => {
    if (!importData.trim()) return;
    
    try {
      const importedDeck = importDeck(importData, importFormat);
      
      // Check if any cards were not found in the database
      const unknownCards = Object.values(importedDeck.entries)
        .filter(entry => entry.card.set === "Unknown")
        .map(entry => entry.card.name);
      
      let message = `Successfully imported deck with ${importedDeck.total} cards.`;
      if (unknownCards.length > 0) {
        message += `\n\nNote: ${unknownCards.length} cards were not found in the database and may need to be loaded first:\n${unknownCards.join(', ')}`;
      }
      
      alert(message);
      onImportDeck(importedDeck);
      setImportData("");
      onClose();
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl border border-gray-700 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold">Deck Manager</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex h-96">
          {/* Left side - Deck list */}
          <div className="w-1/3 border-r border-gray-700 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Your Decks</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowNewDeckForm(true)}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 rounded text-sm"
                >
                  + New
                </button>
              </div>
            </div>

            {showNewDeckForm && (
              <div className="mb-4 p-3 bg-gray-800 rounded border border-gray-600">
                <input
                  type="text"
                  placeholder="Deck name"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm mb-2"
                  onKeyPress={(e) => e.key === 'Enter' && handleNewDeck()}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleNewDeck}
                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 rounded text-xs"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowNewDeckForm(false)}
                    className="px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {Object.keys(decks).length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-3">📁</div>
                  <div className="font-medium mb-2">No Saved Decks</div>
                  <div className="text-sm">
                    Create a deck and save it to see it here.
                  </div>
                </div>
              ) : (
                Object.values(decks).map((deck) => (
                  <div
                    key={deck.id}
                    className={`p-3 rounded border cursor-pointer transition ${
                      deck.id === selectedDeckId
                        ? 'border-emerald-500 bg-emerald-900/20'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                    onClick={() => {
                    console.log('[DeckManager] Deck clicked:', deck);
                    console.log('[DeckManager] Setting selectedDeckId to:', deck.id);
                    setSelectedDeckId(deck.id);
                  }}
                  >
                    <div className="font-medium">{deck.name}</div>
                    <div className="text-sm text-gray-400">
                      {deck.total} cards • {new Date(deck.updatedAt).toLocaleDateString()}
                    </div>
                    {deck.id === currentDeckId && (
                      <div className="text-xs text-emerald-400 mt-1">Current</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right side - Deck details and actions */}
          <div className="flex-1 p-4 overflow-y-auto">
            {Object.keys(decks).length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="text-4xl mb-3">💾</div>
                <div className="font-medium mb-2">Save Your First Deck</div>
                <div className="text-sm mb-4">
                  Create a deck, add some cards, and click Save to get started.
                </div>
                <button
                  onClick={() => setShowNewDeckForm(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded"
                >
                  Create New Deck
                </button>
              </div>
            ) : selectedDeck ? (
              <div>
                <h3 className="font-semibold mb-4">{selectedDeck.name}</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div>
                    <span className="text-gray-400">Cards:</span> {selectedDeck.total}
                  </div>
                  <div>
                    <span className="text-gray-400">Created:</span> {new Date(selectedDeck.createdAt).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="text-gray-400">Updated:</span> {new Date(selectedDeck.updatedAt).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="text-gray-400">Format:</span> {selectedDeck.format}
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => {
                      console.log('[DeckManager] Switch button clicked for deck:', selectedDeck);
                      console.log('[DeckManager] Calling onSwitchDeck with:', selectedDeck);
                      onSwitchDeck(selectedDeck);
                    }}
                    className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded"
                  >
                    Switch to This Deck
                  </button>
                  
                  <button
                    onClick={() => onDuplicateDeck(selectedDeck.id)}
                    className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded"
                  >
                    Duplicate Deck
                  </button>

                  <div className="border-t border-gray-700 pt-3">
                    <h4 className="font-medium mb-2">Export</h4>
                    <div className="flex gap-2 mb-2">
                      <select
                        value={exportFormat}
                        onChange={(e) => setExportFormat(e.target.value)}
                        className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                      >
                        <option value="json">JSON</option>
                        <option value="txt">Text (Detailed)</option>
                        <option value="simple-txt">Text (Simple)</option>
                        <option value="csv">CSV</option>
                      </select>
                      <button
                        onClick={handleExport}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 rounded text-sm"
                      >
                        Export
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-gray-700 pt-3">
                    <h4 className="font-medium mb-2">Import</h4>
                    <div className="space-y-2">
                      <select
                        value={importFormat}
                        onChange={(e) => setImportFormat(e.target.value)}
                        className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                      >
                        <option value="json">JSON</option>
                        <option value="txt">Text</option>
                        <option value="csv">CSV</option>
                      </select>
                      {importFormat === 'txt' && (
                        <div className="text-xs text-gray-400 bg-gray-800 p-2 rounded">
                          <div className="font-medium mb-1">Text format support:</div>
                          <div>• Simple: "4 Rafiki - Mystical Fighter"</div>
                          <div>• Legacy: "2x Card Name (Set #123)"</div>
                          <div>• Comments: Lines starting with # or // are ignored</div>
                          <div>• Empty lines are automatically skipped</div>
                        </div>
                      )}
                      <textarea
                        placeholder="Paste deck data here..."
                        value={importData}
                        onChange={(e) => setImportData(e.target.value)}
                        className="w-full h-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm resize-none"
                      />
                      <button
                        onClick={handleImportWithWarnings}
                        className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-sm"
                      >
                        Import
                      </button>
                    </div>
                  </div>

                  {selectedDeck.id !== currentDeckId && (
                    <button
                      onClick={() => onDeleteDeck(selectedDeck.id)}
                      className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 rounded"
                    >
                      Delete Deck
                    </button>
                  )}
                </div>
              </div>
            ) : Object.keys(decks).length > 0 ? (
              <div className="text-center text-gray-400 py-8">
                <div className="text-4xl mb-3">📋</div>
                <div className="font-medium mb-2">Select a Deck</div>
                <div className="text-sm">
                  Choose a deck from the list to view details and manage it.
                </div>
                {selectedDeckId && !decks[selectedDeckId] && (
                  <div className="mt-4 p-3 bg-red-900/20 border border-red-700 rounded text-red-300 text-xs">
                    Warning: Selected deck ID ({selectedDeckId}) not found in decks collection.
                    This might indicate a synchronization issue.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// Deck panel -----------------------------------------------------------------

function DeckPanel({ deck, onSetCount, onRemove, onExport, onImport, onDeckPresentation }) {
  const entries = Object.values(deck.entries || {}).filter((e) => e.count > 0);
  const groupedByCost = useMemo(
    () => groupBy(entries, (e) => getCost(e.card)),
    [entries]
  );

  // Calculate inkable vs uninkable counts
  const inkableCounts = useMemo(() => {
    let inkable = 0;
    let uninkable = 0;
    
    console.log('[Inkable Detection] Processing entries:', entries.length);
    
    for (const e of entries) {
      // Use the actual inkable field from Lorcast API
      const isInkable = e.card.inkable || e.card._raw?.inkable || e.card._raw?.inkwell;
      
      console.log(`[Inkable Detection] Card: ${e.card.name}, inkable field: ${isInkable}, raw.inkable: ${e.card._raw?.inkable}, raw.inkwell: ${e.card._raw?.inkwell}`);
      
      if (isInkable) {
        inkable += e.count;
        console.log(`[Inkable Detection] ${e.card.name} marked as INKABLE`);
      } else {
        uninkable += e.count;
        console.log(`[Inkable Detection] ${e.card.name} marked as UNINKABLE`);
      }
    }
    
    console.log(`[Inkable Detection] Final counts: ${inkable} inkable, ${uninkable} uninkable`);
    return { inkable, uninkable };
  }, [entries]);

  return (
    <div className="p-3 bg-gray-950 border-l border-gray-800 h-full flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">
          Deck • <span className="text-emerald-400">{deck.total}</span> /{" "}
          {DECK_RULES.MAX_SIZE}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded-xl bg-purple-900 border border-purple-700 hover:bg-purple-800"
            onClick={onDeckPresentation}
            title="View deck presentation with stats and charts"
          >
            Present
          </button>
          <button
            className="px-3 py-1.5 rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700"
            onClick={onImport}
          >
            Import
          </button>
        </div>
      </div>

      {/* Inkable vs Uninkable Ratio with Icons */}
      <div className="flex items-center justify-center gap-4 p-3 bg-gray-900 rounded-xl border border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-emerald-500"></div>
          <span className="text-sm text-emerald-400 font-semibold">
            {inkableCounts.inkable} Inkable
          </span>
        </div>
        <div className="text-gray-500">vs</div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500"></div>
          <span className="text-sm text-red-400 font-semibold">
            {inkableCounts.uninkable} Uninkable
          </span>
        </div>
      </div>

      <div className="space-y-3 overflow-auto pr-1">
        {Object.keys(groupedByCost)
          .sort((a, b) => parseInt(a) - parseInt(b))
          .map((cost) => (
            <div key={cost} className="bg-gray-900 rounded-xl border border-gray-800">
              <div className="px-3 py-2 font-semibold border-b border-gray-800">
                Cost {cost}
              </div>
              <div className="divide-y divide-gray-800">
                {groupedByCost[cost].map((e) => (
                  <DeckRow
                    key={deckKey(e.card)}
                    entry={e}
                    onSetCount={(c) => onSetCount(e.card, c)}
                    onRemove={() => onRemove(e.card)}
                  />
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function DeckRow({ entry, onSetCount, onRemove }) {
  const c = entry.card;
  const imgSrc = getCardImg(c);

  return (
    <div className="flex items-center gap-2 p-2">
      <img src={imgSrc} alt={c.name} className="w-10 h-14 object-cover rounded-md" />
      <div className="flex-1">
        <div className="text-sm font-semibold">{c.name}</div>
        <div className="text-xs text-gray-400">
          {c.set} • #{c.number} • Cost {getCost(c)} • {c.type} • {c.rarity}
        </div>
        {(c.franchise || c.lore > 0 || c.willpower > 0 || c.strength > 0) && (
          <div className="text-xs text-gray-500 mt-1">
            {c.franchise && <span className="mr-2">{c.franchise}</span>}
            {c.lore > 0 && <span className="mr-2">Lore: {c.lore}</span>}
            {c.willpower > 0 && <span className="mr-2">Will: {c.willpower}</span>}
            {c.strength > 0 && <span className="mr-2">Str: {c.strength}</span>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <input
          className="w-10 text-center rounded-md bg-gray-800 border border-gray-700"
          type="number"
          value={entry.count}
          onChange={(e) => onSetCount(parseInt(e.target.value || 0))}
        />
        <button
          className="w-6 h-6 rounded-md bg-gray-800 border border-gray-700 hover:bg-gray-700"
          onClick={() => onSetCount(Math.max(0, entry.count - 1))}
        >
          -
        </button>
        <button
          className="w-6 h-6 rounded-md bg-gray-800 border border-gray-700 hover:bg-gray-700"
          onClick={() => onSetCount(Math.min(DECK_RULES.MAX_COPIES, entry.count + 1))}
        >
          +
        </button>
        <button
          className="px-2 py-1 rounded-md bg-red-900/80 border border-red-700 hover:bg-red-800 text-xs"
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
function DeckStats({ deck }) {
  const entries = Object.values(deck.entries || {}).filter((e) => e.count > 0);

  const costCurve = useMemo(() => {
    const map = new Map();
    // Initialize all costs 0-10 with 0
    for (let i = 0; i <= 10; i++) {
      map.set(i, 0);
    }
    // Add actual counts
    for (const e of entries) {
      const cost = getCost(e.card);
      map.set(cost, (map.get(cost) || 0) + e.count);
    }
    return Array.from(map.entries())
      .map(([cost, count]) => ({ cost, count }));
  }, [entries]);

  const typeCounts = useMemo(() => {
    const counts = {};
    for (const e of entries) {
      const t = e.card.type || "Unknown";
      counts[t] = (counts[t] || 0) + e.count;
    }
    return Object.entries(counts).map(([type, count]) => ({ type, count }));
  }, [entries]);

  const inkableCounts = useMemo(() => {
    let inkable = 0;
    let uninkable = 0;
    
    for (const e of entries) {
      // Better inkable detection
      const isInkable = e.card.text?.toLowerCase().includes('inkable') || 
                       e.card.type?.toLowerCase() === 'character' ||
                       e.card.type?.toLowerCase() === 'action' ||
                       e.card.type?.toLowerCase() === 'item' ||
                       e.card.type?.toLowerCase() === 'location';
      
      if (isInkable) {
        inkable += e.count;
      } else {
        uninkable += e.count;
      }
    }
    
    return [
      { category: 'Inkable', count: inkable },
      { category: 'Uninkable', count: uninkable }
    ];
  }, [entries]);

  const total = entries.reduce((a, b) => a + b.count, 0);
  const avgCost = average(entries, (e) => getCost(e.card)).toFixed(2);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-3">
      <StatCard title="Deck Size" value={total} subtitle={`${DECK_RULES.MIN_SIZE}-${DECK_RULES.MAX_SIZE}`} />
      <StatCard title="Average Cost" value={avgCost} />
      <StatCard title="Unique Cards" value={entries.length} />

      <ChartCard title="Cost Curve">
        <div className="w-full h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={costCurve}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="cost" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Card Types">
        <div className="w-full h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={typeCounts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Inkable vs Uninkable">
        <div className="flex flex-col items-center justify-center h-56">
          <div className="text-3xl font-bold text-emerald-400 mb-2">
            {inkableCounts[0]?.count || 0} Inkable
          </div>
          <div className="text-3xl font-bold text-red-400">
            {inkableCounts[1]?.count || 0} Uninkable
          </div>
        </div>
      </ChartCard>
    </div>
  );
}

function StatCard({ title, value, subtitle }) {
return (
<div className="p-3 bg-gray-900 rounded-xl border border-gray-800">
<div className="text-sm text-gray-400">{title}</div>
<div className="text-2xl font-semibold">{value}</div>
{subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
</div>
);
}

function ChartCard({ title, children }) {
return (
<div className="p-3 bg-gray-900 rounded-xl border border-gray-800">
<div className="text-sm text-gray-300 mb-2">{title}</div>
{children}
</div>
);
}

// Modals ---------------------------------------------------------------------

function Modal({ open, onClose, title, children, footer, size = "md" }) {
  if (!open) return null;
  
  // Size classes
  const sizeClasses = {
    sm: "w-[min(100%-2rem,500px)] max-h-[70vh]",
    md: "w-[min(100%-2rem,700px)] max-h-[80vh]",
    lg: "w-[min(100%-2rem,900px)] max-h-[85vh]",
    xl: "w-[min(100%-2rem,1200px)] max-h-[90vh]",
    full: "w-[min(100%-1rem,1400px)] max-h-[95vh]"
  };
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`bg-gray-900 border border-gray-800 rounded-2xl ${sizeClasses[size]} shadow-2xl`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="text-lg font-semibold">{title}</div>
          <button
            className="px-3 py-1.5 rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[calc(95vh-120px)]">{children}</div>
        {footer && <div className="px-4 py-3 border-t border-gray-800">{footer}</div>}
      </div>
    </div>
  );
}

// Inspect card modal ---------------------------------------------------------

function InspectCardModal({ open, card, onClose, onAdd }) {
  const imgSrc = getCardImg(card || {});
  if (!open || !card) return null;
  
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${card.name} • ${card.set} #${card.number}`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            className="px-3 py-1.5 rounded-xl bg-emerald-900 border border-emerald-700 hover:bg-emerald-800"
            onClick={() => onAdd(card)}
          >
            Add to Deck
          </button>
        </div>
      }
    >
      <div className="flex justify-center">
        <img 
          src={imgSrc} 
          alt={card.name} 
          className="max-w-full max-h-[70vh] object-contain rounded-xl border border-gray-800" 
        />
      </div>
    </Modal>
  );
}

// Import/Export modals -------------------------------------------------------

function ExportModal({ open, deck, onClose }) {
const json = JSON.stringify(deck, null, 2);
return (
<Modal open={open} onClose={onClose} title="Export Deck">
<div className="space-y-3">
  <div>
    <div className="text-sm text-gray-400 mb-1">Deck JSON</div>
    <textarea
      className="w-full h-64 px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 font-mono text-xs"
      readOnly
      value={json}
    />
  </div>
  <div className="flex items-center gap-2">
    <button
      className="px-3 py-1.5 rounded-xl bg-emerald-900 border border-emerald-700 hover:bg-emerald-800"
      onClick={() => {
        navigator.clipboard.writeText(json);
      }}
    >
      Copy JSON
    </button>
    <a
      className="px-3 py-1.5 rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700"
      href={`data:application/json;charset=utf-8,${encodeURIComponent(json)}`}
      download={`${(deck.name || "deck").replace(/\s+/g, "_")}.json`}
    >
      Download JSON
    </a>
  </div>
</div>
</Modal>
);
}

function ImportModal({ open, onClose, onImport }) {
  const [text, setText] = useState("");
  const [savedDecks, setSavedDecks] = useState([]);
  const [showSavedDecks, setShowSavedDecks] = useState(false);
  
  // Load saved decks when modal opens
  useEffect(() => {
    if (open) {
      const saved = JSON.parse(localStorage.getItem('savedLorcanaDecks') || '[]');
      setSavedDecks(saved);
    }
  }, [open]);
  
  const handleLoadSavedDeck = (savedDeck) => {
    // Convert saved deck format back to app format
    const convertedDeck = {
      name: savedDeck.name,
      entries: {},
      total: 0
    };
    
    savedDeck.entries.forEach(entry => {
      const cardKey = `${entry.card.name}-${entry.card.set}-${entry.card.number}`;
      convertedDeck.entries[cardKey] = {
        card: entry.card,
        count: entry.count
      };
      convertedDeck.total += entry.count;
    });
    
    onImport(convertedDeck);
    onClose();
  };
  
  const handleDeleteSavedDeck = (deckId) => {
    if (confirm('Are you sure you want to delete this saved deck?')) {
      const updatedDecks = savedDecks.filter(d => d.id !== deckId);
      localStorage.setItem('savedLorcanaDecks', JSON.stringify(updatedDecks));
      setSavedDecks(updatedDecks);
    }
  };
  
  return (
    <Modal open={open} onClose={onClose} title="Import Deck" size="lg">
      <div className="space-y-4">
        {/* Saved Decks Section */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Saved Decks</h3>
            <button
              onClick={() => setShowSavedDecks(!showSavedDecks)}
              className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm"
            >
              {showSavedDecks ? 'Hide' : 'Show'} Saved Decks
            </button>
          </div>
          
          {showSavedDecks && (
            <div className="space-y-2">
              {savedDecks.length === 0 ? (
                <p className="text-gray-400 text-sm">No saved decks found.</p>
              ) : (
                savedDecks.map(deck => (
                  <div key={deck.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                    <div className="flex-1">
                      <div className="font-semibold">{deck.name}</div>
                      <div className="text-sm text-gray-400">
                        {deck.entries.length} unique cards • Saved {new Date(deck.savedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleLoadSavedDeck(deck)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-sm"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDeleteSavedDeck(deck.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        
        {/* Import JSON Section */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Import from JSON</h3>
          <div className="text-sm text-gray-400 mb-3">
            Paste deck JSON exported from this app (or adapt from another builder).
          </div>
          <textarea
            className="w-full h-48 px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 font-mono text-xs"
            placeholder='{"name":"My Deck","entries":{...},"total":60}'
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex items-center justify-end gap-2 mt-3">
            <button
              className="px-3 py-1.5 rounded-xl bg-emerald-900 border border-emerald-700 hover:bg-emerald-800"
              onClick={() => {
                try {
                  const obj = JSON.parse(text);
                  onImport(obj);
                  onClose();
                } catch {
                  alert("Invalid JSON");
                }
              }}
            >
              Import
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Printable view -------------------------------------------------------------

function PrintableSheet({ deck, onClose }) {
  const entries = Object.values(deck.entries || {}).filter((e) => e.count > 0);
  
  return (
    <Modal open={true} onClose={onClose} title="Printable Deck Sheet">
      <div className="space-y-4">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-emerald-400">{deck.name}</h1>
          <p className="text-gray-400 mt-2">Printable Deck Sheet</p>
        </div>
        
        {/* Card Images Grid */}
        <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
          {entries.map((e) => (
            <div key={deckKey(e.card)} className="relative">
              <div className="w-20 h-28 bg-gray-600 rounded-md overflow-hidden border border-gray-500">
                <img 
                  src={e.card.image_url || e.card._imageFromAPI || FALLBACK_IMG} 
                  alt={e.card.name} 
                  className="w-full h-full object-cover" 
                />
              </div>
                              {/* Count bubble */}
                <div 
                  className="absolute bg-gray-700/80 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-gray-800"
                  style={{ top: '-2px', right: '-2px' }}
                >
                  {e.count}
                </div>
            </div>
          ))}
        </div>
        
        {/* Print Footer */}
        <div className="text-center border-t pt-4 mt-6">
          <p className="text-sm text-gray-400">
            Generated by Lorcana Deck Builder • {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </Modal>
  );
}

// Deck Presentation Popup ----------------------------------------------------

function DeckPresentationPopup({ deck, onClose, onSave }) {
  const entries = Object.values(deck.entries || {}).filter((e) => e.count > 0);
  
  // Lorcanito export constants and functions
  const GROUP_ORDER = ["Character", "Action", "Song", "Item", "Location"];

  // Normalize card types to handle Songs and other subtypes consistently
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

  function groupAndSortForText(entries) {
    try {
      console.log('[Lorcanito Export] groupAndSortForText called with:', entries);
      
      const buckets = new Map(GROUP_ORDER.map(t => [t, []]));
      for (const e of entries) {
        const t = normalizedType(e.card);
        if (!buckets.has(t)) buckets.set(t, []);
        buckets.get(t).push(e);
      }
      
      console.log('[Lorcanito Export] Initial buckets:', Object.fromEntries(buckets));
      
      for (const [t, arr] of buckets) {
        arr.sort((a, b) => (getCost(a.card) ?? 0) - (getCost(b.card) ?? 0) || a.card.name.localeCompare(b.card.name));
      }
      
      const result = GROUP_ORDER
        .filter(t => buckets.get(t)?.length)
        .map(t => ({ section: t, entries: buckets.get(t) }));
      
      console.log('[Lorcanito Export] Final grouped result:', result);
      return result;
    } catch (error) {
      console.error('[Lorcanito Export] Error in groupAndSortForText:', error);
      throw error;
    }
  }

  function displayNameForText(card) {
    const variant = card.title || card.version || card._raw?.version || card._raw?.Version || card.subname || null;
    return variant ? `${card.name} — ${variant}` : card.name;
  }

  // Optional: append set + number when available to disambiguate
  function lineForText(e, withSet = true) {
    const c = e.card;
    const set = c.set || c._raw?.setCode || c._raw?.set;
    const num = c.number || c._raw?.number || c._raw?.collector_number;
    const base = `${e.count} ${displayNameForText(c)}`;
    return withSet && set && num ? `${base} (${set} #${num})` : base;
  }

  function makeLorcanitoTextExport({ name, inks, entries }) {
    try {
      console.log('[Lorcanito Export] makeLorcanitoTextExport called with:', { name, inks, entries });
      
      const groups = groupAndSortForText(entries);
      console.log('[Lorcanito Export] Grouped entries:', groups);
      
      const lines = [];
      if (name) lines.push(`# ${name}`);
      if (inks?.length) lines.push(`# Inks: ${inks.join(" / ")}`);
      lines.push(`# Total: ${entries.reduce((s, x) => s + (x.count || 0), 0)}`, "");

      for (const { section, entries: list } of groups) {
        lines.push(`# ${section}s`);
        for (const e of list) {
          const line = lineForText(e, /*withSet*/ true);
          lines.push(line);
          console.log(`[Lorcanito Export] Added line: ${line}`);
        }
        lines.push("");
      }
      
      const result = lines.join("\n").trim() + "\n";
      console.log('[Lorcanito Export] Final result:', result);
      return result;
    } catch (error) {
      console.error('[Lorcanito Export] Error in makeLorcanitoTextExport:', error);
      throw error;
    }
  }

  // Hook up to a button
  async function onExportLorcanito(deck) {
    console.log('[Lorcanito Export] BUTTON CLICKED! Function called with deck:', deck);
    try {
      console.log('[Lorcanito Export] Starting export for deck:', deck);
      console.log('[Lorcanito Export] Deck entries:', deck.entries);
      
      // Convert deck.entries object to array format and filter out zero-count cards
      const deckEntries = Object.values(deck.entries || {}).filter(e => e.count > 0);
      console.log('[Lorcanito Export] Filtered deck entries:', deckEntries);
      
      if (deckEntries.length === 0) {
        alert("No cards in deck to export!");
        return;
      }
      
      // Extract ink colors from the deck (handle multiple data structures)
      const inkColors = new Set();
      for (const { card } of deckEntries) {
        // Check multiple possible ink field locations
        const inks = card.inks || card._raw?.inks || card._raw?.Inks || [];
        if (Array.isArray(inks)) {
          inks.forEach(ink => inkColors.add(ink));
        } else if (typeof inks === 'string') {
          // Handle comma-separated ink strings
          inks.split(',').map(ink => ink.trim()).forEach(ink => inkColors.add(ink));
        }
      }
      console.log('[Lorcanito Export] Extracted ink colors:', Array.from(inkColors));
      
      const text = makeLorcanitoTextExport({
        name: deck.name || "Untitled Deck",
        inks: inkColors.size > 0 ? Array.from(inkColors) : undefined,
        entries: deckEntries
      });
      
      console.log('[Lorcanito Export] Generated text:', text);
      console.log('[Lorcanito Export] Text length:', text.length);
      
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        console.log('[Lorcanito Export] Using modern clipboard API');
        await navigator.clipboard.writeText(text);
        console.log('[Lorcanito Export] Clipboard write successful');
      } else {
        // Fallback to older method
        console.log('[Lorcanito Export] Using fallback clipboard method');
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (!successful) {
          throw new Error('Fallback clipboard method failed');
        }
        console.log('[Lorcanito Export] Fallback clipboard successful');
      }
      
      alert("Deck list copied to clipboard! Paste it into Lorcanito's import box or any other Lorcana tool.");
      console.log('[Lorcanito Export] Export completed successfully');
    } catch (error) {
      console.error('[Lorcanito Export] Error copying deck list:', error);
      console.error('[Lorcanito Export] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      // Show more specific error message
      if (error.name === 'NotAllowedError') {
        alert('Clipboard permission denied. Please allow clipboard access and try again.');
      } else if (error.name === 'NotSupportedError') {
        alert('Clipboard not supported in this browser. The text will be shown below for manual copying.');
        // Show the text in a prompt for manual copying
        prompt('Copy this deck list manually:', text);
      } else {
        alert(`Error copying deck list: ${error.message}. Please try again.`);
      }
    }
  }
  
  // Calculate deck statistics
  const totalCards = entries.reduce((sum, e) => sum + e.count, 0);
  const totalInkable = entries.reduce((sum, e) => {
    const isInkable = e.card.inkable || e.card._raw?.inkable || e.card._raw?.inkwell || /inkable/i.test(e.card.text || "");
    return sum + (isInkable ? e.count : 0);
  }, 0);
  const totalUninkable = totalCards - totalInkable;
  
  // Calculate cost curve
  const costCurve = {};
  entries.forEach(e => {
    const cost = getCost(e.card);
    const normalizedCost = cost >= 10 ? 10 : cost;
    costCurve[normalizedCost] = (costCurve[normalizedCost] || 0) + e.count;
  });
  
  // Calculate type distribution
  const typeDistribution = {};
  entries.forEach(e => {
    const types = Array.isArray(e.card.types) ? e.card.types : [e.card.type];
    types.forEach(type => {
      if (type) {
        const cleanType = type.split(' - ')[0]; // Handle "Action - Song" -> "Action"
        typeDistribution[cleanType] = (typeDistribution[cleanType] || 0) + e.count;
      }
    });
  });
  
  // Calculate ink color distribution
  const inkDistribution = {};
  entries.forEach(e => {
    const inks = Array.isArray(e.card.inks) ? e.card.inks : [e.card.inks];
    inks.forEach(ink => {
      if (ink) {
        inkDistribution[ink] = (inkDistribution[ink] || 0) + e.count;
      }
    });
  });
  
  // Calculate average cost
  const totalCost = entries.reduce((sum, e) => sum + (getCost(e.card) * e.count), 0);
  const averageCost = totalCost / totalCards;
  
  // Find most expensive and cheapest cards
  const sortedByCost = entries.sort((a, b) => getCost(b.card) - getCost(a.card));
  const mostExpensive = sortedByCost[0];
  const cheapest = sortedByCost[sortedByCost.length - 1];
  
  // Function to generate deck image
  async function generateDeckImage() {
    try {
      // Get the button element to show loading state
      const button = event?.target;
      const originalText = button?.textContent;
      const originalDisabled = button?.disabled;
      
      if (button) {
        button.disabled = true;
        button.textContent = '🔄 Generating...';
      }
      // Create canvas for deck image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Layout constants - tune these for the exact look you want
      const posterW = 1400;       // Fixed width like your clean mock
      const columns = 8;          // 8 across for more compact layout
      const gap = 16;             // Space between cards
      const margin = 32;          // Outer edge margin
      const headerH = 120;        // Title band height
      const cardAR = 63/88;       // Lorcana card aspect ratio
      
      // Calculate card size from width/columns (no dead space)
      const cardWidth = Math.floor((posterW - margin * 2 - gap * (columns - 1)) / columns);
      const cardHeight = Math.floor(cardWidth / cardAR);
      const cardsPerRow = columns;
      
      // Get grouped entries for sorting
      const groupedEntries = groupAndSortForText(entries);
      
      // Flatten all entries into one continuous list, maintaining order
      const allEntries = [];
      try {
        for (const { entries: list } of groupedEntries) {
          // Sort each group by cost, then by name for consistent ordering
          const sortedList = [...list].sort((a, b) => {
            const costA = getCost(a.card) ?? 0;
            const costB = getCost(b.card) ?? 0;
            if (costA !== costB) {
              return costA - costB; // Sort by cost first
            }
            // If costs are equal, sort by name
            return a.card.name.localeCompare(b.card.name);
          });
          allEntries.push(...sortedList);
        }
        
        // Debug: log the entries we're working with
        console.log(`[Deck Image] Total entries to draw:`, allEntries.length);
      } catch (sortError) {
        console.error(`[Deck Image] Error sorting entries:`, sortError);
        // Fallback: just use the original entries without sorting
        for (const { entries: list } of groupedEntries) {
          allEntries.push(...list);
        }
      }
      
      // Calculate exact grid dimensions (no dead space)
      const totalRows = Math.ceil(allEntries.length / cardsPerRow);
      const gridHeight = totalRows * cardHeight + (totalRows - 1) * gap;
      
      // Compute exact poster height (no hard-coded values)
      const posterH = headerH + margin + gridHeight + margin;
      
      // Set canvas dimensions exactly
      canvas.width = posterW;
      canvas.height = posterH;
      
      // Debug logging for dimensions
      console.log(`[Deck Image] Layout calculation:`, {
        posterW,
        posterH,
        columns,
        cardWidth,
        cardHeight,
        gap,
        margin,
        headerH,
        totalRows,
        totalCards: allEntries.length
      });
      
      // Background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Title and username on same row, centered
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 56px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(deck.name || 'Untitled Deck', canvas.width / 2, margin);
      
      // Username on same row, centered below title
      ctx.font = '500 32px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#cdd2e0';
      const username = deck.createdBy || deck.username || 'Unknown User';
      ctx.fillText(`by ${username}`, canvas.width / 2, margin + 70);
      
      // Draw cards in grid - one continuous grid without section breaks
      let currentRow = 0;
      let currentCol = 0;
      const yOffset = headerH + margin;
      
      // Draw all cards in one continuous grid
      for (const entry of allEntries) {
        const x = margin + currentCol * (cardWidth + gap);
        const y = yOffset + currentRow * (cardHeight + gap);
        
        // Draw card background
        ctx.fillStyle = '#2d3748';
        ctx.fillRect(x, y, cardWidth, cardHeight);
        ctx.strokeStyle = '#718096';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, cardWidth, cardHeight);
        
        // Draw card image if available - try multiple image sources
        const card = entry.card;
        let imageDrawn = false;
        
        // Try multiple image sources in order of preference
        const imageSources = [
          card.image_url,
          card.image,
          card._imageFromAPI,
          card._raw?.image_uris?.digital?.large,
          card._raw?.image_uris?.digital?.normal,
          card._raw?.image_uris?.large,
          card._raw?.image_uris?.normal,
          // Try to generate Lorcast URLs if we have set/number
          card.set && card.number ? `https://cards.lorcast.io/card/digital/large/crd_${card.set}_${card.number.toString().padStart(3, '0')}.avif` : null,
          card.set && card.number ? `https://api.lorcast.com/v0/cards/${card.set}/${card.number}/image` : null
        ].filter(Boolean);
        
        // Debug: log what image sources we have
        console.log(`[Deck Image] Card: ${card.name}, Image sources:`, imageSources);
        
        for (const imageSrc of imageSources) {
          if (imageSrc && !imageDrawn) {
            try {
              console.log(`[Deck Image] Trying image source: ${imageSrc}`);
              
              const img = new Image();
              img.crossOrigin = 'anonymous';
              
              // Try to use proxy for CORS issues
              let finalImageSrc = imageSrc;
              if (imageSrc.includes('cards.lorcast.io') || imageSrc.includes('api.lorcast.com')) {
                try {
                  // Use the existing proxy function if available
                  if (typeof proxyImageUrl === 'function') {
                    finalImageSrc = proxyImageUrl(imageSrc);
                    console.log(`[Deck Image] Using proxy URL: ${finalImageSrc}`);
                  } else {
                    // Fallback proxy
                    finalImageSrc = `https://images.weserv.nl/?url=${encodeURIComponent(imageSrc)}&output=jpg`;
                    console.log(`[Deck Image] Using fallback proxy: ${finalImageSrc}`);
                  }
                } catch (proxyError) {
                  console.warn(`[Deck Image] Proxy failed, using original: ${imageSrc}`);
                }
              }
              
              await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Image load timeout')), 5000);
                img.onload = () => {
                  clearTimeout(timeout);
                  console.log(`[Deck Image] Successfully loaded image: ${finalImageSrc}`);
                  resolve();
                };
                img.onerror = () => {
                  clearTimeout(timeout);
                  console.log(`[Deck Image] Failed to load image: ${finalImageSrc}`);
                  reject(new Error('Image failed to load'));
                };
                img.src = finalImageSrc;
              });
              
              // Draw image maintaining aspect ratio
              const imgAspect = img.width / img.height;
              const cardAspect = cardWidth / cardHeight;
              
              let drawWidth = cardWidth;
              let drawHeight = cardHeight;
              let drawX = x;
              let drawY = y;
              
              if (imgAspect > cardAspect) {
                drawHeight = cardWidth / imgAspect;
                drawY = y + (cardHeight - drawHeight) / 2;
              } else {
                drawWidth = cardHeight * imgAspect;
                drawX = x + (cardWidth - drawWidth) / 2;
              }
              
              ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
              imageDrawn = true;
              console.log(`[Deck Image] Successfully drew image for ${card.name}`);
              break; // Successfully drew image, stop trying other sources
              
            } catch (error) {
              console.warn(`[Deck Image] Failed to load image from ${imageSrc}:`, error);
              continue; // Try next image source
            }
          }
        }
        
        // If no image was drawn, try one more approach with existing functions
        if (!imageDrawn) {
          try {
            // Try to use the existing image loading functions from the codebase
            if (typeof getWorkingImageUrl === 'function') {
              const workingUrl = await getWorkingImageUrl(card);
              if (workingUrl) {
                console.log(`[Deck Image] Trying getWorkingImageUrl: ${workingUrl}`);
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                await new Promise((resolve, reject) => {
                  const timeout = setTimeout(() => reject(new Error('Image load timeout')), 3000);
                  img.onload = resolve;
                  img.onerror = reject;
                  img.src = workingUrl;
                });
                
                // Draw the image
                const imgAspect = img.width / img.height;
                const cardAspect = cardWidth / cardHeight;
                
                let drawWidth = cardWidth;
                let drawHeight = cardHeight;
                let drawX = x;
                let drawY = y;
                
                if (imgAspect > cardAspect) {
                  drawHeight = cardWidth / imgAspect;
                  drawY = y + (cardHeight - drawHeight) / 2;
                } else {
                  drawWidth = cardHeight * imgAspect;
                  drawX = x + (cardWidth - drawWidth) / 2;
                }
                
                ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
                imageDrawn = true;
                console.log(`[Deck Image] Successfully drew image using getWorkingImageUrl for ${card.name}`);
              }
            }
          } catch (error) {
            console.warn(`[Deck Image] getWorkingImageUrl failed for ${card.name}:`, error);
          }
        }
        
        // If still no image was drawn, use fallback
        if (!imageDrawn) {
          drawFallbackCard(ctx, x, y, cardWidth, cardHeight, card);
        }
        
        // Draw count indicator
        if (entry.count > 1) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(x + cardWidth - 25, y, 25, 25);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 16px Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(entry.count.toString(), x + cardWidth - 12.5, y + 18);
        }
        
        // Move to next position
        currentCol++;
        if (currentCol >= cardsPerRow) {
          currentCol = 0;
          currentRow++;
        }
      }
      
      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${deck.name || 'deck'}_${new Date().toISOString().split('T')[0]}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        
        // Restore button state
        if (button) {
          button.disabled = originalDisabled;
          button.textContent = originalText;
        }
      }, 'image/png');
      
    } catch (error) {
      console.error('Failed to generate deck image:', error);
      alert('Failed to generate deck image. Please try again.');
      
      // Restore button state on error
      if (button) {
        button.disabled = originalDisabled;
        button.textContent = originalText;
      }
    }
  }
  
  // Helper function to draw fallback card content
  function drawFallbackCard(ctx, x, y, width, height, card) {
    // Card background
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(x, y, width, height);
    
    // Card border
    ctx.strokeStyle = '#718096';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    // Card name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.textAlign = 'center';
    
    // Wrap text if too long
    const maxWidth = width - 10;
    const words = (card.name || 'Unknown').split(' ');
    let line = '';
    let lineY = y + 20;
    
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line, x + width / 2, lineY);
        line = words[i] + ' ';
        lineY += 15;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x + width / 2, lineY);
    
    // Card details
    ctx.font = '10px Arial, sans-serif';
    ctx.fillStyle = '#cccccc';
    
    if (card.set) {
      ctx.fillText(`Set: ${card.set}`, x + width / 2, lineY + 20);
    }
    
    if (card.number) {
      ctx.fillText(`#${card.number}`, x + width / 2, lineY + 35);
    }
    
    if (card.cost !== undefined) {
      ctx.fillText(`Cost: ${card.cost}`, x + width / 2, lineY + 50);
    }
  }
  
  return (
    <Modal open={true} onClose={onClose} title="Deck Presentation" size="full">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-emerald-400">{deck.name}</h1>
          <p className="text-gray-400 mt-2">A Lorcana Deck</p>
          {deck.updatedAt && (
            <p className="text-xs text-gray-500 mt-1">
              Last saved: {new Date(deck.updatedAt).toLocaleString()}
            </p>
          )}
        </div>
        
        {/* Card Images Grid - Organized by Type and Cost */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4 text-center">Deck Cards</h3>
          
          {/* Character Cards */}
          {(() => {
            const characterCards = entries.filter(e => normalizedType(e.card) === 'Character').sort((a, b) => getCost(a.card) - getCost(b.card));
            if (characterCards.length > 0) {
              return (
                <div className="mb-6">
                  <h4 className="text-md font-semibold mb-3 text-center text-blue-400">Character Cards</h4>
                  <div className="grid justify-center gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, 160px)' }}>
                    {characterCards.map((e) => (
                      <div key={deckKey(e.card)} className="relative w-[160px]">
                        <div className="rounded-lg overflow-hidden shadow-lg ring-1 ring-black/40">
                          <img 
                            src={e.card.image_url || e.card._imageFromAPI || FALLBACK_IMG} 
                            alt={e.card.name} 
                            className="block w-full h-[224px] object-cover bg-gray-800"
                            loading="lazy"
                          />
                        </div>
                        <div className="absolute -top-2.5 -right-2.5 z-10">
                          <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-black/85 text-white flex items-center justify-center text-sm font-bold tracking-tight shadow-[0_4px_8px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
                              {e.count}
                            </div>
                            <div className="absolute -bottom-1 right-0.5 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-black/80" />
                          </div>
                        </div>
                        <div className="mt-2 text-center">
                          {/* Smart display name with variant/subtitle */}
                          {(() => {
                            // Prefer the variant/subtitle if present
                            const variant =
                              e.card.title ||
                              e.card.version ||
                              e.card._raw?.version ||
                              e.card._raw?.Version ||
                              e.card.subname ||
                              null;

                            const displayName = variant ? `${e.card.name} — ${variant}` : e.card.name;

                            return (
                              <div
                                className="text-sm font-semibold text-white line-clamp-2 leading-tight px-1"
                                title={displayName}         // full hover tooltip
                                aria-label={displayName}
                              >
                                {displayName}
                              </div>
                            );
                          })()}
                          
                          {/* Card type and cost info */}
                          <div className="text-xs text-gray-400 mt-1 line-clamp-1 leading-tight">
                            {normalizedType(e.card)} • {getCost(e.card)} cost
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          })()}
          
          {/* Action Cards */}
          {(() => {
            const actionCards = entries.filter(e => normalizedType(e.card) === 'Action').sort((a, b) => getCost(a.card) - getCost(b.card));
            if (actionCards.length > 0) {
              return (
                <div className="mb-6">
                  <h4 className="text-md font-semibold mb-3 text-center text-green-400">Action Cards</h4>
                  <div className="grid justify-center gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, 160px)' }}>
                    {actionCards.map((e) => (
                      <div key={deckKey(e.card)} className="relative w-[160px]">
                        <div className="rounded-lg overflow-hidden shadow-lg ring-1 ring-black/40">
                          <img 
                            src={e.card.image_url || e.card._imageFromAPI || FALLBACK_IMG} 
                            alt={e.card.name} 
                            className="block w-full h-[224px] object-cover bg-gray-800"
                            loading="lazy"
                          />
                        </div>
                        <div className="absolute -top-2.5 -right-2.5 z-10">
                          <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-black/85 text-white flex items-center justify-center text-sm font-bold tracking-tight shadow-[0_4px_8px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
                              {e.count}
                            </div>
                            <div className="absolute -bottom-1 right-0.5 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-black/80" />
                          </div>
                        </div>
                        <div className="mt-2 text-center">
                          {/* Smart display name with variant/subtitle */}
                          {(() => {
                            // Prefer the variant/subtitle if present
                            const variant =
                              e.card.title ||
                              e.card.version ||
                              e.card._raw?.version ||
                              e.card._raw?.Version ||
                              e.card.subname ||
                              null;

                            const displayName = variant ? `${e.card.name} — ${variant}` : e.card.name;

                            return (
                              <div
                                className="text-sm font-semibold text-white line-clamp-2 leading-tight px-1"
                                title={displayName}         // full hover tooltip
                                aria-label={displayName}
                              >
                                {displayName}
                              </div>
                            );
                          })()}
                          
                          {/* Card type and cost info */}
                          <div className="text-xs text-gray-400 mt-1 line-clamp-1 leading-tight">
                            {normalizedType(e.card)} • {getCost(e.card)} cost
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          })()}
          
          {/* Song Cards */}
          {(() => {
            const songCards = entries.filter(e => normalizedType(e.card) === 'Song').sort((a, b) => getCost(a.card) - getCost(b.card));
            if (songCards.length > 0) {
              return (
                <div className="mb-6">
                  <h4 className="text-md font-semibold mb-3 text-center text-purple-400">Song Cards</h4>
                  <div className="grid justify-center gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, 160px)' }}>
                    {songCards.map((e) => (
                      <div key={deckKey(e.card)} className="relative w-[160px]">
                        <div className="rounded-lg overflow-hidden shadow-lg ring-1 ring-black/40">
                          <img 
                            src={e.card.image_url || e.card._imageFromAPI || FALLBACK_IMG} 
                            alt={e.card.name} 
                            className="block w-full h-[224px] object-cover bg-gray-800"
                            loading="lazy"
                          />
                        </div>
                        <div className="absolute -top-2.5 -right-2.5 z-10">
                          <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-black/85 text-white flex items-center justify-center text-sm font-bold tracking-tight shadow-[0_4px_8px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
                              {e.count}
                            </div>
                            <div className="absolute -bottom-1 right-0.5 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-black/80" />
                          </div>
                        </div>
                        <div className="mt-2 text-center">
                          {/* Smart display name with variant/subtitle */}
                          {(() => {
                            // Prefer the variant/subtitle if present
                            const variant =
                              e.card.title ||
                              e.card.version ||
                              e.card._raw?.version ||
                              e.card._raw?.Version ||
                              e.card.subname ||
                              null;

                            const displayName = variant ? `${e.card.name} — ${variant}` : e.card.name;

                            return (
                              <div
                                className="text-sm font-semibold text-white line-clamp-2 leading-tight px-1"
                                title={displayName}         // full hover tooltip
                                aria-label={displayName}
                              >
                                {displayName}
                              </div>
                            );
                          })()}
                          
                          {/* Card type and cost info */}
                          <div className="text-xs text-gray-400 mt-1 line-clamp-1 leading-tight">
                            {normalizedType(e.card)} • {getCost(e.card)} cost
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          })()}
          
          {/* Item Cards */}
          {(() => {
            const itemCards = entries.filter(e => normalizedType(e.card) === 'Item').sort((a, b) => getCost(a.card) - getCost(b.card));
            if (itemCards.length > 0) {
              return (
                <div className="mb-6">
                  <h4 className="text-md font-semibold mb-3 text-center text-yellow-400">Item Cards</h4>
                  <div className="grid justify-center gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, 160px)' }}>
                    {itemCards.map((e) => (
                      <div key={deckKey(e.card)} className="relative w-[160px]">
                        <div className="rounded-lg overflow-hidden shadow-lg ring-1 ring-black/40">
                          <img 
                            src={e.card.image_url || e.card._imageFromAPI || FALLBACK_IMG} 
                            alt={e.card.name} 
                            className="block w-full h-[224px] object-cover bg-gray-800"
                            loading="lazy"
                          />
                        </div>
                        <div className="absolute -top-2.5 -right-2.5 z-10">
                          <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-black/85 text-white flex items-center justify-center text-sm font-bold tracking-tight shadow-[0_4px_8px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
                              {e.count}
                            </div>
                            <div className="absolute -bottom-1 right-0.5 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-black/80" />
                          </div>
                        </div>
                        <div className="mt-2 text-center">
                          {/* Smart display name with variant/subtitle */}
                          {(() => {
                            // Prefer the variant/subtitle if present
                            const variant =
                              e.card.title ||
                              e.card.version ||
                              e.card._raw?.version ||
                              e.card._raw?.Version ||
                              e.card.subname ||
                              null;

                            const displayName = variant ? `${e.card.name} — ${variant}` : e.card.name;

                            return (
                              <div
                                className="text-sm font-semibold text-white line-clamp-2 leading-tight px-1"
                                title={displayName}         // full hover tooltip
                                aria-label={displayName}
                              >
                                {displayName}
                              </div>
                            );
                          })()}
                          
                          {/* Card type and cost info */}
                          <div className="text-xs text-gray-400 mt-1 line-clamp-1 leading-tight">
                            {normalizedType(e.card)} • {getCost(e.card)} cost
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          })()}
          
          {/* Location Cards */}
          {(() => {
            const locationCards = entries.filter(e => normalizedType(e.card) === 'Location').sort((a, b) => getCost(a.card) - getCost(b.card));
            if (locationCards.length > 0) {
              return (
                <div className="mb-6">
                  <h4 className="text-md font-semibold mb-3 text-center text-red-400">Location Cards</h4>
                  <div className="grid justify-center gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, 160px)' }}>
                    {locationCards.map((e) => (
                      <div key={deckKey(e.card)} className="relative w-[160px]">
                        <div className="rounded-lg overflow-hidden shadow-lg ring-1 ring-black/40">
                          <img 
                            src={e.card.image_url || e.card._imageFromAPI || FALLBACK_IMG} 
                            alt={e.card.name} 
                            className="block w-full h-[224px] object-cover bg-gray-800"
                            loading="lazy"
                          />
                        </div>
                        <div className="absolute -top-2.5 -right-2.5 z-10">
                          <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-black/85 text-white flex items-center justify-center text-sm font-bold tracking-tight shadow-[0_4px_8px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
                              {e.count}
                            </div>
                            <div className="absolute -bottom-1 right-0.5 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-black/80" />
                          </div>
                        </div>
                        <div className="mt-2 text-center">
                          {/* Smart display name with variant/subtitle */}
                          {(() => {
                            // Prefer the variant/subtitle if present
                            const variant =
                              e.card.title ||
                              e.card.version ||
                              e.card._raw?.version ||
                              e.card._raw?.Version ||
                              e.card.subname ||
                              null;

                            const displayName = variant ? `${e.card.name} — ${variant}` : e.card.name;

                            return (
                              <div
                                className="text-sm font-semibold text-white line-clamp-2 leading-tight px-1"
                                title={displayName}         // full hover tooltip
                                aria-label={displayName}
                              >
                                {displayName}
                              </div>
                            );
                          })()}
                          
                          {/* Card type and cost info */}
                          <div className="text-xs text-gray-400 mt-1 line-clamp-1 leading-tight">
                            {normalizedType(e.card)} • {getCost(e.card)} cost
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          })()}
        </div>
        
        {/* Basic Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{totalCards}</div>
            <div className="text-sm text-gray-400">Total Cards</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{totalInkable}</div>
            <div className="text-sm text-gray-400">Inkable</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{totalUninkable}</div>
            <div className="text-sm text-gray-400">Uninkable</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">{averageCost.toFixed(1)}</div>
            <div className="text-sm text-gray-400">Avg Cost</div>
          </div>
        </div>
        
        {/* Deck Health Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-lg font-semibold mb-2">Deck Size</div>
            <div className={`text-2xl font-bold ${totalCards >= 60 && totalCards <= 60 ? 'text-green-400' : totalCards >= 55 && totalCards <= 65 ? 'text-yellow-400' : 'text-red-400'}`}>
              {totalCards}/60
            </div>
            <div className="text-xs text-gray-400">
              {totalCards === 60 ? 'Perfect!' : totalCards >= 55 && totalCards <= 65 ? 'Close' : 'Needs adjustment'}
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-lg font-semibold mb-2">Inkable Ratio</div>
            <div className={`text-2xl font-bold ${(totalInkable / totalCards) >= 0.7 ? 'text-green-400' : (totalInkable / totalCards) >= 0.6 ? 'text-yellow-400' : 'text-red-400'}`}>
              {((totalInkable / totalCards) * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-gray-400">
              {(totalInkable / totalCards) >= 0.7 ? 'Good' : (totalInkable / totalCards) >= 0.6 ? 'Acceptable' : 'Low'}
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-lg font-semibold mb-2">Cost Balance</div>
            <div className={`text-2xl font-bold ${averageCost >= 2.5 && averageCost <= 4.5 ? 'text-green-400' : averageCost >= 2.0 && averageCost <= 5.0 ? 'text-yellow-400' : 'text-red-400'}`}>
              {averageCost.toFixed(1)}
            </div>
            <div className="text-xs text-gray-400">
              {averageCost >= 2.5 && averageCost <= 4.5 ? 'Balanced' : averageCost >= 2.0 && averageCost <= 5.0 ? 'Moderate' : 'Extreme'}
            </div>
          </div>
        </div>
        
        {/* Cost Curve Chart */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4 text-center">Cost Curve</h3>
          <div className="flex items-end justify-center gap-1 h-32">
            {Array.from({ length: 11 }, (_, i) => {
              const count = costCurve[i] || 0;
              const maxCount = Math.max(...Object.values(costCurve));
              const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <div key={i} className="flex flex-col items-center">
                  <div 
                    className="w-8 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all duration-300 hover:from-blue-500 hover:to-blue-300"
                    style={{ height: `${height}%` }}
                    title={`Cost ${i === 10 ? '10+' : i}: ${count} cards`}
                  />
                  <div className="text-xs text-gray-400 mt-1">{i === 10 ? '10+' : i}</div>
                  <div className="text-xs font-semibold text-blue-400">{count}</div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Type Distribution Pie Chart */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-center">Card Types</h3>
            <div className="space-y-2">
              {Object.entries(typeDistribution).map(([type, count]) => {
                const percentage = ((count / totalCards) * 100).toFixed(1);
                const colors = {
                  'Character': 'bg-red-500',
                  'Action': 'bg-blue-500',
                  'Item': 'bg-green-500',
                  'Location': 'bg-purple-500',
                  'Song': 'bg-yellow-500'
                };
                return (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${colors[type] || 'bg-gray-500'}`} />
                      <span className="text-sm">{type}</span>
                    </div>
                    <div className="text-sm font-semibold">{count} ({percentage}%)</div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Ink Color Distribution */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-center">Ink Colors</h3>
            <div className="space-y-2">
              {Object.entries(inkDistribution).map(([ink, count]) => {
                const percentage = ((count / totalCards) * 100).toFixed(1);
                const colors = {
                  'Amber': 'bg-amber-500',
                  'Amethyst': 'bg-purple-500',
                  'Emerald': 'bg-green-500',
                  'Ruby': 'bg-red-500',
                  'Sapphire': 'bg-blue-500',
                  'Steel': 'bg-gray-500'
                };
                return (
                  <div key={ink} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${colors[ink] || 'bg-gray-500'}`} />
                      <span className="text-sm">{ink}</span>
                    </div>
                    <div className="text-sm font-semibold">{count} ({percentage}%)</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        

        
        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="font-semibold mb-2 text-center">Cost Analysis</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Most Expensive:</span>
                <span className="font-semibold">{mostExpensive?.card.name} (Cost {getCost(mostExpensive?.card)})</span>
              </div>
              <div className="flex justify-between">
                <span>Cheapest:</span>
                <span className="font-semibold">{cheapest?.card.name} (Cost {getCost(cheapest?.card)})</span>
              </div>
              <div className="flex justify-between">
                <span>Total Cost:</span>
                <span className="font-semibold">{totalCost}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="font-semibold mb-2 text-center">Deck Composition</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Inkable Ratio:</span>
                <span className="font-semibold">{((totalInkable / totalCards) * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Uninkable Ratio:</span>
                <span className="font-semibold">{((totalUninkable / totalCards) * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Unique Cards:</span>
                <span className="font-semibold">{entries.length}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Action Buttons - Always Visible */}
        <div className="bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 mt-6 pt-4 pb-2">
          <div className="flex justify-center gap-4 flex-wrap">
            {/* Download Image Button */}
            <button
              onClick={generateDeckImage}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-semibold transition-colors shadow-lg"
              title="Download deck as image (PNG)"
            >
              🖼️ Download Image
            </button>

            {/* Print Button - Opens print dialog */}
            <button
              onClick={() => {
                window.print();
                onClose();
              }}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors shadow-lg"
              title="Print deck presentation"
            >
              🖨️ Print
            </button>

            {/* Save Button - Saves the current deck */}
            <button
              onClick={() => {
                if (onSave) {
                  onSave();
                }
              }}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 rounded-lg font-semibold transition-colors shadow-lg"
              title="Save deck to storage"
            >
              💾 Save Deck
            </button>



            {/* Copy Stats Button - Copies deck statistics */}
            <button
              onClick={() => {
                // Copy deck stats to clipboard
                const stats = `Deck: ${deck.name}
Total Cards: ${totalCards}
Inkable: ${totalInkable} (${((totalInkable / totalCards) * 100).toFixed(1)}%)
Uninkable: ${totalUninkable} (${((totalUninkable / totalCards) * 100).toFixed(1)}%)
Average Cost: ${averageCost.toFixed(1)}
Most Expensive: ${mostExpensive?.card.name} (Cost ${getCost(mostExpensive?.card)})
Cheapest: ${cheapest?.card.name} (Cost ${getCost(cheapest?.card)})`;
                navigator.clipboard.writeText(stats);
                // You could add a toast here if you have access to it
              }}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors shadow-lg"
              title="Copy deck statistics to clipboard"
            >
              📋 Copy Stats
            </button>

            {/* Copy for Lorcanito Button - Copies plain text decklist */}
              <button
                onClick={() => onExportLorcanito(deck)}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors shadow-lg"
                title="Copy decklist in Lorcanito format"
              >
                📋 Copy for Lorcanito
              </button>
            </div>
          </div>
          
          {/* Print Header */}
          <div className="hidden print:block text-center border-t pt-4 mt-4">
            <p className="text-sm text-gray-400">
              Generated by Lorcana Deck Builder • {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </Modal>
    );
  }

// Root App -------------------------------------------------------------------

function AppInner() {
  const { addToast } = useToasts();
  const [deck, deckDispatch] = useReducer(deckReducer, undefined, initialDeckState);
  const [filters, filterDispatch] = useReducer(filterReducer, undefined, initialFilterState);
  console.log('[App] Initial filters state:', filters);
  const [allCards, setAllCards] = useState([]);
  const [shownCards, setShownCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inspectCard, setInspectCard] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [deckPresentationOpen, setDeckPresentationOpen] = useState(false);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);
  const [saveConfirmationOpen, setSaveConfirmationOpen] = useState(false);

  // Enhanced deck management state
  const [decks, setDecks] = useState({});
  const [currentDeckId, setCurrentDeckId] = useState(null);
  const [showDeckManager, setShowDeckManager] = useState(false);

  // Add batch image loader
  const { loadImagesInBatch } = useBatchImageLoader();
  const [imageLoadProgress, setImageLoadProgress] = useState({ loaded: 0, failed: 0 });

  // Performance monitoring for image loading
  const [imagePerformance, setImagePerformance] = useState({
    totalLoaded: 0,
    totalFailed: 0,
    averageLoadTime: 0,
    startTime: Date.now()
  });

  // Track image loading performance
  const trackImagePerformance = useCallback((loadTime, success) => {
    setImagePerformance(prev => {
      const newTotal = prev.totalLoaded + prev.totalFailed + 1;
      const newLoaded = prev.totalLoaded + (success ? 1 : 0);
      const newFailed = prev.totalFailed + (success ? 0 : 1);
      
      // Calculate rolling average load time
      const newAvgTime = success ? 
        ((prev.averageLoadTime * prev.totalLoaded) + loadTime) / newLoaded : 
        prev.averageLoadTime;
      
      return {
        totalLoaded: newLoaded,
        totalFailed: newFailed,
        averageLoadTime: newAvgTime,
        startTime: prev.startTime
      };
    });
  }, []);

  // Safety check: ensure all Set properties are properly initialized
  useEffect(() => {
    console.log('[App] Safety check useEffect triggered');
    console.log('[App] Current filters state:', filters);
    
    // Check if filters object exists and has all required Set properties
    if (!filters || typeof filters !== 'object') {
      console.warn('Filters object is missing or invalid, resetting...');
      filterDispatch({ type: "RESET" });
      return;
    }
    
    // Clean up any empty strings in abilities filter
    if (filters.abilities instanceof Set && filters.abilities.has('')) {
      console.warn('Found empty string in abilities filter, removing...');
      const cleanAbilities = new Set(Array.from(filters.abilities).filter(a => a && a.trim()));
      filterDispatch({ type: "SET_ABILITIES", abilities: cleanAbilities });
      return;
    }
    
    // Only fix if Sets are completely missing, not if they're empty
    const needsFix = !(filters.inks instanceof Set) || 
                     !(filters.rarities instanceof Set) || 
                     !(filters.types instanceof Set) || 
                     !(filters.sets instanceof Set) || 
                     !(filters.classifications instanceof Set) || 
                     !(filters.abilities instanceof Set);
    
    console.log('[App] Needs fix check result:', needsFix);
    if (needsFix) {
      console.warn('Filter Sets not properly initialized, fixing...', filters);
      console.log('[App] Dispatching RESET action from safety check');
      filterDispatch({ type: "RESET" });
    }
    }, [filters, filterDispatch]);

  // Debug filter state changes
  useEffect(() => {
    console.log('[App] Filter state changed useEffect triggered');
    console.log('[App] Filter state changed:', filters);
    console.log('[App] Filter state details:', {
      text: filters.text,
      inksSize: filters.inks?.size,
      raritiesSize: filters.rarities?.size,
      typesSize: filters.types?.size,
      setsSize: filters.sets?.size,
      classificationsSize: filters.classifications?.size,
      abilitiesSize: filters.abilities?.size,
      selectedCostsSize: filters.selectedCosts?.size,
      showInkablesOnly: filters.showInkablesOnly,
      showUninkablesOnly: filters.showUninkablesOnly,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir
    });
  }, [filters]);

  // Load all cards on mount
  useEffect(() => {
    const loadCards = async () => {
      try {
        console.log('[App] Loading all cards...');
        const cards = await fetchAllCards();
        console.log('[App] Loaded cards:', cards.length);
        setAllCards(cards);
        setLoading(false);
      } catch (error) {
        console.error('[App] Error loading cards:', error);
        setLoading(false);
      }
    };
    
    loadCards();
  }, []);

  // Apply filters to cards
  useEffect(() => {
    if (allCards.length === 0) return;
    
    console.log('[App] Applying filters to cards...');
    const filtered = applyFilters(allCards, filters);
    console.log('[App] Filtered cards:', filtered.length);
    setShownCards(filtered);
    
    // Check if there are active filters
    const hasFilters = filters.text || 
                      (filters.inks && filters.inks.size > 0) ||
                      (filters.rarities && filters.rarities.size > 0) ||
                      (filters.types && filters.types.size > 0) ||
                      (filters.sets && filters.sets.size > 0) ||
                      (filters.classifications && filters.classifications.size > 0) ||
                      (filters.abilities && filters.abilities.size > 0) ||
                      (filters.selectedCosts instanceof Set && filters.selectedCosts.size > 0) ||
                      filters.showInkablesOnly ||
                      filters.showUninkablesOnly ||
                      filters.loreMin || filters.loreMax ||
                      filters.willpowerMin || filters.willpowerMax ||
                      filters.strengthMin || filters.strengthMax;
    
    setHasActiveFilters(hasFilters);
  }, [allCards, filters]);

  // Enhanced deck management initialization
  useEffect(() => {
    console.log('[App] Initializing enhanced deck management...');
    
    // Load all decks from storage
    const allDecks = loadAllDecks();
    console.log('[App] Loaded decks:', Object.keys(allDecks).length);
    setDecks(allDecks);
    
    // Load current deck ID
    const currentId = localStorage.getItem(LS_KEYS.CURRENT_DECK_ID);
    if (currentId && allDecks[currentId]) {
      console.log('[App] Loading current deck:', currentId);
      setCurrentDeckId(currentId);
      deckDispatch({ type: "SWITCH_DECK", deck: allDecks[currentId] });
    } else if (Object.keys(allDecks).length > 0) {
      // If no current deck but we have decks, use the first one
      const firstDeckId = Object.keys(allDecks)[0];
      console.log('[App] No current deck, using first available:', firstDeckId);
      setCurrentDeckId(firstDeckId);
      deckDispatch({ type: "SWITCH_DECK", deck: allDecks[firstDeckId] });
      saveCurrentDeckId(firstDeckId);
    } else {
      // Create a default deck if none exist
      console.log('[App] No decks found, creating default deck');
      const defaultDeck = createNewDeck("My First Deck");
      const newDecks = { [defaultDeck.id]: defaultDeck };
      setDecks(newDecks);
      setCurrentDeckId(defaultDeck.id);
      deckDispatch({ type: "SWITCH_DECK", deck: defaultDeck });
      saveCurrentDeckId(defaultDeck.id);
      saveAllDecks(newDecks);
    }
  }, []);

  // Ensure current deck stays in sync with decks state
  useEffect(() => {
    if (currentDeckId && decks[currentDeckId] && deck?.id === currentDeckId) {
      // Check if the deck in decks state is different from current deck
      const deckInCollection = decks[currentDeckId];
      if (JSON.stringify(deckInCollection) !== JSON.stringify(deck)) {
        console.log('[App] Deck in collection differs from current deck, updating...');
        // Only update if the difference is significant (not just timestamp changes)
        const deckWithoutTimestamp = { ...deck, updatedAt: deckInCollection.updatedAt };
        if (JSON.stringify(deckWithoutTimestamp) !== JSON.stringify(deckInCollection)) {
          deckDispatch({ type: "SWITCH_DECK", deck: deckInCollection });
        }
      }
    }
  }, [decks, currentDeckId]); // Removed 'deck' dependency to prevent interference

  // Monitor currentDeckId changes for debugging
  useEffect(() => {
    console.log('[App] currentDeckId changed to:', currentDeckId);
    console.log('[App] Current deck state:', deck);
    console.log('[App] Decks collection:', decks);
  }, [currentDeckId, deck, decks]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            handleSaveDeck();
            break;
          case 'n':
            e.preventDefault();
            handleNewDeck();
            break;
          case 'o':
            e.preventDefault();
            handleImport();
            break;
          case 'e':
            e.preventDefault();
            handleExport();
            break;
          case 'p':
            e.preventDefault();
            handlePrint();
            break;
        }
      }
    };
    
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debug: expose useful functions to window for testing
  useEffect(() => {
    window.checkCardFields = (card) => {
      console.log('Card fields:', {
        name: card.name,
        type: card.type,
        rarity: card.rarity,
        set: card.set,
        number: card.number,
        text: card.text,
        inks: card.inks,
        cost: getCost(card),
        _raw: card._raw
      });
    };
    
    window.getCurrentCards = () => {
      console.log('Current cards:', {
        allCards: allCards.length,
        shownCards: shownCards.length,
        deck: deck,
        filters: filters
      });
    };
    
    return () => {
      delete window.checkCardFields;
      delete window.getCurrentCards;
    };
    }, [shownCards]);

  // Define all handler functions before the return statement
  

  console.log('[App] Rendering with ImageCacheProvider wrapper');




// Simplified card display - no progressive loading to prevent duplicates
useEffect(() => {
  if (shownCards && shownCards.length > 0 && !loading) {
    console.log(`[App] Cards displayed: ${shownCards.length}`);
    
    // Simple image preloading for visible cards only
    const timer = setTimeout(() => {
      const visibleCards = shownCards.slice(0, 100); // Only preload first 100 cards
      const cardsNeedingImages = visibleCards.filter(card => 
        card && card._imageFromAPI && 
        !card._imageLoaded && 
        !card._imageError
      );
      
      if (cardsNeedingImages.length > 0) {
        console.log(`[App] Preloading images for ${cardsNeedingImages.length} visible cards`);
        
        // Simple batch loading without complex logic
        loadImagesInBatch(cardsNeedingImages, (loaded, failed) => {
          setImageLoadProgress({ loaded, failed });
          console.log(`[App] Image preloading completed: ${loaded} success, ${failed} failed`);
        });
      }
    }, 1000); // Delay image preloading to prioritize card display
    
    return () => clearTimeout(timer);
  }
}, [shownCards, loading, loadImagesInBatch]);

// Expose performance tracking globally for batch loader
useEffect(() => {
  window.trackImagePerformance = trackImagePerformance;
  return () => {
    delete window.trackImagePerformance;
  };
}, [trackImagePerformance]);

// Expose card sanity check globally for DevTools debugging
useEffect(() => {
  window.checkCardFields = () => {
    if (shownCards && shownCards.length > 0) {
      const c = shownCards[0];
      console.log('[DevTools] Card field check:', {
        inks: c.inks,
        setCode: c.setCode,
        setName: c.setName,
        setNum: c.setNum,
        number: c.number
      });
      return c;
    } else {
      console.log('[DevTools] No cards available for field check');
      return null;
    }
  };
  
  // Also expose the current card list for debugging
  window.getCurrentCards = () => shownCards || [];
  
  return () => {
    delete window.checkCardFields;
    delete window.getCurrentCards;
  };
}, [shownCards]);

const deckValid = deck.total >= DECK_RULES.MIN_SIZE && deck.total <= DECK_RULES.MAX_SIZE;

function handleAdd(card, count = 1) {
  if (count > 0) {
    deckDispatch({ type: "ADD", card, count });
  } else if (count < 0) {
    // Remove cards (negative count)
    const currentCount = deck.entries[deckKey(card)]?.count || 0;
    const newCount = Math.max(0, currentCount + count);
    if (newCount === 0) {
      deckDispatch({ type: "REMOVE", card });
    } else {
      deckDispatch({ type: "SET_COUNT", card, count: newCount });
    }
  }
}

function handleSetCount(card, count) {
  deckDispatch({ type: "SET_COUNT", card, count });
}

function handleRemove(card) {
  deckDispatch({ type: "REMOVE", card });
}

function handleExport() {
  setExportOpen(true);
}

function handleImport() {
  setImportOpen(true);
}

function handleDoImport(obj) {
  deckDispatch({ type: "IMPORT_STATE", deck: obj });
  addToast("Deck imported", "success");
}

function handleResetDeck() {
  if (confirm("Start a new deck? This will clear the current deck.")) {
    // Create a new deck with a unique name
    const timestamp = new Date().toLocaleString();
    const newDeckName = `Deck ${timestamp}`;
    handleNewDeck(newDeckName);
  }
}

function handlePrint() {
  setPrintOpen(true);
}

function handleSaveDeck() {
  try {
    // Ensure the current deck is saved to the decks collection
    if (deck && currentDeckId) {
      console.log('[handleSaveDeck] Saving deck:', deck);
      console.log('[handleSaveDeck] Current decks state:', decks);
      
      // Update the deck's timestamp and ensure it has the correct ID
      const updatedDeck = { ...deck, id: currentDeckId, updatedAt: Date.now() };
      const updatedDecks = { ...decks, [currentDeckId]: updatedDeck };
      
      console.log('[handleSaveDeck] Updated deck:', updatedDeck);
      console.log('[handleSaveDeck] Updated deck ID:', updatedDeck.id);
      console.log('[handleSaveDeck] Updated decks state:', updatedDecks);
      
      // Update the decks state and ensure it's immediately available
      setDecks(updatedDecks);
      
      // Save to localStorage (for offline backup)
      saveAllDecks(updatedDecks);
      
      // Save to cloud database if user is logged in
      saveDeckToCloud(updatedDeck);
      
      // Don't call deckDispatch here - let the useEffect handle synchronization
      // This prevents interference with the deck switching logic
      
      // Show save confirmation popup
      setSaveConfirmationOpen(true);
      
      addToast(`Deck "${deck.name}" saved successfully! It will now appear in your deck list.`, "success");
    } else {
      addToast("No deck to save", "error");
    }
  } catch (error) {
    console.error("Error saving deck:", error);
    addToast("Failed to save deck", "error");
  }
}

// Save deck to cloud database
async function saveDeckToCloud(deckData) {
  try {
    const response = await fetch('/api/decks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: deckData.name,
        data: deckData,
      }),
    });

    if (response.ok) {
      console.log('[saveDeckToCloud] Deck saved to cloud successfully');
    } else {
      console.warn('[saveDeckToCloud] Failed to save to cloud, but local save succeeded');
    }
  } catch (error) {
    console.warn('[saveDeckToCloud] Cloud save failed, but local save succeeded:', error);
  }
}

// Load decks from cloud database
async function loadDecksFromCloud() {
  try {
    console.log('[loadDecksFromCloud] Attempting to load decks from cloud...');
    const response = await fetch('/api/decks', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const cloudDecks = await response.json();
      console.log('[loadDecksFromCloud] Successfully loaded from cloud:', cloudDecks);
      
      // Convert cloud format to app format
      const convertedDecks = {};
      if (Array.isArray(cloudDecks)) {
        cloudDecks.forEach(cloudDeck => {
          if (cloudDeck.data && cloudDeck.data.id) {
            convertedDecks[cloudDeck.data.id] = cloudDeck.data;
          }
        });
      }
      
      console.log('[loadDecksFromCloud] Converted cloud decks:', convertedDecks);
      return convertedDecks;
    } else {
      console.warn('[loadDecksFromCloud] Cloud response not ok:', response.status);
      return null;
    }
  } catch (error) {
    console.warn('[loadDecksFromCloud] Failed to load from cloud:', error);
    return null;
  }
}

// Sync decks between cloud and local storage
async function syncDecksWithCloud() {
  try {
    console.log('[syncDecksWithCloud] Starting cloud sync...');
    
    // Load from cloud first
    const cloudDecks = await loadDecksFromCloud();
    
    if (cloudDecks) {
      // Load local decks
      const localDecks = loadLS(LS_KEYS.DECKS, {});
      
      // Merge: cloud takes priority, but keep local changes
      const mergedDecks = { ...localDecks };
      
      Object.entries(cloudDecks).forEach(([id, cloudDeck]) => {
        const localDeck = localDecks[id];
        
        if (!localDeck || (cloudDeck.updatedAt > localDeck.updatedAt)) {
          // Cloud deck is newer or doesn't exist locally
          mergedDecks[id] = cloudDeck;
          console.log(`[syncDecksWithCloud] Synced cloud deck: ${cloudDeck.name}`);
        } else if (localDeck.updatedAt > cloudDeck.updatedAt) {
          // Local deck is newer, push to cloud
          console.log(`[syncDecksWithCloud] Local deck is newer, will push: ${localDeck.name}`);
          saveDeckToCloud(localDeck);
        }
      });
      
      // Save merged result to localStorage
      saveAllDecks(mergedDecks);
      
      console.log('[syncDecksWithCloud] Cloud sync completed');
      return mergedDecks;
    }
    
    return null;
  } catch (error) {
    console.error('[syncDecksWithCloud] Error during cloud sync:', error);
    return null;
  }
}

function handleDeckPresentation() {
  setDeckPresentationOpen(true);
}

// Enhanced deck management functions
function handleNewDeck(name = "Untitled Deck") {
  const newDeck = createNewDeck(name);
  // Don't add to decks collection until explicitly saved
  setCurrentDeckId(newDeck.id);
  deckDispatch({ type: "SWITCH_DECK", deck: newDeck });
  saveCurrentDeckId(newDeck.id);
  addToast(`Created new deck: "${name}". Click Save to persist it.`, "success");
}

function handleSwitchDeck(deckToSwitch) {
  console.log('[handleSwitchDeck] Switching to deck:', deckToSwitch);
  console.log('[handleSwitchDeck] Current decks state:', decks);
  console.log('[handleSwitchDeck] Deck to switch exists in decks:', decks[deckToSwitch.id]);
  console.log('[handleSwitchDeck] Current deck before switch:', deck);
  console.log('[handleSwitchDeck] Current currentDeckId before switch:', currentDeckId);
  
  setCurrentDeckId(deckToSwitch.id);
  deckDispatch({ type: "SWITCH_DECK", deck: deckToSwitch });
  
  console.log('[handleSwitchDeck] After switch - new currentDeckId:', deckToSwitch.id);
  console.log('[handleSwitchDeck] Switch operation completed');
  
  addToast(`Switched to deck: "${deckToSwitch.name}"`, "success");
}

function handleDeleteDeck(deckId) {
  if (deckId === currentDeckId) {
    addToast("Cannot delete the current deck", "error");
    return;
  }
  
  const deckToDelete = decks[deckId];
  const updatedDecks = deleteDeck(decks, deckId);
  setDecks(updatedDecks);
  
  if (Object.keys(updatedDecks).length === 0) {
    // If no decks left, create a default one
    const defaultDeck = createNewDeck("My First Deck");
    const newDecks = { [defaultDeck.id]: defaultDeck };
    setDecks(newDecks);
    setCurrentDeckId(defaultDeck.id);
    deckDispatch({ type: "SWITCH_DECK", deck: defaultDeck });
    saveCurrentDeckId(defaultDeck.id);
  }
  
  addToast(`Deleted deck: "${deckToDelete.name}"`, "success");
}

function handleDuplicateDeck(deckId) {
  const originalDeck = decks[deckId];
  const updatedDecks = duplicateDeck(decks, deckId);
  setDecks(updatedDecks);
  
  // Find the new deck (it will have a different ID)
  const newDeck = Object.values(updatedDecks).find(d => 
    d.name === `${originalDeck.name} (Copy)` && d.id !== deckId
  );
  
  if (newDeck) {
    addToast(`Duplicated deck: "${originalDeck.name}"`, "success");
  }
}

function handleImportDeck(importedDeck) {
  const updatedDecks = { ...decks, [importedDeck.id]: importedDeck };
  setDecks(updatedDecks);
  setCurrentDeckId(importedDeck.id);
  deckDispatch({ type: "SWITCH_DECK", deck: importedDeck });
  saveCurrentDeckId(importedDeck.id);
  addToast(`Imported deck: "${importedDeck.name}"`, "success");
}

// Initialize deck management system with cloud sync
useEffect(() => {
  const initializeDecks = async () => {
    try {
      console.log('[App] Starting deck initialization with cloud sync...');
      
      // First try to sync with cloud
      const syncedDecks = await syncDecksWithCloud();
      
      // Fall back to local storage if cloud sync fails
      const { decks: localDecks, currentDeckId: localCurrentDeckId } = loadAllDecks();
      
      // Use synced decks if available, otherwise use local
      const finalDecks = syncedDecks || localDecks;
      const finalCurrentDeckId = localCurrentDeckId;
      
      console.log('[App] Initialization - finalDecks:', finalDecks);
      console.log('[App] Initialization - finalCurrentDeckId:', finalCurrentDeckId);
      
      // Only load decks that have been explicitly saved (have a valid updatedAt timestamp)
      const savedDecks = {};
      Object.entries(finalDecks).forEach(([id, deck]) => {
        console.log('[App] Processing deck:', { id, deckId: deck.id, deckName: deck.name, hasId: !!deck.id });
        if (deck.updatedAt && deck.updatedAt > 0) {
          // Ensure the deck has the correct ID
          const deckWithId = { ...deck, id: id };
          savedDecks[id] = deckWithId;
          console.log('[App] Added deck to savedDecks:', { id, deckId: deckWithId.id, deckName: deckWithId.name });
        }
      });
      
      console.log('[App] Final savedDecks:', savedDecks);
      setDecks(savedDecks);
      
      // Only set current deck if it was explicitly saved
      if (finalCurrentDeckId && savedDecks[finalCurrentDeckId]) {
        setCurrentDeckId(finalCurrentDeckId);
        deckDispatch({ type: "SWITCH_DECK", deck: savedDecks[finalCurrentDeckId] });
      } else {
        // Create a new empty deck if no saved deck exists - but don't add it to decks collection
        const newDeck = createNewDeck("Untitled Deck");
        setCurrentDeckId(newDeck.id);
        deckDispatch({ type: "SWITCH_DECK", deck: newDeck });
      }
      
      console.log('[App] Deck initialization completed');
    } catch (error) {
      console.error('[App] Error during deck initialization:', error);
      
      // Fallback to local-only initialization
      const { decks: localDecks, currentDeckId: localCurrentDeckId } = loadAllDecks();
      setDecks(localDecks);
      
      if (localCurrentDeckId && localDecks[localCurrentDeckId]) {
        setCurrentDeckId(localCurrentDeckId);
        deckDispatch({ type: "SWITCH_DECK", deck: localDecks[localCurrentDeckId] });
      } else {
        const newDeck = createNewDeck("Untitled Deck");
        setCurrentDeckId(newDeck.id);
        deckDispatch({ type: "SWITCH_DECK", deck: newDeck });
      }
    }
  };
  
  initializeDecks();
}, []);

// Keyboard shortcuts (basic)
useEffect(() => {
  const onKey = (e) => {
    if (e.key === "f" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      filterDispatch({ type: "TOGGLE_PANEL" });
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, []);

// hasActiveFilters helper is defined later in the component

  // Define handler functions
  function handleAdd(card, count = 1) {
    if (count > 0) {
      deckDispatch({ type: "ADD", card, count });
    } else if (count < 0) {
      const currentCount = deck.entries[deckKey(card)]?.count || 0;
      const newCount = Math.max(0, currentCount + count);
      if (newCount === 0) {
        deckDispatch({ type: "REMOVE", card });
      } else {
        deckDispatch({ type: "SET_COUNT", card, count: newCount });
      }
    }
  }

  function handleSetCount(card, count) {
    deckDispatch({ type: "SET_COUNT", card, count });
  }

  function handleRemove(card) {
    deckDispatch({ type: "REMOVE", card });
  }

  function handleExport() {
    setExportOpen(true);
  }

  function handleImport() {
    setImportOpen(true);
  }

  function handleDoImport(obj) {
    deckDispatch({ type: "IMPORT_STATE", deck: obj });
    addToast("Deck imported", "success");
  }

  function handleResetDeck() {
    if (confirm("Start a new deck? This will clear the current deck.")) {
      const timestamp = new Date().toLocaleString();
      const newDeckName = `Deck ${timestamp}`;
      handleNewDeck(newDeckName);
    }
  }

  function handlePrint() {
    setPrintOpen(true);
  }





  console.log('[App] Rendering with ImageCacheProvider wrapper');
  
  return (
    <ToastProvider>
      <ImageCacheProvider>
        <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-950 to-black text-gray-100">
          {/* Top Bar */}
          <TopBar
            key={`topbar-${filters?._resetTimestamp ?? "init"}`}
            deckName={deck?.name ?? "Untitled Deck"}
            onRename={(name) => deckDispatch({ type: "SET_NAME", name })}
            onResetDeck={handleResetDeck}
            onExport={handleExport}
            onImport={handleImport}
            onPrint={handlePrint}
            onDeckPresentation={handleDeckPresentation}
            onSaveDeck={handleSaveDeck}
            onToggleFilters={() => filterDispatch({ type: "TOGGLE_PANEL" })}
            searchText={filters?.text || ""}
            onSearchChange={(text) => filterDispatch({ type: "SET_TEXT", text })}
            onNewDeck={handleNewDeck}
            onDeckManager={() => setShowDeckManager(true)}

          />

          {/* Essential Quick Filters */}
          <div className="p-4 bg-gray-900/30 border-b border-gray-800">
  <div className="flex flex-wrap items-center gap-4">
    <div className="text-gray-300 font-medium">Quick Filters:</div>

    {/* Safety check */}
    {(!filters || typeof filters !== "object") && (
      <div className="text-red-400 text-sm">
        Filter state not initialized properly
      </div>
    )}

    {/* Inkable/Uninkable */}
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-gray-300">
        <input
          type="checkbox"
          checked={!!filters?.showInkablesOnly}
          onChange={(e) =>
            filterDispatch({ type: "SET_SHOW_INKABLES", value: e.target.checked })
          }
          className="w-4 h-4 text-emerald-600 bg-gray-700 border-gray-600 rounded focus:ring-emerald-500 focus:ring-2"
        />
        <span>Inkable Only</span>
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-300">
        <input
          type="checkbox"
          checked={!!filters?.showUninkablesOnly}
          onChange={(e) =>
            filterDispatch({ type: "SET_SHOW_UNINKABLES", value: e.target.checked })
          }
          className="w-4 h-4 text-orange-600 bg-gray-700 border-gray-600 rounded focus:ring-orange-500 focus:ring-2"
        />
        <span>Uninkable Only</span>
      </label>
    </div>

    {/* Cost buttons (1–10) */}
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-300">Cost:</span>
      <div className="flex gap-1">
        {[1,2,3,4,5,6,7,8,9,10].map((cost) => (
          <button
            key={cost}
            onClick={() => {
              if (!(filters?.selectedCosts instanceof Set)) {
                console.warn("selectedCosts is not a Set, resetting filters");
                filterDispatch({ type: "RESET" });
                return;
              }
              filterDispatch({ type: "TOGGLE_COST", cost });
            }}
            className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
              (filters?.selectedCosts instanceof Set && filters.selectedCosts.has(cost))
                ? "bg-emerald-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            {cost}
          </button>
        ))}
      </div>
    </div>

    {/* Ink colors */}
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-300">Inks:</span>
      <div className="flex gap-1">
        {["Amber","Amethyst","Emerald","Ruby","Sapphire","Steel"].map((ink) => (
          <button
            key={ink}
            onClick={() => {
              if (!(filters?.inks instanceof Set)) {
                console.warn("inks is not a Set, resetting filters");
                filterDispatch({ type: "RESET" });
                return;
              }
              filterDispatch({ type: "TOGGLE_INK", ink });
            }}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              (filters?.inks instanceof Set && filters.inks.has(ink))
                ? "bg-emerald-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {ink}
          </button>
        ))}
      </div>
    </div>

    {/* Clear Filters */}
    <button
      onClick={() => {
        console.log("[Quick Filters] Clearing all filters");
        filterDispatch({ type: "RESET" });
      }}
      className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm text-white transition-colors"
    >
      Clear All
    </button>
  </div>
</div>

{/* Floating Filter Button */}
<div className="fixed bottom-6 right-6 z-50">
  <button
    onClick={() => filterDispatch({ type: "TOGGLE_PANEL" })}
    className="w-14 h-14 bg-emerald-600 hover:bg-emerald-700 rounded-full shadow-lg border-2 border-emerald-500 text-white font-bold text-lg transition-all hover:scale-110"
    title="Toggle Advanced Filters (Ctrl+F)"
  >
    🔍
  </button>
</div>

{/* Advanced Filter Panel */}
{filters?.showFilterPanel && (
  <FilterPanel
    key={`filter-panel-${filters._resetTimestamp ?? "init"}`}
    state={filters}
    dispatch={filterDispatch}
    onDone={() => filterDispatch({ type: "TOGGLE_PANEL" })}
    onSearchChange={(text) => filterDispatch({ type: "SET_TEXT", text })}
  />
)}

{/* Active Filters */}
{Boolean(
  (filters?.text && filters.text.trim()) ||
  (filters?.inks instanceof Set && filters.inks.size) ||
  (filters?.rarities instanceof Set && filters.rarities.size) ||
  (filters?.types instanceof Set && filters.types.size) ||
  (filters?.sets instanceof Set && filters.sets.size) ||
  (filters?.classifications instanceof Set && filters.classifications.size) ||
  (filters?.abilities instanceof Set && filters.abilities.size) ||
  (filters?.selectedCosts instanceof Set && filters.selectedCosts.size) ||
  filters?.setNumber || filters?.franchise || filters?.gamemode ||
  filters?.showInkablesOnly || filters?.showUninkablesOnly ||
  filters?.loreMin || filters?.loreMax ||
  filters?.willpowerMin || filters?.willpowerMax ||
  filters?.strengthMin || filters?.strengthMax
) && (
  <div
    key={`active-filters-${filters._resetTimestamp ?? "init"}`}
    className="p-3 bg-gray-900/50 border-b border-gray-800"
  >
    <div className="text-sm text-gray-300 mb-2">Active Filters:</div>
    <div className="flex flex-wrap gap-2">
      {(filters?.inks instanceof Set && filters.inks.size > 0) && (
        <span className="px-2 py-1 rounded-full bg-amber-600/20 border border-amber-500/40 text-amber-200 text-xs">
          Ink: {Array.from(filters.inks).join(", ")}
        </span>
      )}
      {(filters?.rarities instanceof Set && filters.rarities.size > 0) && (
        <span className="px-2 py-1 rounded-full bg-purple-600/20 border border-purple-500/40 text-purple-200 text-xs">
          Rarity: {Array.from(filters.rarities).join(", ")}
        </span>
      )}
      {(filters?.types instanceof Set && filters.types.size > 0) && (
        <span className="px-2 py-1 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-200 text-xs">
          Type: {Array.from(filters.types).join(", ")}
        </span>
      )}
      {(filters?.sets instanceof Set && filters.sets.size > 0) && (
        <span className="px-2 py-1 rounded-full bg-indigo-600/20 border border-indigo-500/40 text-indigo-200 text-xs">
          Set: {Array.from(filters.sets).map((code) => {
            const setObj = Array.isArray(SETS) ? SETS.find((s) => s.code === code) : null;
            return setObj ? setObj.name : code;
          }).join(", ")}
        </span>
      )}
      {(filters?.classifications instanceof Set && filters.classifications.size > 0) && (
        <span className="px-2 py-1 rounded-full bg-teal-600/20 border border-teal-500/40 text-teal-200 text-xs">
          Classifications: {Array.from(filters.classifications).join(", ")}
        </span>
      )}
      {(filters?.abilities instanceof Set && filters.abilities.size > 0) && (
        <span className="px-2 py-1 rounded-full bg-gray-600/20 border border-gray-500/40 text-gray-200 text-xs">
          Abilities: {Array.from(filters.abilities).join(", ")}
        </span>
      )}
      {filters?.setNumber && (
        <span className="px-2 py-1 rounded-full bg-indigo-600/20 border border-indigo-500/40 text-indigo-200 text-xs">
          Set #: {filters.setNumber}
        </span>
      )}
      {filters?.franchise && (
        <span className="px-2 py-1 rounded-full bg-pink-600/20 border border-pink-500/40 text-pink-200 text-xs">
          Franchise: {filters.franchise}
        </span>
      )}
      {filters?.gamemode && (
        <span className="px-2 py-1 rounded-full bg-cyan-600/20 border border-cyan-500/40 text-cyan-200 text-xs">
          Gamemode: {filters.gamemode}
        </span>
      )}
      {filters?.inkable && filters.inkable !== "Any" && (
        <span className="px-2 py-1 rounded-full bg-yellow-600/20 border border-yellow-500/40 text-yellow-200 text-xs">
          {filters.inkable}
        </span>
      )}
      {(filters?.loreMin || filters?.loreMax) && (
        <span className="px-2 py-1 rounded-full bg-orange-600/20 border border-orange-500/40 text-orange-200 text-xs">
          Lore: {filters.loreMin || "0"}–{filters.loreMax || "∞"}
        </span>
      )}
      {(filters?.willpowerMin || filters?.willpowerMax) && (
        <span className="px-2 py-1 rounded-full bg-red-600/20 border border-red-500/40 text-red-200 text-xs">
          Willpower: {filters.willpowerMin || "0"}–{filters.willpowerMax || "∞"}
        </span>
      )}
      {(filters?.strengthMin || filters?.strengthMax) && (
        <span className="px-2 py-1 rounded-full bg-red-600/20 border border-red-500/40 text-red-200 text-xs">
          Strength: {filters.strengthMin || "0"}–{filters.strengthMax || "∞"}
        </span>
      )}
      {(filters?.selectedCosts instanceof Set && filters.selectedCosts.size > 0) && (
        <span className="px-2 py-1 rounded-full bg-green-600/20 border border-green-500/40 text-green-200 text-xs">
          Cost: {Array.from(filters.selectedCosts).sort((a,b) => a-b).map((c) => c === 10 ? "10+" : c).join(", ")}
        </span>
      )}
      {!!filters?.showInkablesOnly && (
        <span className="px-2 py-1 rounded-full bg-yellow-600/20 border border-yellow-500/40 text-yellow-200 text-xs">
          Inkable Only
        </span>
      )}
      {!!filters?.showUninkablesOnly && (
        <span className="px-2 py-1 rounded-full bg-orange-600/20 border border-orange-500/40 text-orange-200 text-xs">
          Uninkable Only
        </span>
      )}
    </div>
  </div>
)}

{/* Main content grid */}
<div key={`main-content-${filters?._resetTimestamp ?? "init"}`} className="grid grid-cols-1 lg:grid-cols-[1fr_380px]">
  <div>
    {loading ? (
      <div className="p-6 text-center text-gray-400">
        <div className="flex items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading cards from API...</span>
        </div>
        <div className="text-sm text-gray-500 mt-2">This may take a few moments for the first load</div>
      </div>
    ) : shownCards?.length ? (
      <CardGrid
        cards={shownCards}
        onAdd={handleAdd}
        onInspect={(c) => setInspectCard(c)}
        deck={deck}
      />
    ) : (
      <div className="p-6 text-center text-gray-400">
        {allCards?.length ? (
          <>
            <div className="text-lg mb-2">No cards match your filters</div>
            <div className="text-sm text-gray-500">Try adjusting your search criteria or filters</div>
          </>
        ) : (
          <>
            <div className="text-lg mb-2">No cards loaded</div>
            <div className="text-sm text-gray-500 mb-4">This could be due to API issues or network problems</div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white"
            >
              Retry Loading
            </button>
          </>
        )}
      </div>
    )}
  </div>

  {/* Deck column */}
  <div className="border-l border-gray-800 min-h-[60vh]">
    <DeckPanel
      deck={deck}
      onSetCount={handleSetCount}
      onRemove={handleRemove}
      onExport={() => setExportOpen(true)}
      onImport={() => setImportOpen(true)}
      onDeckPresentation={handleDeckPresentation}
    />
    <DeckStats deck={deck} />
    <div className={`p-3 ${deckValid ? "text-emerald-300" : "text-red-300"}`}>
      {deckValid
        ? "Deck is valid."
        : `Deck must be between ${DECK_RULES.MIN_SIZE} and ${DECK_RULES.MAX_SIZE} cards.`}
    </div>
            </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex">
          {/* Left Panel - Card Grid */}
          <div className="flex-1 p-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="text-2xl text-gray-400">Loading cards...</div>
              </div>
            ) : (
              <>
                <CardGrid
                  cards={shownCards}
                  onAdd={handleAdd}
                  onInspect={setInspectCard}
                  deck={deck}
                />

                {hasActiveFilters && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => filterDispatch({ type: "RESET" })}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                    >
                      Clear All Filters
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Panel - Deck */}
          <div className="w-96 bg-gray-900/50 border-l border-gray-800 p-4">
            <DeckPanel
              deck={deck}
              onSetCount={handleSetCount}
              onRemove={handleRemove}
              onExport={handleExport}
              onImport={handleImport}
              onDeckPresentation={handleDeckPresentation}
            />
            <div className={`p-3 ${deckValid ? "text-emerald-300" : "text-red-300"}`}>
              {deckValid
                ? "Deck is valid."
                : `Deck must be between ${DECK_RULES.MIN_SIZE} and ${DECK_RULES.MAX_SIZE} cards.`}
            </div>
          </div>
        </div>

        {/* Modals */}
        <>
          <InspectCardModal
    key={`inspect-modal-${filters?._resetTimestamp ?? "init"}`}
    open={!!inspectCard}
    card={inspectCard}
    onClose={() => setInspectCard(null)}
    onAdd={handleAdd}
  />

  <ExportModal
    key={`export-modal-${filters?._resetTimestamp ?? "init"}`}
    open={exportOpen}
    deck={deck}
    onClose={() => setExportOpen(false)}
  />

  <ImportModal
    key={`import-modal-${filters?._resetTimestamp ?? "init"}`}
    open={importOpen}
    onClose={() => setImportOpen(false)}
    onImport={handleDoImport}
  />

  {printOpen && (
    <PrintableSheet
    key={`print-sheet-${filters?._resetTimestamp ?? "init"}`}
    deck={deck}
    onClose={() => setPrintOpen(false)}
  />
)}

{deckPresentationOpen && (
            <DeckPresentationPopup
            key={`deck-presentation-${filters?._resetTimestamp ?? "init"}`}
            deck={deck}
            onClose={() => setDeckPresentationOpen(false)}
            onSave={handleSaveDeck}
          />
)}

{/* Save Confirmation Modal */}
{saveConfirmationOpen && (
  <Modal
    open={saveConfirmationOpen}
    onClose={() => setSaveConfirmationOpen(false)}
    title="Deck Saved Successfully!"
    size="md"
  >
    <div className="text-center space-y-4">
      <div className="text-6xl mb-4">✅</div>
      <h3 className="text-xl font-semibold text-green-400">
        Your deck "{deck?.name}" has been saved!
      </h3>
      <p className="text-gray-300">
        The deck is now safely stored and will appear in your deck list. 
        You can access it anytime from the Deck Manager.
      </p>
      <div className="pt-4">
        <button
          onClick={() => setSaveConfirmationOpen(false)}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  </Modal>
)}

{/* Enhanced Deck Manager */}
<DeckManager
  isOpen={showDeckManager}
  onClose={() => setShowDeckManager(false)}
  decks={decks}
  currentDeckId={currentDeckId}
  onSwitchDeck={handleSwitchDeck}
  onNewDeck={handleNewDeck}
  onDeleteDeck={handleDeleteDeck}
  onDuplicateDeck={handleDuplicateDeck}
  onExportDeck={(deckId) => {
    const deckToExport = decks[deckId];
    if (deckToExport) exportDeck(deckToExport, "json");
  }}
  onImportDeck={handleImportDeck}
/>
        </>
      </div>
    </ImageCacheProvider>
  </ToastProvider>
);

// -----------------------------------------------------------------------------
// Filtering + Sorting
// -----------------------------------------------------------------------------

function applyFilters(cards, filters) {
  // Safety check: ensure filters object exists and has required properties
  if (!filters || typeof filters !== 'object') {
    console.warn('[applyFilters] Filters object is missing or invalid, returning all cards');
    return cards.slice();
  }
  
  let list = cards.slice();

  // Only apply text filter if there's actual search text
  if (filters.text && filters.text.trim()) {
    const q = filters.text.toLowerCase().trim();
    console.log('[Search Debug] Searching for:', q);
    console.log('[Search Debug] Sample card data for search:', list.slice(0, 3).map(c => ({
      name: c.name,
      text: c.text,
      type: c.type,
      rarity: c.rarity,
      set: c.set,
      _rawType: c._raw?.type,
      _rawRarity: c._raw?.rarity
    })));
    
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
      
      const matches = searchableFields.some(field => 
        String(field).toLowerCase().includes(q)
      );
      
      if (matches) {
        console.log(`[Search Debug] Card "${c.name}" matches search "${q}"`);
      }
      
      return matches;
    });
    
    console.log('[Search Debug] After text filtering, cards remaining:', list.length);
  }

  if (filters.inks && filters.inks.size) {
    // Ensure inks is a Set
    if (!(filters.inks instanceof Set)) {
      console.warn('filters.inks is not a Set, converting...', filters.inks);
      filters.inks = new Set(filters.inks || []);
    }
    
    console.log('[Filter Debug] Ink filter active:', Array.from(filters.inks));
    console.log('[Filter Debug] Using improved dual-ink filtering logic');
    
    // Use the new improved ink filtering logic
    list = list.filter(card => matchesInkFilter(card, filters.inks));
    
    console.log('[Filter Debug] After ink filtering, cards remaining:', list.length);
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
    
    console.log('[Filter Debug] Type filter active:', Array.from(filters.types));
    console.log('[Filter Debug] Sample card types:', list.slice(0, 3).map(c => ({ name: c.name, type: c.type, _rawType: c._raw?.type, types: c.types })));
    
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
      
      console.log(`[Filter Debug] Card "${c.name}" has types:`, cardTypes);
      
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
          console.log(`[Filter Debug] Card "${c.name}" matches Song filter (types: ${cardTypes}, text: ${c.text?.substring(0, 50)})`);
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
          console.log(`[Filter Debug] Card "${c.name}" matches type filter "${selectedType}" (types: ${cardTypes})`);
        }
        
        return matches;
      });
    });
    
    console.log('[Filter Debug] After type filtering, cards remaining:', list.length);
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

    console.log('[Set Filter Debug] Active set filters:', Array.from(filters.sets));
    console.log('[Set Filter Debug] Wanted codes (Lorcast):', Array.from(wantedCodes));
    console.log('[Set Filter Debug] Wanted names:', Array.from(wantedNames));
    console.log('[Set Filter Debug] Wanted nums:', Array.from(wantedNums));

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

    console.log(`[Set Filter Debug] After set filtering, cards remaining: ${list.length}`);
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
      
      console.log(`[Classifications Filter] Card "${card.name}" has classifications:`, cardClassifications);
      
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
    console.log('[Abilities Filter] Processing filter with normalized abilities:', wanted);
    
    list = list.filter(card => {
      // prefer the precomputed index
      if (card._abilitiesIndex && card._abilitiesIndex.size) {
        const matches = wanted.some(w => card._abilitiesIndex.has(w));
        if (matches) {
          console.log(`[Abilities Filter] Card "${card.name}" matches by index:`, Array.from(card._abilitiesIndex));
        }
        return matches;
      }
      // fallback to text if index missing (shouldn't happen after mapping)
      const t = String(card.text || "").toLowerCase();
      const matches = wanted.some(w => t.includes(w));
      if (matches) {
        console.log(`[Abilities Filter] Card "${card.name}" matches by text fallback:`, wanted);
      }
      return matches;
    });
  }

  // Handle inkable/uninkable filters
  if (filters.showInkablesOnly || filters.showUninkablesOnly) {
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
      
      if (filters.showInkablesOnly && filters.showUninkablesOnly) {
        // Both checked - show all cards
        return true;
      } else if (filters.showInkablesOnly) {
        // Only inkables checked
        return isInkable;
      } else if (filters.showUninkablesOnly) {
        // Only uninkables checked
        return !isInkable;
      }
      
      return true;
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
      
      console.log(`[Franchise Filter] Card "${c.name}" franchise: "${cardFranchise}" vs filter: "${filters.franchise}"`);
      
      return String(cardFranchise).toLowerCase() === filters.franchise.trim().toLowerCase();
    });
  }

  if (filters.gamemode && filters.gamemode.trim()) {
    list = list.filter((c) => {
      // Check multiple sources for gamemode based on Lorcast structure
      let cardGamemode = "";
      
      // First try the normalized gamemode field
      if (c.gamemode) {
        cardGamemode = c.gamemode;
      }
      // Then try the raw data from Lorcast API
      else if (c._raw?.gamemode) {
        cardGamemode = c._raw.gamemode;
      }
      else if (c._raw?.Gamemode) {
        cardGamemode = c._raw.Gamemode;
      }
      
      console.log(`[Gamemode Filter] Card "${c.name}" gamemode: "${cardGamemode}" vs filter: "${filters.gamemode}"`);
      
      return String(cardGamemode).toLowerCase() === filters.gamemode.trim().toLowerCase();
    });
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
      
      console.log(`[Lore Filter] Card "${c.name}" lore: ${lore} vs filter: ${filters.loreMin}-${filters.loreMax}`);
      
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
      
      console.log(`[Willpower Filter] Card "${c.name}" willpower: ${willpower} vs filter: ${filters.willpowerMin}-${filters.willpowerMax}`);
      
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
      
      console.log(`[Strength Filter] Card "${c.name}" strength: ${strength} vs filter: ${filters.strengthMin}-${filters.strengthMax}`);
      
      const strengthMin = Number(filters.strengthMin) || 0;
      const strengthMax = Number(filters.strengthMax) || 999;
      
      if (filters.strengthMin && strength < strengthMin) return false;
      if (filters.strengthMax && strength > strengthMax) return false;
      return true;
    });
  }



  list.sort((a, b) => {
    const dir = filters.sortDir === "desc" ? -1 : 1;
    console.log('[Sort Debug] Sorting with:', filters.sortBy, 'direction:', filters.sortDir);
    
    switch (filters.sortBy) {
              case "set-ink-number": {
          console.log('[Sort Debug] set-ink-number sort for cards:', a.name, 'vs', b.name);
          
          // Use the consistent comparison function (set → ink → card number)
          const result = cardComparator(a, b);
          console.log('[Sort Debug] Consistent comparison result:', result);
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
        console.log('[Sort Debug] ink-set-number sort for cards:', a.name, 'vs', b.name);
        
        // Use the consistent comparison function (ink → set → card number)
        const result = cardComparator(a, b);
        console.log('[Sort Debug] Consistent comparison result:', result);
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

function rarityWeight(r) {
  const idx = RARITIES.findIndex((x) => x.toLowerCase() === (r || "").toLowerCase());
  return idx === -1 ? 999 : idx;
}

// -----------------------------------------------------------------------------
// Parallel image loading system
// -----------------------------------------------------------------------------

// Global image loading queue to prevent overwhelming the browser
const IMAGE_LOAD_QUEUE = {
  maxConcurrent: 6, // Load 6 images at once
  current: 0,
  queue: [],
  
  add(fn) {
    if (this.current < this.maxConcurrent) {
      this.current++;
      fn().finally(() => {
        this.current--;
        this.processNext();
      });
    } else {
      this.queue.push(fn);
    }
  },
  
  processNext() {
    if (this.queue.length > 0 && this.current < this.maxConcurrent) {
      const next = this.queue.shift();
      this.add(next);
    }
  }
};

// Batch image loader for multiple cards
function useBatchImageLoader() {
  console.log('[useBatchImageLoader] Starting...');
  console.log('[useBatchImageLoader] About to call useImageCache...');
  
  let imageCacheContext;
  try {
    imageCacheContext = useImageCache();
    console.log('[useBatchImageLoader] useImageCache succeeded, context:', imageCacheContext);
  } catch (error) {
    console.error('[useBatchImageLoader] useImageCache failed:', error);
    throw error; // Re-throw to see the actual error
  }
  
  const { get, put, putFailed } = imageCacheContext;
  
  const loadImagesInBatch = useCallback(async (cards, onProgress) => {
    // Intelligent loading with multiple strategies
    const CONCURRENCY = 10; // Reduced concurrency to avoid overwhelming
    const MAX_RETRIES = 2; // Allow retries for failed images

    const cardsToLoad = cards.filter(card => {
      const imageURL = generateLorcastURL(card);
      return imageURL && 
             get(deckKey(card)) !== 'FAILED' &&
             !get(deckKey(card));
    });

    if (cardsToLoad.length === 0) {
      onProgress?.(0, 0);
      return Promise.resolve();
    }

    console.log(`[Batch Loader] Starting batch load for ${cardsToLoad.length} cards`);

    let loaded = 0;
    let failed = 0;
    let localGenerated = 0;

    const processCard = async (card) => {
      try {
        // Strategy 1: Try original URL first
        const imageURL = card._imageFromAPI || card._rawImage;
        if (imageURL) {
          try {
            const res = await tryLoadImage(imageURL);
            card._successfulImageUrl = res;
            card._imageLoaded = true;
            card._imageError = false;
            put(deckKey(card), res);
            loaded++;
            console.log(`[Batch Loader] ✓ Original URL worked: ${card.name} -> ${res}`);
            return true;
          } catch (error) {
            console.log(`[Batch Loader] Original URL failed for: ${card.name}`);
          }
        }
        
        // Strategy 2: Try Lorcast API URL
        const lorcastURL = generateLorcastURL(card);
        if (lorcastURL && lorcastURL !== imageURL) {
          try {
            const res = await tryLoadImage(lorcastURL);
            card._successfulImageUrl = res;
            card._imageLoaded = true;
            card._imageError = false;
            put(deckKey(card), res);
            loaded++;
            console.log(`[Batch Loader] ✓ Lorcast URL worked: ${card.name} -> ${res}`);
            return true;
          } catch (error) {
            console.log(`[Batch Loader] Lorcast URL failed for: ${card.name}`);
          }
        }
        
        // Strategy 3: Generate local image as final fallback
        const localImage = generateLocalCardImage(card);
        if (localImage) {
          card._successfulImageUrl = localImage;
          card._imageLoaded = true;
          card._imageError = false;
          put(deckKey(card), localImage);
          localGenerated++;
          console.log(`[Batch Loader] ✓ Local image generated: ${card.name}`);
          return true;
        }
        
        // All strategies failed
        putFailed(deckKey(card));
        failed++;
        console.log(`[Batch Loader] ✗ All strategies failed: ${card.name}`);
        return false;
        
      } finally {
        onProgress?.(loaded, failed, localGenerated);
      }
    };

    // Process cards with controlled concurrency
    const queue = [...cardsToLoad];
    const workers = new Array(Math.min(CONCURRENCY, queue.length)).fill(null).map(async () => {
      while (queue.length > 0) {
        const card = queue.shift();
        if (card) {
          await processCard(card);
          // Small delay to prevent overwhelming
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    });

    await Promise.all(workers);
    
    console.log(`[Batch Loader] Completed: ${loaded} loaded, ${failed} failed, ${localGenerated} local`);
    return { loaded, failed, localGenerated };
    
  }, [get, put, putFailed]);
  
  return { loadImagesInBatch };
}

// -----------------------------------------------------------------------------
// End of file
// -----------------------------------------------------------------------------





} // Close AppInner function

// --- Wrapper to ensure ImageCache is available everywhere ---
export default function App(props) {
  return (
    <ImageCacheProvider>
      <AppInner {...props} />
    </ImageCacheProvider>
  );
}
