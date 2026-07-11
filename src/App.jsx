// Local utilities -------------------------------------------------------------
import { CARD_TYPES, getCardImg } from "./lib/cardUtils.js";
import { LS_KEYS, loadLS, saveLS } from "./lib/storage.js";
import { exportDeck, generateTextExport, generateSimpleTextExport, generateCSVExport } from "./utils/deckExport.js";
import { fetchAllCards, normalizeAbilityToken, ABILITIES_CANON } from "./lib/cardsApi.js";
import { IMG_CACHE_CAP, tryLoadImage, tryLoadImageWithCORSFallback, tryLoadImageWithBetterCORS, getWorkingImageUrl, getCardImageUrl, generateLocalCardImage, createSimpleCardImage, getCORSProxyUrl, getAlternativeCORSProxyUrl, createCanvasImage, generateLorcastURL, generateAlternativeImageUrls, resetFailedImageCache } from "./lib/images.js";
import { generateDeckImagePNG } from "./lib/deckImage.js";

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
  lazy,
  Suspense,
} from "react";
import { useSearchParams } from "react-router-dom";

// Auth context
import { useAuth } from './contexts/AuthContext';

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
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";

// --- Competitive analysis functions defined later in file ---
// See line ~385 for role detection and synergy analysis functions

// Icons (lucide-react) - optional; replace with your icon lib || inline SVGs
// import { Search, Filter, Settings, X, Download, Upload } from "lucide-react";

// Authentication components
import AuthButton from './components/AuthButton';
import DeckStatistics from './components/DeckStats';
import DeckPresentationView from './components/DeckPresentationView';

// Extracted shared modules (H9: single source of truth, no App.jsx re-exports)
import { Section, Pill, WinRateBar, Modal } from "./components/ui";
import {
  FALLBACK_IMG,
  ROLE_ORDER,
  rolesForCard,
  detectSynergies,
  getCost,
  getInks,
  deckKey,
  normalizedType,
} from "./lib/cardUtils.js";
import {
  EnhancedCurveChart,
  DrawProbabilityTool,
  DrawSimulator,
  HoverableStatLine,
  HoverableStatBox,
} from "./components/deckCharts.jsx";
import { useDeckResults, TournamentResultsSection } from "./components/TournamentResults.jsx";
import { useToasts } from "./contexts/ToastContext.jsx";

const ImageCacheContext = createContext();


function ImageCacheProvider({ children }) {
  const [cache, setCache] = useState(() => loadLS(LS_KEYS.CACHE_IMG, {}));
  const [cacheVersion, setCacheVersion] = useState(0);

  // Debounced persist: rapid image loads no longer serialize the entire cache
  // synchronously on every put. We write at most once ~800ms after the last change.
  useEffect(() => {
    const t = setTimeout(() => saveLS(LS_KEYS.CACHE_IMG, cache), 800);
    return () => clearTimeout(t);
  }, [cache]);

  const setEntry = useCallback((key, value) => {
    setCache((c) => {
      const next = { ...c, [key]: value };
      const overflow = Object.keys(next).length - IMG_CACHE_CAP;
      if (overflow > 0) {
        // Drop the oldest entries (objects preserve string-key insertion order).
        const keys = Object.keys(next);
        for (let i = 0; i < overflow; i++) delete next[keys[i]];
      }
      return next;
    });
    setCacheVersion(v => v + 1); // Increment version to trigger re-renders
  }, []);

  const get = useCallback((key) => cache[key], [cache]);
  const put = useCallback((key, value) => setEntry(key, value), [setEntry]);
  const putFailed = useCallback((key) => setEntry(key, 'FAILED'), [setEntry]);

  const value = useMemo(() => ({ get, put, putFailed, cache, cacheVersion }), [get, put, putFailed, cache, cacheVersion]);

  return (
    <ImageCacheContext.Provider value={value}>
      {children}
    </ImageCacheContext.Provider>
  );
}

// Debug component to trace context
function ContextDebugger() {
  useContext(ImageCacheContext);
  return null; // This component doesn't render anything
}

function useImageCache() {
  const context = useContext(ImageCacheContext);
  if (!context) {
    throw new Error('useImageCache must be used within ImageCacheProvider');
  }
  return context;
}

// Ink colors supported by the filters. Feel free to expand.
const INK_COLORS = ["Amber", "Amethyst", "Emerald", "Ruby", "Sapphire", "Steel"];

// Rarity options sample
const RARITIES = ["Common", "Uncommon", "Rare", "Super Rare", "Legendary"];

// CARD_TYPES is imported from ./lib/cardUtils.js

// Card classifications (Lorcana character classifications)
const CLASSIFICATIONS = [
  "Alien", "Ally", "Broom", "Captain", "Colossus", "Deity", "Detective", "Dinosaur",
  "Dragon", "Dreamborn", "Entangled", "Fairy", "Floodborn", "Gargoyle", "Ghost",
  "Giant", "Hero", "Hunny", "Hyena", "Illusion", "Inventor", "King", "Knight",
  "Madrigal", "Mentor", "Monster", "Musketeer", "Obstacle", "Pirate", "Prince",
  "Princess", "Puppy", "Queen", "Racer", "Robot", "Seven Dwarfs", "Sorcerer",
  "Storyborn", "Super", "Tigger", "Titan", "Toy", "Villain", "Whisper"
];


// Legacy ABILITIES constant for backward compatibility
const ABILITIES = ABILITIES_CANON;




function normalizedSetCode(raw) {
  return String(
    raw?.set || raw?.set_code || raw?.setCode || raw?.set?.code || ""
  ).toUpperCase();
}


// New filter constants
// const FRANCHISES = ["Bolt", "Disney", "Pixar", "Marvel", "Star Wars", "Indiana Jones"]; // Commented out - no longer used
const GAMEMODES = ["Infinity", "Core Constructed"];
const INKABLE_OPTIONS = ["Any", "Inkable", "Non-Inkable"];

// Legacy code mapping for UI compatibility (TFC ↔ "1", ROC ↔ "2", etc.)
const LEGACY_TO_LORCAST = {
  TFC: "1", ROC: "2", IAT: "3", URS: "4", SSK: "5", AZS: "6", ARI: "7", ROJ: "8", FAB: "9", WITW: "10", WSP: "11", WLD: "12", AOV: "13", D100: "D100"
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
  { code: "FAB", name: "Fabled", shortName: "FAB", setNum: 9 },
  { code: "WITW", name: "Whispers in the Well", shortName: "WITW", setNum: 10 },
  { code: "WSP", name: "Winterspell", shortName: "WSP", setNum: 11 },
  { code: "WLD", name: "Wilds Unknown", shortName: "WLD", setNum: 12 },
  { code: "AOV", name: "Attack of the Vine!", shortName: "AOV", setNum: 13 },
];

// Set order for consistent sorting (ink → set → set number → card number)
const SET_ORDER = ["TFC", "ROC", "IAT", "URS", "SSK", "AZS", "ARI", "ROJ", "FAB", "WITW", "WSP", "WLD", "AOV"];

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
const SET_CODE_ORDER = ["1","2","3","4","5","6","7","8","9","10","11","12","13","D100"]; // extend as new sets arrive

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
  // 1) Ink color (Amber, Amethyst, Emerald, Ruby, Sapphire, Steel)
  const ia = INK_ORDER.indexOf(primaryInk(a));
  const ib = INK_ORDER.indexOf(primaryInk(b));
  if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);

  // 2) Set — newest first within a color (numeric set code descending; unknown sets last)
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

  // 3) Collector number (numeric then suffix)
  const ca = collectorParts(a);
  const cb = collectorParts(b);
  if (ca.num !== cb.num) return ca.num - cb.num;
  if (ca.suf !== cb.suf) return String(ca.suf) < String(cb.suf) ? -1 : 1;

  // 4) Name tiebreaker
  const nameA = String(a.name || "");
  const nameB = String(b.name || "");
  return nameA.localeCompare(nameB);
}

// Helper to extract normalized set code and name from any card
function getSetCodeAndName(card) {
  const code =
    String(card.setCode || card.set || card._raw?.set?.code || card._raw?.set_code || "")
      .toUpperCase().trim();
  const name =
    String(card.setName || card._raw?.set?.name || card._raw?.set_name || "")
      .toLowerCase().trim();
  return { code, name };
}

// -----------------------------------------------------------------------------
// Utility helpers
// -----------------------------------------------------------------------------

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// -----------------------------------------------------------------------------
// Comp Dashboard Heuristics & Utilities
// -----------------------------------------------------------------------------


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


// Get primary ink color for sorting (first ink in the array)
function getPrimaryInk(card) {
  if (Array.isArray(card?.inks) && card.inks.length > 0) {
    return card.inks[0];
  }
  if (card?.ink) {
    return Array.isArray(card.ink) ? card.ink[0] : card.ink;
  }
  // Try to get from _raw data
  if (card?._raw?.ink) {
    return Array.isArray(card._raw.ink) ? card._raw.ink[0] : card._raw.ink;
  }
  return "";
}


