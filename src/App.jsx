import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";

/** =========================
 *  Config / Data helpers
 * ========================= */
const BASE = import.meta.env.VITE_LORCANA_BASE || "https://api.lorcana-api.com";

function buildSearch({ q, colors, types, cost, set, rarity, text }) {
  const parts = [];
  if (q) parts.push(`name~${encodeURIComponent(q)}`);
  if (text) parts.push(`rules~${encodeURIComponent(text)}`);
  if (colors.length) parts.push(colors.map((c) => `color=${encodeURIComponent(c)}`).join(";"));
  if (types.length) parts.push(types.map((t) => `type~${encodeURIComponent(t)}`).join(";"));
  if (set) parts.push(`set=${encodeURIComponent(set)}`);
  if (rarity) parts.push(`rarity=${encodeURIComponent(rarity)}`);
  if (cost && cost !== "Any") {
    if (cost === "9+") parts.push("cost>=9");
    else parts.push(`cost=${cost}`);
  }
  return parts.length ? parts.join(";") : "";
}

async function fetchCardsRaw(paramsObj) {
  const params = new URLSearchParams(paramsObj);
  const url = `${BASE}/cards/fetch?${params.toString()}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`lorcana-api ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// Caching (in-memory + sessionStorage)
const cache = new Map();
function cacheKeyFor(query) {
  return JSON.stringify(query);
}
function getCached(query) {
  const k = cacheKeyFor(query);
  if (cache.has(k)) return cache.get(k);
  let s = null;
  try { s = sessionStorage.getItem(`lorcana.cache.${k}`); } catch {}
  if (s) {
    try {
      const parsed = JSON.parse(s);
      cache.set(k, parsed);
      return parsed;
    } catch {}
  }
  return null;
}
function setCached(query, value) {
  const k = cacheKeyFor(query);
  cache.set(k, value);
  try {
    sessionStorage.setItem(`lorcana.cache.${k}`, JSON.stringify(value));
  } catch {}
}

async function fetchCards({
  q,
  colors,
  types,
  cost = "Any",
  set,
  rarity,
  text,
  page = 1,
  pagesize = 24,
  orderby = "Color,Set_Num,Name",
  sortdirection = "ASC",
}) {
  const search = buildSearch({ q, colors, types, cost, set, rarity, text });
  const query = { search, page, pagesize, orderby, sortdirection };
  if (!search) delete query.search;
  const cached = getCached(query);
  if (cached) return cached;
  const data = await fetchCardsRaw(query);
  setCached(query, data);
  return data;
}

// CORS-friendly image proxy
function proxyImageUrl(src) {
  if (!src) return "";
  try {
    const u = new URL(src);
    if (u.hostname.includes("weserv.nl")) return src;
  } catch {}
  return `https://images.weserv.nl/?url=${encodeURIComponent(src)}&output=jpg&il`;
}

/** =========================
 *  UI Data
 * ========================= */
const INKS = ["Amber", "Amethyst", "Emerald", "Ruby", "Sapphire", "Steel"];
const TYPES = ["Character", "Action", "Action - Song", "Item", "Location"];
const COSTS = ["Any", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9+"];
const RARITIES = ["Common", "Uncommon", "Rare", "Super Rare", "Legendary", "Fabled"];
const SETS = [
  "The First Chapter",
  "Rise of the Floodborn",
  "Into the Inklands",
  "Ursula’s Return",
  "Shimmering Skies",
  "Set 7",
  "Set 8",
  "Set 9",
];
const INK_COLORS = { Amber: "#ffb703", Amethyst: "#9b5de5", Emerald: "#00a884", Ruby: "#e63946", Sapphire: "#1e90ff", Steel: "#9aa0a6" };

/** =========================
 *  Deck & Utils
 * ========================= */
function cardKey(c) {
  return `${c.Set_ID ?? ""}|${c.Set_Num ?? ""}|${c.Name ?? ""}|${c.Image ?? ""}`;
}
function toCSV(rows) {
  const headers = ["Name", "Color", "Cost", "Type", "Rarity", "Set", "Set_Num", "Count"];
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
}
function deckIssues(deckMap) {
  const issues = [];
  const total = Object.values(deckMap).reduce((s, d) => s + (d.__count || 0), 0);
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
function copyText(txt) {
  try {
    navigator.clipboard.writeText(txt);
    return true;
  } catch {
    return false;
  }
}

/** =========================
 *  Toasts
 * ========================= */
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, tone = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2500);
  }, []);
  return { toasts, push };
}

