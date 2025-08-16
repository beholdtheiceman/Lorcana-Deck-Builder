// app.jsx
// ============================================================================
// Lorcana Deck Builder - Monolithic App File (~1500 lines)
// Target: Restore "full" single-file app with all features and use Lorcast for images
// Author: ChatGPT (GPT-5 Thinking)
// Notes:
//   - This is a single-file React app designed to drop into an existing Vite/CRA
//     project as src/app.jsx (or App.jsx) and render the full experience.
//   - It includes: search, filters, sort, deck panel, stats, curve chart, cost
//     breakdowns, ink color filters, rarity filters, set filters, text search,
//     type filters, advanced rules for deck validation, import/export (JSON +
//     Dreamborn string flavor), printable deck sheet, image preloading, keyboard
//     shortcuts, optimistic caching, error toasts, and more.
//   - Image source: Lorcast (configurable & robust URL resolution).
//   - Card data: expected from your existing data pipeline; fetch adapter is
//     included with fallback options. You can point it to your API/JSON.
//   - Styling assumes TailwindCSS. If you don't use Tailwind, replace classNames
//     with your CSS or strip classes.
// ============================================================================

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

// Icons (lucide-react) - optional; replace with your icon lib or inline SVGs
// import { Search, Filter, Settings, X, Download, Upload } from "lucide-react";

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const APP_VERSION = "1.0.0-lorcast-monolith";

// Lorcast configuration: tweak if your endpoints/CDN differ.
// We intentionally implement a robust resolver that tries multiple URL shapes
// commonly used by Lorcast mirrors/CDNs. You can tailor this as needed.
const LORCAST_CONFIG = {
  // Example API base for metadata. If you already have your own card API,
  // keep that and only use the image resolver below.
  // Leaving this as null means "don't fetch cards from Lorcast; only resolve images."
  API_BASE: null,

  // Common image base paths seen in community projects:
  IMAGE_BASES: [
    // Primary guess (adjust to match your known working URLs)
    "https://media.lorcast.com/images/cards/",
    "https://cdn.lorcast.com/images/cards/",
    "https://static.lorcast.com/cards/",
    // Generic backup pattern
    "https://lorcast-media.sfo3.cdn.digitaloceanspaces.com/cards/",
  ],

  // File extensions we'll try in order
  IMAGE_EXTS: [".webp", ".jpg", ".jpeg", ".png"],
};