// Normalize inks from either Lorcast (card.inks array) or lorcana-api (Color string)
function getCardInks(card) {
  if (Array.isArray(card.inks) && card.inks.length) {
    return new Set(card.inks.map(s => String(s).trim()));
  }
  if (typeof card.Color === "string" && card.Color.length) {
    return new Set(card.Color.split(",").map(s => String(s).trim()));
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


// Utility to reduce noisy logs in dev (StrictMode double-runs)
const logged = new Set();
const logOnce = (key, ...args) => {
  if (logged.has(key)) return;
  logged.add(key);
  console.log(...args);
};

// Debug sort gating to reduce noise
const DEBUG_SORT = import.meta.env.DEV && localStorage.getItem("DEBUG_SORT") === "1";
function sortLog(...args) { 
  if (DEBUG_SORT) console.log(...args); 
}

// TODO: Fix favicon 404 - either add /public/vite.svg or change reference in index.html
// Current error: /vite.svg:1 Failed to load resource: the server responded with a status of 404 ()

/**
 * Auth-safe fetch wrapper that handles missing tokens gracefully
 */
async function authSafeFetch(input, init = {}) {
  // With cookie-based auth, we don't need to manually add tokens
  // The cookies are automatically included with the request
  console.log('[authSafeFetch] Making authenticated request to:', input);
  console.log('[authSafeFetch] Request method:', init.method || 'GET');
  console.log('[authSafeFetch] Request headers:', init.headers);
  
  try {
    const response = await fetch(input, {
      ...init,
      // Ensure credentials (cookies) are included
      credentials: 'include'
    });
    
    console.log('[authSafeFetch] Response status:', response.status);
    console.log('[authSafeFetch] Response URL:', response.url);
    
    // Check if response indicates authentication failure
    if (response.status === 401) {
      console.log('[authSafeFetch] Authentication failed - user not logged in or session expired');
      console.log('[authSafeFetch] Failed request details - URL:', input, 'Method:', init.method || 'GET');
      
      // For deck operations that require authentication, don't mask the error
      // Let the calling code handle the 401 properly
      if (input.includes('/api/decks')) {
        console.log('[authSafeFetch] Deck operation failed due to authentication - returning actual error');
        throw new Error('Authentication required. Please log in to access your decks.');
      }
      
      // For other operations, return graceful fallback
      if (init.method && init.method !== "GET") {
        return new Response(JSON.stringify({ ok: true, skippedAuth: true }), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }
    
    return response;
  } catch (error) {
    console.error('[authSafeFetch] Request failed:', error);
    
    // If it's an authentication error for deck operations, re-throw it
    if (error.message.includes('Authentication required')) {
      throw error;
    }
    
    // Return appropriate fallback response for other errors
    if (init.method && init.method !== "GET") {
      return new Response(JSON.stringify({ ok: true, skippedAuth: true }), { status: 200 });
    }
    return new Response(JSON.stringify([]), { status: 200 });
  }
}

/**
 * Normalize display names and comparisons
 */
const splitDisplayName = (name) => {
  const n = String(name || "");
  // split on hyphen / en dash / em dash, with or without spaces
  const parts = n.split(/\s*[-–—]\s*/);
  return {
    baseName: (parts[0] || "").trim(),
    subname:  (parts[1] || null)?.trim() || null,
  };
};

const canon = (s) =>
  String(s || "")
    .toLowerCase()
    // normalize all dash styles to " - "
    .replace(/\s*[-–—]\s*/g, " - ")
    // collapse whitespace
    .replace(/\s+/g, " ")
    .trim();

// Helper function to detect cards with subtitles (used in multiple places)
const hasSubtitleLike = (card) => {
  return !!(card.subname && card.subname.trim()) || 
         /\s[-–]\s/.test((card.name || "").toLowerCase());
};



// Transform API card data to app format
function toAppCard(raw) {
  // GUARD: Ensure raw is valid
  if (!raw || typeof raw !== 'object') {
    console.warn('[toAppCard] Invalid raw data:', raw);
    return null;
  }

  // DEBUG: Log the actual structure of the card data
  console.log('[toAppCard] Raw card data structure:', {
    keys: Object.keys(raw),
    name: raw.name,
    baseName: raw.baseName,
    subname: raw.subname,
    setId: raw.setId,
    setNum: raw.setNum,
    cost: raw.cost,
    type: raw.type,
    inkable: raw.inkable
  });

  // Use the actual API structure from your database
  const id = raw.id || raw.Unique_ID || crypto.randomUUID();
  const name = raw.Name || raw.name || 'Unknown Card';
  const baseName = name.split(" - ")[0];
  const subtitle = name.includes(" - ") ? name.split(" - ")[1] : null;

  const splitList = (s) =>
    s ? s.split(",").map(x => x.trim()).filter(Boolean) : [];

  const abilities = raw.abilities || splitList(raw.Abilities || '');

  return {
    id: id,
    setId: raw.setId || raw.set || raw.Set_ID || null,
    setNum: raw.setNum || raw.Set_Num || null,
    cardNum: raw.cardNum || raw.number || raw.Card_Num || null,
    name: name,
    baseName: baseName,
    subtitle: subtitle,
    imageUrl: raw.imageUrl || raw.image || raw.Image || null,
    inkable: Boolean(raw.inkable ?? raw._raw?.inkwell ?? raw._raw?.inkable ?? raw._raw?.can_be_ink ?? raw._raw?.Inkable ?? false),
    colors: splitList(raw.colors || raw.color || raw.Color || ''),
    classifications: splitList(raw.classifications || raw.Classifications || ''),
    type: raw.type || raw.Type || null,
    cost: raw.cost || raw.Cost || 0,
    lore: raw.lore || raw.Lore || 0,
    willpower: raw.willpower || raw.Willpower || 0,
    strength: raw.strength || raw.Strength || 0,
    rarity: raw.rarity || raw.Rarity || null,
    abilities: abilities,
    rulesText: raw.rulesText || raw.bodyText || raw.Body_Text || '',
    flavorText: raw.flavorText || raw.Flavor_Text || '',
    artist: raw.artist || raw.Artist || null,
    franchise: raw.franchise || raw.Franchise || null,
  };
}

// Helper function to ensure we always get string URLs - single source of truth
function asUrl(v) {
  if (!v) return null;
  if (typeof v === 'string') return v;
  // tolerate different shapes - extract URL from common object patterns
  return v.url ?? v.href ?? v.src ?? v.toString?.() ?? null;
}

/**
 * Proxy helper MUST return a string URL (logs show an object was returned in build)
 */
function lorcanaImageProxyUrl(src){
  if (!src) return null;
  const srcStr = String(src);
  return `https://images.weserv.nl/?url=${encodeURIComponent(srcStr)}&output=jpg`;
}

// Alias for backward compatibility
const proxyImageUrl = lorcanaImageProxyUrl;

// DEBUG: Log all function references to identify minification conflicts
console.log('[DEBUG] Function references:', {
  lorcanaImageProxyUrl: typeof lorcanaImageProxyUrl,
  proxyImageUrl: typeof proxyImageUrl,
  lorcanaImageProxyUrlName: lorcanaImageProxyUrl.name,
  proxyImageUrlName: proxyImageUrl.name
});


// Enhanced function to search Lorcast API for card resolution
async function searchLorcastForCard(cardName, subtitle = null) {
  try {
    // Build search query - prefer exact match with quotes
    let query = cardName;
    if (subtitle) {
      query = `"${cardName} - ${subtitle}"`;
    } else {
      query = `"${cardName}"`;
    }
    
    console.log(`[LorcastSearch] Searching for: ${query}`);
    
    // Make API call to Lorcast search
    const response = await fetch(`https://api.lorcast.com/v0/cards/search?q=${encodeURIComponent(query)}&unique=cards&per_page=5`);
    
    if (!response.ok) {
      console.warn(`[LorcastSearch] API response not ok:`, response.status, response.statusText);
      return null;
    }
    
    const data = await response.json();
    const results = data.results || [];
    
    if (results.length === 0) {
      console.log(`[LorcastSearch] No results found for: ${query}`);
      return null;
    }
    
    // Find exact match if possible
    const exactMatch = results.find(card => {
      const cardNameLower = card.name?.toLowerCase() || '';
      const searchNameLower = cardName.toLowerCase();
      return cardNameLower === searchNameLower || 
             cardNameLower.includes(searchNameLower) ||
             searchNameLower.includes(cardNameLower);
    });
    
    if (exactMatch) {
      console.log(`[LorcastSearch] Found exact match:`, exactMatch.name);
      return exactMatch;
    }
    
    // Return first result as best guess
    console.log(`[LorcastSearch] Using best match:`, results[0].name);
    return results[0];
    
  } catch (error) {
    console.warn(`[LorcastSearch] Error searching Lorcast for ${cardName}:`, error);
    return null;
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

// Lorcast card-API layer (fetch + normalization) extracted to ./lib/cardsApi.js (Phase 5.2)

// DUPLICATE SECTION REMOVED - Local storage functions are now at the top of the file

// Toast system extracted to ./contexts/ToastContext.jsx (H9).

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

// Find card by Lorcanito export format: "Card Name — Subtitle (Set #Number)"
function findCardByLorcanitoFormat(cardName, subtitle, setId, setNumber) {
  const getCards = window.getAllCards || window.getCurrentCards;
  if (getCards) {
    const cards = getCards();

    if (!cards || cards.length === 0) {
      console.warn('[findCardByLorcanitoFormat] No cards available in database');
      return null;
    }
    
    console.log(`[findCardByLorcanitoFormat] Searching for: "${cardName} — ${subtitle}" (Set ${setId} #${setNumber})`);
    
    // Try exact match first
    const exactMatch = cards.find(c => 
      c.name === `${cardName} — ${subtitle}` ||
      (c.name === cardName && c.subname === subtitle)
    );
    
    if (exactMatch) {
      console.log(`[findCardByLorcanitoFormat] Exact match found: "${exactMatch.name}"`);
      return exactMatch;
    }
    
    // Try matching by set and number
    const setMatch = cards.find(c => 
      String(c.setId) === String(setId) && 
      String(c.setNumber) === String(setNumber)
    );
    
    if (setMatch) {
      console.log(`[findCardByLorcanitoFormat] Set match found: "${setMatch.name}" (Set ${setMatch.setId} #${setMatch.setNumber})`);
      return setMatch;
    }
    
    // Try fuzzy name matching
    const fuzzyMatch = cards.find(c => 
      c.name.toLowerCase().includes(cardName.toLowerCase()) &&
      c.name.toLowerCase().includes(subtitle.toLowerCase())
    );
    
    if (fuzzyMatch) {
      console.log(`[findCardByLorcanitoFormat] Fuzzy match found: "${fuzzyMatch.name}"`);
      return fuzzyMatch;
    }
    
    console.log(`[findCardByLorcanitoFormat] No match found for "${cardName} — ${subtitle}"`);
    return null;
  } else {
    console.warn('[findCardByLorcanitoFormat] getCurrentCards function not available');
    return null;
  }
}

// Parse text import - PERMISSIVE format that handles various deck list styles
function parseTextImport(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid text input');
  }
  
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line);
  console.log(`[parseTextImport] Split ${lines.length} lines from input`);
  console.log(`[parseTextImport] First few lines:`, lines.slice(0, 3));
  
  if (lines.length === 0) {
    throw new Error('No valid lines found in text input');
  }
  
  const deck = { entries: {} };
  let validCards = 0;
  let totalCards = 0;
  let skippedLines = 0;
  let foundCards = [];
  let notFoundCards = [];
  
  // Simple, permissive line format that handles:
  // "4 Name - Subtitle (TFC #123)"
  // Parse each line - just count and full card name
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    // Skip empty lines and comments
    if (!line || line.startsWith('#') || line.startsWith('//')) {
      skippedLines++;
      continue;
    }
    
    // DEBUG: Log the actual line content to see what we're parsing
    console.log(`[parseTextImport] Processing line ${index + 1}: "${line}"`);
    
    // Try to parse the line - just count and full card name
    const match = line.match(/^(\d+)\s+(.+)$/);
    if (!match) {
      console.warn(`[parseTextImport] Unrecognized format on line ${index + 1}: "${line}"`);
      skippedLines++;
      continue;
    }
    
    const [, count, fullCardName] = match;
    const countNum = parseInt(count);
    
    if (countNum <= 0 || !fullCardName.trim()) {
      console.warn(`[parseTextImport] Invalid count or card name on line ${index + 1}: "${line}"`);
      skippedLines++;
      continue;
    }
    
    totalCards += countNum;
    const cardName = fullCardName.trim();
    // The permissive line format only yields a full name; there is no separate
    // subtitle/set/number token. These are declared (empty) so the placeholder
    // fallbacks below resolve to their defaults instead of throwing ReferenceError.
    const cardSubtitle = '';
    const cardSet = '';
    const cardNumber = '';

    console.log(`[parseTextImport] Parsed: ${countNum}x "${cardName}"`);

    // Resolve against the FULL catalog, not the currently filtered view — an
    // active search/filter must not make deck-list cards unresolvable on import.
    const cards = window.getAllCards
      ? window.getAllCards()
      : (window.getCurrentCards ? window.getCurrentCards() : []);
    const foundCard = findCardByName(cardName, cards);
    
    if (foundCard && !foundCard.reason) {
      // Card found successfully
      const key = deckKey(foundCard);
      
              try {
          // Extract inkable information from the original card data BEFORE processing, prioritize inkwell field
          const inkable = foundCard.inkable ?? foundCard._raw?.inkwell ?? foundCard._raw?.inkable ?? foundCard._raw?.can_be_ink ?? foundCard._raw?.Inkable ?? false;
          
          const transformedCard = toAppCard(foundCard);
          const rawUrl = getCardImageUrl(transformedCard);
          const proxied = lorcanaImageProxyUrl(rawUrl);
          let image_url = asUrl(proxied) ?? asUrl(rawUrl);
          
          if (image_url && typeof image_url !== 'string') {
            image_url = null;
          }
          
          deck.entries[key] = { 
            card: {
              ...transformedCard,
              inkable: Boolean(inkable), // Use the extracted inkable value
              _raw: foundCard._raw, // Preserve the original raw data
              image_url,
              _generatedImageUrl: rawUrl,
              _proxiedImageUrl: proxied
            }, 
            count: countNum 
          };
        
        validCards++;
        foundCards.push({ name: foundCard.name, found: foundCard.name, count: countNum });
        console.log(`[parseTextImport] Successfully imported: ${foundCard.name}`);
        
      } catch (error) {
        console.warn(`[parseTextImport] Error processing card ${foundCard.name}:`, error);
        // Store the card without image on error
        deck.entries[key] = { 
          card: { ...foundCard, image_url: null }, 
          count: countNum 
        };
        validCards++;
        foundCards.push({ name: foundCard.name, found: foundCard.name, count: countNum });
      }
      
    } else if (foundCard && foundCard.reason === 'ambiguous-base' && foundCard.candidates) {
      // Handle ambiguous cases
      console.log(`[parseTextImport] Ambiguous card found for "${cardName}", ${foundCard.candidates.length} candidates`);
      
      // Use the first candidate as a best guess
      const bestMatch = foundCard.candidates[0];
      const key = deckKey(bestMatch);
      
              try {
          // Extract inkable information from the original card data BEFORE processing, prioritize inkwell field
          const inkable = bestMatch.inkable ?? bestMatch._raw?.inkwell ?? bestMatch._raw?.inkable ?? bestMatch._raw?.can_be_ink ?? bestMatch._raw?.Inkable ?? false;
          
          const transformedCard = toAppCard(bestMatch);
          const rawUrl = getCardImageUrl(transformedCard);
          const proxied = lorcanaImageProxyUrl(rawUrl);
          let image_url = asUrl(proxied) ?? asUrl(rawUrl);
          
          if (image_url && typeof image_url !== 'string') {
            image_url = null;
          }
          
          deck.entries[key] = { 
            card: {
              ...transformedCard,
              inkable: Boolean(inkable), // Use the extracted inkable value
              _raw: bestMatch._raw, // Preserve the original raw data
              image_url,
              _generatedImageUrl: rawUrl,
              _proxiedImageUrl: proxied,
              _resolvedFromAmbiguous: true
            }, 
            count: countNum 
          };
        
        validCards++;
        foundCards.push({ name: bestMatch.name, found: bestMatch.name, count: countNum, reason: 'resolved-from-ambiguous' });
        console.log(`[parseTextImport] Used best match: ${bestMatch.name}`);
        
      } catch (error) {
        console.warn(`[parseTextImport] Error processing ambiguous card ${bestMatch.name}:`, error);
        // Create placeholder
        const placeholderCard = {
          name: `${cardName}${cardSubtitle ? ` - ${cardSubtitle}` : ''}`,
          set: cardSet || 'Multiple',
          number: cardNumber || 'Multiple',
          cost: 0,
          inks: [],
          type: "Unknown",
          rarity: "Unknown",
          text: `Multiple variants found: ${foundCard.candidates.map(c => c.name).join(', ')}`,
          classifications: [],
          keywords: [],
          image_url: null,
          _raw: {},
          _candidates: foundCard.candidates,
          _needsResolution: true,
          setCode: cardSet || 'Multiple',
          setName: cardSet ? `Set ${cardSet}` : 'Multiple Sets',
          setNum: cardNumber || 'Multiple',
          inkable: false,
          lore: 0,
          willpower: 0,
          strength: 0,
          franchise: "",
          gamemode: "Lorcana"
        };
        
        const placeholderKey = deckKey(placeholderCard);
        deck.entries[placeholderKey] = { card: placeholderCard, count: countNum };
        validCards++;
        notFoundCards.push({ name: `${cardName}${cardSubtitle ? ` - ${cardSubtitle}` : ''}`, count: countNum, reason: 'ambiguous-needs-resolution' });
      }
      
    } else {
      // No card found, create placeholder
      console.log(`[parseTextImport] No card found for: "${cardName}${cardSubtitle ? ` - ${cardSubtitle}` : ''}"`);
      
      const placeholderCard = {
        name: `${cardName}${cardSubtitle ? ` - ${cardSubtitle}` : ''}`,
        set: cardSet || "Unknown",
        number: cardNumber || "?",
        cost: 0,
        inks: [],
        type: "Unknown",
        rarity: "Unknown",
        text: "",
        classifications: [],
        keywords: [],
        image_url: null,
        _raw: {},
        setCode: cardSet || "Unknown",
        setName: cardSet ? `Set ${cardSet}` : "Unknown",
        setNum: cardNumber || "?",
        inkable: false,
        lore: 0,
        willpower: 0,
        strength: 0,
        franchise: "",
        gamemode: "Lorcana"
      };
      
      const key = deckKey(placeholderCard);
      deck.entries[key] = { card: placeholderCard, count: countNum };
      validCards++;
      notFoundCards.push({ name: `${cardName}${cardSubtitle ? ` - ${cardSubtitle}` : ''}`, count: countNum, reason: 'not-found' });
    }
    
    // REMOVED: Duplicate processing blocks that were causing double processing
    // The main parsing logic above already handles all the formats we need
  }
  
  if (validCards === 0) {
    throw new Error('No valid cards found in text input');
  }
  
  // Ensure the deck has the total count properly set
  deck.total = totalCards;
  
  // Log detailed results for debugging
  console.log(`[parseTextImport] Successfully parsed ${validCards} unique cards, ${totalCards} total cards (skipped ${skippedLines} lines)`);
  
  // Extract all valid image URLs for prefetching (ensuring they're strings)
  const imageUrlsToPrefetch = Object.values(deck.entries)
    .map(entry => {
      const card = entry.card;
      if (!card) return null;
      
      // DEBUG: Log what we're working with
      console.log(`[parseTextImport] Prefetch processing card:`, {
        name: card.name,
        type: typeof card,
        keys: Object.keys(card),
        hasImageUrl: !!card.image_url,
        imageUrlType: typeof card.image_url
      });
      
      // Use getCardImageUrl to get the best possible URL
      const rawUrl = getCardImageUrl(card);
      
      // DEBUG: Log the exact value and type
      console.log(`[parseTextImport] Prefetch rawUrl details:`, {
        rawUrl,
        type: typeof rawUrl,
        isString: typeof rawUrl === 'string',
        isObject: typeof rawUrl === 'object',
        length: rawUrl?.length,
        keys: typeof rawUrl === 'object' ? Object.keys(rawUrl) : 'N/A'
      });
      
      // GUARD: Ensure rawUrl is a string before calling proxyImageUrl
      if (typeof rawUrl !== 'string') {
        console.warn(`[parseTextImport] rawUrl is not a string, skipping proxy:`, rawUrl);
        return asUrl(rawUrl);
      }
      
      console.log(`[parseTextImport] Prefetch call to lorcanaImageProxyUrl with:`, { rawUrl, type: typeof rawUrl, function: typeof lorcanaImageProxyUrl });
      const proxied = lorcanaImageProxyUrl(rawUrl);
      return asUrl(proxied) ?? asUrl(rawUrl);
    })
    .filter(url => typeof url === 'string' && url.length > 0);
  
  console.log(`[parseTextImport] Extracted ${imageUrlsToPrefetch.length} valid image URLs for prefetching`);
  if (imageUrlsToPrefetch.length > 0) {
    console.log(`[parseTextImport] Sample URLs:`, imageUrlsToPrefetch.slice(0, 3));
  }
  
  if (foundCards.length > 0) {
    console.log('[parseTextImport] Found cards:', foundCards);
  }
  if (notFoundCards.length > 0) {
    console.log('[parseTextImport] Not found cards:', notFoundCards);
  }
  
  return deck;
}


// ADVANCED: Deterministic card matching system with clear outcomes
function matchCard(line, db) {
  const raw = line.trim();
  
  // Normalize function for consistent matching
  const clean = (s = '') => s.toLowerCase()
    .normalize('NFKD')
    .replace(/[–—]/g, '-')     // dash normalize
    .replace(/\s+/g, ' ')
    .trim();
  
  const normLine = clean(raw);
  
  // Split title into base and subtitle
  function splitTitle(line) {
    const m = clean(line).split(/\s-\s/); // tolerant of hyphenated subtitles
    return { base: m[0], sub: m[1] ?? '' };
  }
  
  // 1) Exact match on full normalized name
  const exact = db.find(c => clean(c.name) === normLine);
  if (exact) {
    console.log(`[matchCard] Exact match found: "${exact.name}"`);
    return { match: exact, needsConfirmation: false, reason: "exact-name" };
  }
  
  // 2) Name - Subtitle pairing using new normalized fields
  const { base, sub } = splitTitle(raw);
  if (sub) {
    console.log(`[matchCard] Trying subtitle match: base="${base}", sub="${sub}"`);
    
    // Use the new normalized fields for more reliable matching
    const subtitleCandidates = db.filter(c => {
      // First try the new normalized fields
      if (c.baseName && c.subname) {
        return clean(c.baseName) === clean(base) && clean(c.subname) === clean(sub);
      }
      // Fallback to parsing the name field (for legacy cards)
      const [cBase, cSub = ''] = clean(c.name).split(/\s-\s/);
      return cBase === clean(base) && cSub === clean(sub);
    });
    
    if (subtitleCandidates.length === 1) {
      console.log(`[matchCard] Single subtitle match: "${subtitleCandidates[0].name}"`);
      return { match: subtitleCandidates[0], needsConfirmation: false, reason: "name+subtitle" };
    }
    if (subtitleCandidates.length > 1) {
      console.log(`[matchCard] Multiple subtitle matches (${subtitleCandidates.length}), needs confirmation`);
      return { candidates: subtitleCandidates, needsConfirmation: true, reason: "ambiguous-name+subtitle" };
    }
  }
  
  // 3) Unique base-name fallback using new normalized fields
  const baseMatches = db.filter(c => {
    // First try the new normalized fields
    if (c.baseName) {
      return clean(c.baseName) === clean(base);
    }
    // Fallback to parsing the name field (for legacy cards)
    const [cBase] = clean(c.name).split(/\s-\s/);
    return cBase === clean(base);
  });
  
  if (baseMatches.length === 1) {
    console.log(`[matchCard] Unique base name match: "${baseMatches[0].name}"`);
    return { match: baseMatches[0], needsConfirmation: false, reason: "unique-base" };
  }
  
  if (baseMatches.length > 1) {
    console.log(`[matchCard] Multiple base matches (${baseMatches.length}), applying tiebreakers`);
    
    // Apply soft tiebreakers: set, color, inkable
    const boosted = [...baseMatches].sort((a, b) => {
      let scoreA = 0, scoreB = 0;
      if (normLine.includes(clean(String(a.setId)))) scoreA += 3;
      if (normLine.includes(clean(String(b.setId)))) scoreB += 3;
      if (normLine.includes(clean(String(a.setNum)))) scoreA += 2;
      if (normLine.includes(clean(String(b.setNum)))) scoreB += 2;
      if (normLine.includes(clean(String(a.colors?.[0])))) scoreA += 1;
      if (normLine.includes(clean(String(b.colors?.[0])))) scoreB += 1;
      return scoreB - scoreA;
    });
    
    // If the top score is unique & >0, pick it; else ask user
    const top = boosted[0];
    const topScore = (() => {
      let s = 0;
      if (normLine.includes(clean(String(top.setId)))) s += 3;
      if (normLine.includes(clean(String(top.setNum)))) s += 2;
      if (normLine.includes(clean(String(top.colors?.[0])))) s += 1;
      return s;
    })();
    
    if (topScore > 0 && (boosted.length === 1 || top !== boosted[1])) {
      console.log(`[matchCard] Tiebreaker resolved: "${top.name}" (score: ${topScore})`);
      return { match: top, needsConfirmation: false, reason: "base+tiebreak" };
    }
    
    console.log(`[matchCard] Ambiguous base matches, needs confirmation`);
    return { candidates: baseMatches, needsConfirmation: true, reason: "ambiguous-base" };
  }
  
  // 4) Give up cleanly
  console.log(`[matchCard] No match found for: "${line}"`);
  return { candidates: [], needsConfirmation: true, reason: "no-match" };
}

// UPDATED: Enhanced card finder using the new matching system
/**
 * Name resolver used by importer:
 * 1) try exact full-name equality (dash/space insensitive)
 * 2) if "Base - Subtitle" was typed, match by baseName + subname
 * 3) optional: tie-break by set number if present in user line
 */
function findCardByName(userLine, cards) {
  const typed = String(userLine || "");
  
  console.log(`[findCardByName] Searching for: "${typed}" (cleaned: "${typed.toLowerCase()}")`);
  console.log(`[findCardByName] Total cards in database: ${cards.length}`);
  
  // DEBUG: Show detailed structure of sample cards
  console.log(`[findCardByName] Sample cards structure:`, 
    cards.slice(0, 3).map(c => ({
      name: c.name,
      baseName: c.baseName,
      subname: c.subname,
      subtitle: c.subtitle,
      allKeys: Object.keys(c).slice(0, 10), // Show first 10 keys
      hasRaw: !!c._raw,
      rawKeys: c._raw ? Object.keys(c._raw).slice(0, 5) : []
    }))
  );
  
  // DEBUG: Look for cards with similar names to understand the data structure
  if (typed.includes(" - ")) {
    const [baseTyped, subTyped] = typed.split(/\s*[-–—]\s*/);
    const similarCards = cards.filter(c => {
      const cardName = (c.name || "").toLowerCase();
      return cardName.startsWith(baseTyped.toLowerCase());
    }).slice(0, 5);
    
    console.log(`[findCardByName] Cards with similar base name "${baseTyped}":`, 
      similarCards.map(c => ({
        name: c.name,
        baseName: c.baseName,
        subname: c.subname,
        rawName: c._raw?.Name
      }))
    );
  }
  
  // DEBUG: Show what we're searching for
  console.log(`[findCardByName] Searching for complete card name: "${typed}"`);

  // 1) Try exact match first (case-insensitive)
  console.log(`[findCardByName] Trying exact match for: "${typed}"`);
  const exact = cards.find(c => c.name.toLowerCase() === typed.toLowerCase());
  if (exact) {
    console.log(`[findCardByName] Found exact match: "${exact.name}"`);
    return exact;
  }
  console.log(`[findCardByName] No exact match found`);

  // 2) Try case-insensitive match with normalized names
  console.log(`[findCardByName] Trying case-insensitive match for: "${typed.toLowerCase()}"`);
  const caseInsensitive = cards.find(c => canon(c.name) === canon(typed));
  if (caseInsensitive) {
    console.log(`[findCardByName] Found case-insensitive match: "${caseInsensitive.name}"`);
    return caseInsensitive;
  }
  console.log(`[findCardByName] No case-insensitive match found`);

  // 3) Try matching against the original Name field if it exists
  console.log(`[findCardByName] Trying original Name field match for: "${typed}"`);
  const originalNameMatch = cards.find(c => {
    const originalName = c._raw?.Name || c._raw?.name;
    return originalName && originalName.toLowerCase() === typed.toLowerCase();
  });
  if (originalNameMatch) {
    console.log(`[findCardByName] Found original Name match: "${originalNameMatch._raw?.Name || originalNameMatch._raw?.name}"`);
    return originalNameMatch;
  }
  console.log(`[findCardByName] No original Name match found`);

  // 4) Try matching against Lorcast API name + version combination
  console.log(`[findCardByName] Trying Lorcast name + version match for: "${typed}"`);
  const lorcastMatch = cards.find(c => {
    if (c._raw?.name && c._raw?.version) {
      const fullName = `${c._raw.name} - ${c._raw.version}`;
      return fullName.toLowerCase() === typed.toLowerCase();
    }
    return false;
  });
  if (lorcastMatch) {
    console.log(`[findCardByName] Found Lorcast name + version match: "${lorcastMatch._raw.name} - ${lorcastMatch._raw.version}"`);
    return lorcastMatch;
  }
  console.log(`[findCardByName] No Lorcast name + version match found`);

  // 5) Try fuzzy matching on the complete card name
  let candidates = cards.filter(c => {
    const cardName = (c.name || "").toLowerCase();
    const userFullName = typed.toLowerCase();
    
    // Check if the card name starts with the user's input or vice versa
    return cardName.startsWith(userFullName) || userFullName.startsWith(cardName);
  });
  
  console.log(`[findCardByName] Found ${candidates.length} fuzzy matches for "${typed}"`);
  if (candidates.length > 0) {
    console.log(`[findCardByName] Fuzzy match candidates:`, candidates.slice(0, 3).map(c => ({ name: c.name })));
    
    if (candidates.length === 1) {
      console.log(`[findCardByName] Found single fuzzy match: "${candidates[0].name}"`);
      return candidates[0];
    } else {
      console.log(`[findCardByName] Multiple fuzzy matches found, returning ambiguous result`);
      return { reason: "ambiguous-base", candidates };
    }
  }

  // 6) No match found
  console.log(`[findCardByName] No match found for: "${typed}"`);
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
      console.log('[deckReducer] SWITCH_DECK action:', action);
      console.log('[deckReducer] Current state:', state);
      console.log('[deckReducer] New deck:', action.deck);
      const newState = action.deck || state;
      console.log('[deckReducer] Returning new state:', newState);
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
    classifications: new Set(),
    abilities: new Set(),
    selectedCosts: new Set(),
    showInkablesOnly: false,
    showUninkablesOnly: false,
    sortBy: "ink-set-number",
    sortDir: "asc",
    showFilterPanel: false,
    setNumber: "",
    franchise: "",
    gamemode: "",
    loreMin: "",
    loreMax: "",
    willpowerMin: "",
    willpowerMax: "",
    strengthMin: "",
    strengthMax: "",
    _resetTimestamp: Date.now(),
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
    selectedCosts: Array.from(state.selectedCosts || []),
    showFilterPanel: state.showFilterPanel || false,
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
    selectedCosts: new Set(raw.selectedCosts || []),
    showFilterPanel: false, // always start closed on load
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

// DUPLICATE SECTION REMOVED - ImageCacheProvider is now only defined at the top of the file

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

// Header & topbar -------------------------------------------------------------

function TopBar({ onResetDeck, onExport, onImport, onPrint, onSaveDeck, onToggleFilters, searchText, onSearchChange, onNewDeck, onDeckManager }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-[#0a0d13]/70 border-b border-white/10 sticky top-0 z-40 backdrop-blur">
      {/* Search bar - always visible */}
      <div className="flex-1 min-w-[160px] max-w-xl">
        <input
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 placeholder:text-gray-500"
          placeholder="Search cards by name, text, etc."
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">

        <button
          className="px-2.5 py-1 rounded-md text-sm bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 hover:border-white/20 transition"
          onClick={onToggleFilters}
          title="Toggle filters (Ctrl+F)"
        >
          Filters
        </button>
        <button
          className="px-3 py-1.5 rounded-lg bg-gradient-to-b from-violet-500 to-indigo-500 border border-violet-400/40 text-white shadow-[0_3px_12px_-3px_rgba(139,108,255,0.7)] hover:brightness-110 transition"
          onClick={onDeckManager}
          title="Manage decks"
        >
          Decks
        </button>
        <button
          className="px-2.5 py-1 rounded-md text-sm bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 hover:border-white/20 transition"
          onClick={onNewDeck}
          title="Start fresh deck"
        >
          New
        </button>
        <button
          className="px-2.5 py-1 rounded-md text-sm bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 hover:border-white/20 transition"
          onClick={onImport}
          title="Import deck JSON"
        >
          Import
        </button>
        
      </div>
    </div>
  );
}

// Filter panel ---------------------------------------------------------------

function FilterPanel({ state, dispatch, onDone, onSearchChange }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0a0d13]/95 backdrop-blur-sm p-5 md:p-8">
      <div className="flex items-center gap-2 mb-2">
        <input
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 placeholder:text-gray-500"
          placeholder="Search cards by name, text, etc."
          value={state.text}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <button
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 transition"
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
          className="px-3 py-2 rounded-lg bg-gradient-to-b from-violet-500 to-indigo-500 border border-violet-400/40 text-white hover:brightness-110 transition"
          onClick={onDone}
        >
          Done
        </button>
      </div>

      {/* Inkable Checkboxes - Top Priority */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <details open className="bg-white/[0.03] rounded-xl p-3 border border-white/10">
          <summary className="text-sm font-semibold text-gray-200 cursor-pointer select-none marker:text-violet-400">Inkable Status</summary>
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
        </details>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Ink Colors */}
        <details open className="bg-white/[0.03] rounded-xl p-3 border border-white/10">
          <summary className="text-sm font-semibold text-gray-200 cursor-pointer select-none marker:text-violet-400">Ink Colors</summary>
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
        </details>

        {/* 2. Cost Selection */}
        <details open className="bg-white/[0.03] rounded-xl p-3 border border-white/10">
          <summary className="text-sm font-semibold text-gray-200 cursor-pointer select-none marker:text-violet-400">Cost</summary>
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
        </details>

        {/* 3. Types */}
        <details open className="bg-white/[0.03] rounded-xl p-3 border border-white/10">
          <summary className="text-sm font-semibold text-gray-200 cursor-pointer select-none marker:text-violet-400">Types</summary>
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
        </details>

        {/* 4. Legality */}
        <details open className="bg-white/[0.03] rounded-xl p-3 border border-white/10">
          <summary className="text-sm font-semibold text-gray-200 cursor-pointer select-none marker:text-violet-400">Legality</summary>
          <select
            className="w-full px-2 py-1 rounded-lg bg-gray-800 border border-white/10"
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
        </details>

        {/* 5. Classifications */}
        <details open className="bg-white/[0.03] rounded-xl p-3 border border-white/10">
          <summary className="text-sm font-semibold text-gray-200 cursor-pointer select-none marker:text-violet-400">Classifications</summary>
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
        </details>

        {/* 6. Abilities */}
        <details open className="bg-white/[0.03] rounded-xl p-3 border border-white/10">
          <summary className="text-sm font-semibold text-gray-200 cursor-pointer select-none marker:text-violet-400">Abilities</summary>
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
            className="hidden"
            onClick={() => {
              console.log('[Debug] Current abilities state:', state.abilities);
              dispatch({ type: "RESET" });
            }}
          >
            Reset Filters (Debug)
          </button>
        </details>

        {/* 4. Lore Range */}
        <details open className="bg-white/[0.03] rounded-xl p-3 border border-white/10">
          <summary className="text-sm font-semibold text-gray-200 cursor-pointer select-none marker:text-violet-400">Lore Range</summary>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              className="w-20 px-2 py-1 rounded-lg bg-gray-800 border border-white/10"
              placeholder="Min"
              min="0"
              value={state.loreMin}
              onChange={(e) => dispatch({ type: "SET_LORE_RANGE", min: parseInt(e.target.value || 0) })}
            />
            <span className="text-gray-400">to</span>
            <input
              type="number"
              className="w-20 px-2 py-1 rounded-lg bg-gray-800 border border-white/10"
              placeholder="Max"
              min="0"
              value={state.loreMax}
              onChange={(e) => dispatch({ type: "SET_LORE_RANGE", max: parseInt(e.target.value || 0) })}
            />
          </div>
        </details>

        {/* 5. Strength Range */}
        <details open className="bg-white/[0.03] rounded-xl p-3 border border-white/10">
          <summary className="text-sm font-semibold text-gray-200 cursor-pointer select-none marker:text-violet-400">Strength Range</summary>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              className="w-20 px-2 py-1 rounded-lg bg-gray-800 border border-white/10"
              placeholder="Min"
              min="0"
              value={state.strengthMin}
              onChange={(e) => dispatch({ type: "SET_STRENGTH_RANGE", min: parseInt(e.target.value || 0) })}
            />
            <span className="text-gray-400">to</span>
            <input
              type="number"
              className="w-20 px-2 py-1 rounded-lg bg-gray-800 border border-white/10"
              placeholder="Max"
              min="0"
              value={state.strengthMax}
              onChange={(e) => dispatch({ type: "SET_STRENGTH_RANGE", max: parseInt(e.target.value || 0) })}
            />
          </div>
        </details>

        {/* 6. Willpower Range */}
        <details open className="bg-white/[0.03] rounded-xl p-3 border border-white/10">
          <summary className="text-sm font-semibold text-gray-200 cursor-pointer select-none marker:text-violet-400">Willpower Range</summary>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              className="w-20 px-2 py-1 rounded-lg bg-gray-800 border border-white/10"
              placeholder="Min"
              min="0"
              value={state.willpowerMin}
              onChange={(e) => dispatch({ type: "SET_WILLPOWER_RANGE", min: parseInt(e.target.value || 0) })}
            />
            <span className="text-gray-400">to</span>
            <input
              type="number"
              className="w-20 px-2 py-1 rounded-lg bg-gray-800 border border-white/10"
              placeholder="Max"
              min="0"
              value={state.willpowerMax}
              onChange={(e) => dispatch({ type: "SET_WILLPOWER_RANGE", max: parseInt(e.target.value || 0) })}
            />
          </div>
        </details>

        <details open className="bg-white/[0.03] rounded-xl p-3 border border-white/10">
          <summary className="text-sm font-semibold text-gray-200 cursor-pointer select-none marker:text-violet-400">Sets</summary>
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
                className="w-full px-2 py-1 rounded-lg bg-gray-800 border border-white/10 text-sm"
                placeholder="e.g., 1, 2, 3..."
                value={state.setNumber}
                onChange={(e) => dispatch({ type: "SET_SET_NUMBER", value: e.target.value })}
              />
            </div>
            
            {/* Quick Set Actions */}
            <div className="flex gap-2">
              <button
                className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded border border-white/10 text-gray-200"
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
                className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded border border-white/10 text-gray-200"
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
              className="hidden"
              onClick={() => {
                console.log('[Debug] Current sets state:', state.sets);
                console.log('[Debug] SETS constant:', SETS);
              }}
            >
              Debug Sets (Console)
            </button>
          </div>
        </details>





        {/* 7. Rarity */}
        <details open className="bg-white/[0.03] rounded-xl p-3 border border-white/10">
          <summary className="text-sm font-semibold text-gray-200 cursor-pointer select-none marker:text-violet-400">Rarity</summary>
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
        </details>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">

        {/* Sort section hidden but functionality preserved */}
        {/* <details open className="bg-white/[0.03] rounded-xl p-3 border border-white/10">
          <summary className="text-sm font-semibold text-gray-200 cursor-pointer select-none marker:text-violet-400">Sort</summary> */}
          <div className="flex items-center gap-2 mt-2">
            <select
              className="px-2 py-1 rounded-lg bg-gray-800 border border-white/10"
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
              className="px-2 py-1 rounded-lg bg-gray-800 border border-white/10"
              value={state.sortDir}
              onChange={(e) => dispatch({ type: "SET_SORT", sortDir: e.target.value })}
            >
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </select>
          </div>
        {/* </details> */}
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
          : "bg-gray-800 border-white/10 text-gray-200"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

// Card grid ------------------------------------------------------------------

const PAGE_SIZE = 60;

function CardGrid({ cards, onAdd, onInspect, deck }) {
  const validCards = cards.filter(card => card && typeof card === 'object');

  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);

  // Reset to first page when the card list changes (filter / search)
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [cards]);

  // Load next page when the sentinel scrolls into view
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayCount((n) => Math.min(n + PAGE_SIZE, validCards.length));
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [validCards.length]);

  const getDeckCount = (card) => {
    const key = deckKey(card);
    return deck?.entries?.[key]?.count || 0;
  };

  const visible = validCards.slice(0, displayCount);
  const hasMore = displayCount < validCards.length;

  return (
    <div className="space-y-3 p-3">
      {validCards.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <div className="text-lg mb-2">No valid cards found</div>
          <div className="text-sm">Please check your data source or try refreshing the page</div>
        </div>
      )}

      {validCards.length > 0 && (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))", gap: "12px" }}>
          {visible.map((c) => (
            <div key={deckKey(c)}>
              <CardTile
                card={c}
                onAdd={onAdd}
                onInspect={onInspect}
                deckCount={getDeckCount(c)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Sentinel — triggers next page when scrolled into view */}
      <div ref={sentinelRef} className="py-2 text-center text-xs text-gray-600">
        {hasMore
          ? `Showing ${visible.length} of ${validCards.length} cards — scroll for more`
          : validCards.length > 0
            ? `All ${validCards.length} cards shown`
            : null}
      </div>
    </div>
  );
}

// Enhanced image function that supports multiple image sources
// getCardImg is imported from ./lib/cardUtils.js

const CardTile = React.memo(function CardTile({ card, onAdd, onInspect, deckCount = 0 }) {
  if (!card || typeof card !== 'object' || !card.name) {
    console.warn('[CardTile] Invalid card object, showing fallback:', card);
    return (
      <div className="group relative bg-gray-900 rounded-xl border border-white/10 overflow-hidden w-full h-96 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="text-sm mb-2">Invalid Card</div>
          <div className="text-xs">Missing or corrupted data</div>
        </div>
      </div>
    );
  }
  
  // Use multiple image sources for better compatibility
  const img = card.image_url || card._imageFromAPI || card.image;
  
  return (
    <div className="group relative rounded-xl overflow-hidden border border-white/10 bg-[#11151f] transition-all duration-200 hover:-translate-y-1.5 hover:border-violet-400/60 hover:shadow-[0_18px_34px_-14px_#000,0_0_28px_-6px_rgba(139,108,255,0.55)] cursor-pointer w-full">
      {img ? (
        <img
          src={img}
          alt={card.name}
          className="block w-full h-auto aspect-[5/7] object-cover"
          loading="lazy"
          onClick={() => onInspect(card)}
        />
      ) : (
        <div className="w-full aspect-[5/7] bg-gray-800 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="text-xs mb-2">No image</div>
            <div className="text-xs">{card.name}</div>
          </div>
        </div>
      )}
      
      {/* Add/Remove buttons with count fraction - always visible to prevent layout shifts */}
      <div className="absolute inset-x-0 bottom-0 px-1.5 pb-1.5 pt-6 flex items-center gap-1.5 bg-gradient-to-t from-black/80 to-transparent">
        <button
          className="w-6 h-6 rounded-md text-white text-sm leading-none flex items-center justify-center bg-gradient-to-b from-violet-500 to-indigo-500 shadow-[0_3px_12px_-3px_rgba(139,108,255,0.8)] hover:brightness-110 transition"
          onClick={(e) => { e.stopPropagation(); onAdd(card, 1); }}
          title="Add to deck"
        >
          +
        </button>
        
        <button
          className={`w-6 h-6 rounded-md border text-sm flex items-center justify-center transition ${
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
        
        {/* Card count display as fraction */}
        <div className="ml-auto bg-black/60 backdrop-blur border border-white/15 text-white text-[11px] font-semibold px-2 py-0.5 rounded-md tabular-nums">
          {deckCount}/4
        </div>
      </div>
    </div>
  );
});

// Deck Manager Component
// -----------------------------------------------------------------------------

function DeckManager({ isOpen, onClose, decks, currentDeckId, onSwitchDeck, onNewDeck, onDeleteDeck, onDuplicateDeck, onImportDeck, onRefreshDecks, onRenameDeck }) {
  const { user } = useAuth();
  const [selectedDeckId, setSelectedDeckId] = useState(currentDeckId);
  const [showNewDeckForm, setShowNewDeckForm] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [exportFormat, setExportFormat] = useState("json");
  const [importFormat, setImportFormat] = useState("json");
  const [importData, setImportData] = useState("");
  const [renamingDeckId, setRenamingDeckId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    if (Object.keys(decks).length > 0 && (!selectedDeckId || !decks[selectedDeckId])) {
      const fallback = currentDeckId && decks[currentDeckId] ? currentDeckId : Object.keys(decks)[0];
      setSelectedDeckId(fallback);
    }
  }, [currentDeckId, decks, selectedDeckId]);

  useEffect(() => {
    if (selectedDeckId && !decks[selectedDeckId] && Object.keys(decks).length > 0) {
      setSelectedDeckId(Object.keys(decks)[0]);
    }
  }, [selectedDeckId, decks]);

  if (!isOpen) return null;

  const selectedDeck = decks[selectedDeckId];
  const sortedDecks = Object.values(decks).sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));

  function formatDate(ts) {
    return ts ? new Date(ts).toLocaleDateString() : 'Not saved';
  }

  const handleNewDeck = () => {
    const name = String(newDeckName).trim();
    if (name) {
      onNewDeck(name);
      setNewDeckName("");
      setShowNewDeckForm(false);
    }
  };

  const handleExport = () => {
    if (!selectedDeck) return;
    const data = exportDeck(selectedDeck, exportFormat);
    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDeck.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${exportFormat === 'simple-txt' ? 'txt' : exportFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportWithWarnings = () => {
    if (!importData.trim()) return;
    try {
      const importedDeck = importDeck(importData, importFormat);
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

  const startRename = (deck) => {
    setRenamingDeckId(deck.id);
    setRenameValue(deck.name);
  };

  const commitRename = () => {
    if (renamingDeckId && renameValue.trim()) {
      onRenameDeck(renamingDeckId, renameValue.trim());
    }
    setRenamingDeckId(null);
    setRenameValue("");
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-900 rounded-xl border border-white/10 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <h2 className="text-xl font-semibold">My Decks</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">✕</button>
        </div>

        {/* Auth nudge */}
        {!user && (
          <div className="flex items-center gap-2 px-4 py-2 bg-violet-900/30 border-b border-violet-700/40 text-sm text-violet-200 flex-shrink-0">
            <span>☁</span>
            <span>Log in to sync your decks across devices and keep them backed up.</span>
          </div>
        )}

        <div className="flex flex-1 min-h-0">
          {/* Left — deck list */}
          <div className="w-72 border-r border-white/10 flex flex-col flex-shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
              <span className="text-sm font-medium text-gray-300">Your Decks ({sortedDecks.length})</span>
              <div className="flex items-center gap-2">
                {user && (
                  <button
                    onClick={async () => { if (onRefreshDecks) await onRefreshDecks(); }}
                    className="px-2 py-1 bg-white/5 border border-white/10 hover:bg-white/10 rounded text-xs text-gray-300 transition-colors"
                    title="Refresh from cloud"
                  >
                    ↻
                  </button>
                )}
                <button
                  onClick={() => setShowNewDeckForm(true)}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 rounded text-xs transition-colors"
                >
                  + New
                </button>
              </div>
            </div>

            {showNewDeckForm && (
              <div className="m-3 p-3 bg-gray-800 rounded border border-gray-600 flex-shrink-0">
                <input
                  type="text"
                  placeholder="Deck name"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleNewDeck()}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm mb-2 outline-none focus:border-violet-500"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={handleNewDeck} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 rounded text-xs">Create</button>
                  <button onClick={() => { setShowNewDeckForm(false); setNewDeckName(""); }} className="px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs">Cancel</button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {sortedDecks.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-3">📁</div>
                  <div className="font-medium mb-1">No Saved Decks</div>
                  <div className="text-sm">Create a deck and save it to see it here.</div>
                </div>
              ) : sortedDecks.map((deck) => (
                <div
                  key={deck.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    deck.id === selectedDeckId
                      ? 'border-emerald-500 bg-emerald-900/20'
                      : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                  }`}
                  onClick={() => setSelectedDeckId(deck.id)}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="font-medium text-sm truncate">{deck.name}</div>
                    <span
                      title={deck._dbId ? 'Synced to cloud' : 'Local only'}
                      className={`text-xs flex-shrink-0 mt-0.5 ${deck._dbId ? 'text-emerald-400' : 'text-gray-500'}`}
                    >
                      {deck._dbId ? '☁' : '💾'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {deck.total} cards • {formatDate(deck.updatedAt ?? deck.createdAt)}
                  </div>
                  {deck.id === currentDeckId && (
                    <div className="text-xs text-emerald-400 mt-1 font-medium">Active</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right — deck detail */}
          <div className="flex-1 overflow-y-auto p-5">
            {sortedDecks.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <div className="text-4xl mb-3">💾</div>
                <div className="font-medium mb-2">Save Your First Deck</div>
                <div className="text-sm mb-4">Create a deck, add some cards, and click Save to get started.</div>
                <button onClick={() => setShowNewDeckForm(true)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded transition-colors">
                  Create New Deck
                </button>
              </div>
            ) : selectedDeck ? (
              <div className="space-y-4">
                {/* Name — click pencil to rename */}
                <div className="flex items-center gap-2">
                  {renamingDeckId === selectedDeck.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') { setRenamingDeckId(null); setRenameValue(""); }
                      }}
                      className="flex-1 text-lg font-semibold bg-gray-800 border border-violet-500 rounded px-2 py-0.5 outline-none"
                    />
                  ) : (
                    <>
                      <h3 className="text-lg font-semibold">{selectedDeck.name}</h3>
                      <button
                        onClick={() => startRename(selectedDeck)}
                        className="text-gray-500 hover:text-gray-300 text-sm px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors"
                        title="Rename deck"
                      >
                        ✎
                      </button>
                    </>
                  )}
                </div>

                {/* Meta grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><span className="text-gray-400">Cards:</span> {selectedDeck.total}</div>
                  <div><span className="text-gray-400">Format:</span> {selectedDeck.format}</div>
                  <div><span className="text-gray-400">Created:</span> {formatDate(selectedDeck.createdAt)}</div>
                  <div><span className="text-gray-400">Updated:</span> {formatDate(selectedDeck.updatedAt)}</div>
                </div>

                {/* Cloud status badge */}
                <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded ${selectedDeck._dbId ? 'bg-emerald-900/20 text-emerald-300' : 'bg-white/5 text-gray-400'}`}>
                  <span>{selectedDeck._dbId ? '☁ Synced to your profile' : '💾 Saved locally only'}</span>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <button
                    onClick={() => onSwitchDeck(selectedDeck)}
                    disabled={selectedDeck.id === currentDeckId}
                    className="w-full px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
                  >
                    {selectedDeck.id === currentDeckId ? 'Currently Active' : 'Switch to This Deck'}
                  </button>

                  <button
                    onClick={() => onDuplicateDeck(selectedDeck.id)}
                    className="w-full px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-sm transition-colors"
                  >
                    Duplicate
                  </button>
                </div>

                {/* Export */}
                <div className="border-t border-white/10 pt-4">
                  <h4 className="text-sm font-medium mb-2">Export</h4>
                  <div className="flex gap-2">
                    <select
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-gray-800 border border-white/10 rounded text-sm"
                    >
                      <option value="json">JSON</option>
                      <option value="txt">Text (Detailed)</option>
                      <option value="simple-txt">Text (Simple)</option>
                      <option value="csv">CSV</option>
                    </select>
                    <button onClick={handleExport} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded text-sm transition-colors">
                      Export
                    </button>
                  </div>
                </div>

                {/* Import */}
                <div className="border-t border-white/10 pt-4">
                  <h4 className="text-sm font-medium mb-2">Import</h4>
                  <div className="space-y-2">
                    <select
                      value={importFormat}
                      onChange={(e) => setImportFormat(e.target.value)}
                      className="w-full px-2 py-1.5 bg-gray-800 border border-white/10 rounded text-sm"
                    >
                      <option value="json">JSON</option>
                      <option value="txt">Text</option>
                      <option value="csv">CSV</option>
                    </select>
                    {importFormat === 'txt' && (
                      <div className="text-xs text-gray-400 bg-gray-800 p-2 rounded">
                        <div className="font-medium mb-1">Supported formats:</div>
                        <div>• "4 Rafiki - Mystical Fighter"</div>
                        <div>• "2x Card Name (Set #123)"</div>
                        <div>• Lines starting with # or // are ignored</div>
                      </div>
                    )}
                    <textarea
                      placeholder="Paste deck data here..."
                      value={importData}
                      onChange={(e) => setImportData(e.target.value)}
                      className="w-full h-20 px-2 py-1.5 bg-gray-800 border border-white/10 rounded text-sm resize-none"
                    />
                    <button onClick={handleImportWithWarnings} className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-sm transition-colors">
                      Import
                    </button>
                  </div>
                </div>

                {/* Delete */}
                <div className="border-t border-white/10 pt-4">
                  <button
                    onClick={() => {
                      const msg = selectedDeck.id === currentDeckId
                        ? `Delete the active deck "${selectedDeck.name}"? You'll be switched to another deck.`
                        : `Delete "${selectedDeck.name}"? This cannot be undone.`;
                      if (confirm(msg)) onDeleteDeck(selectedDeck.id);
                    }}
                    className="w-full px-3 py-2 bg-red-600/70 hover:bg-red-600 rounded text-sm transition-colors"
                  >
                    Delete Deck
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-10">
                <div className="text-4xl mb-3">📋</div>
                <div className="font-medium mb-2">Select a Deck</div>
                <div className="text-sm">Choose a deck from the list to view details and manage it.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Deck panel -----------------------------------------------------------------

// --- Deck Lab comp primitives (design/comps/uninkable-deck-lab-comp.html) ---
const HEX_CLIP = { clipPath: 'var(--hex)' };

// The card's primary ink as a CSS token color (falls back to steel).
function cardInkVar(card) {
  const inks = (typeof getInks === 'function' ? getInks(card) : []) || [];
  const first = String(inks[0] || '').toLowerCase();
  const known = ['amber', 'amethyst', 'emerald', 'ruby', 'sapphire', 'steel'];
  return known.includes(first) ? `var(--${first})` : 'var(--steel)';
}

function isCardInkable(card) {
  return Boolean(
    card.inkable ?? card._raw?.inkwell ?? card._raw?.inkable ?? card._raw?.can_be_ink ?? card._raw?.Inkable ?? false
  );
}

// The signature element: one hex per card in the deck, colored by its ink,
// hollow if uninkable. The whole deck's identity compressed into one glyph.
function DeckInkLedger({ entries }) {
  const hexes = [];
  for (const e of entries) {
    const v = cardInkVar(e.card);
    const inkable = isCardInkable(e.card);
    for (let i = 0; i < e.count; i++) hexes.push({ v, inkable, key: `${deckKey(e.card)}-${i}` });
  }
  if (!hexes.length) return null;
  return (
    <div className="flex flex-wrap gap-[3px]" aria-label={`${hexes.length} cards, hollow = uninkable`}>
      {hexes.map((h) => (
        <span
          key={h.key}
          className="relative"
          style={{ width: 10, height: 12, ...HEX_CLIP, background: h.inkable ? h.v : `color-mix(in srgb, ${h.v} 72%, transparent)` }}
        >
          {!h.inkable && <span className="absolute" style={{ inset: 2, ...HEX_CLIP, background: 'var(--panel)' }} />}
        </span>
      ))}
    </div>
  );
}

function DeckPanel({ deck, onSetCount, onRemove, onExport, onImport }) {
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
      // Use the same inkable detection logic as the import function, but prioritize inkwell field
      const fallback1 = e.card.inkable;
      const fallback2 = e.card._raw?.inkwell;
      const fallback3 = e.card._raw?.inkable;
      const fallback4 = e.card._raw?.can_be_ink;
      const fallback5 = e.card._raw?.Inkable;
      const fallback6 = false;
      
      const isInkable = Boolean(fallback1 ?? fallback2 ?? fallback3 ?? fallback4 ?? fallback5 ?? fallback6);
      
      console.log(`[Inkable Detection] Fallbacks for ${e.card.name}:`, {
        fallback1, fallback2, fallback3, fallback4, fallback5, fallback6, isInkable
      });
      
      console.log(`[Inkable Detection] Card: ${e.card.name}, e.card.inkable: ${e.card.inkable}, raw.inkwell: ${e.card._raw?.inkwell}, raw.inkable: ${e.card._raw?.inkable}, calculated isInkable: ${isInkable}`);
      
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
    <div className="bg-[#0b0e15]/80 backdrop-blur border-l border-white/10 h-full flex flex-col">
      {/* Identity / count header */}
      <div className="p-4 border-b border-white/10 relative">
        <div className="absolute inset-0 bg-[radial-gradient(80%_120%_at_0%_0%,rgba(58,160,224,0.13),transparent_55%)] pointer-events-none" />
        <div className="relative flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold leading-none">{deck.total}</span>
            <span className="text-sm text-gray-500">/ {DECK_RULES.MAX_SIZE}</span>
            <span className={`ml-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${deck.total === DECK_RULES.MAX_SIZE ? "text-emerald-300 bg-emerald-500/15 border border-emerald-400/30 shadow-[0_0_14px_-4px_#34d399]" : "text-gray-400 bg-white/5 border border-white/10"}`}>
              {deck.total === DECK_RULES.MAX_SIZE ? "● Legal" : `${Math.max(0, DECK_RULES.MAX_SIZE - deck.total)} to go`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 transition text-sm"
              onClick={onImport}
            >
              Import
            </button>
          </div>
        </div>
        {/* Inkable ratio bar */}
        <div className="relative flex items-center gap-3 text-xs">
          <span className="text-emerald-300 font-medium whitespace-nowrap">{inkableCounts.inkable} inkable</span>
          <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden border border-white/10">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_0_10px_-2px_#34d399]"
              style={{ width: `${deck.total ? (inkableCounts.inkable / deck.total) * 100 : 0}%` }}
            />
          </div>
          <span className="text-gray-400 whitespace-nowrap">{inkableCounts.uninkable} not</span>
        </div>
        {/* Signature: the ink ledger — one hex per card, hollow = uninkable. */}
        {entries.length > 0 && (
          <div className="relative mt-3">
            <div className="text-[10px] uppercase tracking-[0.1em] mb-1.5" style={{ color: 'var(--faint)' }}>
              Ink ledger · <span style={{ color: 'var(--muted)' }}>hollow = uninkable</span>
            </div>
            <DeckInkLedger entries={entries} />
          </div>
        )}
      </div>

      {/* Deck list grouped by cost */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {Object.keys(groupedByCost)
          .sort((a, b) => parseInt(a) - parseInt(b))
          .map((cost) => (
            <div key={cost} className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-violet-300 border-b border-white/10 flex items-center justify-between">
                <span>Cost {cost}</span>
                <span className="text-gray-500 tabular-nums">{groupedByCost[cost].reduce((s, e) => s + e.count, 0)}</span>
              </div>
              <div className="divide-y divide-white/5">
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
  const inkColor = cardInkVar(c);
  const inkable = isCardInkable(c);
  // Lorcana names read "Name - Version"; show the version in italic serif.
  const [nm, ...verParts] = String(c.name || '').split(' - ');
  const ver = verParts.join(' - ');

  return (
    <div className="group flex items-center gap-2.5 px-3 py-[5px] rounded-md hover:bg-[color:var(--panel-2)]">
      {/* stepper */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          className="w-[18px] h-[18px] grid place-items-center rounded border text-[color:var(--faint)] hover:text-[color:var(--text)] leading-none"
          style={{ borderColor: 'var(--line-2)' }}
          onClick={() => onSetCount(Math.max(0, entry.count - 1))}
          aria-label="Remove one"
        >
          −
        </button>
        <span className="w-5 text-center font-semibold text-[13px] tabular-nums">{entry.count}</span>
        <button
          className="w-[18px] h-[18px] grid place-items-center rounded border text-[color:var(--faint)] hover:text-[color:var(--text)] leading-none"
          style={{ borderColor: 'var(--line-2)' }}
          onClick={() => onSetCount(Math.min(DECK_RULES.MAX_COPIES, entry.count + 1))}
          aria-label="Add one"
        >
          +
        </button>
      </div>

      {/* cost hexagon in the card's ink */}
      <span
        className="relative grid place-items-center shrink-0"
        style={{ width: 22, height: 25, ...HEX_CLIP, background: `color-mix(in srgb, ${inkColor} 80%, transparent)` }}
      >
        <span className="absolute" style={{ inset: 1.5, ...HEX_CLIP, background: 'var(--panel)' }} />
        <b className="relative text-[11px] font-semibold tabular-nums">{getCost(c)}</b>
      </span>

      {/* name + italic-serif version */}
      <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
        <span className="font-semibold text-[13.5px] truncate">{nm}</span>
        {ver && (
          <span className="font-display italic text-[13px] truncate" style={{ color: 'var(--muted)' }}>
            — {ver}
          </span>
        )}
      </div>

      {/* uninkable well glyph */}
      <span
        title={inkable ? 'Inkable' : 'Uninkable'}
        className="relative shrink-0"
        style={{ width: 12, height: 14, ...HEX_CLIP, background: inkable ? 'var(--steel)' : `color-mix(in srgb, var(--steel) 80%, transparent)` }}
      >
        {!inkable && <span className="absolute" style={{ inset: 2.5, ...HEX_CLIP, background: 'var(--panel)' }} />}
      </span>

      {/* remove — appears on hover */}
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 text-[color:var(--faint)] hover:text-[color:var(--ruby)] text-xs shrink-0 leading-none"
        title="Remove card"
        aria-label="Remove card"
      >
        ✕
      </button>
    </div>
  );
}


function StatCard({ title, value, subtitle }) {
return (
<div className="p-3 bg-white/[0.03] rounded-xl border border-white/10">
<div className="text-sm text-gray-400">{title}</div>
<div className="text-2xl font-semibold">{value}</div>
{subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
</div>
);
}


function ChartCard({ title, children }) {
return (
<div className="p-3 bg-white/[0.03] rounded-xl border border-white/10">
<div className="text-sm text-gray-300 mb-2">{title}</div>
{children}
</div>
);
}

// Inspect card modal ---------------------------------------------------------

function InspectCardModal({ open, card, onClose, onAdd }) {
  const imgSrc = getCardImg(card || {});
  if (!open || !card) return null;

  // Locations are landscape cards, but the image source stores them as a
  // portrait (rotated 90°) frame. Rotate back so they present horizontally,
  // and swap the size constraints so the rotated image still fits the viewport.
  // Card mappings are inconsistent (type can be a string, an array like
  // ["Location"], or dropped entirely), so check every representation plus
  // Lorcast's canonical `layout: "landscape"` flag.
  const rawType =
    card.type ?? card.type_line ?? card._raw?.type ?? card.types ?? card._raw?.types;
  const typeStr = (Array.isArray(rawType) ? rawType.join(" ") : `${rawType ?? ""}`).toLowerCase();
  const layoutStr = `${card.layout ?? card._raw?.layout ?? ""}`.toLowerCase();
  const isLocation = layoutStr === "landscape" || typeStr.includes("location");
  const imgClass = isLocation
    ? "w-auto h-auto max-w-[calc(90vh-100px)] max-h-[90vw] object-contain rounded-xl border border-white/10 rotate-90"
    : "w-auto h-auto max-w-[99.5%] max-h-[calc(90vh-100px)] object-contain rounded-xl border border-white/10";
  
  // Debug log to see card structure
  console.log('[InspectCardModal] Card object:', card);
  console.log('[InspectCardModal] Card name:', card.name);
  console.log('[InspectCardModal] Card subname:', card.subname);
  console.log('[InspectCardModal] Card version:', card.version);
  
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative flex justify-center w-full">
        {/* Card Image Container - this will be the positioning context for the X button */}
        <div className="relative">
          <img
            src={imgSrc}
            alt={card.name}
            className={imgClass}
          />
          
          {/* Close Button - positioned relative to the card image */}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 w-8 h-8 bg-black/70 hover:bg-black/90 text-white rounded-full flex items-center justify-center text-lg font-bold border border-white/30 hover:border-white/50 transition-colors"
          >
            ×
          </button>
        </div>
        
        {/* Name Bubble - positioned above the card */}
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full border border-white/30 shadow-lg">
          <span className="text-sm font-medium whitespace-nowrap">{card.subname ? `${card.name} - ${card.subname}` : card.name}</span>
        </div>
        
        {/* +/- Buttons - centered over card bottom */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-3">
          <button
            onClick={() => onAdd(card)}
            className="w-10 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full flex items-center justify-center text-xl font-bold border-2 border-emerald-400 hover:border-emerald-300 transition-colors shadow-lg"
          >
          +
          </button>
          <button
            onClick={() => onAdd(card)}
            className="w-10 h-10 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-xl font-bold border-2 border-red-400 hover:border-red-300 transition-colors shadow-lg"
          >
          −
          </button>
        </div>
      </div>
    </div>
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
      className="w-full h-64 px-3 py-2 rounded-xl bg-gray-800 border border-white/10 font-mono text-xs"
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
      className="px-2.5 py-1 rounded-md text-sm bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 hover:border-white/20 transition"
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
  const [importFormat, setImportFormat] = useState("json");

  return (
    <Modal open={open} onClose={onClose} title="Import Deck" size="lg">
      <div className="space-y-4">
        {/* Import Section */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Import Deck</h3>
          
          {/* Format Selector */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-300 mb-2">Import Format:</label>
            <select
              value={importFormat}
              onChange={(e) => {
                setImportFormat(e.target.value);
                setText(""); // Clear textarea when format changes
              }}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm"
            >
              <option value="json">JSON</option>
              <option value="txt">Text</option>
            </select>
          </div>
          
          {/* Format-specific help text */}
          {importFormat === 'json' && (
            <div className="text-sm text-gray-400 mb-3">
              Paste deck JSON exported from this app (or adapt from another builder).
            </div>
          )}
          {importFormat === 'txt' && (
            <div className="text-sm text-gray-400 mb-3">
              Paste your deck list with one card per line. Format: "4 Rafiki - Mystical Fighter"
            </div>
          )}
          <textarea
            className="w-full h-48 px-3 py-2 rounded-xl bg-gray-800 border border-white/10 font-mono text-xs"
            placeholder={importFormat === 'json' ? '{"name":"My Deck","entries":{...},"total":60}' : '4 Rafiki - Mystical Fighter\n2 The Magic Feather\n4 Sail The Azurite Sea'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex items-center justify-end gap-2 mt-3">
            <button
              className="px-3 py-1.5 rounded-xl bg-emerald-900 border border-emerald-700 hover:bg-emerald-800"
              onClick={() => {
                if (!text.trim()) {
                  alert("Please enter some text to import");
                  return;
                }
                
                try {
                  let importedDeck;
                  
                  if (importFormat === 'json') {
                    importedDeck = JSON.parse(text);
                  } else if (importFormat === 'txt') {
                    // Use the global parseTextImport function
                    if (typeof window.parseTextImport === 'function') {
                      importedDeck = window.parseTextImport(text);
                      
                      // Check for cards that weren't found and show user feedback
                      const notFoundCards = Object.values(importedDeck.entries)
                        .filter(entry => entry.card.set === "Unknown")
                        .map(entry => entry.card.name);
                      
                      if (notFoundCards.length > 0) {
                        const message = `Import successful! ${importedDeck.total} cards imported.\n\nNote: ${notFoundCards.length} cards were not found in the database:\n${notFoundCards.join(', ')}\n\nThese may need to be loaded first or check spelling.`;
                        alert(message);
                      } else {
                        alert(`Import successful! ${importedDeck.total} cards imported.`);
                      }
                    } else {
                      throw new Error('Text import function not available');
                    }
                  } else {
                    throw new Error(`Unsupported format: ${importFormat}`);
                  }
                  
                  onImport(importedDeck);
                  onClose();
                } catch (error) {
                  if (importFormat === 'json') {
                    alert("Invalid JSON");
                  } else {
                    alert(`Import failed: ${error.message}`);
                  }
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
        <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
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
                  className="absolute bg-emerald-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-emerald-700 shadow-lg"
                  style={{ top: '8px', right: '8px' }}
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


// Root App -------------------------------------------------------------------

function AppInner() {
  console.log('[App] AppInner component starting up...');
  const { addToast } = useToasts();
  const { user, loading: authLoading } = useAuth();
  
  // Deck presentation image download. The heavy canvas/layout logic lives in
  // src/lib/deckImage.js as a pure function; this wrapper just owns the
  // loading state and error toast for the Deck Lab's own "Present" panel.
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  async function generateDeckImage() {
    setIsGeneratingImage(true);
    try {
      await generateDeckImagePNG(deck, allCards, { username: user?.email });
    } catch (error) {
      console.error('Failed to generate deck image:', error);
      addToast('Failed to generate deck image. Please try again.', 'error');
    } finally {
      setIsGeneratingImage(false);
    }
  }

  // Debug: Track component lifecycle
  console.log('[App] ===== COMPONENT LIFECYCLE DEBUG =====');
  console.log('[App] Component function starting...');
  
  // Debug: Check if allCards has data immediately
  console.log('[App] ===== COMPONENT STARTUP DEBUG =====');
  console.log('[App] About to initialize state variables...');
  const [deck, deckDispatch] = useReducer(deckReducer, undefined, initialDeckState);
  const [filters, filterDispatch] = useReducer(filterReducer, undefined, initialFilterState);
  console.log('[App] Initial filters state:', filters);
  
  // Debug: Track when allCards is modified
  const [allCards, setAllCards] = useState([]);
  const [shownCards, setShownCards] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Debug: Create a custom setAllCards that logs when it's called
  const setAllCardsWithLogging = useCallback((cards) => {
    console.log('[App] ===== setAllCards CALLED =====');
    console.log('[App] Cards being set:', cards?.length || 0);
    if (cards && cards.length > 0) {
      console.log('[App] Sample cards being set:', cards.slice(0, 3).map(c => ({ name: c.name, id: c.id })));
      const cardsWithSubnames = cards.filter(card => card.name && card.name.includes(' - '));
      console.log('[App] Cards with subnames in new data:', cardsWithSubnames.length);
      if (cardsWithSubnames.length > 0) {
        console.log('[App] Sample subname cards in new data:', cardsWithSubnames.slice(0, 3).map(c => c.name));
      }
    }
    console.log('[App] ===== END setAllCards LOG =====');
    setAllCards(cards);
  }, []);
  
  // (Removed a large per-render debug block that filtered the full card catalog
  //  twice and parsed localStorage/sessionStorage on every render — see audit.)

  const [inspectCard, setInspectCard] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  // Mobile-only (below lg): a persistent two-tab bottom bar replaces the
  // "Present -> full-screen overlay" pattern. "cards" shows the existing
  // search/filter/grid UI (the default), "deck" shows a small header +
  // segmented control (Cards / Info) backed by DeckPresentationView's
  // mobileSection prop. Desktop ignores this entirely.
  const [mobileTab, setMobileTab] = useState('cards');
  const [mobileDeckSection, setMobileDeckSection] = useState('cards');
  const [hasActiveFilters, setHasActiveFilters] = useState(false);
  const [saveConfirmationOpen, setSaveConfirmationOpen] = useState(false);
  const [focusCardName, setFocusCardName] = useState('');

  // Enhanced deck management state
  const [decks, setDecks] = useState({});
  const [currentDeckId, setCurrentDeckId] = useState(null);
  const [showDeckManager, setShowDeckManager] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('decks') === 'open') {
      setShowDeckManager(true);
      setSearchParams({}, { replace: true });
    }
  }, []);

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

  console.log('[App] 📍 CHECKPOINT: About to define card loading useEffect...');
  
  // TEST: Simple useEffect to see if any useEffect works
  console.log('[App] 🧪 About to define TEST useEffect...');
  useEffect(() => {
    console.log('[App] 🧪 TEST useEffect is running!');
  }, []);
  
  // Load all cards on mount - FORCE reload if simplified cards detected
  console.log('[App] 🔧 About to define the main card loading useEffect...');
  
  // Wrap in try-catch to catch React errors
  try {
    useEffect(() => {
      console.log('[App] ===== CARD LOADING useEffect triggered =====');
      console.log('[App] 🔄 useEffect is running! allCards state:', allCards?.length || 0);
    
    // FIXED: Check if we already have cards with subnames OR subtitles in Name field
    if (allCards && allCards.length > 0) {
      const cardsWithSubnames = allCards.filter(hasSubtitleLike);
      console.log('[App] Existing cards with subnames/subtitles:', cardsWithSubnames.length);
      
      if (cardsWithSubnames.length > 0) {
        console.log('[App] ✅ Already have', cardsWithSubnames.length, 'cards with subnames/subtitles, skipping API call');
        setLoading(false);
        return;
      } else {
        console.log('[App] ⚠️  DETECTED SIMPLIFIED CARDS - No subnames/subtitles found in', allCards.length, 'cards');
        console.log('[App] 🔄 FORCING API RELOAD to get cards with subnames/subtitles...');
      }
    }
    
    const loadCards = async () => {
      try {
        console.log('[App] 📡 Calling fetchAllCards() to get cards with subnames...');
        const cards = await fetchAllCards();
        console.log('[App] ✅ fetchAllCards() returned:', cards?.length || 0, 'cards');
        
        if (cards && cards.length > 0) {
          // FIXED: Check what cards we actually got (subnames OR subtitles in Name)
          const cardsWithSubnames = cards.filter(hasSubtitleLike);
          console.log('[App] 🎯 Cards with subnames/subtitles loaded:', cardsWithSubnames.length);
          
          if (cardsWithSubnames.length > 0) {
            console.log('[App] ✅ SUCCESS! Sample subname/subtitle cards:', cardsWithSubnames.slice(0, 3).map(c => ({ 
              name: c.name, 
              subname: c.subname,
              hasSubtitle: c.name && c.name.includes(' - ')
            })));
            setAllCardsWithLogging(cards);
            setLoading(false);
          } else {
            console.log('[App] ❌ STILL NO SUBNAMES/SUBTITLES! Sample cards:', cards.slice(0, 3).map(c => ({ name: c.name, id: c.id })));
            // For now, use what we got but log the issue
            setAllCardsWithLogging(cards);
            setLoading(false);
          }
        } else {
          console.log('[App] ❌ fetchAllCards returned no cards');
          setLoading(false);
        }
      } catch (error) {
        console.error('[App] ❌ Error loading cards:', error);
        setLoading(false);
      }
    };
    
    loadCards();
  }, []); // Only run once on mount
  } catch (error) {
    console.error('[App] ❌ React error in useEffect definition:', error);
  }

  // Apply filters to cards
  useEffect(() => {
    console.log('[App] Filtering cards...');
    console.log('[App] allCards length:', allCards?.length);
    if (allCards && allCards.length > 0) {
      console.log('[App] allCards sample:', allCards.slice(0, 3).map(c => ({ name: c.name, id: c.id })));
      const cardsWithSubnames = allCards.filter(hasSubtitleLike);
      console.log('[App] Cards with subnames/subtitles found:', cardsWithSubnames.length);
      if (cardsWithSubnames.length > 0) {
        console.log('[App] Sample subname/subtitle cards:', cardsWithSubnames.slice(0, 5).map(c => c.name));
      }
    }
    
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

  // Keyboard shortcuts. The handlers are function declarations recreated every
  // render (each closing over the current deck/state), so we route through a ref
  // that is refreshed each render — the listener is bound once but always calls
  // the latest handler instead of the stale mount-time closure.
  const shortcutHandlersRef = useRef({});
  shortcutHandlersRef.current = { handleSaveDeck, handleNewDeck, handleImport, handleExport, handlePrint };
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey) {
        const h = shortcutHandlersRef.current;
        switch (e.key) {
          case 's':
            e.preventDefault();
            h.handleSaveDeck();
            break;
          case 'n':
            e.preventDefault();
            h.handleNewDeck();
            break;
          case 'o':
            e.preventDefault();
            h.handleImport();
            break;
          case 'e':
            e.preventDefault();
            h.handleExport();
            break;
          case 'p':
            e.preventDefault();
            h.handlePrint();
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
    
    // Removed duplicate window.getCurrentCards exposure - keeping only the one in the later useEffect
    
    return () => {
      delete window.checkCardFields;
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
  // Full, unfiltered catalog — used by import parsers so an active filter can't
  // hide deck-list cards. Re-bound with shownCards (derived from allCards), so
  // it tracks catalog changes and never goes stale.
  window.getAllCards = () => allCards || [];

  // Expose the text import function globally
  window.parseTextImport = parseTextImport;

  return () => {
    delete window.checkCardFields;
    delete window.getCurrentCards;
    delete window.getAllCards;
    delete window.parseTextImport;
  };
}, [shownCards, allCards]);

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

function handleSaveDeck(customDeckName = null) {
  try {
    // Ensure the current deck is saved to the decks collection
    if (deck && currentDeckId) {
      console.log('[handleSaveDeck] Saving deck:', deck);
      console.log('[handleSaveDeck] Current decks state:', decks);
      
      // Update the deck's timestamp and ensure it has the correct ID
      // Use the custom deck name if provided, otherwise keep the existing name
      const finalDeckName = customDeckName || deck.name || "Untitled Deck";
      const updatedDeck = { ...deck, id: currentDeckId, name: finalDeckName, updatedAt: Date.now() };
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
      
      // Update the current deck state if we used a custom name
      if (customDeckName && customDeckName !== deck.name) {
        deckDispatch({ type: "SET_NAME", name: customDeckName });
      }
      
      // Show save confirmation popup
      setSaveConfirmationOpen(true);
      
      addToast(`Deck "${finalDeckName}" saved successfully! It will now appear in your deck list.`, "success");
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
    // Use the database ID if available for updates
    const isUpdate = deckData._dbId || deckData._cloudId;
    const payload = {
      title: deckData.name,
      data: deckData,
    };
    
    // If this is an update, include the database ID
    if (isUpdate) {
      payload.id = deckData._dbId || deckData._cloudId;
    }
    
    console.log('[saveDeckToCloud] Saving deck:', deckData.id, 'isUpdate:', !!isUpdate, 'cloudId:', payload.id);
    
    const response = await authSafeFetch('/api/decks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const responseData = await response.json();
      console.log('[saveDeckToCloud] Deck saved to cloud successfully:', responseData);
      
      // Update the local deck with the database ID for future updates
      if (responseData.deck && responseData.deck.id) {
        console.log('[saveDeckToCloud] Updating local deck with database ID:', responseData.deck.id);
        
        // Update the deck in the local state with the database ID
        const updatedDeck = { 
          ...deckData, 
          _dbId: responseData.deck.id,
          _cloudId: responseData.deck.id
        };
        
        // Update the decks state with the new database ID
        const updatedDecks = { ...decks, [currentDeckId]: updatedDeck };
        setDecks(updatedDecks);
        
        // Save to localStorage with the updated database ID
        saveAllDecks(updatedDecks);
        
        // Update the current deck state if it's the same deck
        if (deck && deck.id === deckData.id) {
          deckDispatch({ type: "UPDATE_DECK", deck: updatedDeck });
        }
      }
    } else {
      console.warn('[saveDeckToCloud] Failed to save to cloud, but local save succeeded');
      addToast("Saved locally, but couldn't sync to the cloud. Your changes are on this device only.", "error", 5000);
    }
  } catch (error) {
    console.warn('[saveDeckToCloud] Cloud save failed, but local save succeeded:', error);
    addToast("Saved locally, but couldn't sync to the cloud. Your changes are on this device only.", "error", 5000);
  }
}

// Load decks from cloud database
async function loadDecksFromCloud() {
  try {
    console.log('[loadDecksFromCloud] Attempting to load decks from cloud...');
    console.log('[loadDecksFromCloud] Current user state:', { hasUser: !!user, userEmail: user?.email });
    
    // With cookie-based auth, we don't need to check for tokens
    // The authSafeFetch will handle authentication via cookies
    
    const response = await authSafeFetch('/api/decks', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const responseData = await response.json();
      console.log('[loadDecksFromCloud] Successfully loaded from cloud:', responseData);
      
      // Check if this is a skipped auth response
      if (responseData.skippedAuth) {
        console.log('[loadDecksFromCloud] Auth was skipped, returning null');
        return null;
      }
      
      // Extract decks array from response
      const cloudDecksArray = responseData.decks || [];
      console.log('[loadDecksFromCloud] Raw cloud decks array:', cloudDecksArray);
      
      // Convert cloud format to app format
      const convertedDecks = {};
      if (Array.isArray(cloudDecksArray)) {
        cloudDecksArray.forEach(cloudDeck => {
          console.log('[loadDecksFromCloud] Processing deck:', cloudDeck);
          if (cloudDeck.data && cloudDeck.data.id) {
            console.log('[loadDecksFromCloud] Converting deck:', cloudDeck.data.id, cloudDeck.title);
            // Use the unique database ID as the key to prevent duplicates from overwriting each other
            const deckData = { 
              ...cloudDeck.data, 
              _dbId: cloudDeck.id, // Store the database UUID for deletion
              _cloudId: cloudDeck.id, // Also store as _cloudId for clarity
              // Update the deck's ID to be the unique database ID to prevent conflicts
              id: cloudDeck.id
            };
            // Use the unique database ID as the key instead of the potentially duplicate frontend ID
            convertedDecks[cloudDeck.id] = deckData;
          } else {
            console.log('[loadDecksFromCloud] Skipping deck - missing data or id:', cloudDeck);
          }
        });
      }
      
      console.log('[loadDecksFromCloud] Converted cloud decks:', convertedDecks);
      console.log('[loadDecksFromCloud] Found', Object.keys(convertedDecks).length, 'decks');
      return convertedDecks;
    } else {
      console.warn('[loadDecksFromCloud] Cloud response not ok:', response.status);
      return null;
    }
  } catch (error) {
    if (error.message.includes('Authentication required')) {
      console.log('[loadDecksFromCloud] No auth token, skipping cloud load');
    } else {
      console.warn('[loadDecksFromCloud] Failed to load from cloud:', error);
    }
    return null;
  }
}

// Helper function to generate a signature for deck content (for duplicate detection)
function getDeckContentSignature(deck) {
  if (!deck || !deck.entries) return null;
  
  // Create a sorted signature of the deck's card content
  const cardSignatures = Object.entries(deck.entries)
    .map(([cardId, entry]) => `${cardId}:${entry.count}`)
    .sort()
    .join('|');
  
  return cardSignatures;
}

// Helper function to detect content-based duplicates
function findContentDuplicates(decks) {
  const signatureMap = new Map();
  const duplicates = [];
  
  Object.entries(decks).forEach(([deckId, deck]) => {
    const signature = getDeckContentSignature(deck);
    if (signature) {
      if (signatureMap.has(signature)) {
        const originalDeckId = signatureMap.get(signature);
        duplicates.push({
          originalId: originalDeckId,
          originalDeck: decks[originalDeckId],
          duplicateId: deckId,
          duplicateDeck: deck
        });
      } else {
        signatureMap.set(signature, deckId);
      }
    }
  });
  
  return duplicates;
}

// Sync decks between cloud and local storage
async function syncDecksWithCloud() {
  try {
    console.log('[syncDecksWithCloud] Starting cloud sync...');
    
    // Load from cloud first
    const cloudDecks = await loadDecksFromCloud();
    console.log('[syncDecksWithCloud] Cloud decks received:', cloudDecks);
    
    if (cloudDecks && Object.keys(cloudDecks).length > 0) {
      // Load local decks
      const localDecks = loadLS(LS_KEYS.DECKS, {});
      console.log('[syncDecksWithCloud] Local decks:', localDecks);
      
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
      
      // Check for content-based duplicates and resolve them
      const duplicates = findContentDuplicates(mergedDecks);
      console.log('[syncDecksWithCloud] Found content duplicates:', duplicates.length);
      
      duplicates.forEach(({ originalId, originalDeck, duplicateId, duplicateDeck }) => {
        console.log(`[syncDecksWithCloud] Resolving duplicate: "${originalDeck.name}" (${originalId}) vs "${duplicateDeck.name}" (${duplicateId})`);
        
        // Keep the deck with the cloud database ID (has _dbId) or the most recently updated one
        const keepOriginal = originalDeck._dbId || (originalDeck.updatedAt >= duplicateDeck.updatedAt);
        
        if (keepOriginal) {
          console.log(`[syncDecksWithCloud] Keeping original deck: ${originalDeck.name}`);
          delete mergedDecks[duplicateId];
        } else {
          console.log(`[syncDecksWithCloud] Keeping duplicate deck: ${duplicateDeck.name}`);
          delete mergedDecks[originalId];
        }
      });
      
      // Save merged result to localStorage
      saveAllDecks(mergedDecks);
      
      console.log('[syncDecksWithCloud] Cloud sync completed, merged decks:', mergedDecks);
      return mergedDecks;
    } else {
      console.log('[syncDecksWithCloud] No cloud decks found or cloud sync failed');
    }
    
    return null;
  } catch (error) {
    console.error('[syncDecksWithCloud] Error during cloud sync:', error);
    return null;
  }
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
  setCurrentDeckId(deckToSwitch.id);
  deckDispatch({ type: "SWITCH_DECK", deck: deckToSwitch });
  addToast(`Switched to deck: "${deckToSwitch.name}"`, "success");
}

async function handleDeleteDeck(deckId) {
  const deckToDelete = decks[deckId];
  
  try {
    // Delete from cloud first if authenticated
    if (user) {
      try {
        // Use the database ID for deletion if available, otherwise use the deck ID
        const cloudId = deckToDelete?._dbId || deckToDelete?._cloudId || deckId;
        console.log('[handleDeleteDeck] Attempting to delete from cloud:', deckId, 'using cloudId:', cloudId);
        
        const response = await authSafeFetch(`/api/decks/${cloudId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          console.log('[handleDeleteDeck] Successfully deleted from cloud');
        } else {
          console.error('[handleDeleteDeck] Cloud deletion failed with status:', response.status);
          const errorText = await response.text().catch(() => 'Unknown error');
          console.error('[handleDeleteDeck] Error response:', errorText);
          addToast("Warning: Failed to delete deck from cloud. Deck deleted locally only.", "warning");
        }
      } catch (cloudError) {
        if (cloudError.message.includes('Authentication required')) {
          console.warn('[handleDeleteDeck] Authentication failed for cloud deletion - user may need to log in again');
          addToast("Warning: Could not delete from cloud - please log in again", "warning");
        } else {
          console.error('[handleDeleteDeck] Cloud deletion failed but continuing with local deletion:', cloudError);
          addToast("Warning: Failed to delete deck from cloud. Deck deleted locally only.", "warning");
        }
      }
    }
    
    // Delete from local storage
    const updatedDecks = deleteDeck(decks, deckId);
    setDecks(updatedDecks);
    
    // If we're deleting the current deck, switch to another deck or create a new one
    if (deckId === currentDeckId) {
      if (Object.keys(updatedDecks).length > 0) {
        // Switch to the first available deck
        const firstDeckId = Object.keys(updatedDecks)[0];
        setCurrentDeckId(firstDeckId);
        deckDispatch({ type: "SWITCH_DECK", deck: updatedDecks[firstDeckId] });
        saveCurrentDeckId(firstDeckId);
      } else {
        // Create a new empty deck
        const newDeck = createNewDeck("Untitled Deck");
        setCurrentDeckId(newDeck.id);
        deckDispatch({ type: "SWITCH_DECK", deck: newDeck });
        saveCurrentDeckId(newDeck.id);
      }
    }
    
    addToast(`Deleted deck: "${deckToDelete.name}"`, "success");
  } catch (error) {
    console.error('[handleDeleteDeck] Error deleting deck:', error);
    addToast(`Failed to delete deck: "${deckToDelete.name}"`, "error");
  }
}

function handleRenameDeck(deckId, newName) {
  const updatedDecks = updateDeckMetadata(decks, deckId, { name: newName });
  setDecks(updatedDecks);
  const updatedDeck = updatedDecks[deckId];
  if (updatedDeck) saveDeckToCloud(updatedDeck);
  addToast(`Renamed deck to "${newName}"`, "success");
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

async function handleRefreshDecks() {
  try {
    console.log('[handleRefreshDecks] Starting deck refresh...');
    console.log('[handleRefreshDecks] Auth state:', { user: !!user, authLoading, userEmail: user?.email });
    
    // Try cloud sync first if authenticated
    if (user) {
      try {
        const syncedDecks = await syncDecksWithCloud();
        if (syncedDecks && Object.keys(syncedDecks).length > 0) {
          console.log('[handleRefreshDecks] Cloud sync successful, got', Object.keys(syncedDecks).length, 'decks');
          setDecks(syncedDecks);
          addToast(`Refreshed ${Object.keys(syncedDecks).length} decks from cloud`, "success");
          return;
        }
      } catch (cloudError) {
        if (cloudError.message.includes('Authentication required')) {
          console.warn('[handleRefreshDecks] Authentication failed - user may need to log in again');
          addToast("Authentication expired. Please log in again to access cloud decks.", "warning");
        } else {
          console.error('[handleRefreshDecks] Cloud sync failed:', cloudError);
          addToast("Failed to sync with cloud, using local decks", "warning");
        }
      }
    }
    
    // Fall back to local storage
    const { decks: localDecks } = loadAllDecks();
    console.log('[handleRefreshDecks] Local decks found:', Object.keys(localDecks).length);
    if (Object.keys(localDecks).length > 0) {
      setDecks(localDecks);
      if (user) {
        addToast(`Refreshed ${Object.keys(localDecks).length} decks from local storage (cloud sync failed)`, "warning");
      } else {
        addToast(`Refreshed ${Object.keys(localDecks).length} decks from local storage`, "success");
      }
    } else {
      if (user) {
        addToast("No decks found locally or in cloud. Please check your connection and try logging in again.", "info");
      } else {
        addToast("No decks found. Please log in to access your saved decks.", "info");
      }
    }
  } catch (error) {
    console.error('[handleRefreshDecks] Error refreshing decks:', error);
    addToast("Failed to refresh decks", "error");
  }
}

// Initialize deck management system with cloud sync
useEffect(() => {
  console.log('[App] 🚀 DECK INITIALIZATION useEffect triggered!');
  console.log('[App] 🚀 useEffect is actually running!');
  console.log('[App] 🚀 Auth state:', { user: !!user, authLoading });
  
  // Don't run if auth is still loading
  if (authLoading) {
    console.log('[App] Auth still loading, skipping deck initialization...');
    return;
  }
  
  // Log what triggered this useEffect
  console.log('[App] 🔄 Deck initialization triggered by auth state change:', { 
    userExists: !!user, 
    userEmail: user?.email, 
    authLoading,
    currentDecksCount: Object.keys(decks || {}).length
  });
  
  const initializeDecks = async () => {
    try {
      console.log('[App] Starting deck initialization with cloud sync...');
      
      // First try to sync with cloud if user is authenticated
      let syncedDecks = null;
      if (user) {
        console.log('[App] User authenticated, attempting cloud sync...');
        syncedDecks = await syncDecksWithCloud();
        console.log('[App] Cloud sync result:', syncedDecks);
      } else {
        console.log('[App] User not authenticated, skipping cloud sync');
      }
      
      // Fall back to local storage if cloud sync fails or user not authenticated
      const { decks: localDecks, currentDeckId: localCurrentDeckId } = loadAllDecks();
      console.log('[App] Local decks:', localDecks);
      console.log('[App] Local currentDeckId:', localCurrentDeckId);
      
      // Use synced decks if available, otherwise use local
      const finalDecks = syncedDecks || localDecks;
      const finalCurrentDeckId = localCurrentDeckId;
      
      console.log('[App] Initialization - finalDecks:', finalDecks);
      console.log('[App] Initialization - finalCurrentDeckId:', finalCurrentDeckId);
      
      // Only load decks that have been explicitly saved (have a valid updatedAt timestamp)
      const savedDecks = {};
      Object.entries(finalDecks).forEach(([id, deck]) => {
        console.log('[App] Processing deck:', { id, deckId: deck.id, deckName: deck.name, hasId: !!deck.id, updatedAt: deck.updatedAt });
        if (deck.updatedAt && deck.updatedAt > 0) {
          // Ensure the deck has the correct ID
          const deckWithId = { ...deck, id: id };
          savedDecks[id] = deckWithId;
          console.log('[App] Added deck to savedDecks:', { id, deckId: deckWithId.id, deckName: deckWithId.name });
        } else {
          console.log('[App] Skipping deck (no updatedAt):', { id, deckName: deck.name });
        }
      });
      
      console.log('[App] Final savedDecks:', savedDecks);
      console.log('[App] Number of saved decks:', Object.keys(savedDecks).length);
      setDecks(savedDecks);
      
      // Only set current deck if it was explicitly saved
      if (finalCurrentDeckId && savedDecks[finalCurrentDeckId]) {
        console.log('[App] Setting current deck from saved decks:', finalCurrentDeckId);
        setCurrentDeckId(finalCurrentDeckId);
        deckDispatch({ type: "SWITCH_DECK", deck: savedDecks[finalCurrentDeckId] });
      } else {
        // Create a new empty deck if no saved deck exists - but don't add it to decks collection
        console.log('[App] Creating new empty deck');
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
}, [user, authLoading]);

// Deck initialization handled by useEffect above with proper auth dependency

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
        <div className="flex flex-col min-h-screen overflow-x-clip bg-[color:var(--canvas)] text-gray-100">
          {/* Card search/filter toolbar — below lg this belongs to the mobile
              "Cards" tab; hidden entirely on the "Deck" tab so switching tabs
              is a clean swap instead of just hiding the grid under a toolbar. */}
          <div className={`${mobileTab === 'cards' ? 'block' : 'hidden'} lg:block`}>
          {/* Top Bar */}
          <TopBar
            key={`topbar-${filters?._resetTimestamp ?? "init"}`}
            onResetDeck={handleResetDeck}
            onExport={handleExport}
            onImport={handleImport}
            onPrint={handlePrint}
            onSaveDeck={handleSaveDeck}
            onToggleFilters={() => filterDispatch({ type: "TOGGLE_PANEL" })}
            searchText={filters?.text || ""}
            onSearchChange={(text) => filterDispatch({ type: "SET_TEXT", text })}
            onNewDeck={handleNewDeck}
            onDeckManager={() => setShowDeckManager(true)}
          />

          {/* Essential Quick Filters */}
          <div className="px-4 py-2.5 bg-[#0c0f17]/80 border-b border-white/10 sticky top-0 sm:top-16 z-30 backdrop-blur">
  <div className="flex flex-wrap items-center gap-4">
    <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Filter</div>

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
          className="w-4 h-4 accent-violet-500 rounded"
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
          className="w-4 h-4 accent-violet-500 rounded"
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
                ? "bg-gradient-to-b from-violet-500 to-indigo-500 text-white shadow-[0_2px_10px_-2px_rgba(139,108,255,0.7)]"
                : "bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10"
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
                ? "bg-gradient-to-b from-violet-500 to-indigo-500 text-white shadow-[0_2px_10px_-2px_rgba(139,108,255,0.7)]"
                : "bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10"
            }`}
          >
            {ink}
          </button>
        ))}
      </div>
    </div>

    {/* Legality Filter */}
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-300">Legality:</span>
      <select
        value={filters?.gamemode || ""}
        onChange={(e) => filterDispatch({ type: "SET_GAMEMODE", value: e.target.value })}
        className="px-2 py-1 bg-white/5 border border-white/10 rounded text-sm text-gray-200 focus:ring-violet-500 focus:ring-2"
      >
        <option value="">Any</option>
        <option value="Core Constructed">Core Constructed</option>
        <option value="Infinity">Infinity</option>
      </select>
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

{/* Floating Filter Button — desktop only. Below lg this duplicates the
    "Filters" button already in the toolbar, and its fixed position collides
    with the mobile Cards/Deck bottom tab bar. */}
<div className="hidden lg:block fixed bottom-6 right-6 z-50">
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
    className="p-3 bg-white/[0.02] border-b border-white/10"
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
          Legality: {filters.gamemode}
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
          </div>

{/* Main content area with sticky deck panel */}
<div key={`main-content-${filters?._resetTimestamp ?? "init"}`} className="flex relative">
  {/* Card grid - takes remaining space. Below lg, this is the "Cards" tab of
      the mobile bottom tab bar (see the tab bar + "Deck" tab content further
      down); on lg+ it's always shown alongside the docked deck panels. */}
  <div className={`flex-1 lg:pr-4 pb-24 lg:pb-0 ${mobileTab === 'cards' ? 'block' : 'hidden'} lg:block`}>
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
        onInspect={setInspectCard}
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

  {/* Sticky Deck Panel - own fixed-height scroll region below the header, so
      scrolling the card grid on the left no longer scrolls this list too. */}
  <div className="hidden lg:block w-96 flex-shrink-0">
    <div className="sticky top-16 border-l border-white/10 bg-gray-950/95 backdrop-blur-sm h-[calc(100vh-4rem)] overflow-y-auto">
      <DeckPanel
        deck={deck}
        onSetCount={handleSetCount}
        onRemove={handleRemove}
        onExport={() => setExportOpen(true)}
        onImport={() => setImportOpen(true)}
      />
      <DeckStatistics
        entries={Object.values(deck?.entries || {}).filter(e => e.count > 0)}
        focusCardName={focusCardName || ""}
      />
      <div className={`p-3 ${deckValid ? "text-emerald-300" : "text-red-300"}`}>
        {deckValid
          ? "Deck is valid."
          : `Deck must be between ${DECK_RULES.MIN_SIZE} and ${DECK_RULES.MAX_SIZE} cards.`}
      </div>
    </div>
  </div>

</div>

{/* Mobile "Deck" tab — dreamborn-style persistent tab switch, not a modal/
    overlay. Shown only when the bottom tab bar's "Deck" tab is active; the
    "Cards" tab is the card-grid column above (already mobile-optimized).
    Header (name/count/ink) + a Cards/Info segmented control, backed by
    DeckPresentationView's mobileSection prop so the cards-by-type grid and
    the stats/tips/action-buttons aren't duplicated here. */}
{mobileTab === 'deck' && (
  <div className="lg:hidden fixed inset-0 top-16 bottom-14 z-30 bg-gray-950 flex flex-col overflow-hidden">
    <div className="px-4 py-3 border-b border-white/10 shrink-0 bg-gray-950/95 backdrop-blur-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-gray-200 truncate">
          {deck?.name || "Untitled Deck"}
        </span>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {Object.values(deck?.entries || {}).filter((e) => e.count > 0).reduce((sum, e) => sum + e.count, 0)}/{DECK_RULES.MAX_SIZE} cards
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
        <button
          type="button"
          onClick={() => setMobileDeckSection('cards')}
          className={`py-1.5 rounded-md text-sm font-medium transition ${
            mobileDeckSection === 'cards'
              ? "bg-gradient-to-b from-violet-500 to-indigo-500 text-white shadow-[0_2px_10px_-2px_rgba(139,108,255,0.7)]"
              : "text-gray-300 hover:bg-white/5"
          }`}
        >
          Cards
        </button>
        <button
          type="button"
          onClick={() => setMobileDeckSection('info')}
          className={`py-1.5 rounded-md text-sm font-medium transition ${
            mobileDeckSection === 'info'
              ? "bg-gradient-to-b from-violet-500 to-indigo-500 text-white shadow-[0_2px_10px_-2px_rgba(139,108,255,0.7)]"
              : "text-gray-300 hover:bg-white/5"
          }`}
        >
          Info
        </button>
      </div>
    </div>
    <div className="flex-1 overflow-y-auto p-3">
      <DeckPresentationView
        deck={deck}
        allCards={allCards}
        onSave={handleSaveDeck}
        onGenerateImage={generateDeckImage}
        toast={addToast}
        mobileSection={mobileDeckSection}
        onAdjustCount={(card, delta) => handleAdd(card, delta)}
      />
    </div>
  </div>
)}

{/* Mobile bottom tab bar — persistent "Cards" / "Deck" switch (dreamborn-
    style) replacing the old "Present" button + full-screen overlay pattern.
    "Deck" shows a live card-count badge. Desktop is unaffected (lg:hidden). */}
<div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-gray-950/95 backdrop-blur-sm border-t border-white/10 grid grid-cols-2">
  <button
    type="button"
    onClick={() => setMobileTab('cards')}
    className={`flex items-center justify-center gap-2 text-sm font-semibold transition ${
      mobileTab === 'cards' ? "text-white bg-white/5" : "text-gray-400"
    }`}
  >
    Cards
  </button>
  <button
    type="button"
    onClick={() => setMobileTab('deck')}
    className={`flex items-center justify-center gap-2 text-sm font-semibold transition border-l border-white/10 ${
      mobileTab === 'deck' ? "text-white bg-white/5" : "text-gray-400"
    }`}
  >
    Deck
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
      deckValid ? "text-emerald-300 bg-emerald-500/15 border border-emerald-400/30" : "text-gray-300 bg-white/10 border border-white/10"
    }`}>
      {Object.values(deck?.entries || {}).filter((e) => e.count > 0).reduce((sum, e) => sum + e.count, 0)}
    </span>
  </button>
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

{/* Deck Presentation now renders as a docked panel next to the card grid
    (see the "Docked Deck Presentation panel" block above) instead of a
    blocking modal, so there's no popup to mount here anymore. */}

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
          className="px-6 py-3 bg-violet-600 hover:bg-violet-700 rounded-lg font-semibold transition-colors"
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
  onRefreshDecks={handleRefreshDecks}
  onRenameDeck={handleRenameDeck}
/>

        </>
      </div>
);
} // End AppInner function

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

  // Apply legality filter using set-based logic (same approach as sets filter)
  if (filters.gamemode && filters.gamemode.trim()) {
    console.log(`[Legality Filter] Applying ${filters.gamemode} filter`);
    
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
          console.log(`[Legality Filter] Card "${c.name}" has unknown set number, allowing through`);
          return true;
        }
        
        if (allowedSetNums.has(setNum)) {
          return true; // Allow sets 5+
        } else {
          console.log(`[Legality Filter] Excluding card "${c.name}" from set ${setNum} (not allowed in Core Constructed)`);
          return false;
        }
      });
      
      console.log(`[Legality Filter] After Core Constructed filtering, cards remaining: ${list.length}`);
    }
    // Infinity mode: no filtering needed, show all cards
    else if (filters.gamemode === "Infinity") {
      console.log('[Legality Filter] Infinity mode selected - showing all cards');
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
  
  const loadImagesInBatch = async (cards, onProgress) => {
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
    
  };
  
  return { loadImagesInBatch };
}

// -----------------------------------------------------------------------------
// End of file
// -----------------------------------------------------------------------------





// --- Wrapper to ensure ImageCache is available everywhere ---
export default function App(props) {
  return (
    <ImageCacheProvider>
      <AppInner {...props} />
    </ImageCacheProvider>
  );
}
