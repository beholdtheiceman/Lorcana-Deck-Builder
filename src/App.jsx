import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

/** =========================
 *  Provider selector
 *  (Default to LORCAST per your request)
 * ========================= */
const DATA_PROVIDER = (import.meta.env.VITE_DATA_PROVIDER || "lorcast").toLowerCase();

/** =========================
 *  Lorcast Provider
 * ========================= */
const LORCAST_BASE = import.meta.env.VITE_LORCAST_BASE || "";

function buildLorcastQuery({
  q,
  colors,
  types,
  cost,
  set,
  rarity,
  text,
  keywords = [],
  archetype = "",
  page = 1,
  pagesize = 24,
  orderby = "Color,Set_Num,Name",
  sortdirection = "ASC",
}) {
  // We don't know Lorcast's exact grammar, so we send common-sense params.
  // Adjust keys here to match your Lorcast server once known.
  const params = new URLSearchParams();

  if (q) params.set("name", q);
  if (text) params.set("text", text);
  if (keywords.length) params.set("keywords", keywords.join(","));
  if (archetype) params.set("archetype", archetype);

  if (colors?.length) params.set("color", colors.join(",")); // e.g., Amber,Emerald
  if (types?.length) params.set("type", types.join(","));    // e.g., Character,Song

  if (cost && cost !== "Any") {
    if (cost === "9+") {
      params.set("minCost", "9");
    } else {
      params.set("cost", String(cost));
    }
  }

  if (set) params.set("set", set);
  if (rarity) params.set("rarity", rarity);

  params.set("page", String(page));
  params.set("pageSize", String(pagesize)); // common naming; server can alias

  // Sort mapping best-effort
  // Map known fields to lowercase plausible server keys.
  const mappedSort = orderby
    .split(",")
    .map((k) => k.trim().toLowerCase().replace("set_num", "setnumber"))
    .join(",");
  params.set("sort", mappedSort);
  params.set("dir", (sortdirection || "ASC").toUpperCase());

  return params;
}

function normalizeLorcastCard(x) {
  // Normalize various possible field names coming from Lorcast
  const Name = x.Name ?? x.name ?? x.cardName ?? x.title ?? "";
  const Color = x.Color ?? x.color ?? x.ink ?? x.inkColor ?? "";
  const Cost = x.Cost ?? x.cost ?? x.inkCost ?? x.playCost ?? "";
  const Type = x.Type ?? x.type ?? x.cardType ?? "";
  const Rarity = x.Rarity ?? x.rarity ?? "";
  const Set = x.Set ?? x.setName ?? x.set ?? "";
  const Set_Num = x.Set_Num ?? x.setNumber ?? x.number ?? x.collectorNumber ?? "";
  const Image =
    x.Image ??
    x.image ??
    x.imageUrl ??
    (x.images && (x.images.large || x.images.normal || x.images.small)) ??
    "";
  const Rules = x.Rules ?? x.text ?? x.oracleText ?? x.rules ?? "";

  return {
    ...x,
    Name,
    Color,
    Cost,
    Type,
    Rarity,
    Set,
    Set_Num,
    Image,
    Rules,
  };
}

async function fetchFromLorcast(query) {
  if (!LORCAST_BASE) {
    throw new Error(
      "VITE_LORCAST_BASE is not set. Please add it in your env (Preview/Production)."
    );
  }
  // Try a couple of common endpoints: /cards, /api/cards, /cards/search
  const endpoints = ["/cards", "/api/cards", "/cards/search"];
  let lastErr;
  for (const path of endpoints) {
    const url = `${LORCAST_BASE.replace(/\/+$/, "")}${path}?${query.toString()}`;
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        lastErr = new Error(`Lorcast ${res.status} on ${path}`);
        continue;
      }
      const data = await res.json();
      // Accept either an array or {results:[], total: n}
      const list = Array.isArray(data) ? data : data.results || [];
      return list.map(normalizeLorcastCard);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Lorcast request failed");
}

const lorcastProvider = {
  async fetchCards(filters) {
    const qs = buildLorcastQuery(filters);
    return fetchFromLorcast(qs);
  },
  label: LORCAST_BASE ? new URL(LORCAST_BASE).host : "Lorcast",
};

/** =========================
 *  (Optional) Lorcana-API Provider (kept as fallback)
 * ========================= */
const LORCANA_BASE =
  import.meta.env.VITE_LORCANA_BASE || "https://api.lorcana-api.com";

function buildLorcanaSearch({
  q,
  colors,
  types,
  cost,
  set,
  rarity,
  text,
  keywords,
  archetype,
}) {
  const parts = [];
  if (q) parts.push(`name~${encodeURIComponent(q)}`);
  if (text) parts.push(`rules~${encodeURIComponent(text)}`);
  if (keywords?.length) {
    parts.push(keywords.map((k) => `rules~${encodeURIComponent(k)}`).join(";"));
  }
  if (archetype) parts.push(`rules~${encodeURIComponent(archetype)}`);
  if (colors?.length)
    parts.push(colors.map((c) => `color=${encodeURIComponent(c)}`).join(";"));
  if (types?.length) {
    const normalized = types.map((t) => (t === "Song" ? "Song" : t));
    parts.push(
      normalized.map((t) => `type~${encodeURIComponent(t)}`).join(";")
    );
  }
  if (set) parts.push(`set=${encodeURIComponent(set)}`);
  if (rarity) parts.push(`rarity=${encodeURIComponent(rarity)}`);
  if (cost && cost !== "Any") {
    if (cost === "9+") parts.push("cost>=9");
    else parts.push(`cost=${cost}`);
  }
  return parts.length ? parts.join(";") : "";
}