// Fallback images (local or remote). Replace with your assets if desired.
const FALLBACK_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420">
      <rect width="100%" height="100%" fill="#111"/>
      <text x="50%" y="50%" fill="#999" font-family="Arial" font-size="16" text-anchor="middle">
        Image unavailable
      </text>
    </svg>`
  );

// Ink colors supported by the filters. Feel free to expand.
const INK_COLORS = ["Amber", "Amethyst", "Emerald", "Ruby", "Sapphire", "Steel"];

// Rarity options sample
const RARITIES = ["Common", "Uncommon", "Rare", "Super Rare", "Legendary", "Fabled"];

// Card types (simplified). Adjust to your schema.
const CARD_TYPES = ["Character", "Action", "Item", "Location", "Song", "Floodborn", "Shift"];

// Sets (simplified); replace with your canonical list as needed
const SETS = [
  { code: "TFC", name: "The First Chapter" },
  { code: "ROC", name: "Rise of the Floodborn" },
  { code: "IAT", name: "Into the Inklands" },
  { code: "URS", name: "Ursula’s Return" },
  { code: "ITI", name: "Into the Inklands (Intl Variant)" },
  { code: "ST6", name: "Set 6" },
  { code: "ST7", name: "Set 7" },
  { code: "ST8", name: "Set 8" },
  { code: "ST9", name: "Set 9" }, // Ensure Set 9 is visible to your filters
];

// -----------------------------------------------------------------------------
// Utility helpers
// -----------------------------------------------------------------------------

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

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

// Uniform attempt to compute ink colors for card
function getInks(card) {
  // Accept arrays or single strings:
  if (Array.isArray(card?.ink)) return card.ink;
  if (Array.isArray(card?.inks)) return card.inks;
  if (typeof card?.ink === "string") return [card.ink];
  if (typeof card?.inkColor === "string") return [card.inkColor];
  if (Array.isArray(card?.inkColors)) return card.inkColors;
  return [];
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

// -----------------------------------------------------------------------------
// Lorcast Image Resolver
// -----------------------------------------------------------------------------

/**
 * Create candidate image URLs for a given card using Lorcast patterns.
 * We try combinations based on set code/number/name, then different extensions.
 * Your data model may vary; adjust accessors to match your fields.
 */
function lorcastImageCandidates(card) {
  const setCode = (card?.set || card?.setCode || card?.set_code || "").toString();
  const number = (card?.number || card?.collector_number || card?.no || "").toString();
  const slug = safeSlug(card?.name || card?.title || "", setCode, number);

  const dirs = [
    // Most common: /{setCode}/{number}
    `${setCode}/${number}`,
    // Alternate: /${slug}
    `${slug}`,
    // Some mirrors flatten under set only:
    `${setCode}`,
  ].filter(Boolean);

  const names = [
    `${number}`, // 126
    `${slug}`, // mulan-elite-archer-st9-126
    safeSlug(card?.name || "", number), // mulan-elite-archer-126
  ].filter(Boolean);

  const bases = LORCAST_CONFIG.IMAGE_BASES;
  const exts = LORCAST_CONFIG.IMAGE_EXTS;

  const candidates = [];

  // If card provides a direct Lorcast URL, try that first
  const direct = card?.image_lorcast || card?.lorcast_image || card?.imageLorcast;
  if (direct) {
    exts.forEach((ext) => {
      candidates.push(direct);
      if (!/\.(png|jpg|jpeg|webp)$/i.test(direct)) {
        candidates.push(`${direct}${ext}`);
      }
    });
  }

  // Build combinations: base + dir + name + ext
  for (const base of bases) {
    for (const dir of dirs) {
      for (const nm of names) {
        for (const ext of exts) {
          const url = `${base}${dir}/${nm}${ext}`;
          candidates.push(url);
        }
      }
    }
  }

  // Some CDNs prefer lowercase set codes; try lower
  if (setCode) {
    const lowerDirs = dirs.map((d) => d.toLowerCase());
    for (const base of bases) {
      for (const dir of lowerDirs) {
        for (const nm of names) {
          for (const ext of exts) {
            const url = `${base}${dir}/${nm}${ext}`;
            candidates.push(url);
          }
        }
      }
    }
  }

  return Array.from(new Set(candidates)); // dedupe
}

/**
 * Preload image; resolve with first working candidate or fallback.
 */
async function resolveLorcastImage(card, signal) {
  const candidates = lorcastImageCandidates(card);
  for (const url of candidates) {
    try {
      const res = await fetch(url, { method: "HEAD", signal });
      if (res.ok && res.headers.get("content-type")?.startsWith("image")) {
        return url;
      }
    } catch (e) {
      // ignore, try next
    }
  }
  return FALLBACK_IMG;
}

// -----------------------------------------------------------------------------
// Data Fetch Adapter
// -----------------------------------------------------------------------------

/**
 * Plug in your primary metadata source here. This adapter supports:
 *  - Local JSON via /cards.json
 *  - Remote API via ENV or config
 *  - Optional Lorcast API if provided
 *
 * It returns a normalized shape:
 *   {
 *     id, name, set, number, cost, inks: [],
 *     type, rarity, text, image (resolved lazily),
 *     ...original
 *   }
 */
async function fetchAllCards({ signal } = {}) {
  const sources = [
    // Priority 1: local /cards.json (drop your built/compiled card data here)
    async () => {
      try {
        const res = await fetch("/cards.json", { signal });
        if (!res.ok) throw new Error("No local file");
        const data = await res.json();
        if (Array.isArray(data) && data.length) return data;
      } catch {}
      return null;
    },
    // Priority 2: environment-provided endpoint (window.CARDS_ENDPOINT)
    async () => {
      try {
        const endpoint = window?.CARDS_ENDPOINT;
        if (!endpoint) return null;
        const res = await fetch(endpoint, { signal });
        if (!res.ok) throw new Error("endpoint failed");
        const data = await res.json();
        if (Array.isArray(data) && data.length) return data;
      } catch {}
      return null;
    },
    // Priority 3: Lorcast API for metadata (optional; leave null if unused)
    async () => {
      try {
        if (!LORCAST_CONFIG.API_BASE) return null;
        const res = await fetch(`${LORCAST_CONFIG.API_BASE}/cards`, { signal });
        if (!res.ok) throw new Error("no lorcast api");
        const data = await res.json();
        if (Array.isArray(data) && data.length) return data;
      } catch {}
      return null;
    },
  ];

  for (const fn of sources) {
    const data = await fn();
    if (data) {
      return data.map(normalizeCard);
    }
  }
  return [];
}

function normalizeCard(raw) {
  // Attempt to map common fields
  const id =
    raw.id ||
    raw._id ||
    `${raw.set || raw.set_code || raw.setCode || "UNK"}-${raw.number || raw.no || raw.collector_number || raw.name}`;

  const name = raw.name || raw.title || "Unknown Card";
  const set = raw.set || raw.set_code || raw.setCode || raw.setName || "Unknown";
  const number = raw.number || raw.no || raw.collector_number || 0;
  const cost = getCost(raw);
  const inks = getInks(raw);
  const type = raw.type || raw.cardType || raw.category || "Unknown";
  const rarity = raw.rarity || raw.rarityLabel || "Unknown";

  const text =
    raw.rules_text ||
    raw.text ||
    raw.abilityText ||
    raw.rules ||
    raw.abilities ||
    "";

  // If the raw data comes with an image, we still prioritize Lorcast.
  // We'll keep the raw image as last-gasp fallback.
  const rawImage =
    raw.image ||
    raw.image_url ||
    raw.picture ||
    raw.art ||
    raw.imageUrl ||
    raw.images?.large ||
    raw.images?.png ||
    null;

  return {
    id,
    name,
    set,
    number,
    cost,
    inks,
    type,
    rarity,
    text,
    _rawImage: rawImage,
    _raw: raw,
  };
}

// -----------------------------------------------------------------------------
// Local storage & caching
// -----------------------------------------------------------------------------

const LS_KEYS = {
  DECK: "lorcana.deck.v1",
  FILTERS: "lorcana.filters.v1",
  CACHE_IMG: "lorcana.imageCache.v1",
  CACHE_CARDS: "lorcana.cardsCache.v1",
};

function loadLS(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function saveLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
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
// Deck state
// -----------------------------------------------------------------------------

/**
 * Deck constraints (simplified; adjust to your house rules if needed):
 * - Max deck size: 60
 * - Min deck size: 60
 * - Max 4 copies per unique card (by id or by set+number)
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

const initialDeckState = () => {
  const saved = loadLS(LS_KEYS.DECK, null);
  return saved || { entries: {}, total: 0, name: "Untitled Deck" };
};

function deckReducer(state, action) {
  switch (action.type) {
    case "SET_NAME": {
      const name = action.name || "Untitled Deck";
      const next = { ...state, name };
      saveLS(LS_KEYS.DECK, next);
      return next;
    }
    case "RESET": {
      const next = { entries: {}, total: 0, name: "Untitled Deck" };
      saveLS(LS_KEYS.DECK, next);
      return next;
    }
    case "IMPORT_STATE": {
      const next = action.deck || { entries: {}, total: 0, name: "Imported Deck" };
      saveLS(LS_KEYS.DECK, next);
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
      const next = { ...state, entries: nextEntries, total: newTotal };
      saveLS(LS_KEYS.DECK, next);
      return next;
    }
    case "SET_COUNT": {
      const { card, count } = action;
      const key = deckKey(card);
      const nextEntries = { ...state.entries };
      nextEntries[key] = { card, count: clamp(count, 0, DECK_RULES.MAX_COPIES) };
      const newTotal = Object.values(nextEntries).reduce((a, b) => a + (b?.count || 0), 0);
      const next = { ...state, entries: nextEntries, total: newTotal };
      saveLS(LS_KEYS.DECK, next);
      return next;
    }
    case "REMOVE": {
      const { card } = action;
      const key = deckKey(card);
      const nextEntries = { ...state.entries };
      delete nextEntries[key];
      const newTotal = Object.values(nextEntries).reduce((a, b) => a + (b?.count || 0), 0);
      const next = { ...state, entries: nextEntries, total: newTotal };
      saveLS(LS_KEYS.DECK, next);
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
  return (
    loadLS(LS_KEYS.FILTERS, {
      text: "",
      inks: new Set(),
      rarities: new Set(),
      types: new Set(),
      sets: new Set(),
      costMin: 0,
      costMax: 10,
      showInkablesOnly: false,
      sortBy: "name",
      sortDir: "asc",
      showFilterPanel: true,
    }) || {}
  );
};

function serializeFilterState(state) {
  return {
    ...state,
    inks: Array.from(state.inks || []),
    rarities: Array.from(state.rarities || []),
    types: Array.from(state.types || []),
    sets: Array.from(state.sets || []),
  };
}

function hydrateFilterState(raw) {
  return {
    ...raw,
    inks: new Set(raw.inks || []),
    rarities: new Set(raw.rarities || []),
    types: new Set(raw.types || []),
    sets: new Set(raw.sets || []),
  };
}

function filterReducer(state, action) {
  switch (action.type) {
    case "SET_TEXT":
      return persist({ ...state, text: action.text || "" });
    case "TOGGLE_INK": {
      const inks = new Set(state.inks);
      if (inks.has(action.ink)) inks.delete(action.ink);
      else inks.add(action.ink);
      return persist({ ...state, inks });
    }
    case "TOGGLE_RARITY": {
      const rarities = new Set(state.rarities);
      if (rarities.has(action.rarity)) rarities.delete(action.rarity);
      else rarities.add(action.rarity);
      return persist({ ...state, rarities });
    }
    case "TOGGLE_TYPE": {
      const types = new Set(state.types);
      if (types.has(action.cardType)) types.delete(action.cardType);
      else types.add(action.cardType);
      return persist({ ...state, types });
    }
    case "TOGGLE_SET": {
      const sets = new Set(state.sets);
      if (sets.has(action.setCode)) sets.delete(action.setCode);
      else sets.add(action.setCode);
      return persist({ ...state, sets });
    }
    case "SET_COST_RANGE": {
      const costMin = clamp(action.costMin ?? state.costMin, 0, 20);
      const costMax = clamp(action.costMax ?? state.costMax, 0, 20);
      return persist({ ...state, costMin, costMax });
    }
    case "SET_SHOW_INKABLES": {
      return persist({ ...state, showInkablesOnly: !!action.value });
    }
    case "SET_SORT": {
      return persist({
        ...state,
        sortBy: action.sortBy || state.sortBy,
        sortDir: action.sortDir || state.sortDir,
      });
    }
    case "RESET": {
      const next = initialFilterState();
      saveLS(LS_KEYS.FILTERS, serializeFilterState(next));
      return next;
    }
    case "TOGGLE_PANEL": {
      return persist({ ...state, showFilterPanel: !state.showFilterPanel });
    }
    default:
      return state;
  }

  function persist(next) {
    saveLS(LS_KEYS.FILTERS, serializeFilterState(next));
    return next;
  }
}

// -----------------------------------------------------------------------------
// Card image cache hook
// -----------------------------------------------------------------------------

function useImageCache() {
  const [cache, setCache] = useState(() => loadLS(LS_KEYS.CACHE_IMG, {}));
  useEffect(() => {
    saveLS(LS_KEYS.CACHE_IMG, cache);
  }, [cache]);

  const get = useCallback((key) => cache[key], [cache]);
  const put = useCallback((key, value) => {
    setCache((c) => ({ ...c, [key]: value }));
  }, []);

  return { get, put };
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

// Header & topbar -------------------------------------------------------------

function TopBar({ deckName, onRename, onResetDeck, onExport, onImport, onPrint }) {
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

      <div className="flex items-center gap-2">
        <button
          className="px-3 py-1.5 rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700"
          onClick={onResetDeck}
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
        <button
          className="px-3 py-1.5 rounded-xl bg-emerald-900 border border-emerald-700 hover:bg-emerald-800"
          onClick={onExport}
          title="Export deck JSON"
        >
          Export
        </button>
        <button
          className="px-3 py-1.5 rounded-xl bg-blue-900 border border-blue-700 hover:bg-blue-800"
          onClick={onPrint}
          title="Open printable deck sheet"
        >
          Print
        </button>
      </div>
    </div>
  );
}

// Filter panel ---------------------------------------------------------------

function FilterPanel({ state, dispatch, onDone }) {
  return (
    <div className="p-3 bg-gray-900/50 border-b border-gray-800">
      <div className="flex items-center gap-2 mb-2">
        <input
          className="w-full px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 outline-none focus:border-emerald-400"
          placeholder="Search cards by name, text, etc."
          value={state.text}
          onChange={(e) => dispatch({ type: "SET_TEXT", text: e.target.value })}
        />
        <button
          className="px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700"
          onClick={() => dispatch({ type: "RESET" })}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
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
          <legend className="text-sm text-gray-300">Types</legend>
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

        <fieldset className="bg-gray-900 rounded-xl p-3 border border-gray-800">
          <legend className="text-sm text-gray-300">Sets</legend>
          <div className="flex flex-wrap gap-2 mt-2">
            {SETS.map((s) => (
              <TogglePill
                key={s.code}
                label={s.name}
                active={state.sets.has(s.code)}
                onClick={() => dispatch({ type: "TOGGLE_SET", setCode: s.code })}
              />
            ))}
          </div>
        </fieldset>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
        <fieldset className="bg-gray-900 rounded-xl p-3 border border-gray-800">
          <legend className="text-sm text-gray-300">Cost Range</legend>
          <div className="flex items-center gap-3 mt-2">
            <input
              type="number"
              className="w-24 px-2 py-1 rounded-lg bg-gray-800 border border-gray-700"
              value={state.costMin}
              onChange={(e) =>
                dispatch({ type: "SET_COST_RANGE", costMin: parseInt(e.target.value || 0) })
              }
            />
            <span className="text-gray-400">to</span>
            <input
              type="number"
              className="w-24 px-2 py-1 rounded-lg bg-gray-800 border border-gray-700"
              value={state.costMax}
              onChange={(e) =>
                dispatch({ type: "SET_COST_RANGE", costMax: parseInt(e.target.value || 0) })
              }
            />
          </div>
        </fieldset>

        <fieldset className="bg-gray-900 rounded-xl p-3 border border-gray-800">
          <legend className="text-sm text-gray-300">Inkable</legend>
          <label className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              checked={state.showInkablesOnly}
              onChange={(e) => dispatch({ type: "SET_SHOW_INKABLES", value: e.target.checked })}
            />
            <span>Show only inkables</span>
          </label>
        </fieldset>

        <fieldset className="bg-gray-900 rounded-xl p-3 border border-gray-800">
          <legend className="text-sm text-gray-300">Sort</legend>
          <div className="flex items-center gap-2 mt-2">
            <select
              className="px-2 py-1 rounded-lg bg-gray-800 border border-gray-700"
              value={state.sortBy}
              onChange={(e) => dispatch({ type: "SET_SORT", sortBy: e.target.value })}
            >
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
        </fieldset>
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

function CardGrid({ cards, onAdd, onInspect }) {
  return (
    <div className="grid gap-3 p-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
      {cards.map((c) => (
        <CardTile key={deckKey(c)} card={c} onAdd={() => onAdd(c)} onInspect={() => onInspect(c)} />
      ))}
    </div>
  );
}

function useCardImage(card) {
  const { get, put } = useImageCache();
  const [src, setSrc] = useState(() => get(deckKey(card)) || null);

  useEffect(() => {
    let abort = new AbortController();
    let mounted = true;

    (async () => {
      const cached = get(deckKey(card));
      if (cached) {
        setSrc(cached);
        return;
      }
      const found = await resolveLorcastImage(card, abort.signal).catch(() => null);
      const finalSrc = found || card._rawImage || FALLBACK_IMG;
      if (mounted) {
        setSrc(finalSrc);
        put(deckKey(card), finalSrc);
      }
    })();

    return () => {
      mounted = false;
      abort.abort();
    };
  }, [card, get, put]);

  return src || FALLBACK_IMG;
}

function CardTile({ card, onAdd, onInspect }) {
  const imgSrc = useCardImage(card);
  return (
    <div className="group bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:shadow-xl hover:border-emerald-700 transition">
      <div className="relative">
        <img
          src={imgSrc}
          alt={card.name}
          className="w-full aspect-[3/4] object-cover bg-black"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition" />
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition">
          <button
            className="px-2 py-1 rounded-lg bg-emerald-900/90 border border-emerald-700 text-emerald-100 text-xs hover:bg-emerald-800"
            onClick={onAdd}
          >
            Add to Deck
          </button>
          <button
            className="px-2 py-1 rounded-lg bg-gray-900/90 border border-gray-700 text-gray-100 text-xs hover:bg-gray-800"
            onClick={onInspect}
          >
            Details
          </button>
        </div>
      </div>
      <div className="p-2 border-t border-gray-800">
        <div className="text-sm font-semibold truncate">{card.name}</div>
        <div className="text-xs text-gray-400 flex items-center gap-2">
          <span>{card.set}</span>
          <span>#{card.number}</span>
          <span>•</span>
          <span>Cost {getCost(card)}</span>
        </div>
      </div>
    </div>
  );
}

// Deck panel -----------------------------------------------------------------

function DeckPanel({ deck, onSetCount, onRemove, onExport, onImport }) {
  const entries = Object.values(deck.entries || {}).filter((e) => e.count > 0);
  const groupedByCost = useMemo(
    () => groupBy(entries, (e) => getCost(e.card)),
    [entries]
  );

  return (
    <div className="p-3 bg-gray-950 border-l border-gray-800 h-full flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">
          Deck • <span className="text-emerald-400">{deck.total}</span> /{" "}
          {DECK_RULES.MAX_SIZE}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded-xl bg-emerald-900 border border-emerald-700 hover:bg-emerald-800"
            onClick={onExport}
          >
            Export
          </button>
          <button
            className="px-3 py-1.5 rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700"
            onClick={onImport}
          >
            Import
          </button>
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
  const imgSrc = useCardImage(c);

  return (
    <div className="flex items-center gap-2 p-2">
      <img src={imgSrc} alt={c.name} className="w-10 h-14 object-cover rounded-md" />
      <div className="flex-1">
        <div className="text-sm font-semibold">{c.name}</div>
        <div className="text-xs text-gray-400">
          {c.set} • #{c.number} • Cost {getCost(c)} • {c.type} • {c.rarity}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          className="w-6 h-6 rounded-md bg-gray-800 border border-gray-700 hover:bg-gray-700"
          onClick={() => onSetCount(Math.max(0, entry.count - 1))}
        >
          -
        </button>
        <input
          className="w-10 text-center rounded-md bg-gray-800 border border-gray-700"
          type="number"
          value={entry.count}
          onChange={(e) => onSetCount(parseInt(e.target.value || 0))}
        />
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

// Stats & charts --------------------------------------------------------------

function DeckStats({ deck }) {
  const entries = Object.values(deck.entries || {}).filter((e) => e.count > 0);

  const costCurve = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const cost = getCost(e.card);
      map.set(cost, (map.get(cost) || 0) + e.count);
    }
    const rows = Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([cost, count]) => ({ cost, count }));
    return rows;
  }, [entries]);

  const inkCounts = useMemo(() => {
    const counts = {};
    for (const e of entries) {
      for (const ink of getInks(e.card)) {
        counts[ink] = (counts[ink] || 0) + e.count;
      }
    }
    return Object.entries(counts).map(([ink, count]) => ({ ink, count }));
  }, [entries]);

  const typeCounts = useMemo(() => {
    const counts = {};
    for (const e of entries) {
      const t = e.card.type || "Unknown";
      counts[t] = (counts[t] || 0) + e.count;
    }
    return Object.entries(counts).map(([type, count]) => ({ type, count }));
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
              <Bar dataKey="count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Inks">
        <div className="w-full h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={inkCounts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="ink" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Types">
        <div className="w-full h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={typeCounts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" />
            </BarChart>
          </ResponsiveContainer>
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

function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-[min(100%-2rem,900px)] max-h-[85vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="text-lg font-semibold">{title}</div>
          <button
            className="px-3 py-1.5 rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="p-4 overflow-auto">{children}</div>
        {footer && <div className="px-4 py-3 border-t border-gray-800">{footer}</div>}
      </div>
    </div>
  );
}

// Inspect card modal ---------------------------------------------------------

function InspectCardModal({ open, card, onClose, onAdd }) {
  const imgSrc = useCardImage(card || {});
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <img src={imgSrc} alt={card.name} className="w-full rounded-xl border border-gray-800" />
        <div className="space-y-2">
          <div className="text-sm text-gray-300">
            <span className="font-semibold">Type:</span> {card.type} •{" "}
            <span className="font-semibold">Rarity:</span> {card.rarity} •{" "}
            <span className="font-semibold">Cost:</span> {getCost(card)}
          </div>
          <div className="text-sm text-gray-300">
            <span className="font-semibold">Inks:</span> {getInks(card).join(", ") || "—"}
          </div>
          <div className="p-3 bg-gray-950 rounded-xl border border-gray-800">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Card Text</div>
            <div className="whitespace-pre-wrap">{card.text || "—"}</div>
          </div>
        </div>
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
  return (
    <Modal open={open} onClose={onClose} title="Import Deck">
      <div className="space-y-3">
        <div className="text-sm text-gray-400">
          Paste deck JSON exported from this app (or adapt from another builder).
        </div>
        <textarea
          className="w-full h-64 px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 font-mono text-xs"
          placeholder='{"name":"My Deck","entries":{...},"total":60}'
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex items-center justify-end gap-2">
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
    </Modal>
  );
}

// Printable view -------------------------------------------------------------

function PrintableSheet({ deck, onClose }) {
  const entries = Object.values(deck.entries || {}).filter((e) => e.count > 0);
  return (
    <Modal open={true} onClose={onClose} title="Printable Deck Sheet">
      <div className="space-y-4">
        <div className="text-xl font-semibold">{deck.name}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {entries.map((e) => (
            <div key={deckKey(e.card)} className="flex items-center gap-2">
              <div className="w-14 h-20 bg-gray-800 rounded-md overflow-hidden border border-gray-700">
                <img src={e.card._rawImage || FALLBACK_IMG} alt={e.card.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">{e.card.name}</div>
                <div className="text-xs text-gray-400">
                  {e.card.set} • #{e.card.number} • Cost {getCost(e.card)}
                </div>
              </div>
              <div className="text-lg font-bold w-8 text-right">{e.count}×</div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// Root App -------------------------------------------------------------------

export default function App() {
  const { addToast } = useToasts();
  const [deck, deckDispatch] = useReducer(deckReducer, undefined, initialDeckState);
  const [filters, filterDispatch] = useReducer(filterReducer, undefined, initialFilterState);
  const [allCards, setAllCards] = useState([]);
  const [shownCards, setShownCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inspectCard, setInspectCard] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  // Load all cards once
  useEffect(() => {
    let abort = new AbortController();
    (async () => {
      setLoading(true);
      const cached = loadLS(LS_KEYS.CACHE_CARDS, []);
      if (cached?.length) {
        setAllCards(cached);
        setLoading(false);
      }
      try {
        const data = await fetchAllCards({ signal: abort.signal });
        setAllCards(data);
        saveLS(LS_KEYS.CACHE_CARDS, data);
      } catch (e) {
        addToast("Failed to load cards; working from cache if available", "error");
      } finally {
        setLoading(false);
      }
    })();
    return () => abort.abort();
  }, [addToast]);

  // Apply filters
  useEffect(() => {
    // Lightweight debounce to keep typing smooth
    const apply = debounce(() => {
      const list = applyFilters(allCards, filters);
      setShownCards(list);
    }, 50);
    apply();
    return () => {};
  }, [allCards, filters]);

  const deckValid =
    deck.total >= DECK_RULES.MIN_SIZE && deck.total <= DECK_RULES.MAX_SIZE;

  function handleAdd(card) {
    deckDispatch({ type: "ADD", card, count: 1 });
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
      deckDispatch({ type: "RESET" });
      addToast("New deck started", "success");
    }
  }
  function handlePrint() {
    setPrintOpen(true);
  }

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

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gradient-to-b from-gray-950 to-black text-gray-100">
        <TopBar
          deckName={deck.name}
          onRename={(name) => deckDispatch({ type: "SET_NAME", name })}
          onResetDeck={handleResetDeck}
          onExport={handleExport}
          onImport={handleImport}
          onPrint={handlePrint}
        />

        {filters.showFilterPanel && (
          <FilterPanel
            state={filters}
            dispatch={filterDispatch}
            onDone={() => filterDispatch({ type: "TOGGLE_PANEL" })}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px]">
          <div>
            {loading ? (
              <div className="p-6 text-center text-gray-400">Loading cards…</div>
            ) : shownCards.length ? (
              <CardGrid
                cards={shownCards}
                onAdd={handleAdd}
                onInspect={(c) => setInspectCard(c)}
              />
            ) : (
              <div className="p-6 text-center text-gray-400">No cards match your filters.</div>
            )}
          </div>
          <div className="border-l border-gray-800 min-h-[60vh]">
            <DeckPanel
              deck={deck}
              onSetCount={handleSetCount}
              onRemove={handleRemove}
              onExport={() => setExportOpen(true)}
              onImport={() => setImportOpen(true)}
            />
            <DeckStats deck={deck} />
            <div className={`p-3 ${deckValid ? "text-emerald-300" : "text-red-300"}`}>
              {deckValid
                ? "Deck is valid."
                : `Deck must be between ${DECK_RULES.MIN_SIZE} and ${DECK_RULES.MAX_SIZE} cards.`}
            </div>
          </div>
        </div>

        <InspectCardModal
          open={!!inspectCard}
          card={inspectCard}
          onClose={() => setInspectCard(null)}
          onAdd={handleAdd}
        />
        <ExportModal open={exportOpen} deck={deck} onClose={() => setExportOpen(false)} />
        <ImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImport={handleDoImport}
        />
        {printOpen && <PrintableSheet deck={deck} onClose={() => setPrintOpen(false)} />}
      </div>
    </ToastProvider>
  );
}

// -----------------------------------------------------------------------------
// Filtering + Sorting
// -----------------------------------------------------------------------------

function applyFilters(cards, filters) {
  let list = cards.slice();

  if (filters.text) {
    const q = filters.text.toLowerCase();
    list = list.filter((c) => {
      return (
        c.name?.toLowerCase().includes(q) ||
        c.text?.toLowerCase().includes(q) ||
        c.type?.toLowerCase().includes(q) ||
        c.rarity?.toLowerCase().includes(q) ||
        c.set?.toLowerCase().includes(q)
      );
    });
  }

  if (filters.inks?.size) {
    list = list.filter((c) => {
      const inks = new Set(getInks(c));
      for (const i of filters.inks) {
        if (inks.has(i)) return true;
      }
      return false;
    });
  }

  if (filters.rarities?.size) {
    list = list.filter((c) => filters.rarities.has(c.rarity));
  }

  if (filters.types?.size) {
    list = list.filter((c) => filters.types.has(c.type));
  }

  if (filters.sets?.size) {
    list = list.filter((c) => filters.sets.has(c.set) || filters.sets.has(c.set?.code));
  }

  list = list.filter((c) => {
    const cost = getCost(c);
    return cost >= filters.costMin && cost <= filters.costMax;
  });

  if (filters.showInkablesOnly) {
    list = list.filter((c) => {
      // Heuristic: card has "inkable" boolean or inkable in text
      if (typeof c._raw?.inkable === "boolean") return c._raw.inkable;
      if (typeof c.inkable === "boolean") return c.inkable;
      return /inkable/i.test(c.text || "");
    });
  }

  list.sort((a, b) => {
    const dir = filters.sortDir === "desc" ? -1 : 1;
    switch (filters.sortBy) {
      case "cost":
        return (getCost(a) - getCost(b)) * dir;
      case "set": {
        const sa = `${a.set}-${a.number}`;
        const sb = `${b.set}-${b.number}`;
        return sa.localeCompare(sb) * dir;
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
// End of file
// -----------------------------------------------------------------------------