/** =========================
 *  URL Sync
 * ========================= */
function useUrlSync(filters, setters) {
  const { q, textSearch, colors, types, cost, rarity, setName, pagesize, orderby, sortdirection } = filters;
  // Load from URL once
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.has("q")) setters.setQ(sp.get("q") || "");
    if (sp.has("text")) setters.setTextSearch(sp.get("text") || "");
    if (sp.has("colors")) setters.setColors((sp.get("colors") || "").split(",").filter(Boolean));
    if (sp.has("types")) setters.setTypes((sp.get("types") || "").split(",").filter(Boolean));
    if (sp.has("cost")) setters.setCost(sp.get("cost") || "Any");
    if (sp.has("rarity")) setters.setRarity(sp.get("rarity") || "");
    if (sp.has("set")) setters.setSetName(sp.get("set") || "");
    if (sp.has("pagesize")) setters.setPagesize(Number(sp.get("pagesize") || 24));
    if (sp.has("orderby")) setters.setOrderby(sp.get("orderby") || "Color,Set_Num,Name");
    if (sp.has("dir")) setters.setSortdirection(sp.get("dir") || "ASC");
    // eslint-disable-next-line
  }, []);

  // Persist to URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (textSearch) sp.set("text", textSearch);
    if (colors.length) sp.set("colors", colors.join(","));
    if (types.length) sp.set("types", types.join(","));
    if (cost !== "Any") sp.set("cost", cost);
    if (rarity) sp.set("rarity", rarity);
    if (setName) sp.set("set", setName);
    if (pagesize !== 24) sp.set("pagesize", String(pagesize));
    if (orderby !== "Color,Set_Num,Name") sp.set("orderby", orderby);
    if (sortdirection !== "ASC") sp.set("dir", sortdirection);
    const qs = sp.toString();
    const url = qs ? `?${qs}` : window.location.pathname;
    window.history.replaceState({}, "", url);
  }, [q, textSearch, colors, types, cost, rarity, setName, pagesize, orderby, sortdirection]);
}

/** =========================
 *  Main App
 * ========================= */