async function fetchFromLorcanaApi(paramsObj) {
  const params = new URLSearchParams(paramsObj);
  const url = `${LORCANA_BASE}/cards/fetch?${params.toString()}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`lorcana-api ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

const lorcanaProvider = {
  async fetchCards(filters) {
    const {
      q,
      colors,
      types,
      cost = "Any",
      set,
      rarity,
      text,
      keywords = [],
      archetype = "",
      page = 1,
      pagesize = 24,
      orderby = "Color,Set_Num,Name",
      sortdirection = "ASC",
    } = filters;
    const search = buildLorcanaSearch({
      q,
      colors,
      types,
      cost,
      set,
      rarity,
      text,
      keywords,
      archetype,
    });
    const query = { page, pagesize, orderby, sortdirection };
    if (search) query.search = search;
    return fetchFromLorcanaApi(query);
  },
  label: "api.lorcana-api.com",
};

const provider = DATA_PROVIDER === "lorcana-api" ? lorcanaProvider : lorcastProvider;

/** =========================
 *  Shared helpers
 * ========================= */
const cache = new Map();
const cacheKeyFor = (q) => JSON.stringify(q);
const getCached = (q) => {
  const k = cacheKeyFor(q);
  if (cache.has(k)) return cache.get(k);
  try {
    const s = sessionStorage.getItem(`lorcana.cache.${k}`);
    if (s) {
      const parsed = JSON.parse(s);
      cache.set(k, parsed);
      return parsed;
    }
  } catch {}
  return null;
};
const setCached = (q, v) => {
  const k = cacheKeyFor(q);
  cache.set(k, v);
  try {
    sessionStorage.setItem(`lorcana.cache.${k}`, JSON.stringify(v));
  } catch {}
};
function proxyImageUrl(src) {
  if (!src) return "";
  try {
    const u = new URL(src);
    if (u.hostname.includes("weserv.nl")) return src;
  } catch {}
  return `https://images.weserv.nl/?url=${encodeURIComponent(
    src
  )}&output=jpg&il`;
}

/** =========================
 *  UI Data
 * ========================= */
const INKS = ["Amber", "Amethyst", "Emerald", "Ruby", "Sapphire", "Steel"];
const TYPES = ["Character", "Action", "Song", "Item", "Location"]; // Song only
const COSTS = ["Any", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9+"];
const RARITIES = [
  "Common",
  "Uncommon",
  "Rare",
  "Super Rare",
  "Legendary",
  "Fabled",
];
const SETS = [
  { id: 1, name: "The First Chapter" },
  { id: 2, name: "Rise of the Floodborn" },
  { id: 3, name: "Into the Inklands" },
  { id: 4, name: "Ursula’s Return" },
  { id: 5, name: "Shimmering Skies" },
  { id: 6, name: "Set 7" },
  { id: 7, name: "Set 8" },
  { id: 8, name: "Set 9" },
];

const INK_COLORS = {
  Amber: "#ffb703",
  Amethyst: "#9b5de5",
  Emerald: "#00a884",
  Ruby: "#e63946",
  Sapphire: "#1e90ff",
  Steel: "#9aa0a6",
};

/** =========================
 *  Deck & Utils
 * ========================= */
const cardKey = (c) =>
  `${c.Set_ID ?? ""}|${c.Set_Num ?? ""}|${c.Name ?? ""}|${c.Image ?? ""}`;
const toCSV = (rows) => {
  const headers = [
    "Name",
    "Color",
    "Cost",
    "Type",
    "Rarity",
    "Set",
    "Set_Num",
    "Count",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        (r.Name ?? "").replaceAll(",", " "),
        r.Color ?? "",
        r.Cost ?? "",
        r.Type ?? "",
        r.Rarity ?? "",
        r.Set ?? "",
        r.Set_Num ?? "",
        r.__count ?? 1,
      ].join(",")
    ),
  ];
  return lines.join("\n");
};
function deckIssues(deckMap) {
  const issues = [];
  const total = Object.values(deckMap).reduce(
    (s, d) => s + (d.__count || 0),
    0
  );
  if (total < 60) issues.push(`Deck has ${total} cards (need at least 60).`);
  const byName = {};
  for (const d of Object.values(deckMap)) {
    const name = String(d.Name || "").trim();
    byName[name] = (byName[name] || 0) + (d.__count || 0);
  }
  for (const [name, cnt] of Object.entries(byName)) {
    if (cnt > 4) issues.push(`More than 4 copies of "${name}" (${cnt}).`);
  }
  return issues;
}
const copyText = (txt) => {
  try {
    navigator.clipboard.writeText(txt);
    return true;
  } catch {
    return false;
  }
};

/** =========================
 *  Toasts
 * ========================= */
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, tone = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      2500
    );
  }, []);
  return { toasts, push };
}

/** =========================
 *  URL Sync
 * ========================= */
