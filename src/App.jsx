import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Lorcana Deck Builder — Two‑Pane (Dreamborn‑style)
 *
 * Left pane: Filters (collapsible) + Results
 * Right pane: Deck (sticky)
 *
 * Notes:
 * - Keeps your rules: >=60 cards, <=4 per full name, <=2 inks
 * - Lorcast mapping: keywords, archetypes (t:), format core/infinity
 * - Clipboard/Export fallbacks preserved
 */

// =====================
// Types
// =====================

type Ink = "Amber" | "Amethyst" | "Emerald" | "Ruby" | "Sapphire" | "Steel";

type Card = {
  id: string;
  name: string;
  version?: string | null;
  image_uris?: { digital?: { small?: string; normal?: string; large?: string } };
  cost?: number | null;
  inkwell?: boolean;
  ink?: Ink | null;
  type?: string[];
  classifications?: string[] | null;
  text?: string | null;
  rarity?: string | null;
  set?: { id: string; code: string; name: string };
  collector_number?: string;
};

function fullNameKey(card: Card) {
  return `${card.name} — ${card.version ?? ""}`.trim();
}

// =====================
// API
// =====================

const API_ROOT = "https://api.lorcast.com/v0";

async function fetchSets(): Promise<{ id: string; name: string; code: string }[]> {
  const r = await fetch(`${API_ROOT}/sets`);
  if (!r.ok) throw new Error("Failed to load sets");
  const j = await r.json();
  return (j.results ?? []) as any[];
}

