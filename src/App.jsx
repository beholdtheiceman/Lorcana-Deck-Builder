import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

/* ===========================
   Config.
   =========================== */

// Switch here if you want to try a different source later
const DATA_SOURCE_LABEL = "lorcana-api";

// API: tries lorcana-api first; gracefully empties on error
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
  format = "infinity", // "core" or "infinity"
}) {
  // Build a simple query; different backends can be mapped here later
  const params = new URLSearchParams();
  if (q && q.trim()) params.set("search", q.trim());
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (inks.length) params.set("inks", inks.join(","));
  if (types.length) params.set("types", types.join(","));
  if (sets.length) params.set("sets", sets.join(","));
  if (costs.length) params.set("costs", costs.join(","));
  if (keywords.length) params.set("keywords", keywords.join(","));
  if (archetypes.length) params.set("archetypes", archetypes.join(","));
  if (format) params.set("format", format);

  // NOTE: Adjust the endpoint if your lorcana-api host differs
  const url = `${LORCAST_BASE.replace(/\/+$/, "")}/cards?${params.toString()}`;

  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    // Expecting { cards: [...], total: n } but we normalize either way
    const cards = Array.isArray(json?.cards) ? json.cards : Array.isArray(json) ? json : [];
    const total = Number(json?.total ?? cards.length);
    return { cards, total };
  } catch (e) {
    console.warn("Card search failed", e);
    return { cards: [], total: 0 };
  }
}

/* ===========================
   Image proxy helpers
   =========================== */

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
  // We keep original size (no w/h) to preserve quality in exports; the browser will size for grid
  return `https://images.weserv.nl/?url=${encodeURIComponent(src)}&output=jpg`;
}

function getCardImg(card) {
  const raw =
    card?.image_uris?.digital?.normal ||
    card?.image_uris?.digital?.small ||
    card?.image_uris?.normal ||
    card?.image_url ||
    card?._raw?.image_front ||
    card?._raw?.image ||
    (Array.isArray(card?._raw?.images) ? card._raw.images[0] : null);

  if (!raw) return null;
  return proxyImageUrl(raw);
}

/* ===========================
   Utilities
   =========================== */

function keyForCard(card) {
  // Use a stable key across sets/versions if possible
  // Prefer numeric set + number if present; fall back to id or name
  const setNo =
    card.setNumber ?? card.set_no ?? card.setNumberRaw ?? card.setCode ?? "";
  const num = card.number ?? card.cardNumber ?? card.no ?? "";
  const id = card.id ?? card._id ?? `${card.name}|${setNo}|${num}`;
  return String(id);
}

function getInk(card) {
  return card.ink || card.inkColor || card.color || card.ink_color || "";
}

function getCost(card) {
  return Number(
    card.cost ??
      card.inkCost ??
      card.ink_cost ??
      card.play_cost ??
      (card.stats && card.stats.cost) ??
      0
  );
}

function getType(card) {
  // Character, Action, Song, Item, Location
  const t =
    card.type ||
    card.cardType ||
    card.category ||
    (Array.isArray(card.types) ? card.types[0] : "");
  return t || "";
}

function isInkable(card) {
  // many feeds use "inkwell"/"inkable"; default to false
  const v =
    card.inkwell ??
    card.inkable ??
    card.inkWell ??
    (card.rules && card.rules.includes("inkwell")) ??
    false;
  return Boolean(v);
}

function getSetSortKey(card) {
  // Sort DESC by set release if available (most recent first)
  // Fallback ascending by human set code
  const setIdx =
    card.set_index ??
    card.setIndex ??
    card.set_no ??
    card.setNumberRaw ??
    card.setCode ??
    0;
  return setIdx;
}

function getCardNumber(card) {
  return Number(
    card.number ??
      card.cardNumber ??
      card.no ??
      card.collector_number ??
      0
  );
}

function friendlyInk(ink) {
  if (!ink) return "—";
  return String(ink);
}