function useUrlSync(filters, setters) {
  const {
    q,
    textSearch,
    keywords,
    archetype,
    colors,
    types,
    cost,
    rarity,
    setName,
    format,
    pagesize,
    orderby,
    sortdirection,
  } = filters;
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.has("q")) setters.setQ(sp.get("q") || "");
    if (sp.has("text")) setters.setTextSearch(sp.get("text") || "");
    if (sp.has("keywords"))
      setters.setKeywords(sp.get("keywords").split(",").filter(Boolean));
    if (sp.has("archetype")) setters.setArchetype(sp.get("archetype") || "");
    if (sp.has("colors"))
      setters.setColors(sp.get("colors").split(",").filter(Boolean));
    if (sp.has("types"))
      setters.setTypes(sp.get("types").split(",").filter(Boolean));
    if (sp.has("cost")) setters.setCost(sp.get("cost") || "Any");
    if (sp.has("rarity")) setters.setRarity(sp.get("rarity") || "");
    if (sp.has("set")) setters.setSetName(sp.get("set") || "");
    if (sp.has("format")) setters.setFormat(sp.get("format") || "Infinity");
    if (sp.has("pagesize"))
      setters.setPagesize(Number(sp.get("pagesize") || 24));
    if (sp.has("orderby"))
      setters.setOrderby(sp.get("orderby") || "Color,Set_Num,Name");
    if (sp.has("dir")) setters.setSortdirection(sp.get("dir") || "ASC");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (textSearch) sp.set("text", textSearch);
    if (keywords.length) sp.set("keywords", keywords.join(","));
    if (archetype) sp.set("archetype", archetype);
    if (colors.length) sp.set("colors", colors.join(","));
    if (types.length) sp.set("types", types.join(","));
    if (cost !== "Any") sp.set("cost", cost);
    if (rarity) sp.set("rarity", rarity);
    if (setName) sp.set("set", setName);
    if (format !== "Infinity") sp.set("format", format);
    if (pagesize !== 24) sp.set("pagesize", String(pagesize));
    if (orderby !== "Color,Set_Num,Name") sp.set("orderby", orderby);
    if (sortdirection !== "ASC") sp.set("dir", sortdirection);
    const qs = sp.toString();
    const url = qs ? `?${qs}` : window.location.pathname;
    window.history.replaceState({}, "", url);
  }, [
    q,
    textSearch,
    keywords,
    archetype,
    colors,
    types,
    cost,
    rarity,
    setName,
    format,
    pagesize,
    orderby,
    sortdirection,
  ]);
}

/** =========================
 *  Main App
 * ========================= */