async function searchCards(
  query: string,
  unique: "cards" | "prints" = "cards"
): Promise<Card[]> {
  const url = new URL(`${API_ROOT}/cards/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("unique", unique);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error("Search failed");
  const j = await r.json();
  return (j.results ?? []) as any[];
}

// =====================
// Filters & query mapping
// =====================

type Filters = {
  text: string;
  inks: Ink[];
  types: string[];
  rarities: string[];
  sets: string[];
  costMin?: number;
  costMax?: number;
  inkwell?: "any" | "inkable" | "non-inkable";
  keywords?: string[];
  archetypes?: string[];
  format?: "any" | "core" | "infinity";
};

const ALL_INKS: Ink[] = [
  "Amber",
  "Amethyst",
  "Emerald",
  "Ruby",
  "Sapphire",
  "Steel",
];
const ALL_TYPES = ["Character", "Action", "Song", "Item", "Location"];
const ALL_RARITIES = [
  "Common",
  "Uncommon",
  "Rare",
  "Super_rare",
  "Legendary",
  "Enchanted",
  "Promo",
];
const ALL_KEYWORDS = [
  "Shift",
  "Resist",
  "Ward",
  "Reckless",
  "Challenger",
  "Evasive",
  "Rush",
  "Support",
  "Bodyguard",
  "Singer",
  "Guard",
  "Hardy",
  "Shift 1",
  "Shift 2",
  "Shift 3",
  "Shift 4",
  "Shift 5",
  "Shift 6",
  "Shift 7",
  "Shift 8",
  "Shift 9",
  "Shift 10",
  "Resist 1",
  "Resist 2",
  "Resist 3",
  "Resist 4",
  "Resist 5",
  "Reckless 1",
  "Reckless 2",
  "Reckless 3",
  "Reckless 4",
  "Reckless 5",
  "Reckless 6",
  "Reckless 7",
  "Challenger 1",
  "Challenger 2",
  "Challenger 3",
  "Challenger 4",
  "Challenger 5",
  "Challenger 6",
  "Challenger 7",
  "Challenger 8",
  "Challenger 9",
  "Challenger 10",
  "Singer 2",
  "Singer 3",
  "Singer 4",
  "Singer 5",
  "Singer 6",
  "Singer 7",
  "Singer 8",
  "Singer 9",
  "Singer 10",
];
const ALL_ARCHETYPES = [
  "Storyborn",
  "Dreamborn",
  "Floodborn",
  "Hero",
  "Villain",
  "Ally",
  "Mentor",
  "Alien",
  "Broom",
  "Captain",
  "Deity",
  "Detective",
  "Dragon",
  "Fairy",
  "Hyena",
  "Inventor",
  "King",
  "Knight",
  "Madrigal",
  "Musketeer",
  "Pirate",
  "Prince",
  "Princess",
  "Puppy",
  "Queen",
  "Racer",
  "Robot",
  "Seven Dwarfs",
  "Sorcerer",
  "Tigger",
  "Titan",
];

function buildQuery(f: Filters): string {
  const parts: string[] = [];
  const raw = f.text.trim();
  if (raw) {
    if (raw.startsWith("n:")) parts.push(`name:${JSON.stringify(raw.slice(2).trim())}`);
    else if (raw.startsWith("e:")) parts.push(`text:${JSON.stringify(raw.slice(2).trim())}`);
    else parts.push(JSON.stringify(raw));
  }
  if (f.inks.length)
    parts.push(`(${f.inks.map((i) => `i:${i.toLowerCase()}`).join(" or ")})`);
  if (f.types.length)
    parts.push(`(${f.types.map((t) => `t:${t.toLowerCase()}`).join(" or ")})`);
  if (f.rarities.length)
    parts.push(`(${f.rarities.map((r) => `r:${r.toLowerCase()}`).join(" or ")})`);
  if (f.sets.length) parts.push(`(${f.sets.map((s) => `s:${s}`).join(" or ")})`);
  if (typeof f.costMin === "number") parts.push(`c>=${f.costMin}`);
  if (typeof f.costMax === "number") parts.push(`c<=${f.costMax}`);
  if (f.inkwell === "inkable") parts.push("iw");
  if (f.inkwell === "non-inkable") parts.push("-iw");
  if (f.keywords?.length)
    parts.push(
      `(${f.keywords
        .map((k) => `keyword:${k.toLowerCase().replace(/\s+/g, "_")}`)
        .join(" or ")})`
    );
  if (f.archetypes?.length)
    parts.push(`(${f.archetypes.map((a) => `t:${a.toLowerCase()}`).join(" or ")})`);
  if (f.format === "core") parts.push("format:core");
  if (f.format === "infinity") parts.push("format:infinity");
  return parts.join(" ").trim();
}

// =====================
// Deck helpers
// =====================

type DeckEntry = { card: Card; count: number };

type Deck = Record<string, DeckEntry>;

function deckCount(deck: Deck) {
  return Object.values(deck).reduce((n, e) => n + e.count, 0);
}
function deckInks(deck: Deck) {
  const s = new Set<Ink>();
  Object.values(deck).forEach(({ card }) => {
    if (card.ink) s.add(card.ink as Ink);
  });
  return Array.from(s);
}
function fullNameTotals(deck: Deck) {
  const m: Record<string, number> = {};
  Object.values(deck).forEach(({ card, count }) => {
    const k = fullNameKey(card);
    m[k] = (m[k] || 0) + count;
  });
  return m;
}

// =====================
// Clipboard & Export
// =====================

async function copyToClipboardRobust(
  text: string
): Promise<"api" | "exec" | "manual"> {
  try {
    if (
      typeof window !== "undefined" &&
      (window as any).isSecureContext &&
      navigator.clipboard?.writeText
    ) {
      await navigator.clipboard.writeText(text);
      return "api";
    }
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) return "exec";
  } catch {}
  return "manual";
}

async function fetchImageBlob(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Image fetch failed");
  return await r.blob();
}
function drawCountBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  n: number
) {
  const radius = 16;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 16px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n), x, y + 1);
  ctx.restore();
}
async function exportDeckAsPng(deck: Deck) {
  const entries = Object.values(deck)
    .filter((e) => e.count > 0)
    .sort(
      (a, b) =>
        (a.card.cost ?? 0) - (b.card.cost ?? 0) ||
        (a.card.name > b.card.name ? 1 : -1)
    );
  const prints: Card[] = [];
  entries.forEach(({ card, count }) => {
    for (let i = 0; i < count; i++) prints.push(card);
  });
  const cols = 10,
    cellW = 134,
    cellH = 187,
    pad = 10;
  const rows = Math.ceil(Math.max(1, prints.length) / cols);
  const W = pad + cols * (cellW + pad),
    H = pad + rows * (cellH + pad);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");
  ctx.fillStyle = "#0b0f1a";
  ctx.fillRect(0, 0, W, H);
  for (let idx = 0; idx < prints.length; idx++) {
    const card = prints[idx];
    const imgUrl =
      card.image_uris?.digital?.large ||
      card.image_uris?.digital?.normal ||
      card.image_uris?.digital?.small;
    if (!imgUrl) continue;
    const col = idx % cols,
      row = Math.floor(idx / cols);
    const x = pad + col * (cellW + pad),
      y = pad + row * (cellH + pad);
    try {
      const blob = await fetchImageBlob(imgUrl);
      const img = await createImageBitmap(blob);
      const scale = Math.min(cellW / img.width, cellH / img.height);
      const w = img.width * scale,
        h = img.height * scale;
      const cx = x + (cellW - w) / 2,
        cy = y + (cellH - h) / 2;
      ctx.drawImage(img, cx, cy, w, h);
    } catch {
      ctx.fillStyle = "#222";
      ctx.fillRect(x, y, cellW, cellH);
      ctx.fillStyle = "#999";
      ctx.font = "12px ui-sans-serif, system-ui";
      ctx.fillText(card.name, x + 6, y + 20);
    }
  }
  let cursor = 0;
  entries.forEach(({ count }) => {
    for (let i = 0; i < count; i++) {
      const col = cursor % cols,
        row = Math.floor(cursor / cols);
      const x = pad + col * (cellW + pad) + cellW - 18,
        y = pad + row * (cellH + pad) + 18;
      drawCountBubble(ctx, x, y, i === 0 ? count : 0);
      cursor++;
    }
  });
  ctx.fillStyle = "#fff";
  ctx.font = "12px ui-sans-serif, system-ui";
  ctx.fillText(
    `Exported ${new Date().toLocaleString()} — Powered by Lorcast`,
    pad,
    H - 6
  );
  return new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
}

// =====================
// Small UI atoms
// =====================

function Chip({
  active,
  label,
  onClick,
  title,
}: {
  active?: boolean;
  label: string;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`px-3 py-1 rounded-full border text-sm mr-2 mb-2 transition ${
        active
          ? "bg-white text-black border-white"
          : "border-white/25 hover:border-white/60"
      }`}
    >
      {label}
    </button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="text-xs uppercase tracking-wider text-white/60 mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}

function CardTile({
  card,
  onAdd,
}: {
  card: Card;
  onAdd?: (c: Card) => void;
}) {
  const img = card.image_uris?.digital?.normal || card.image_uris?.digital?.small;
  const name = `${card.name}${card.version ? ` — ${card.version}` : ""}`;
  return (
    <div className="group bg-white/5 hover:bg-white/10 rounded-xl p-2 flex flex-col gap-2 border border-white/10 transition">
      <div className="aspect-[488/681] w-full bg-black/40 rounded-lg overflow-hidden flex items-center justify-center">
        {img ? (
          <img src={img} alt={name} className="w-full h-full object-contain" />
        ) : (
          <div className="text-white/40 text-xs">No image</div>
        )}
      </div>
      <div className="text-sm leading-tight">
        <div className="font-medium">{name}</div>
        <div className="text-white/60 flex items-center gap-2 mt-1">
          {card.ink && (
            <span className="text-xs px-2 py-0.5 rounded-full border border-white/20">
              {card.ink}
            </span>
          )}
          {typeof card.cost === "number" && (
            <span className="text-xs px-2 py-0.5 rounded-full border border-white/20">
              Cost {card.cost}
            </span>
          )}
          {card.type?.length ? (
            <span className="text-xs px-2 py-0.5 rounded-full border border-white/20">
              {card.type.join(", ")}
            </span>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onAdd && onAdd(card)}
        className="mt-auto w-full text-center py-2 rounded-lg bg-white text-black font-medium hover:opacity-90"
      >
        Add to deck
      </button>
    </div>
  );
}

function DeckRow({
  entry,
  onInc,
  onDec,
  onRemove,
}: {
  entry: DeckEntry;
  onInc: () => void;
  onDec: () => void;
  onRemove: () => void;
}) {
  const { card, count } = entry;
  const name = `${card.name}${card.version ? ` — ${card.version}` : ""}`;
  return (
    <div className="flex items-center gap-2 py-2 border-b border-white/10">
      <div className="w-10 h-14 bg-black/40 rounded overflow-hidden flex items-center justify-center">
        {card.image_uris?.digital?.small ? (
          <img
            src={card.image_uris.digital.small}
            alt={name}
            className="h-full object-contain"
          />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium text-sm">{name}</div>
        <div className="text-xs text-white/60 flex gap-2">
          {card.ink ?? "—"} {typeof card.cost === "number" ? `· ${card.cost}` : ""}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDec}
          className="px-2 py-1 rounded border border-white/20"
        >
          -
        </button>
        <div className="w-6 text-center">{count}</div>
        <button
          type="button"
          onClick={onInc}
          className="px-2 py-1 rounded border border-white/20"
        >
          +
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="px-2 py-1 rounded border border-red-400 text-red-300"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

// =====================
// Tiny runtime self-tests (debug UI)
// =====================

type TestResult = { name: string; pass: boolean; got?: any; expected?: any };
function runSelfTests() {
  const base: Filters = {
    text: "",
    inks: [],
    types: [],
    rarities: [],
    sets: [],
    costMin: undefined,
    costMax: undefined,
    inkwell: "any",
    keywords: [],
    archetypes: [],
    format: "any",
  };
  const T: TestResult[] = [];
  const q1 = buildQuery({ ...base, text: "n:Elsa" });
  T.push({ name: "n: maps to name:", pass: q1 === 'name:"Elsa"', got: q1, expected: 'name:"Elsa"' });
  const q2 = buildQuery({ ...base, text: "e:draw" });
  T.push({ name: "e: maps to text:", pass: q2 === 'text:"draw"', got: q2, expected: 'text:"draw"' });
  const q3 = buildQuery({ ...base, keywords: ["Bodyguard", "Ward"] });
  T.push({ name: "keywords OR", pass: q3 === "(keyword:bodyguard or keyword:ward)", got: q3, expected: "(keyword:bodyguard or keyword:ward)" });
  const q4 = buildQuery({ ...base, archetypes: ["Princess", "Floodborn"] });
  T.push({ name: "archetypes t:", pass: q4 === "(t:princess or t:floodborn)", got: q4, expected: "(t:princess or t:floodborn)" });
  const q5 = buildQuery({ ...base, format: "core" });
  T.push({ name: "format core", pass: q5 === "format:core", got: q5, expected: "format:core" });
  const q6 = buildQuery({ ...base, format: "infinity" });
  T.push({ name: "format infinity", pass: q6 === "format:infinity", got: q6, expected: "format:infinity" });
  return T;
}

// =====================
// Main Component
// =====================

export default function TwoPaneDeckBuilder() {
  // data
  const [sets, setSets] = useState<{ id: string; name: string; code: string }[]>(
    []
  );
  const [loadingSets, setLoadingSets] = useState(true);

  // filters & search
  const [filters, setFilters] = useState<Filters>({
    text: "",
    inks: [],
    types: [],
    rarities: [],
    sets: [],
    costMin: undefined,
    costMax: undefined,
    inkwell: "any",
    keywords: [],
    archetypes: [],
    format: "any",
  });
  const [query, setQuery] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [uniqueMode, setUniqueMode] = useState<"cards" | "prints">("cards");
  const [err, setErr] = useState<string | null>(null);

  // deck state
  const [deck, setDeck] = useState<Record<string, DeckEntry>>(() => {
    try {
      const raw = localStorage.getItem("lorcana_deck_mvp");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const total = useMemo(() => deckCount(deck as any), [deck]);
  const inksInDeck = useMemo(() => deckInks(deck as any), [deck]);
  const fullTotals = useMemo(() => fullNameTotals(deck as any), [deck]);

  // export/copy
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [copyModal, setCopyModal] = useState<{ open: boolean; text: string }>(
    { open: false, text: "" }
  );
  const copyAreaRef = useRef<HTMLTextAreaElement | null>(null);

  // filters UI
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [showTests, setShowTests] = useState(false);

  // effects
  useEffect(() => {
    (async () => {
      try {
        setLoadingSets(true);
        const s = await fetchSets();
        setSets(s);
      } catch (e: any) {
        setErr(e?.message || String(e));
      } finally {
        setLoadingSets(false);
      }
    })();
  }, []);

  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    const q = buildQuery(filters);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setQuery(q), 200);
  }, [filters]);

  useEffect(() => {
    (async () => {
      try {
        setLoadingCards(true);
        setErr(null);
        const res = await searchCards(query || "", uniqueMode);
        setCards(res);
      } catch (e: any) {
        setErr(e?.message || String(e));
      } finally {
        setLoadingCards(false);
      }
    })();
  }, [query, uniqueMode]);

  useEffect(() => {
    localStorage.setItem("lorcana_deck_mvp", JSON.stringify(deck));
  }, [deck]);

  // deck actions
  function canAdd(card: Card, n = 1) {
    const fn = fullNameKey(card);
    const already = (fullTotals as any)[fn] || 0;
    if (already + n > 4) return { ok: false, reason: "Max 4 copies per full name." };
    if (card.ink) {
      const s = new Set(inksInDeck);
      s.add(card.ink as Ink);
      if (s.size > 2) return { ok: false, reason: "Deck can only include up to 2 inks." };
    }
    return { ok: true };
  }
  function addToDeck(card: Card, n = 1) {
    const chk = canAdd(card, n) as any;
    if (!chk.ok) {
      alert(chk.reason);
      return;
    }
    setDeck((d) => {
      const cur = d[card.id]?.count || 0;
      return { ...d, [card.id]: { card, count: cur + n } };
    });
  }
  function inc(e: DeckEntry) {
    addToDeck(e.card, 1);
  }
  function dec(e: DeckEntry) {
    setDeck((d) => {
      const cur = d[e.card.id]?.count || 0;
      const next = Math.max(0, cur - 1);
      const nd = { ...d } as Record<string, DeckEntry>;
      if (next === 0) delete nd[e.card.id];
      else nd[e.card.id] = { card: e.card, count: next };
      return nd as any;
    });
  }
  function remove(e: DeckEntry) {
    setDeck((d) => {
      const nd = { ...d } as Record<string, DeckEntry>;
      delete nd[e.card.id];
      return nd as any;
    });
  }
  function clearDeck() {
    if (confirm("Clear current deck?")) setDeck({});
  }

  function buildDeckText() {
    const lines: string[] = [];
    lines.push(`# Lorcana Deck (${total} cards)`);
    lines.push(`Inks: ${inksInDeck.join(", ") || "—"}`);
    lines.push("");
    Object.values(deck)
      .sort(
        (a: any, b: any) =>
          (a.card.cost ?? 0) - (b.card.cost ?? 0) ||
          (a.card.name > b.card.name ? 1 : -1)
      )
      .forEach(({ card, count }: any) => {
        const nm = `${card.name}${card.version ? ` — ${card.version}` : ""}`;
        const setInfo = card.set ? ` [${card.set.code}#${card.collector_number}]` : "";
        lines.push(`${count}x ${nm}${setInfo}`);
      });
    return lines.join("\n");
  }

  async function copyTextExport() {
    const text = buildDeckText();
    const method = await copyToClipboardRobust(text);
    if (method === "api" || method === "exec") {
      alert("Deck copied to clipboard as text.");
      return;
    }
    setCopyModal({ open: true, text });
    setTimeout(() => {
      copyAreaRef.current?.focus();
      copyAreaRef.current?.select();
    }, 0);
  }

  async function doExport() {
    setExportErr(null);
    setExporting(true);
    try {
      const blob = await exportDeckAsPng(deck as any);
      if (!blob) throw new Error("Failed to build image blob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "lorcana-deck.png";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e: any) {
      setExportErr(e?.message || String(e));
    } finally {
      setExporting(false);
    }
  }

  // Filters panel (collapsible)
  function FiltersPanel() {
    return (
      <div className="p-3 rounded-2xl border border-white/10 bg-white/5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Filters</div>
          <button
            type="button"
            className="text-xs underline text-white/70"
            onClick={() =>
              setFilters({
                text: "",
                inks: [],
                types: [],
                rarities: [],
                sets: [],
                costMin: undefined,
                costMax: undefined,
                inkwell: "any",
                keywords: [],
                archetypes: [],
                format: "any",
              })
            }
          >
            Reset
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Section title="Search">
              <input
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/20 outline-none"
                placeholder="Name (default), or prefix n: / e: (e.g., e:draw)"
                value={filters.text}
                onChange={(e) => setFilters((f) => ({ ...f, text: e.target.value }))}
              />
              <div className="mt-2 text-[11px] text-white/50">
                Supports i:/t:/r:/s:/c:/iw, <span className="font-mono">keyword:</span>, and
                <span className="font-mono"> format:core|infinity</span>.
              </div>
            </Section>
            <Section title="Ink (OR)">
              <div className="flex flex-wrap">
                {ALL_INKS.map((ink) => (
                  <Chip
                    key={ink}
                    label={ink}
                    active={filters.inks.includes(ink)}
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        inks: f.inks.includes(ink)
                          ? f.inks.filter((x) => x !== ink)
                          : [...f.inks, ink],
                      }))
                    }
                  />
                ))}
              </div>
            </Section>
            <Section title="Type (OR)">
              <div className="flex flex-wrap">
                {ALL_TYPES.map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    active={filters.types.includes(t)}
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        types: f.types.includes(t)
                          ? f.types.filter((x) => x !== t)
                          : [...f.types, t],
                      }))
                    }
                  />
                ))}
              </div>
            </Section>
            <Section title="Rarity (OR)">
              <div className="flex flex-wrap">
                {ALL_RARITIES.map((r) => (
                  <Chip
                    key={r}
                    label={r.replace("_", " ")}
                    active={filters.rarities.includes(r)}
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        rarities: f.rarities.includes(r)
                          ? f.rarities.filter((x) => x !== r)
                          : [...f.rarities, r],
                      }))
                    }
                  />
                ))}
              </div>
            </Section>
          </div>
          <div>
            <Section title="Sets (OR)">
              <div className="max-h-32 overflow-auto pr-2">
                {loadingSets ? (
                  <div className="text-white/60 text-sm">Loading sets…</div>
                ) : (
                  <div className="flex flex-wrap">
                    {sets.map((s) => (
                      <Chip
                        key={s.code}
                        label={`${s.name} (${s.code})`}
                        active={filters.sets.includes(s.code)}
                        onClick={() =>
                          setFilters((f) => ({
                            ...f,
                            sets: f.sets.includes(s.code)
                              ? f.sets.filter((x) => x !== s.code)
                              : [...f.sets, s.code],
                          }))
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            </Section>
            <Section title="Cost">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  placeholder="Min"
                  className="px-2 py-1 rounded bg-black/40 border border-white/20"
                  value={filters.costMin ?? ""}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      costMin:
                        e.target.value === "" ? undefined : Number(e.target.value),
                    }))
                  }
                />
                <input
                  type="number"
                  min={0}
                  placeholder="Max"
                  className="px-2 py-1 rounded bg-black/40 border border-white/20"
                  value={filters.costMax ?? ""}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      costMax:
                        e.target.value === "" ? undefined : Number(e.target.value),
                    }))
                  }
                />
              </div>
            </Section>
            <Section title="Inkwell">
              <select
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/20"
                value={filters.inkwell}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, inkwell: e.target.value as any }))
                }
              >
                <option value="any">Any</option>
                <option value="inkable">Inkable only</option>
                <option value="non-inkable">Non-inkable only</option>
              </select>
            </Section>
            <Section title="Archetypes (Classifications, OR)">
              <div className="max-h-24 overflow-auto pr-1 flex flex-wrap">
                {ALL_ARCHETYPES.map((a) => (
                  <Chip
                    key={a}
                    label={a}
                    active={filters.archetypes?.includes(a) || false}
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        archetypes: (f.archetypes || []).includes(a)
                          ? (f.archetypes || []).filter((x) => x !== a)
                          : [...(f.archetypes || []), a],
                      }))
                    }
                  />
                ))}
              </div>
            </Section>
            <Section title="Keywords (OR)">
              <div className="max-h-24 overflow-auto pr-1 flex flex-wrap">
                {ALL_KEYWORDS.map((k) => (
                  <Chip
                    key={k}
                    label={k}
                    active={filters.keywords?.includes(k) || false}
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        keywords: (f.keywords || []).includes(k)
                          ? (f.keywords || []).filter((x) => x !== k)
                          : [...(f.keywords || []), k],
                      }))
                    }
                  />
                ))}
              </div>
            </Section>
            <Section title="Format">
              <select
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/20"
                value={filters.format}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, format: e.target.value as any }))
                }
              >
                <option value="any">Any</option>
                <option value="core">Standard/Core legal</option>
                <option value="infinity">Infinity legal</option>
              </select>
            </Section>
          </div>
        </div>
      </div>
    );
  }

  function buildQueryPreview() {
    return buildQuery(filters);
  }

  // pagination
  const [page, setPage] = useState(1);
  const pageSize = 24;
  const pageCount = Math.max(1, Math.ceil(cards.length / pageSize));
  useEffect(() => setPage(1), [cards.length]);
  const view = useMemo(
    () => cards.slice((page - 1) * pageSize, page * pageSize),
    [cards, page]
  );

  return (
    <div className="min-h-screen text-white bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <header className="sticky top-0 z-30 backdrop-blur bg-slate-950/70 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="text-lg font-bold">Lorcana Deck Builder</div>
          <div className="text-xs text-white/60 ml-auto">Two‑Pane · Lorcast</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 grid gap-6 lg:grid-cols-[minmax(0,1fr),380px]">
        {/* LEFT PANE: filters (collapsible) + results */}
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg border border-white/20 text-sm"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              {filtersOpen ? "Hide Filters" : "Show Filters"}
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg border border-white/20 text-sm"
              onClick={() => {
                setTestResults(runSelfTests());
                setShowTests(true);
              }}
            >
              Run Self‑tests
            </button>
            <div className="text-xs text-white/60">
              Query: <code>{buildQueryPreview()}</code>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <label className="text-xs">Unique:</label>
              <select
                className="px-2 py-1 rounded border border-white/20 bg-black/40 text-sm"
                value={uniqueMode}
                onChange={(e) => setUniqueMode(e.target.value as any)}
              >
                <option value="cards">Cards</option>
                <option value="prints">Prints</option>
              </select>
            </div>
          </div>

          {showTests && testResults && (
            <div className="mb-4 p-3 rounded-lg border border-white/10 bg-white/5 text-xs">
              <div className="font-semibold mb-2">Diagnostics</div>
              <ul className="list-disc ml-5 space-y-1">
                {testResults.map((t, i) => (
                  <li key={i} className={t.pass ? "text-emerald-300" : "text-red-300"}>
                    {t.pass ? "✓" : "✗"} {t.name}
                    {!t.pass && (
                      <span className="block text-white/70">
                        got: {String(t.got)} | expected: {String(t.expected)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {filtersOpen && <FiltersPanel />}

          <div className="mt-4 mb-3 flex items-center justify-between">
            <div className="text-sm text-white/70">
              {loadingCards ? "Searching…" : `${cards.length} results`}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg border border-white/20 text-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Prev
              </button>
              <div className="text-sm">Page {page} / {pageCount}</div>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg border border-white/20 text-sm"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next →
              </button>
            </div>
          </div>

          {err && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm">
              {err}
            </div>
          )}
          {view.length === 0 && !loadingCards && (
            <div className="text-white/60 text-sm">No results. Try broadening filters.</div>
          )}

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
            {view.map((c) => (
              <CardTile
                key={`${c.id}-${c.collector_number}`}
                card={c}
                onAdd={(card) => addToDeck(card, 1)}
              />
            ))}
          </div>
        </section>

        {/* RIGHT PANE: deck (sticky) */}
        <aside className="lg:sticky lg:top-16 h-fit p-4 rounded-2xl border border-white/10 bg-white/5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-semibold">Deck</div>
              <div className="text-xs text-white/70">
                {total} cards · Inks: {inksInDeck.join(", ") || "—"}{" "}
                {total < 60 && (
                  <span className="ml-1 text-amber-300">(needs ≥ 60)</span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="px-2 py-1 rounded border border-white/20 text-sm"
                onClick={async () => {
                  const text = Object.values(deck)
                    .map(
                      (e: any) =>
                        `${e.count}x ${e.card.name}${
                          e.card.version ? ` — ${e.card.version}` : ""
                        }`
                    )
                    .join("\n");
                  const method = await copyToClipboardRobust(text);
                  if (method === "api" || method === "exec") {
                    alert("Deck copied to clipboard as text.");
                  } else {
                    setCopyModal({ open: true, text });
                    setTimeout(() => {
                      copyAreaRef.current?.focus();
                      copyAreaRef.current?.select();
                    }, 0);
                  }
                }}
              >
                Copy Text
              </button>
              <button
                type="button"
                className={`px-2 py-1 rounded border text-sm ${
                  exporting ? "opacity-60 cursor-wait border-white/10" : "border-white/20"
                }`}
                onClick={doExport}
                disabled={exporting}
                aria-busy={exporting}
              >
                {exporting ? "Exporting…" : "Export PNG"}
              </button>
              <button
                type="button"
                className="px-2 py-1 rounded border border-white/20 text-sm"
                onClick={clearDeck}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-auto pr-2">
            {Object.values(deck).length === 0 ? (
              <div className="text-white/60 text-sm">
                Add cards from the results →
              </div>
            ) : (
              Object.values(deck)
                .sort(
                  (a: any, b: any) =>
                    (a.card.cost ?? 0) - (b.card.cost ?? 0) ||
                    (a.card.name > b.card.name ? 1 : -1)
                )
                .map((e: any) => (
                  <DeckRow
                    key={e.card.id}
                    entry={e}
                    onInc={() => addToDeck(e.card, 1)}
                    onDec={() => dec(e)}
                    onRemove={() => remove(e)}
                  />
                ))
            )}
          </div>

          {exportErr && (
            <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-400/40 text-sm">
              Export note: {exportErr}
            </div>
          )}
          <div className="mt-3 text-[11px] text-white/50">
            Rules: ≥60 cards, ≤4 per full name, ≤2 inks.
          </div>
        </aside>
      </main>

      {/* Manual copy modal */}
      {copyModal.open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">Manual Copy</div>
              <button
                type="button"
                className="text-xs underline text-white/70"
                onClick={() => setCopyModal({ open: false, text: "" })}
              >
                Close
              </button>
            </div>
            <textarea
              ref={copyAreaRef}
              className="w-full h-64 p-2 rounded-lg bg-black/40 border border-white/20 font-mono text-xs"
              value={copyModal.text}
              onChange={() => {}}
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg border border-white/20 text-sm"
                onClick={() => {
                  copyAreaRef.current?.focus();
                  copyAreaRef.current?.select();
                  try {
                    document.execCommand("copy");
                    alert("Text selected. Press Ctrl/Cmd+C if not auto-copied.");
                  } catch {
                    alert("Select all (Ctrl/Cmd+A) then copy.");
                  }
                }}
              >
                Select all & Copy
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg border border-white/20 text-sm"
                onClick={() => setCopyModal({ open: false, text: "" })}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="px-4 py-6 text-center text-xs text-white/50">
        Two‑pane layout like Dreamborn: left filters+results, right deck. Uses Lorcast API for data & legality.
      </footer>
    </div>
  );
}