function countCurve(entries) {
  const buckets = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9+": 0 };
  entries.forEach(({ card, count }) => {
    const c = getCost(card);
    const key = c >= 9 ? "9+" : String(Math.max(1, c));
    buckets[key] += count;
  });
  return Object.keys(buckets).map((k) => ({ cost: k, count: buckets[k] }));
}

/* ===========================
   Small UI primitives
   =========================== */

function Btn({ children, onClick, className = "", title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={
        "px-3 py-1.5 rounded-md bg-[#20263a] hover:bg-[#263046] text-sm border border-white/10 " +
        className
      }
    >
      {children}
    </button>
  );
}

/* ===========================
   Card Tile
   =========================== */

function CardTile({ card, onAdd }) {
  const img = getCardImg(card);
  const name = `${card.name}${
    card.version ? ` — ${card.version}` : ""
  }`;
  const ink = friendlyInk(getInk(card));
  const cost = getCost(card);

  return (
    <div className="group bg-[#0f1320] hover:bg-[#141828] rounded-xl p-2 flex flex-col gap-2 border border-white/10 transition">
      <div className="aspect-[488/681] w-full bg-black/40 rounded-lg overflow-hidden flex items-center justify-center">
        {img ? (
          <img
            loading="lazy"
            src={img}
            alt={name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-white/40 text-xs">No image</div>
        )}
      </div>

      <div className="px-1">
        <div className="text-sm font-semibold line-clamp-2">{name}</div>
        <div className="mt-1 flex gap-2">
          <span className="text-[11px] px-1.5 py-0.5 bg-white/10 rounded-full">
            {ink}
          </span>
          <span className="text-[11px] px-1.5 py-0.5 bg-white/10 rounded-full">
            Cost {cost}
          </span>
        </div>
        <Btn
          onClick={() => onAdd(card)}
          className="mt-2 w-full bg-indigo-600 hover:bg-indigo-500"
        >
          + Add
        </Btn>
      </div>
    </div>
  );
}

/* ===========================
   Deck Row
   =========================== */

function DeckRow({ entry, onInc, onDec, onRemove }) {
  const { card, count } = entry;
  const name = `${card.name}${card.version ? ` — ${card.version}` : ""}`;
  const img = getCardImg(card);
  const ink = friendlyInk(getInk(card));
  const cost = getCost(card);

  return (
    <div className="flex items-center gap-2 py-2 border-b border-white/10">
      <div className="w-10 h-14 bg-black/40 rounded overflow-hidden flex items-center justify-center">
        {img && (
          <img
            loading="lazy"
            src={img}
            alt={name}
            referrerPolicy="no-referrer"
            className="h-full object-contain"
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{name}</div>
        <div className="text-xs text-white/60">
          {ink} · Cost {cost}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Btn onClick={onDec} title="Decrease">-</Btn>
        <div className="w-6 text-center">{count}</div>
        <Btn onClick={onInc} title="Increase">+</Btn>
      </div>
      <Btn onClick={onRemove} className="ml-2 border-red-500/30 text-red-300">
        Remove
      </Btn>
    </div>
  );
}

/* ===========================
   Export poster with count bubbles
   =========================== */

async function exportPosterPNG(entries, deckTitle = "Deck") {
  // entries: [{card, count}]
  const W = 1920;
  const H = 1080;
  const P = 24;
  const gridW = Math.floor(W * 0.70);
  const infoW = W - gridW;

  // grid cell size
  const cols = 8;
  const cellW = Math.floor((gridW - P * 2 - (cols - 1) * 10) / cols);
  const cellH = Math.floor(cellW * (681 / 488)); // Lorcana ratio

  // Prepare images
  const uniq = entries.slice().sort((a, b) => {
    // Order by ink, then set (desc recent first), then number asc
    const ia = String(getInk(a.card));
    const ib = String(getInk(b.card));
    if (ia !== ib) return ia.localeCompare(ib);

    const sa = getSetSortKey(a.card);
    const sb = getSetSortKey(b.card);
    if (sa !== sb) return sb - sa; // recent first

    const na = getCardNumber(a.card);
    const nb = getCardNumber(b.card);
    return na - nb;
  });

  const imgs = await Promise.all(
    uniq.map(async ({ card }) => {
      const src = getCardImg(card);
      if (!src) return null;
      return new Promise((resolve) => {
        const im = new Image();
        im.crossOrigin = "anonymous";
        im.referrerPolicy = "no-referrer";
        im.onload = () => resolve(im);
        im.onerror = () => resolve(null);
        im.src = src;
      });
    })
  );

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // bg
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#0b1021");
  grad.addColorStop(1, "#151b2f");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = "#fff";
  ctx.font = "bold 36px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText(deckTitle, P, P + 32);

  // Grid
  let x = P;
  let y = P + 48;
  let col = 0;

  uniq.forEach((entry, i) => {
    const im = imgs[i];
    // box
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(x, y, cellW, cellH);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);

    if (im) {
      // draw contain
      const r = Math.min(cellW / im.width, cellH / im.height);
      const iw = Math.floor(im.width * r);
      const ih = Math.floor(im.height * r);
      const ix = x + Math.floor((cellW - iw) / 2);
      const iy = y + Math.floor((cellH - ih) / 2);
      ctx.drawImage(im, ix, iy, iw, ih);
    }

    // count bubble (top-right)
    const count = entry.count;
    const bx = x + cellW - 12;
    const by = y + 12;
    ctx.beginPath();
    ctx.arc(bx, by, 14, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    const txt = String(count);
    const tm = ctx.measureText(txt);
    ctx.fillText(txt, bx - tm.width / 2, by + 5);

    // advance
    col++;
    if (col >= cols) {
      col = 0;
      x = P;
      y += cellH + 10;
    } else {
      x += cellW + 10;
    }
  });

  // Right info panel
  const rightX = gridW;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(rightX, 0, infoW, H);

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "bold 20px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText("List", rightX + 18, P + 26);

  ctx.fillStyle = "#e5e7eb";
  ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

  let ly = P + 50;
  uniq.forEach(({ card, count }) => {
    const line = `${count}x  ${card.name}${
      card.version ? ` — ${card.version}` : ""
    }`;
    ctx.fillText(line, rightX + 18, ly);
    ly += 20;
  });

  const blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png")
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "deck_poster.png";
  a.click();
  URL.revokeObjectURL(url);
}

/* ===========================
   Import: Dreamborn-style text
   =========================== */

function parseDeckText(text) {
  // Accept lines like "4x Card Name — Version [S#num]" or "4 Card Name"
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const parsed = [];
  for (const line of lines) {
    const m =
      /^(\d+)\s*x?\s+(.+?)\s*$/.exec(line) ||
      /^(\d+)\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const count = Number(m[1]);
    const name = m[2];
    parsed.push({ name, count });
  }
  return parsed;
}

/* ===========================
   Filters drawer
   =========================== */

function FiltersDrawer({
  open,
  onClose,
  inks,
  setInks,
  types,
  setTypes,
  costs,
  setCosts,
  setFormat,
  format,
}) {
  const costButtons = ["1","2","3","4","5","6","7","8","9+"];

  function toggle(list, setList, value) {
    setList((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  return (
    <div
      className={`fixed top-0 right-0 h-full w-[340px] bg-[#0c1120] border-l border-white/10 transition-transform ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
      style={{ zIndex: 40 }}
    >
      <div className="p-4 flex items-center justify-between border-b border-white/10">
        <div className="font-semibold">Filters</div>
        <Btn onClick={onClose} className="bg-emerald-600 hover:bg-emerald-500">
          Done
        </Btn>
      </div>

      <div className="p-4 space-y-6 overflow-y-auto h-[calc(100%-64px)]">
        <section>
          <div className="text-xs uppercase text-white/60 mb-2">Ink (OR)</div>
          <div className="flex flex-wrap gap-2">
            {["Amber", "Amethyst", "Emerald", "Ruby", "Sapphire", "Steel"].map(
              (ink) => (
                <button
                  key={ink}
                  onClick={() => toggle(inks, setInks, ink)}
                  className={`px-3 py-1.5 rounded-full border text-sm ${
                    inks.includes(ink)
                      ? "bg-indigo-600 border-indigo-400"
                      : "bg-[#141828] border-white/10"
                  }`}
                >
                  {ink}
                </button>
              )
            )}
          </div>
        </section>

        <section>
          <div className="text-xs uppercase text-white/60 mb-2">Type (OR)</div>
          <div className="flex flex-wrap gap-2">
            {["Character", "Action", "Song", "Item", "Location"].map((t) => (
              <button
                key={t}
                onClick={() => toggle(types, setTypes, t)}
                className={`px-3 py-1.5 rounded-full border text-sm ${
                  types.includes(t)
                    ? "bg-indigo-600 border-indigo-400"
                    : "bg-[#141828] border-white/10"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="text-xs uppercase text-white/60 mb-2">Cost</div>
          <div className="flex flex-wrap gap-2">
            {costButtons.map((c) => (
              <button
                key={c}
                onClick={() => toggle(costs, setCosts, c)}
                className={`px-3 py-1.5 rounded-full border text-sm ${
                  costs.includes(c)
                    ? "bg-indigo-600 border-indigo-400"
                    : "bg-[#141828] border-white/10"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="text-xs uppercase text-white/60 mb-2">Format</div>
          <div className="flex gap-2">
            {["core", "infinity"].map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`px-3 py-1.5 rounded-full border text-sm ${
                  format === f
                    ? "bg-indigo-600 border-indigo-400"
                    : "bg-[#141828] border-white/10"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="text-xs text-white/50 mt-2">
            core = only legal (rotations/bans applied), infinity = all cards.
          </div>
        </section>
      </div>
    </div>
  );
}

/* ===========================
   Main App
   =========================== */

export default function App() {
  // Search
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [cards, setCards] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filters
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inks, setInks] = useState([]);
  const [types, setTypes] = useState([]);
  const [costs, setCosts] = useState([]);
  const [format, setFormat] = useState("infinity");

  // Sort/group
  const [groupBy, setGroupBy] = useState("Ink"); // "Ink" | "Type"
  const [sortBy, setSortBy] = useState("Cost"); // "Cost" | "Set"

  // Deck
  const [deck, setDeck] = useState([]); // [{ key, card, count }]
  const totalInDeck = deck.reduce((s, e) => s + e.count, 0);
  const inksInDeck = useMemo(() => {
    const s = new Set(deck.map((e) => friendlyInk(getInk(e.card))));
    s.delete("—");
    return Array.from(s);
  }, [deck]);

  // Import modal
  const [importOpen, setImportOpen] = useState(false);
  const importTextRef = useRef(null);

  // Query execution
  useEffect(() => {
    let ignore = false;
    async function go() {
      setLoading(true);
      const { cards: found, total } = await apiSearchCards({
        q,
        page,
        pageSize: 24,
        inks,
        types,
        costs,
        format,
      });
      if (!ignore) {
        setCards(found);
        setTotal(total);
      }
      setLoading(false);
    }
    go();
    return () => {
      ignore = true;
    };
  }, [q, page, inks, types, costs, format]);

  // Derived: sorted cards for grid
  const gridCards = useMemo(() => {
    const copy = cards.slice();

    // Sort by Ink -> Set(desc) -> Number, OR by Type -> Set(desc) -> Number
    copy.sort((a, b) => {
      if (groupBy === "Ink") {
        const ia = String(getInk(a));
        const ib = String(getInk(b));
        if (ia !== ib) return ia.localeCompare(ib);
      } else {
        const ta = String(getType(a));
        const tb = String(getType(b));
        if (ta !== tb) return ta.localeCompare(tb);
      }

      if (sortBy === "Set") {
        const sa = getSetSortKey(a);
        const sb = getSetSortKey(b);
        if (sa !== sb) return sb - sa; // most recent first
      } else {
        // Cost
        const ca = getCost(a);
        const cb = getCost(b);
        if (ca !== cb) return ca - cb;
      }

      const na = getCardNumber(a);
      const nb = getCardNumber(b);
      return na - nb;
    });

    return copy;
  }, [cards, groupBy, sortBy]);

  // Deck ops
  function addCard(card) {
    const k = keyForCard(card);
    setDeck((d) => {
      const i = d.findIndex((e) => e.key === k);
      if (i >= 0) {
        const copy = d.slice();
        copy[i] = { ...copy[i], count: Math.min(copy[i].count + 1, 4) };
        return copy;
      }
      return [...d, { key: k, card, count: 1 }];
    });
  }
  function incCard(k) {
    setDeck((d) =>
      d.map((e) => (e.key === k ? { ...e, count: Math.min(e.count + 1, 4) } : e))
    );
  }
  function decCard(k) {
    setDeck((d) =>
      d
        .map((e) => (e.key === k ? { ...e, count: Math.max(e.count - 1, 0) } : e))
        .filter((e) => e.count > 0)
    );
  }
  function removeCard(k) {
    setDeck((d) => d.filter((e) => e.key !== k));
  }
  function clearDeck() {
    setDeck([]);
  }

  // Inkable/uninkable
  const inkableCount = useMemo(
    () => deck.reduce((s, e) => s + (isInkable(e.card) ? e.count : 0), 0),
    [deck]
  );
  const uninkableCount = totalInDeck - inkableCount;

  // Curve
  const curveData = useMemo(() => countCurve(deck), [deck]);

  // Import handler
  async function handleImportText() {
    const text = importTextRef.current?.value || "";
    if (!text.trim()) return setImportOpen(false);
    const parsed = parseDeckText(text);
    if (!parsed.length) return setImportOpen(false);

    // naive import by name search; we fetch each name and match first exact
    const next = [];
    for (const row of parsed) {
      try {
        const { cards: found } = await apiSearchCards({ q: row.name, page: 1, pageSize: 8 });
        const match =
          found.find((c) => (c.name || "").toLowerCase() === row.name.toLowerCase()) ||
          found[0];
        if (match) {
          next.push({ key: keyForCard(match), card: match, count: Math.min(row.count, 4) });
        }
      } catch {}
    }
    if (next.length) setDeck(next);
    setImportOpen(false);
  }

  // Print decklist sheet
  function printDecklistPNG() {
    const lines = deck
      .slice()
      .sort((a, b) => {
        const ia = String(getInk(a.card));
        const ib = String(getInk(b.card));
        if (ia !== ib) return ia.localeCompare(ib);
        const ca = getCost(a.card);
        const cb = getCost(b.card);
        if (ca !== cb) return ca - cb;
        return (a.card.name || "").localeCompare(b.card.name || "");
      })
      .map(
        ({ card, count }) =>
          `${count}x  ${card.name}${card.version ? ` — ${card.version}` : ""}  ·  ${friendlyInk(
            getInk(card)
          )} · Cost ${getCost(card)}`
      );

    const W = 800;
    const H = Math.max(600, 120 + lines.length * 24);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0b1021";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText("Decklist", 20, 40);
    ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    let y = 80;
    lines.forEach((ln) => {
      ctx.fillText(ln, 20, y);
      y += 22;
    });
    canvas.toBlob((b) => {
      const url = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = url;
      a.download = "decklist.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0f1d]/95 backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-3">
          <div className="text-lg font-semibold">lorcana deck builder</div>

          <Btn onClick={() => setDrawerOpen(true)}>Filters</Btn>
          <Btn onClick={() => setImportOpen(true)}>Import</Btn>
          <Btn onClick={printDecklistPNG}>Print Decklist</Btn>

          <div className="ml-auto text-xs text-white/60">
            Data & Images: {DATA_SOURCE_LABEL}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-4">
        {/* Left: search + grid */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1">
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search…"
                className="w-full px-3 py-2 rounded-md bg-[#0f1324] border border-white/10 outline-none"
              />
            </div>
            <div className="px-2 py-1 text-xs rounded bg-[#0f1324] border border-white/10">
              {cards.length} cards
            </div>
            <Btn onClick={() => setDrawerOpen(true)}>Show all</Btn>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="text-sm text-white/60">Group by</div>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="bg-[#0f1324] border border-white/10 rounded px-2 py-1 text-sm"
            >
              <option>Ink</option>
              <option>Type</option>
            </select>

            <div className="text-sm text-white/60 ml-4">Sort by</div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#0f1324] border border-white/10 rounded px-2 py-1 text-sm"
            >
              <option>Cost</option>
              <option>Set</option>
            </select>
          </div>

          {loading ? (
            <div className="text-white/60">Loading…</div>
          ) : gridCards.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {gridCards.map((c) => (
                <CardTile key={keyForCard(c)} card={c} onAdd={addCard} />
              ))}
            </div>
          ) : (
            <div className="text-white/60">0 results</div>
          )}
        </div>

        {/* Right: deck pane */}
        <div className="min-w-0 border border-white/10 rounded-xl p-3 bg-[#0c1120] sticky top-[68px] h-[calc(100vh-88px)] overflow-auto">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Unsaved deck</div>
            <div className="text-xs">
              Inkable:{" "}
              <span className="text-emerald-300">{inkableCount}</span>{" "}
              &nbsp; Uninkable:{" "}
              <span className="text-rose-300">{uninkableCount}</span>
            </div>
          </div>

          <div className="text-xs text-white/60 mt-1">
            {totalInDeck} cards · Inks:{" "}
            {inksInDeck.join(", ") || "—"}{" "}
            {totalInDeck < 60 && (
              <span className="ml-1 text-amber-300">(needs ≥ 60)</span>
            )}
          </div>

          <div className="flex gap-2 mt-3">
            <Btn
              onClick={() => exportPosterPNG(deck, "Deck")}
              className="bg-indigo-600 hover:bg-indigo-500"
            >
              Export PNG
            </Btn>
            <Btn onClick={printDecklistPNG}>Export Decklist (PNG)</Btn>
            <Btn onClick={clearDeck} className="ml-auto">
              Clear
            </Btn>
          </div>

          <div className="mt-4">
            {deck.length === 0 ? (
              <div className="text-sm text-white/60">Add cards from the grid →</div>
            ) : (
              deck.map((e) => (
                <DeckRow
                  key={e.key}
                  entry={e}
                  onInc={() => incCard(e.key)}
                  onDec={() => decCard(e.key)}
                  onRemove={() => removeCard(e.key)}
                />
              ))
            )}
          </div>

          {/* Curve */}
          <div className="mt-4">
            <div className="font-semibold mb-2">Curve</div>
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={curveData}>
                  <XAxis dataKey="cost" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      background: "#0f1324",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-xs text-white/50 mt-1">
              Rules: ≥60 min, ≤4 per full name, ≤2 inks.
            </div>
          </div>
        </div>
      </div>

      {/* Filters drawer */}
      <FiltersDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        inks={inks}
        setInks={setInks}
        types={types}
        setTypes={setTypes}
        costs={costs}
        setCosts={setCosts}
        format={format}
        setFormat={setFormat}
      />

      {/* Import modal (very lightweight) */}
      {importOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4"
          style={{ zIndex: 50 }}
        >
          <div className="w-full max-w-xl rounded-xl bg-[#0c1120] border border-white/10 p-4">
            <div className="font-semibold mb-2">Import decklist (text)</div>
            <textarea
              ref={importTextRef}
              rows={10}
              placeholder={`Example:\n4x Tipo — Growing Son\n3x Monstro — Infamous Whale\n…`}
              className="w-full rounded-md bg-[#0f1324] border border-white/10 p-2 text-sm outline-none"
            />
            <div className="mt-3 flex gap-2 justify-end">
              <Btn onClick={() => setImportOpen(false)}>Cancel</Btn>
              <Btn
                onClick={handleImportText}
                className="bg-indigo-600 hover:bg-indigo-500"
              >
                Import
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