export default function App() {
  // Filters / search
  const [q, setQ] = useState("");
  const [textSearch, setTextSearch] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [archetype, setArchetype] = useState("");
  const [colors, setColors] = useState([]);
  const [types, setTypes] = useState([]);
  const [cost, setCost] = useState("Any");
  const [rarity, setRarity] = useState("");
  const [setName, setSetName] = useState("");
  const [format, setFormat] = useState("Infinity"); // Infinity | Standard Core

  const [filtersOpen, setFiltersOpen] = useState(false);

  // Results & paging
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const [pagesize, setPagesize] = useState(24);
  const [orderby, setOrderby] = useState("Color,Set_Num,Name");
  const [sortdirection, setSortdirection] = useState("ASC");
  const [hasMore, setHasMore] = useState(true);

  // Deck & modal
  const [deck, setDeck] = useState({});
  const [modalCard, setModalCard] = useState(null);
  const [lastAddedKey, setLastAddedKey] = useState("");

  // Export canvas
  const canvasRef = useRef(null);
  const exportBusyRef = useRef(false);
  const sentinelRef = useRef(null);
  const debounceRef = useRef(0);
  const { toasts, push } = useToasts();

  // URL sync
  useUrlSync(
    {
      q,
      textSearch,
      keywords,
      archetype,
      colors,
      types,
      cost,
      rarity,
      setName,
      format,
      pagesize,
      orderby,
      sortdirection,
    },
    {
      setQ,
      setTextSearch,
      setKeywords,
      setArchetype,
      setColors,
      setTypes,
      setCost,
      setRarity,
      setSetName,
      setFormat,
      setPagesize,
      setOrderby,
      setSortdirection,
    }
  );

  // localStorage persistence
  useEffect(() => {
    try {
      const raw = localStorage.getItem("lorcana.deckbuilder.v3");
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.deck) setDeck(saved.deck);
      if (saved.filters) {
        const f = saved.filters;
        setQ(f.q || "");
        setTextSearch(f.textSearch || "");
        setKeywords(f.keywords || []);
        setArchetype(f.archetype || "");
        setColors(f.colors || []);
        setTypes(f.types || []);
        setCost(f.cost || "Any");
        setRarity(f.rarity || "");
        setSetName(f.setName || "");
        setFormat(f.format || "Infinity");
        setPagesize(f.pagesize || 24);
        setOrderby(f.orderby || "Color,Set_Num,Name");
        setSortdirection(f.sortdirection || "ASC");
      }
    } catch {}
  }, []);
  useEffect(() => {
    const payload = {
      deck,
      filters: {
        q,
        textSearch,
        keywords,
        archetype,
        colors,
        types,
        cost,
        rarity,
        setName,
        format,
        pagesize,
        orderby,
        sortdirection,
      },
    };
    try {
      localStorage.setItem("lorcana.deckbuilder.v3", JSON.stringify(payload));
    } catch {}
  }, [
    deck,
    q,
    textSearch,
    keywords,
    archetype,
    colors,
    types,
    cost,
    rarity,
    setName,
    format,
    pagesize,
    orderby,
    sortdirection,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if (
        e.target &&
        (e.target.tagName === "INPUT" ||
          e.target.tagName === "TEXTAREA" ||
          e.target.isContentEditable)
      )
        return;
      if (!lastAddedKey) return;
      if (e.key === "+") {
        setDeck((prev) => {
          const d = prev[lastAddedKey];
          if (!d) return prev;
          return {
            ...prev,
            [lastAddedKey]: { ...d, __count: (d.__count || 0) + 1 },
          };
        });
        push("Added +1", "success");
      } else if (e.key === "-") {
        setDeck((prev) => {
          const d = prev[lastAddedKey];
          if (!d) return prev;
          const n = Math.max(0, (d.__count || 0) - 1);
          const copy = { ...prev };
          if (n === 0) delete copy[lastAddedKey];
          else copy[lastAddedKey] = { ...d, __count: n };
          return copy;
        });
        push("Removed −1", "info");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lastAddedKey, push]);

  /** =========================
   *  Fetch
   * ========================= */
  async function fetchCards(filters) {
    const key = { provider: provider.label, ...filters };
    const cached = getCached(key);
    if (cached) return cached;
    const data = await provider.fetchCards(filters);
    setCached(key, data);
    return data;
  }

  // Apply Format (client-side): Standard Core excludes Sets 1–4
  function passesFormat(c) {
    if (format === "Infinity") return true;
    const setName = String(c.Set || "");
    const found = SETS.find((s) => s.name === setName);
    const setId = found?.id ?? Number(c.Set_Num ?? 0);
    return setId >= 5; // Standard Core ⇒ sets 5+
  }

  // Extra client-side filters (keywords/archetype if backend didn't)
  function passesClientFilters(c) {
    const textBlob = [c.Rules, c.Traits, c.Subtypes, c.Type, c.Name]
      .map((x) => String(x || "").toLowerCase())
      .join(" ");
    if (
      keywords.length &&
      !keywords.every((k) => textBlob.includes(String(k).toLowerCase()))
    )
      return false;
    if (archetype && !textBlob.includes(String(archetype).toLowerCase()))
      return false;
    return true;
  }

  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    setLoading(true);
    setErr("");
    debounceRef.current = setTimeout(async () => {
      try {
        const first = await fetchCards({
          q,
          colors,
          types,
          cost,
          set: setName || undefined,
          rarity: rarity || undefined,
          text: textSearch || undefined,
          keywords,
          archetype,
          page: 1,
          pagesize,
          orderby,
          sortdirection,
        });
        const filtered = first.filter(passesFormat).filter(passesClientFilters);
        setCards(filtered);
        setPage(1);
        setHasMore(first.length === pagesize);
        setHasFetchedOnce(true);
      } catch (e) {
        setErr(e?.message || "Failed to load cards");
        setCards([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line
  }, [
    q,
    textSearch,
    keywords.join("|"),
    archetype,
    colors.join("|"),
    types.join("|"),
    cost,
    rarity,
    setName,
    format,
    pagesize,
    orderby,
    sortdirection,
    DATA_PROVIDER,
  ]);

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;
    const el = sentinelRef.current;
    const io = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || loading || !hasMore || !hasFetchedOnce)
          return;
        try {
          setLoading(true);
          const next = page + 1;
          const data = await fetchCards({
            q,
            colors,
            types,
            cost,
            set: setName || undefined,
            rarity: rarity || undefined,
            text: textSearch || undefined,
            keywords,
            archetype,
            page: next,
            pagesize,
            orderby,
            sortdirection,
          });
          const filtered = data
            .filter(passesFormat)
            .filter(passesClientFilters);
          setCards((prev) => [...prev, ...filtered]);
          setPage(next);
          setHasMore(data.length === pagesize);
        } catch (e) {
          setErr(e?.message || "Failed to load more");
          setHasMore(false);
        } finally {
          setLoading(false);
        }
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [
    page,
    loading,
    hasMore,
    hasFetchedOnce,
    q,
    textSearch,
    keywords.join("|"),
    archetype,
    colors.join("|"),
    types.join("|"),
    cost,
    rarity,
    setName,
    format,
    pagesize,
    orderby,
    sortdirection,
  ]);

  /** =========================
   *  Analytics
   * ========================= */
  const totalDeckCards = useMemo(
    () => Object.values(deck).reduce((sum, d) => sum + (d.__count || 0), 0),
    [deck]
  );
  const manaCurve = useMemo(() => {
    const buckets = {
      "0": 0,
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0,
      "6": 0,
      "7": 0,
      "8": 0,
      "9+": 0,
    };
    for (const d of Object.values(deck)) {
      const cost = Number(d.Cost ?? 0);
      const key = cost >= 9 ? "9+" : String(cost);
      buckets[key] = (buckets[key] || 0) + (d.__count || 0);
    }
    return Object.entries(buckets).map(([k, v]) => ({ cost: k, count: v }));
  }, [deck]);
  const inkDistribution = useMemo(() => {
    const cnt = {};
    for (const d of Object.values(deck)) {
      const color = d.Color || "Unknown";
      cnt[color] = (cnt[color] || 0) + (d.__count || 0);
    }
    return Object.entries(cnt)
      .map(([ink, count]) => ({ ink, count }))
      .sort((a, b) => b.count - a.count);
  }, [deck]);

  /** =========================
   *  Deck actions
   * ========================= */
  function addToDeck(card, inc = 1) {
    const key = cardKey(card);
    setDeck((prev) => {
      const existing = prev[key];
      const nextCount = Math.max(0, (existing?.__count || 0) + inc);
      if (nextCount === 0) {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      }
      return { ...prev, [key]: { ...card, __count: nextCount } };
    });
    setLastAddedKey(key);
  }
  function setCount(card, count) {
    const key = cardKey(card);
    const n = Math.max(0, Number(count || 0));
    setDeck((prev) => {
      if (n === 0) {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      }
      return { ...prev, [key]: { ...card, __count: n } };
    });
    setLastAddedKey(key);
  }
  function clearDeck() {
    setDeck({});
    push("Deck cleared", "info");
  }

  /** =========================
   *  UI helpers
   * ========================= */
  const sorted = useMemo(() => {
    const copy = cards.slice();
    copy.sort((a, b) =>
      String(a.Name || "").localeCompare(String(b.Name || ""))
    );
    return copy;
  }, [cards]);

  const toggleSel = (arr, setArr, value) => {
    setPage(1);
    setArr(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  // Mobile deck panel toggle
  const [deckOpen, setDeckOpen] = useState(false);

  // Export helpers
  function triggerDownload(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL?.(url), 2000);
  }
  function exportJSON() {
    const rows = Object.values(deck).map((d) => ({
      Name: d.Name,
      Color: d.Color,
      Cost: d.Cost,
      Type: d.Type,
      Rarity: d.Rarity,
      Set: d.Set,
      Set_Num: d.Set_Num,
      Count: d.__count,
      Image: d.Image,
    }));
    const blob = new Blob([JSON.stringify(rows, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, "deck.json");
    push("Exported JSON", "success");
  }
  function exportCSV() {
    const rows = Object.values(deck);
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, "deck.csv");
    push("Exported CSV", "success");
  }
  async function exportPNG() {
    if (exportBusyRef.current) return;
    exportBusyRef.current = true;
    try {
      const entries = Object.values(deck);
      if (!entries.length) {
        alert("Deck is empty.");
        return;
      }
      const cols = 6;
      const cardW = 300;
      const cardH = Math.round(cardW * (2048 / 1468));
      const pad = 12;
      const badgeH = 36;
      const rows = Math.ceil(entries.length / cols);
      const canvasW = cols * (cardW + pad) + pad;
      const canvasH = rows * (cardH + pad + badgeH) + pad;

      const canvas = canvasRef.current;
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#0a0f1d";
      ctx.fillRect(0, 0, canvasW, canvasH);

      for (let i = 0; i < entries.length; i++) {
        const c = entries[i];
        const imgURL = proxyImageUrl(c.Image);
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = pad + col * (cardW + pad);
        const y = pad + row * (cardH + pad + badgeH);

        ctx.fillStyle = "#0f1320";
        ctx.fillRect(x - 2, y - 2, cardW + 4, cardH + 4);

        const img = await loadImage(imgURL);
        const { sx, sy, sw, sh, dx, dy, dw, dh } = cover(
          img.width,
          img.height,
          cardW,
          cardH,
          x,
          y
        );
        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);

        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(x, y + cardH, cardW, badgeH);
        ctx.fillStyle = "#fff";
        ctx.font =
          "bold 20px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillText(`${c.__count}×  ${c.Name ?? ""}`, x + 10, y + cardH + badgeH / 2);
      }

      const url = canvas.toDataURL("image/png");
      triggerDownload(url, "deck.png");
      push("Exported PNG", "success");
    } catch (e) {
      console.error(e);
      alert("PNG export failed.");
    } finally {
      exportBusyRef.current = false;
    }
  }
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image load error"));
      img.src = src;
    });
  }
  function cover(sw, sh, dw, dh, dx, dy) {
    const sRatio = sw / sh;
    const dRatio = dw / dh;
    let sx = 0,
      sy = 0,
      sw2 = sw,
      sh2 = sh;
    if (sRatio > dRatio) {
      sh2 = sh;
      sw2 = sh2 * dRatio;
      sx = (sw - sw2) / 2;
    } else {
      sw2 = sw;
      sh2 = sw2 / dRatio;
      sy = (sh - sh2) / 2;
    }
    return { sx, sy, sw: sw2, sh: sh2, dx, dy, dw, dh };
  }

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-white">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-3 py-2 rounded-md border text-sm shadow ${
              t.tone === "success"
                ? "bg-emerald-600/20 border-emerald-500/40"
                : t.tone === "info"
                ? "bg-sky-600/20 border-sky-500/40"
                : "bg-rose-600/20 border-rose-500/40"
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center gap-3">
        <h1 className="text-xl font-semibold">Lorcana Deck Builder</h1>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:inline text-xs text-white/60">
            Data: {provider.label}
          </span>
          <button
            className="sm:hidden px-3 py-2 rounded-md border border-white/10 bg-white/5"
            onClick={() => setDeckOpen(true)}
          >
            Open Deck ({totalDeckCards})
          </button>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        {/* Left: Search & Results */}
        <div>
          <div className="flex flex-wrap gap-2 items-center mb-3">
            <input
              className="flex-1 min-w-[180px] px-3 py-2 rounded-md bg-[#0f1324] border border-white/10 outline-none"
              placeholder="Search name…"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
            />
            <input
              className="flex-1 min-w-[180px] px-3 py-2 rounded-md bg-[#0f1324] border border-white/10 outline-none"
              placeholder="Text in rules…"
              value={textSearch}
              onChange={(e) => {
                setPage(1);
                setTextSearch(e.target.value);
              }}
            />
            <button
              className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
              onClick={() => setFiltersOpen(true)}
            >
              Filters
            </button>

            <div className="ml-auto flex items-center gap-2 w-full sm:w-auto">
              <select
                className="flex-1 sm:flex-none px-2 py-2 rounded-md bg-[#0f1324] border border-white/10"
                value={orderby}
                onChange={(e) => setOrderby(e.target.value)}
              >
                <option value="Color,Set_Num,Name">Sort: Ink → Set → Name</option>
                <option value="Set_Num,Name">Sort: Set → Name</option>
                <option value="Name">Sort: Name</option>
                <option value="Cost,Name">Sort: Cost → Name</option>
              </select>
              <select
                className="px-2 py-2 rounded-md bg-[#0f1324] border border-white/10"
                value={sortdirection}
                onChange={(e) => setSortdirection(e.target.value)}
              >
                <option value="ASC">ASC</option>
                <option value="DESC">DESC</option>
              </select>
              <select
                className="px-2 py-2 rounded-md bg-[#0f1324] border border-white/10"
                value={pagesize}
                onChange={(e) => {
                  setPage(1);
                  setPagesize(Number(e.target.value));
                }}
              >
                {[12, 24, 48].map((n) => (
                  <option key={n} value={n}>
                    {n}/page
                  </option>
                ))}
              </select>
            </div>
          </div>

          {err && (
            <div className="mb-3 px-3 py-2 text-sm rounded-md bg-rose-600/20 border border-rose-500/40 text-rose-200">
              {err}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            {sorted.map((c) => {
              const img = proxyImageUrl(c.Image);
              return (
                <button
                  key={`${c.Set_ID}-${c.Name}-${c.Image}-${c.Set_Num}`}
                  className="bg-[#0f1320] rounded-lg overflow-hidden border border-white/10 text-left hover:border-white/20 transition"
                  title="Click to add to deck"
                  onClick={() => {
                    addToDeck(c, 1);
                    push(`Added ${c.Name}`, "success");
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setModalCard(c);
                  }}
                >
                  <div className="aspect-[1468/2048] bg-black/40">
                    {img ? (
                      <img
                        src={img}
                        alt={c.Name}
                        loading="lazy"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src =
                            "data:image/svg+xml;utf8," +
                            encodeURIComponent(
                              "<svg xmlns='http://www.w3.org/2000/svg' width='300' height='420'><rect width='100%' height='100%' fill='#111827'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='system-ui' font-size='14' fill='#9ca3af'>Image unavailable</text></svg>"
                            );
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-white/40">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="p-2 text-sm">
                    <div className="font-medium line-clamp-2">{c.Name}</div>
                    <div className="text-xs text-white/60">
                      {c.Color ?? "—"} · Cost {c.Cost ?? "—"}
                    </div>
                    <div className="text-xs text-white/40">
                      {c.Rarity ?? "—"} · {c.Set ?? "—"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div ref={sentinelRef} className="h-8" />
          {loading && <div className="text-white/60 mt-2">Loading…</div>}
          {!loading && !sorted.length && (
            <div className="text-white/60 mt-2">0 results</div>
          )}
        </div>

        {/* Right: Deck panel (desktop) */}
        <div className="hidden lg:block bg-[#0f1324] rounded-xl border border-white/10 p-3 h-fit sticky top-4">
          <DeckPanel
            deck={deck}
            totalDeckCards={totalDeckCards}
            addToDeck={addToDeck}
            setCount={setCount}
            clearDeck={clearDeck}
            manaCurve={manaCurve}
            inkDistribution={inkDistribution}
            canvasRef={canvasRef}
            exportPNG={exportPNG}
            exportJSON={exportJSON}
            exportCSV={exportCSV}
            push={push}
          />
        </div>
      </div>

      {/* Mobile bottom sheet */}
      {deckOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setDeckOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85%] bg-[#0b1120] border-t border-white/10 rounded-t-2xl p-3 overflow-auto">
            <div className="flex items-center mb-2">
              <h2 className="text-lg font-semibold">
                Your Deck ({totalDeckCards})
              </h2>
              <button
                className="ml-auto px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
                onClick={() => setDeckOpen(false)}
              >
                Close
              </button>
            </div>
            <DeckPanel
              deck={deck}
              totalDeckCards={totalDeckCards}
              addToDeck={addToDeck}
              setCount={setCount}
              clearDeck={clearDeck}
              manaCurve={manaCurve}
              inkDistribution={inkDistribution}
              canvasRef={canvasRef}
              exportPNG={exportPNG}
              exportJSON={exportJSON}
              exportCSV={exportCSV}
              push={push}
              compact
            />
          </div>
        </div>
      )}

      {/* Filters Drawer */}
      {filtersOpen && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[520px] bg-[#0a0f1d] border-l border-white/10 p-4 overflow-auto">
            <div className="flex items-center mb-4">
              <h3 className="text-lg font-semibold">Filters</h3>
              <button
                className="ml-auto px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
                onClick={() => {
                  setPage(1);
                  setFiltersOpen(false);
                }}
              >
                Done
              </button>
            </div>

            <div className="space-y-5">
              {/* Format */}
              <div>
                <div className="text-sm text-white/70 mb-2">Format</div>
                <div className="flex flex-wrap gap-2">
                  {["Infinity", "Standard Core"].map((f) => (
                    <button
                      key={f}
                      className={`px-3 py-1.5 rounded-full border text-sm ${
                        format === f
                          ? "bg-white/20 border-white/40"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      }`}
                      onClick={() => setFormat(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="mt-1 text-xs text-white/50">
                  Standard Core hides Sets 1–4; Infinity shows all.
                </div>
              </div>

              {/* Ink multi-select */}
              <div>
                <div className="text-sm text-white/70 mb-2">Ink</div>
                <div className="flex flex-wrap gap-2">
                  {INKS.map((ink) => {
                    const active = colors.includes(ink);
                    return (
                      <button
                        key={ink}
                        className={`px-3 py-1.5 rounded-full border text-sm ${
                          active
                            ? "bg-white/20 border-white/40"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                        onClick={() => toggleSel(colors, setColors, ink)}
                      >
                        {ink}
                      </button>
                    );
                  })}
                  {colors.length > 0 && (
                    <button
                      className="ml-auto px-3 py-1.5 rounded-full border border-white/10 text-xs bg-white/5 hover:bg-white/10"
                      onClick={() => setColors([])}
                    >
                      Clear Ink
                    </button>
                  )}
                </div>
              </div>

              {/* Type multi-select */}
              <div>
                <div className="text-sm text-white/70 mb-2">Type</div>
                <div className="flex flex-wrap gap-2">
                  {TYPES.map((t) => {
                    const active = types.includes(t);
                    return (
                      <button
                        key={t}
                        className={`px-3 py-1.5 rounded-full border text-sm ${
                          active
                            ? "bg-white/20 border-white/40"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                        onClick={() => toggleSel(types, setTypes, t)}
                      >
                        {t}
                      </button>
                    );
                  })}
                  {types.length > 0 && (
                    <button
                      className="ml-auto px-3 py-1.5 rounded-full border border-white/10 text-xs bg-white/5 hover:bg-white/10"
                      onClick={() => setTypes([])}
                    >
                      Clear Type
                    </button>
                  )}
                </div>
              </div>

              {/* Cost chips */}
              <div>
                <div className="text-sm text-white/70 mb-2">Cost</div>
                <div className="flex flex-wrap gap-2">
                  {COSTS.map((c) => (
                    <button
                      key={c}
                      className={`px-3 py-1.5 rounded-full border text-sm ${
                        cost === c
                          ? "bg-white/20 border-white/40"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      }`}
                      onClick={() => {
                        setCost(c);
                        setPage(1);
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rarity */}
              <div>
                <div className="text-sm text-white/70 mb-2">Rarity</div>
                <select
                  className="w-full px-3 py-2 rounded-md bg-[#0f1324] border border-white/10"
                  value={rarity}
                  onChange={(e) => {
                    setRarity(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Any</option>
                  {RARITIES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Set (optional) */}
              <div>
                <div className="text-sm text-white/70 mb-2">Set</div>
                <input
                  list="sets"
                  className="w-full px-3 py-2 rounded-md bg-[#0f1324] border border-white/10"
                  placeholder="Any (type to search)…"
                  value={setName}
                  onChange={(e) => {
                    setSetName(e.target.value);
                    setPage(1);
                  }}
                />
                <datalist id="sets">
                  {SETS.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
              </div>

              {/* Keywords */}
              <div>
                <div className="text-sm text-white/70 mb-2">Keywords</div>
                <KeywordInput values={keywords} setValues={setKeywords} />
                <div className="text-xs text-white/50 mt-1">
                  Press Enter to add; we match inside rules text.
                </div>
              </div>

              {/* Archetype */}
              <div>
                <div className="text-sm text-white/70 mb-2">Archetype</div>
                <input
                  className="w-full px-3 py-2 rounded-md bg-[#0f1324] border border-white/10"
                  placeholder="e.g., Song, Aggro Steel, Control Sapphire…"
                  value={archetype}
                  onChange={(e) => setArchetype(e.target.value)}
                />
              </div>

              {/* Reset */}
              <div className="pt-2">
                <button
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
                  onClick={() => {
                    setColors([]);
                    setTypes([]);
                    setCost("Any");
                    setRarity("");
                    setSetName("");
                    setTextSearch("");
                    setQ("");
                    setKeywords([]);
                    setArchetype("");
                    setFormat("Infinity");
                    setOrderby("Color,Set_Num,Name");
                    setSortdirection("ASC");
                    setPagesize(24);
                    setPage(1);
                  }}
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalCard && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setModalCard(null)}
          />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl bg-[#0b1120] rounded-xl border border-white/10 overflow-hidden">
              <div className="flex flex-col md:flex-row">
                <div className="md:w-1/2 bg-black/40">
                  {modalCard.Image ? (
                    <img
                      src={proxyImageUrl(modalCard.Image)}
                      alt={modalCard.Name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/60">
                      No image
                    </div>
                  )}
                </div>
                <div className="md:w-1/2 p-4">
                  <div className="flex items-start gap-2">
                    <h4 className="text-lg font-semibold">{modalCard.Name}</h4>
                    <button
                      className="ml-auto px-2 py-1 rounded-md bg-white/10 hover:bg-white/20"
                      onClick={() => setModalCard(null)}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="text-sm text-white/70 mt-1">
                    {modalCard.Color ?? "—"} · Cost {modalCard.Cost ?? "—"} ·{" "}
                    {modalCard.Rarity ?? "—"}
                  </div>
                  <div className="text-sm text-white/60 mt-3 whitespace-pre-wrap">
                    {modalCard.Rules || "—"}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
                      onClick={() => {
                        addToDeck(modalCard, 1);
                        push(`Added ${modalCard.Name}`, "success");
                      }}
                    >
                      +1 to Deck
                    </button>
                    <button
                      className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
                      onClick={() => {
                        addToDeck(modalCard, 4);
                        push(`Added 4× ${modalCard.Name}`, "success");
                      }}
                    >
                      +4 to Deck
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden canvas for PNG export */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

/** =========================
 *  Small components
 * ========================= */
function KeywordInput({ values, setValues }) {
  const [input, setInput] = useState("");
  function add(val) {
    const v = val.trim();
    if (!v) return;
    if (values.includes(v)) return;
    setValues([...values, v]);
    setInput("");
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {values.map((k) => (
          <span
            key={k}
            className="px-2 py-1 rounded-full border border-white/10 bg-white/5 text-sm"
          >
            {k}
            <button
              className="ml-2 text-white/60 hover:text-white"
              onClick={() => setValues(values.filter((x) => x !== k))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        className="w-full px-3 py-2 rounded-md bg-[#0f1324] border border-white/10"
        placeholder="Add keyword then press Enter"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") add(input);
        }}
      />
    </div>
  );
}

function DeckPanel({
  deck,
  totalDeckCards,
  addToDeck,
  setCount,
  clearDeck,
  manaCurve,
  inkDistribution,
  canvasRef,
  exportPNG,
  exportJSON,
  exportCSV,
  push,
  compact = false,
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-lg font-semibold">Your Deck</h2>
        <span className="text-xs text-white/60">({totalDeckCards} cards)</span>
        <button
          className="ml-auto px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
          onClick={clearDeck}
        >
          Clear
        </button>
      </div>

      <div className="max-h-[40vh] lg:max-h-[48vh] overflow-auto pr-1">
        {Object.values(deck).length === 0 ? (
          <div className="text-sm text-white/60">
            Tap cards to add them to your deck.
          </div>
        ) : (
          <ul className="space-y-1">
            {Object.values(deck)
              .sort((a, b) => {
                const ia = String(a.Color || "");
                const ib = String(b.Color || "");
                if (ia !== ib) return ia.localeCompare(ib);
                const ca = Number(a.Cost ?? 0);
                const cb = Number(b.Cost ?? 0);
                if (ca !== cb) return ca - cb;
                return String(a.Name || "").localeCompare(
                  String(b.Name || "")
                );
              })
              .map((d) => (
                <li
                  key={`${d.Set_ID ?? ""}|${d.Set_Num ?? ""}|${d.Name ?? ""}|${
                    d.Image ?? ""
                  }`}
                  className="flex items-center gap-2 p-2 rounded-lg bg-black/10 border border-white/10"
                >
                  <div className="text-xs w-6 text-center font-semibold">
                    {d.__count}×
                  </div>
                  <div className="flex-1">
                    <div className="text-sm">{d.Name}</div>
                    <div className="text-xs text-white/50">
                      {d.Color ?? "—"} · Cost {d.Cost ?? "—"} ·{" "}
                      {d.Rarity ?? "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="px-3 py-2 text-base rounded-md bg-white/10 hover:bg-white/20"
                      onClick={() => addToDeck(d, -1)}
                      title="Remove one"
                    >
                      −
                    </button>
                    <input
                      className="w-16 px-2 py-2 text-sm rounded-md bg-[#0a0f1d] border border-white/10 text-center"
                      value={d.__count}
                      onChange={(e) => setCount(d, e.target.value)}
                    />
                    <button
                      className="px-3 py-2 text-base rounded-md bg-white/10 hover:bg-white/20"
                      onClick={() => addToDeck(d, +1)}
                      title="Add one"
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>

      {/* Exports */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
          onClick={exportJSON}
        >
          Export JSON
        </button>
        <button
          className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
          onClick={exportCSV}
        >
          Export CSV
        </button>
        <button
          className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
          onClick={exportPNG}
          title="Exports a PNG sheet"
        >
          Export PNG
        </button>
      </div>

      {/* Analytics */}
      <div className="mt-4">
        <div className="text-sm text-white/70 mb-2">Mana Curve</div>
        <div className="h-40 bg-black/10 rounded-lg border border-white/10 p-2">
          {Array.isArray(manaCurve) && manaCurve.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={manaCurve}>
                <XAxis dataKey="cost" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-white/40 text-sm">
              No data yet
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="text-sm text-white/70 mb-2">Ink Distribution</div>
        <div className="h-40 bg-black/10 rounded-lg border border-white/10 p-2">
          {Array.isArray(inkDistribution) && inkDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={inkDistribution}
                  dataKey="count"
                  nameKey="ink"
                  outerRadius={70}
                  label
                >
                  {inkDistribution.map((entry, idx) => (
                    <Cell
                      key={`cell-${idx}`}
                      fill={INK_COLORS[entry.ink] || "#999"}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-white/40 text-sm">
              No data yet
            </div>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