export default function App() {
  // Filters / search (multi-select for colors/types)
  const [q, setQ] = useState("");
  const [textSearch, setTextSearch] = useState("");
  const [colors, setColors] = useState([]);
  const [types, setTypes] = useState([]);
  const [cost, setCost] = useState("Any");
  const [rarity, setRarity] = useState("");
  const [setName, setSetName] = useState("");

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

  // Infinite scroll sentinel
  const sentinelRef = useRef(null);

  // Debounce timer
  const debounceRef = useRef(0);

  // Toasts
  const { toasts, push } = useToasts();

  // URL sync
  useUrlSync(
    { q, textSearch, colors, types, cost, rarity, setName, pagesize, orderby, sortdirection },
    { setQ, setTextSearch, setColors, setTypes, setCost, setRarity, setSetName, setPagesize, setOrderby, setSortdirection }
  );

  // localStorage persistence
  useEffect(() => {
    try {
      const raw = localStorage.getItem("lorcana.deckbuilder.v2");
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.deck) setDeck(saved.deck);
      if (saved.filters) {
        const f = saved.filters;
        setQ(f.q || "");
        setTextSearch(f.textSearch || "");
        setColors(f.colors || []);
        setTypes(f.types || []);
        setCost(f.cost || "Any");
        setRarity(f.rarity || "");
        setSetName(f.setName || "");
        setPagesize(f.pagesize || 24);
        setOrderby(f.orderby || "Color,Set_Num,Name");
        setSortdirection(f.sortdirection || "ASC");
      }
    } catch {}
  }, []);
  useEffect(() => {
    const payload = {
      deck,
      filters: { q, textSearch, colors, types, cost, rarity, setName, pagesize, orderby, sortdirection },
    };
    try {
      localStorage.setItem("lorcana.deckbuilder.v2", JSON.stringify(payload));
    } catch {}
  }, [deck, q, textSearch, colors, types, cost, rarity, setName, pagesize, orderby, sortdirection]);

  // Keyboard shortcuts: + / - adjust lastAddedKey in deck
  useEffect(() => {
    function onKey(e) {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable)) return;
      if (!lastAddedKey) return;
      if (e.key === "+") {
        setDeck((prev) => {
          const d = prev[lastAddedKey];
          if (!d) return prev;
          return { ...prev, [lastAddedKey]: { ...d, __count: (d.__count || 0) + 1 } };
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

  // Fetch (initial & whenever filters change)
  useEffect(() => {
    clearTimeout(debounceRef.current);
    setLoading(true);
    setErr("");
    debounceRef.current = setTimeout(async () => {
      try {
        const firstPage = await fetchCards({
          q,
          colors,
          types,
          cost,
          set: setName || undefined,
          rarity: rarity || undefined,
          text: textSearch || undefined,
          page: 1,
          pagesize,
          orderby,
          sortdirection,
        });
        setCards(firstPage);
        setPage(1);
        setHasMore(firstPage.length === pagesize);
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
  }, [q, textSearch, colors.join("|"), types.join("|"), cost, rarity, setName, pagesize, orderby, sortdirection]);

  // Infinite scroll observer
  useEffect(() => {
    if (!sentinelRef.current) return;
    const el = sentinelRef.current;
    const io = new IntersectionObserver(async (entries) => {
      const [entry] = entries;
      if (!entry.isIntersecting) return;
      if (loading || !hasMore) return;
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
          page: next,
          pagesize,
          orderby,
          sortdirection,
        });
        setCards((prev) => [...prev, ...data]);
        setPage(next);
        setHasMore(data.length === pagesize);
      } catch (e) {
        setErr(e?.message || "Failed to load more");
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [page, hasMore, loading, q, textSearch, colors.join("|"), types.join("|"), cost, rarity, setName, pagesize, orderby, sortdirection]);

  // Deck totals & analytics
  const totalDeckCards = useMemo(
    () => Object.values(deck).reduce((sum, d) => sum + (d.__count || 0), 0),
    [deck]
  );
  const manaCurve = useMemo(() => {
    const buckets = { "0":0,"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9+":0 };
    for (const d of Object.values(deck)) {
      const cost = Number(d.Cost ?? 0);
      const key = cost >= 9 ? "9+" : String(cost);
      buckets[key] = (buckets[key] || 0) + (d.__count || 0);
    }
    return Object.entries(buckets).map(([k,v]) => ({ cost: k, count: v }));
  }, [deck]);
  const inkDistribution = useMemo(() => {
    const cnt = {};
    for (const d of Object.values(deck)) {
      const color = d.Color || "Unknown";
      cnt[color] = (cnt[color] || 0) + (d.__count || 0);
    }
    return Object.entries(cnt)
      .map(([ink, count]) => ({ ink, count }))
      .sort((a,b) => b.count - a.count);
  }, [deck]);

  // Actions
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

  // Exports
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
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
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
        const { sx, sy, sw, sh, dx, dy, dw, dh } = cover(img.width, img.height, cardW, cardH, x, y);
        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);

        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(x, y + cardH, cardW, badgeH);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 20px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
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
    let sx = 0, sy = 0, sw2 = sw, sh2 = sh;
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

  // Bulk import from pasted list (naive parser)
  function importFromText(text) {
    // supports lines like: "3x Card Name" or "Card Name x3"
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const parsed = [];
    for (const line of lines) {
      let m1 = line.match(/^(\d+)[xX]?\s+(.+)$/);
      let m2 = line.match(/^(.+?)\s+[xX](\d+)$/);
      if (m1) {
        const count = Number(m1[1] || 1);
        const name = (m1[2] || "").trim();
        if (name) parsed.push({ name, count: isNaN(count) ? 1 : count });
      } else if (m2) {
        const count = Number(m2[2] || 1);
        const name = (m2[1] || "").trim();
        if (name) parsed.push({ name, count: isNaN(count) ? 1 : count });
      } else {
        parsed.push({ name: line, count: 1 });
      }
    }
    if (!parsed.length) return;

    // Merge into deck by name (best-effort; may mix printings)
    setDeck((prev) => {
      const copy = { ...prev };
      const nameIndex = {};
      for (const [k, d] of Object.entries(copy)) {
        const nm = (d.Name || "").trim().toLowerCase();
        if (!nm) continue;
        nameIndex[nm] = k;
      }
      for (const { name, count } of parsed) {
        const nm = name.toLowerCase();
        const key = nameIndex[nm];
        if (key && copy[key]) {
          copy[key].__count = (copy[key].__count || 0) + count;
        } else {
          // placeholder if not found
          copy[`name-only|${name}`] = { Name: name, __count: count, Color: "—", Cost: "—", Type: "—", Rarity: "—", Set: "—", Set_Num: "—", Image: "" };
        }
      }
      return copy;
    });
    push("Imported deck from text", "success");
  }

  function importCSV(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result.toString();
      const rows = text.split(/\r?\n/).map((l) => l.split(","));
      const header = rows.shift() || [];
      const idx = (name) => header.findIndex((h) => h.trim().toLowerCase() === name);
      const iName = idx("name");
      const iCount = idx("count");
      if (iName === -1) return alert("CSV missing 'Name' header");
      setDeck((prev) => {
        const copy = { ...prev };
        for (const r of rows) {
          if (!r || !r.length) continue;
          const name = (r[iName] || "").trim();
          if (!name) continue;
          const count = Number((iCount !== -1 ? r[iCount] : "1") || "1") || 1;
          const nm = name.toLowerCase();
          const existingKey = Object.keys(copy).find((k) => (copy[k].Name || "").trim().toLowerCase() === nm);
          if (existingKey) copy[existingKey].__count = (copy[existingKey].__count || 0) + count;
          else copy[`name-only|${name}`] = { Name: name, __count: count, Color: "—", Cost: "—", Type: "—", Rarity: "—", Set: "—", Set_Num: "—", Image: "" };
        }
        return copy;
      });
      push("Imported CSV", "success");
    };
    reader.readAsText(file);
  }

  const issues = deckIssues(deck);

  // Sorted render order (stable + name tiebreak)
  const sorted = useMemo(() => {
    const copy = cards.slice();
    copy.sort((a, b) => String(a.Name || "").localeCompare(String(b.Name || "")));
    return copy;
  }, [cards]);

  // UI helpers
  const toggleSel = (arr, setArr, value) => {
    setPage(1);
    setArr(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-white">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className={`px-3 py-2 rounded-md border text-sm shadow ${t.tone === "success" ? "bg-emerald-600/20 border-emerald-500/40" : t.tone === "info" ? "bg-sky-600/20 border-sky-500/40" : "bg-rose-600/20 border-rose-500/40"}`}>
            {t.msg}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center gap-3">
        <h1 className="text-xl font-semibold">Lorcana Deck Builder</h1>
        <div className="text-xs text-white/60 ml-auto">Data: {BASE.replace(/^https?:\/\//, "")}</div>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        {/* Left: Search & Results */}
        <div>
          {/* Search row */}
          <div className="flex flex-wrap gap-2 items-center mb-3">
            <input
              className="px-3 py-2 rounded-md bg-[#0f1324] border border-white/10 outline-none"
              placeholder="Search name…"
              value={q}
              onChange={(e) => { setPage(1); setQ(e.target.value); }}
              style={{ width: 280 }}
            />
            <input
              className="px-3 py-2 rounded-md bg-[#0f1324] border border-white/10 outline-none"
              placeholder="Text in rules…"
              value={textSearch}
              onChange={(e) => { setPage(1); setTextSearch(e.target.value); }}
              style={{ width: 240 }}
            />
            <button
              className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
              onClick={() => setFiltersOpen(true)}
            >
              Filters
            </button>

            <div className="ml-auto flex items-center gap-2">
              <select
                className="px-2 py-2 rounded-md bg-[#0f1324] border border-white/10"
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
                onChange={(e) => { setPage(1); setPagesize(Number(e.target.value)); }}
              >
                {[12, 24, 48].map((n) => <option key={n} value={n}>{n}/page</option>)}
              </select>
            </div>
          </div>

          {/* Results grid */}
          {err && (
            <div className="mb-3 px-3 py-2 text-sm rounded-md bg-rose-600/20 border border-rose-500/40 text-rose-200">
              {err}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
            {sorted.map((c) => {
              const img = proxyImageUrl(c.Image);
              return (
                <button
                  key={`${c.Set_ID}-${c.Name}-${c.Image}-${c.Set_Num}`}
                  className="bg-[#0f1320] rounded-lg overflow-hidden border border-white/10 text-left hover:border-white/20 transition"
                  title="Click to add to deck"
                  onClick={() => { addToDeck(c, 1); push(`Added ${c.Name}`, "success"); }}
                  onDoubleClick={(e) => { e.stopPropagation(); setModalCard(c); }}
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
                            encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='300' height='420'><rect width='100%' height='100%' fill='#111827'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='system-ui' font-size='14' fill='#9ca3af'>Image unavailable</text></svg>");
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-white/40">No image</div>
                    )}
                  </div>
                  <div className="p-2 text-sm">
                    <div className="font-medium line-clamp-2">{c.Name}</div>
                    <div className="text-xs text-white/60">{c.Color ?? "—"} · Cost {c.Cost ?? "—"}</div>
                    <div className="text-xs text-white/40">{c.Rarity ?? "—"} · {c.Set ?? "—"}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-8" />
          {loading && <div className="text-white/60 mt-2">Loading…</div>}
          {!loading && !sorted.length && <div className="text-white/60 mt-2">0 results</div>}
        </div>

        {/* Right: Deck panel */}
        <div className="bg-[#0f1324] rounded-xl border border-white/10 p-3 h-fit sticky top-4">
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

          {issues.length > 0 && (
            <div className="mb-2 px-3 py-2 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-200 text-sm">
              {issues.map((t) => <div key={t}>• {t}</div>)}
            </div>
          )}

          {/* Deck list */}
          <div className="max-h-[48vh] overflow-auto pr-1">
            {Object.values(deck).length === 0 ? (
              <div className="text-sm text-white/60">Click cards (or double-click for details) to add to your deck.</div>
            ) : (
              <ul className="space-y-1">
                {Object.values(deck)
                  .sort((a, b) => {
                    const ia = String(a.Color || ""); const ib = String(b.Color || "");
                    if (ia !== ib) return ia.localeCompare(ib);
                    const ca = Number(a.Cost ?? 0); const cb = Number(b.Cost ?? 0);
                    if (ca !== cb) return ca - cb;
                    return String(a.Name || "").localeCompare(String(b.Name || ""));
                  })}
                  .map((d) => (
                    <li key={cardKey(d)} className="flex items-center gap-2 p-2 rounded-lg bg-black/10 border border-white/10">
                      <div className="text-xs w-6 text-center font-semibold">{d.__count}×</div>
                      <div className="flex-1">
                        <div className="text-sm">{d.Name}</div>
                        <div className="text-xs text-white/50">{d.Color ?? "—"} · Cost {d.Cost ?? "—"} · {d.Rarity ?? "—"}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          className="px-2 py-1 text-sm rounded-md bg-white/10 hover:bg-white/20"
                          onClick={() => addToDeck(d, -1)}
                          title="Remove one"
                        >
                          −
                        </button>
                        <input
                          className="w-14 px-2 py-1 text-sm rounded-md bg-[#0a0f1d] border border-white/10 text-center"
                          value={d.__count}
                          onChange={(e) => setCount(d, e.target.value)}
                        />
                        <button
                          className="px-2 py-1 text-sm rounded-md bg-white/10 hover:bg-white/20"
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

          {/* Exports & Imports */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm" onClick={exportJSON}>Export JSON</button>
            <button className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm" onClick={exportCSV}>Export CSV</button>
            <button className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm" onClick={exportPNG} title="Exports a PNG sheet">Export PNG</button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
              onClick={() => {
                const txt = Object.values(deck)
                  .sort((a, b) => String(a.Name || "").localeCompare(String(b.Name || "")))
                  .map((d) => `${d.__count}x ${d.Name}`).join("\n");
                if (copyText(txt)) push("Decklist copied", "success");
                else push("Copy failed", "error");
              }}
            >
              Copy Decklist
            </button>
            <label className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-center cursor-pointer">
              Import CSV
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCSV(e.target.files[0])} />
            </label>
          </div>

          <textarea
            className="mt-2 w-full min-h-[80px] px-3 py-2 rounded-md bg-[#0a0f1d] border border-white/10 text-sm"
            placeholder="Paste decklist (e.g., '4x Card Name') and click Import Text…"
            id="import-text"
          />
          <button
            className="mt-2 w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
            onClick={() => {
              const el = document.getElementById("import-text");
              if (el && el.value.trim()) importFromText(el.value);
            }}
          >
            Import Text
          </button>

          {/* Analytics */}
          <div className="mt-4">
            <div className="text-sm text-white/70 mb-2">Mana Curve</div>
            <div className="h-40 bg-black/10 rounded-lg border border-white/10 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={manaCurve}>
                  <XAxis dataKey="cost" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm text-white/70 mb-2">Ink Distribution</div>
            <div className="h-40 bg-black/10 rounded-lg border border-white/10 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={inkDistribution} dataKey="count" nameKey="ink" outerRadius={70} label>
                    {inkDistribution.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={INK_COLORS[entry.ink] || "#999"} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </div>
      </div>

      {/* Filters Drawer */}
      {filtersOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setFiltersOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[480px] bg-[#0a0f1d] border-l border-white/10 p-4 overflow-auto">
            <div className="flex items-center mb-4">
              <h3 className="text-lg font-semibold">Filters</h3>
              <button
                className="ml-auto px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
                onClick={() => { setPage(1); setFiltersOpen(false); }}
              >
                Done
              </button>
            </div>

            <div className="space-y-5">
              {/* Ink multi-select */}
              <div>
                <div className="text-sm text-white/70 mb-2">Ink</div>
                <div className="flex flex-wrap gap-2">
                  {INKS.map((ink) => {
                    const active = colors.includes(ink);
                    return (
                      <button
                        key={ink}
                        className={`px-3 py-1.5 rounded-full border text-sm ${active ? "bg-white/20 border-white/40" : "bg-white/5 border-white/10 hover:bg-white/10"}`}
                        onClick={() => toggleSel(colors, setColors, ink)}
                      >
                        {ink}
                      </button>
                    );
                  })}
                  {colors.length > 0 && (
                    <button className="ml-auto px-3 py-1.5 rounded-full border border-white/10 text-xs bg-white/5 hover:bg-white/10" onClick={() => setColors([])}>
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
                        className={`px-3 py-1.5 rounded-full border text-sm ${active ? "bg-white/20 border-white/40" : "bg-white/5 border-white/10 hover:bg-white/10"}`}
                        onClick={() => toggleSel(types, setTypes, t)}
                      >
                        {t}
                      </button>
                    );
                  })}
                  {types.length > 0 && (
                    <button className="ml-auto px-3 py-1.5 rounded-full border border-white/10 text-xs bg-white/5 hover:bg-white/10" onClick={() => setTypes([])}>
                      Clear Type
                    </button>
                  )}
                </div>
              </div>

              {/* Cost quick chips */}
              <div>
                <div className="text-sm text-white/70 mb-2">Cost</div>
                <div className="flex flex-wrap gap-2">
                  {COSTS.map((c) => (
                    <button
                      key={c}
                      className={`px-3 py-1.5 rounded-full border text-sm ${cost === c ? "bg-white/20 border-white/40" : "bg-white/5 border-white/10 hover:bg-white/10"}`}
                      onClick={() => { setCost(c); setPage(1); }}
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
                  onChange={(e) => { setRarity(e.target.value); setPage(1); }}
                >
                  <option value="">Any</option>
                  {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Set */}
              <div>
                <div className="text-sm text-white/70 mb-2">Set</div>
                <input
                  list="sets"
                  className="w-full px-3 py-2 rounded-md bg-[#0f1324] border border-white/10"
                  placeholder="Any (type to search)…"
                  value={setName}
                  onChange={(e) => { setSetName(e.target.value); setPage(1); }}
                />
                <datalist id="sets">
                  {SETS.map((s) => <option key={s} value={s} />)}
                </datalist>
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
          <div className="absolute inset-0 bg-black/60" onClick={() => setModalCard(null)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl bg-[#0b1120] rounded-xl border border-white/10 overflow-hidden">
              <div className="flex">
                <div className="w-1/2 bg-black/40">
                  {modalCard.Image ? (
                    <img src={proxyImageUrl(modalCard.Image)} alt={modalCard.Name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/60">No image</div>
                  )}
                </div>
                <div className="w-1/2 p-4">
                  <div className="flex items-start gap-2">
                    <h4 className="text-lg font-semibold">{modalCard.Name}</h4>
                    <button className="ml-auto px-2 py-1 rounded-md bg-white/10 hover:bg-white/20" onClick={() => setModalCard(null)}>✕</button>
                  </div>
                  <div className="text-sm text-white/70 mt-1">
                    {modalCard.Color ?? "—"} · Cost {modalCard.Cost ?? "—"} · {modalCard.Rarity ?? "—"}
                  </div>
                  <div className="text-sm text-white/60 mt-3 whitespace-pre-wrap">
                    {modalCard.Rules || "—"}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10" onClick={() => { addToDeck(modalCard, 1); push(`Added ${modalCard.Name}`, "success"); }}>
                      +1 to Deck
                    </button>
                    <button className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10" onClick={() => { addToDeck(modalCard, 4); push(`Added 4× ${modalCard.Name}`, "success"); }}>
                      +4 to Deck
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
