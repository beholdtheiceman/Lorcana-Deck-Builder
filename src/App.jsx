// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

/* =========================
   API base (lorcana-api)
   ========================= */
const API_ROOT = "https://api.lorcana-api.com";

/* =========================
   Constants / lists
   ========================= */
const ALL_INKS = ["Amber","Amethyst","Emerald","Ruby","Sapphire","Steel"];
const ALL_TYPES = ["Character","Action","Song","Item","Location"];
const TYPE_ORDER = { Character:0, Action:1, Song:2, Item:3, Location:4 };
const ALL_RARITIES = ["Common","Uncommon","Rare","Super_rare","Legendary","Enchanted","Promo"];
const ALL_KEYWORDS = [
  "Shift","Resist","Ward","Reckless","Challenger","Evasive","Rush","Support","Bodyguard","Singer","Guard","Hardy",
  "Shift 1","Shift 2","Shift 3","Shift 4","Shift 5","Shift 6","Shift 7","Shift 8","Shift 9","Shift 10",
  "Resist 1","Resist 2","Resist 3","Resist 4","Resist 5",
  "Reckless 1","Reckless 2","Reckless 3","Reckless 4","Reckless 5","Reckless 6","Reckless 7",
  "Challenger 1","Challenger 2","Challenger 3","Challenger 4","Challenger 5","Challenger 6","Challenger 7","Challenger 8","Challenger 9","Challenger 10",
  "Singer 2","Singer 3","Singer 4","Singer 5","Singer 6","Singer 7","Singer 8","Singer 9","Singer 10",
];
const ALL_ARCHETYPES = [
  "Storyborn","Dreamborn","Floodborn","Hero","Villain","Ally","Mentor","Alien","Broom","Captain","Deity","Detective","Dragon","Fairy","Hyena","Inventor","King","Knight","Madrigal","Musketeer","Pirate","Prince","Princess","Puppy","Queen","Racer","Robot","Seven Dwarfs","Sorcerer","Tigger","Titan",
];
const COST_CHOICES = [1,2,3,4,5,6,7,8,9]; // 9 => 9+

/* =========================
   Utilities / normalization
   ========================= */
function cap(s){ return typeof s === "string" ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s; }
function firstNonNull(...vals){ return vals.find(v => v !== undefined && v !== null) ?? null; }
function fullNameKey(card){ return `${card.name} — ${card.version ?? ""}`.trim(); }

// Normalize lorcana-api card JSON into the shape the UI expects
function normalizeCard(raw){
  const img =
    firstNonNull(
      raw?.image_uris?.digital?.normal,
      raw?.image_uris?.normal,
      raw?.image?.normal,
      raw?.imageUrl,
      raw?.image_url,
      raw?.image_front,
      raw?.image,
      raw?.images?.normal,
      Array.isArray(raw?.images) ? raw.images[0] : null
    );

  const setCode = firstNonNull(raw?.set?.code, raw?.set_code, raw?.setCode, raw?.set, raw?.set_id);
  const setName = firstNonNull(raw?.set?.name, raw?.setName, raw?.set_name);
  const releaseDate = firstNonNull(raw?.set?.releaseDate, raw?.set?.release_date, raw?.releaseDate, raw?.release_date);

  const collector = firstNonNull(raw?.collector_number, raw?.number, raw?.card_number, raw?.collectorNumber);
  const cost = firstNonNull(raw?.cost, raw?.ink_cost, raw?.inkCost);
  const ink = firstNonNull(raw?.ink, raw?.color, raw?.colour);
  const inkwell = firstNonNull(raw?.inkwell, raw?.inkable, raw?.is_inkable);
  const version = firstNonNull(raw?.version, raw?.subtitle, raw?.title2, raw?.variation);
  const id = firstNonNull(raw?.id, raw?.uuid, raw?._id, `${setCode ?? "x"}-${collector ?? raw?.name}`);

  return {
    id,
    name: raw?.name || "Unknown",
    version: version || null,
    cost: typeof cost === "number" ? cost : (Number(cost) || null),
    inkwell: typeof inkwell === "boolean" ? inkwell : null,
    ink: ink ? cap(ink) : null,
    type: Array.isArray(raw?.types) ? raw.types[0] : (raw?.type || raw?.card_type || null),
    text: firstNonNull(raw?.text, raw?.rules_text, raw?.rules) || "",
    set: setCode ? { code: String(setCode).toUpperCase(), name: setName || String(setCode).toUpperCase(), releaseDate: releaseDate || null } : null,
    collector_number: collector ? String(collector) : null,
    rarity: firstNonNull(raw?.rarity, raw?.rarity_code, raw?.rarity_name),
    image_uris: img ? { digital: { normal: String(img) } } : null,
    _raw: raw,
  };
}

/* =========================
   Build lorcana-api search clause from filters
   AND = ';'   OR = ';|'
   ========================= */
function buildSearchClause(f){
  const parts = [];
  const rawText = (f.text || "").trim();
  if (rawText) {
    if (rawText.startsWith("n:")) parts.push(`name~${encodeURIComponent(rawText.slice(2).trim())}`);
    else if (rawText.startsWith("e:")) parts.push(`text~${encodeURIComponent(rawText.slice(2).trim())}`);
    else parts.push(`name~${encodeURIComponent(rawText)}`);
  }
  if (f.inks?.length) parts.push(f.inks.map(v => `color=${encodeURIComponent(v.toLowerCase())}`).join(";|"));
  if (f.types?.length) parts.push(f.types.map(v => `type=${encodeURIComponent(v.toLowerCase())}`).join(";|"));
  if (f.rarities?.length) parts.push(f.rarities.map(v => `rarity=${encodeURIComponent(v.toLowerCase())}`).join(";|"));
  if (f.sets?.length) parts.push(f.sets.map(v => `set=${encodeURIComponent(String(v).toLowerCase())}`).join(";|"));
  if (f.costs?.length) {
    const chunks = f.costs.map(n => (n >= 9 ? "cost>=9" : `cost=${n}`));
    parts.push(chunks.join(";|"));
  }
  if (f.inkwell === "inkable") parts.push("inkwell=true");
  if (f.inkwell === "non-inkable") parts.push("inkwell=false");
  if (f.keywords?.length) parts.push(f.keywords.map(v => `keyword=${encodeURIComponent(v.toLowerCase().replace(/\s+/g, "_"))}`).join(";|"));
  if (f.archetypes?.length) parts.push(f.archetypes.map(v => `class=${encodeURIComponent(v.toLowerCase().replace(/\s+/g, "_"))}`).join(";|"));
  if (f.format === "core") parts.push("format=core");
  if (f.format === "infinity") parts.push("format=infinity");
  return parts.filter(Boolean).join(";");
}

/* =========================
   API calls (lorcana-api)
   ========================= */
async function fetchSets(){
  const r = await fetch(`${API_ROOT}/sets/all`);
  if (!r.ok) throw new Error("Failed to load sets");
  const data = await r.json();
  return (Array.isArray(data) ? data : []).map(s => ({
    code: String(firstNonNull(s?.code, s?.set_code, s?.id, s?.abbr, s?.slug, s?.shortname, s?.short))?.toUpperCase(),
    name: String(firstNonNull(s?.name, s?.longname, s?.title, s?.display_name, s?.full_name, s?.code)) || "Unknown Set",
    releaseDate: firstNonNull(s?.releaseDate, s?.release_date, s?.released_on) || null,
    _raw: s,
  })).filter(s => !!s.code);
}
async function searchCards(filters, { page = 1, pagesize = 100 } = {}){
  const clause = buildSearchClause(filters) || "name~a";
  const url = new URL(`${API_ROOT}/cards/fetch`);
  url.searchParams.set("search", clause);
  url.searchParams.set("page", String(page));
  url.searchParams.set("pagesize", String(pagesize));
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`Search failed (${r.status})`);
  const arr = await r.json();
  return (Array.isArray(arr) ? arr : []).map(normalizeCard);
}

/* =========================
   Deck helpers
   ========================= */
function deckCount(deck){ return Object.values(deck).reduce((n,e)=> n + e.count, 0); }
function deckInks(deck){ const s=new Set(); Object.values(deck).forEach(({card})=>{ if(card.ink) s.add(card.ink); }); return Array.from(s); }
function fullNameTotals(deck){ const m={}; Object.values(deck).forEach(({card,count})=>{ const k=fullNameKey(card); m[k]=(m[k]||0)+count; }); return m; }
function deckInkableStats(deck){ let inkable=0, uninkable=0; Object.values(deck).forEach(({card,count})=>{ if(card.inkwell) inkable+=count; else uninkable+=count; }); return {inkable,uninkable}; }
function curveDataFromDeck(deck){ const bins=Array.from({length:9},(_,i)=>({key:i+1,count:0})); Object.values(deck).forEach(({card,count})=>{ const c=typeof card.cost==='number'?card.cost:0; const idx=c>=9?8:Math.max(0,c-1); bins[idx].count+=count; }); return bins.map(b=>({cost:b.key===9?'9+':String(b.key),count:b.count})); }

async function copyToClipboardRobust(text){
  try{
    if (typeof window!=='undefined' && window.isSecureContext && navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return 'api'; }
  }catch{}
  try{
    const ta=document.createElement('textarea'); ta.value=text; ta.setAttribute('readonly',''); ta.style.position='fixed'; ta.style.top='-1000px'; document.body.appendChild(ta); ta.select(); const ok=document.execCommand('copy'); document.body.removeChild(ta); if(ok) return 'exec';
  }catch{}
  return 'manual';
}

/* =========================
   EXPORT HELPERS (images + list)
   ========================= */
function proxyImageUrl(rawUrl) {
  if (!rawUrl) return null;
  const noProto = String(rawUrl).replace(/^https?:\/\//, "");
  return `https://images.weserv.nl/?url=${encodeURIComponent(noProto)}&w=600&h=800&fit=inside`;
}
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
function drawCountBubble(ctx, x, y, n) {
  if (!n || n <= 1) return;
  const r = 16;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 14px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n), x, y + 0.5);
  ctx.restore();
}
async function exportDeckAsPng(deck, { unique = false } = {}) {
  const entries = sortEntriesForList(deckEntries(deck));
  const totalByFullName = {};
  const repByFullName = {};
  const prints = [];

  for (const { card, count } of entries) {
    const key = fullNameKey(card);
    totalByFullName[key] = (totalByFullName[key] || 0) + count;
    if (!repByFullName[key]) repByFullName[key] = card;
    if (!unique) for (let i = 0; i < count; i++) prints.push(card);
  }
  if (unique) for (const key of Object.keys(repByFullName)) prints.push(repByFullName[key]);

  const cols = unique ? 8 : 10;
  const cellW = unique ? 180 : 134;
  const cellH = unique ? 255 : 187;
  const pad = 12;

  const rows = Math.max(1, Math.ceil(prints.length / cols));
  const W = pad + cols * (cellW + pad);
  const H = pad + rows * (cellH + pad);

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");

  ctx.fillStyle = "#0b0f1a"; ctx.fillRect(0, 0, W, H);

  for (let idx = 0; idx < prints.length; idx++) {
    const card = prints[idx];
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = pad + col * (cellW + pad);
    const y = pad + row * (cellH + pad);

    ctx.fillStyle = "#171b2b"; ctx.fillRect(x, y, cellW, cellH);
    ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);

    const rawImg =
      card.image_uris?.digital?.large ||
      card.image_uris?.digital?.normal ||
      card.image_uris?.digital?.small;
    const proxied = proxyImageUrl(rawImg);
    if (proxied) {
      try {
        const img = await loadImage(proxied);
        const scale = Math.min(cellW / img.width, cellH / img.height);
        const w = img.width * scale, h = img.height * scale;
        const cx = x + (cellW - w) / 2, cy = y + (cellH - h) / 2;
        ctx.drawImage(img, cx, cy, w, h);
      } catch {}
    }

    const key = fullNameKey(card);
    const totalForThis = totalByFullName[key] || 0;
    if (unique) drawCountBubble(ctx, x + cellW - 18, y + 18, totalForThis);
    else {
      const firstIdx = prints.findIndex(p => fullNameKey(p) === key);
      if (firstIdx === idx) drawCountBubble(ctx, x + cellW - 18, y + 18, totalForThis);
    }
  }

  ctx.fillStyle = "#fff"; ctx.font = "10px ui-sans-serif, system-ui";
  ctx.fillText(`Exported ${new Date().toLocaleString()} — lorcana-api`, pad, H - 6);

  return new Promise(res => canvas.toBlob(b => res(b), "image/png"));
}

function deckEntries(deck){ return Object.values(deck).map(e => ({ card: e.card, count: e.count })); }

function sortEntriesForList(entries){
  return [...entries].sort((a,b)=>{
    // group by TYPE order
    const ta = TYPE_ORDER[a.card.type] ?? 999;
    const tb = TYPE_ORDER[b.card.type] ?? 999;
    if (ta !== tb) return ta - tb;
    // then cost asc
    const ca = a.card.cost ?? 999;
    const cb = b.card.cost ?? 999;
    if (ca !== cb) return ca - cb;
    // then ink
    const ia = ALL_INKS.indexOf(a.card.ink ?? "zz");
    const ib = ALL_INKS.indexOf(b.card.ink ?? "zz");
    if (ia !== ib) return ia - ib;
    // then set (newest first) — setRankForCode is injected from component state
    // we fall back to name if ranks are same
    return (a.card.name > b.card.name) ? 1 : -1;
  });
}

async function exportDeckListPng(deck, title, setRankForCode){
  const entries = deckEntries(deck).sort((a,b)=>{
    const ta = TYPE_ORDER[a.card.type] ?? 999;
    const tb = TYPE_ORDER[b.card.type] ?? 999;
    if (ta !== tb) return ta - tb;
    const ca = a.card.cost ?? 999, cb = b.card.cost ?? 999;
    if (ca !== cb) return ca - cb;
    const ia = ALL_INKS.indexOf(a.card.ink ?? "zz"), ib = ALL_INKS.indexOf(b.card.ink ?? "zz");
    if (ia !== ib) return ia - ib;
    const ra = setRankForCode(a.card.set?.code), rb = setRankForCode(b.card.set?.code);
    if (ra !== rb) return rb - ra;
    const na = parseInt(a.card.collector_number||"0",10)||0, nb = parseInt(b.card.collector_number||"0",10)||0;
    if (na !== nb) return na - nb;
    return a.card.name.localeCompare(b.card.name);
  });
  const groups = {};
  for (const e of entries){
    const k = ALL_TYPES.includes(e.card.type) ? e.card.type : "Other";
    (groups[k] ||= []).push(e);
  }
  const pad = 24, colW = 620, headerH = 54, lineH = 20, gap = 8;
  let lines = 0; Object.keys(groups).forEach(g=> { lines += 1 + groups[g].length; });
  const H = pad*2 + headerH + lines*lineH + gap*(Object.keys(groups).length+2) + 30;
  const W = pad*2 + colW;

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0b0f1a"; ctx.fillRect(0,0,W,H);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 22px ui-sans-serif, system-ui";
  ctx.fillText(title || "Decklist", pad, pad + 24);
  ctx.font = "12px ui-sans-serif, system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(new Date().toLocaleString(), pad, pad + 44);

  let y = pad + headerH;
  for (const type of Object.keys(TYPE_ORDER)){
    if (!groups[type]) continue;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "bold 14px ui-sans-serif, system-ui";
    ctx.fillText(type, pad, y);
    y += lineH;
    ctx.font = "13px ui-sans-serif, system-ui";
    ctx.fillStyle = "#fff";
    for (const e of groups[type]){
      const line = `${e.count}x  ${e.card.name}${e.card.version ? ` — ${e.card.version}` : ""}  · ${e.card.ink || "—"} · ${typeof e.card.cost === "number" ? e.card.cost : "—"}${e.card.set?.code && e.card.collector_number ? `  [${e.card.set.code}#${e.card.collector_number}]` : ""}`;
      ctx.fillText(line, pad, y);
      y += lineH;
    }
    y += gap;
  }
  ctx.font = "11px ui-sans-serif, system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText("Generated by deckbuilder", pad, H - 10);
  return new Promise((resolve)=> canvas.toBlob(b=> resolve(b), "image/png", 0.92));
}

/* =========================
   Import (Dreamborn-style) parser
   ========================= */
function parseDeckText(text){
  const entries = [];
  const lines = (text || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  for (const line of lines){
    let s = line.replace(/^[-*\d.)\s]+/, "").trim();
    let count = 1;

    const mStart = s.match(/^(\d+)x\s+/i);
    if (mStart){ count = parseInt(mStart[1],10); s = s.replace(/^(\d+)x\s+/i, ""); }
    const mEnd = s.match(/\sx(\d+)$/i);
    if (mEnd){ count = parseInt(mEnd[1],10); s = s.replace(/\sx\d+$/i, ""); }

    let setCode = null, number = null;
    const bracket = s.match(/\[([^\]]+)\]$/);
    if (bracket){
      const inside = bracket[1];
      const parts = inside.split("#");
      if (parts.length === 2){
        setCode = parts[0].trim().toUpperCase();
        number = parts[1].trim();
        s = s.replace(/\[[^\]]+\]$/, "").trim();
      }
    }

    const parts = s.split(/\s+—\s+|\s+-\s+/);
    const name = parts[0]?.trim();
    const version = parts[1] ? parts[1].trim() : null;
    if (!name) continue;

    entries.push({ name, version, count, setCode, number });
  }
  return { entries };
}

/* =========================
   Small UI atoms
   ========================= */
function Chip({ active, label, onClick, title }){
  return (
    <button type="button" title={title} onClick={onClick}
      className={`px-3 py-1 rounded-full border text-sm mr-2 mb-2 transition ${active ? 'bg-white text-black border-white' : 'border-white/25 hover:border-white/60'}`}>
      {label}
    </button>
  );
}
function Section({ title, children }){
  return (
    <div className="mb-4">
      <div className="text-xs uppercase tracking-wider text-white/60 mb-2">{title}</div>
      {children}
    </div>
  );
}
function CardTile({ card, onAdd }){
  const img = card.image_uris?.digital?.normal || card.image_uris?.digital?.small;
  const name = `${card.name}${card.version ? ` — ${card.version}` : ''}`;
  return (
    <div className="group bg-[#0f1320] hover:bg-[#141828] rounded-xl p-2 flex flex-col gap-2 border border-white/10 transition">
      <div className="aspect-[488/681] w-full bg-black/40 rounded-lg overflow-hidden flex items-center justify-center">
        {img ? (<img loading="lazy" src={img} alt={name} className="w-full h-full object-contain" />) : (<div className="text-white/40 text-xs">No image</div>)}
      </div>
      <div className="text-sm leading-tight">
        <div className="font-medium">{name}</div>
        <div className="text-white/60 flex items-center gap-2 mt-1">
          {card.ink && (<span className="text-xs px-2 py-0.5 rounded-full border border-white/20">{card.ink}</span>)}
          {typeof card.cost === 'number' && (<span className="text-xs px-2 py-0.5 rounded-full border border-white/20">Cost {card.cost}</span>)}
        </div>
      </div>
      <button type="button" onClick={()=> onAdd && onAdd(card)}
        className="mt-auto w-full text-center py-2 rounded-lg bg-white text-black font-medium hover:opacity-90">
        + Add
      </button>
    </div>
  );
}
function DeckRow({ entry, onInc, onDec, onRemove }){
  const { card, count } = entry;
  const name = `${card.name}${card.version ? ` — ${card.version}` : ''}`;
  return (
    <div className="flex items-center gap-2 py-2 border-b border-white/10">
      <div className="w-10 h-14 bg-black/40 rounded overflow-hidden flex items-center justify-center">
        {card.image_uris?.digital?.small ? (<img loading="lazy" src={card.image_uris.digital.small} alt={name} className="h-full object-contain" />) : null}
      </div>
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium text-sm">{name}</div>
        <div className="text-xs text-white/60 flex gap-2">{card.type ?? '—'} · {card.ink ?? '—'} {typeof card.cost === 'number' ? `· ${card.cost}` : ''}</div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onDec} className="px-2 py-1 rounded border border-white/20">-</button>
        <div className="w-6 text-center">{count}</div>
        <button type="button" onClick={onInc} className="px-2 py-1 rounded border border-white/20">+</button>
        <button type="button" onClick={onRemove} className="px-2 py-1 rounded border border-red-400 text-red-300">Remove</button>
      </div>
    </div>
  );
}

/* =========================
   Main component
   ========================= */
export default function App(){
  // sets
  const [sets, setSets] = useState([]);
  const [loadingSets, setLoadingSets] = useState(true);

  // filters & results
  const [filters, setFilters] = useState({
    text:"", inks:[], types:[], rarities:[], sets:[],
    costs:[], inkwell:"any", keywords:[], archetypes:[], format:"any"
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterScrollRef = useRef(null);
  const prevScrollRef = useRef(0);
  function updateFilters(mutator){
    if (filterScrollRef.current) prevScrollRef.current = filterScrollRef.current.scrollTop;
    setFilters(f => (typeof mutator === 'function' ? mutator(f) : mutator));
    requestAnimationFrame(()=>{
      if (filterScrollRef.current) filterScrollRef.current.scrollTop = prevScrollRef.current;
    });
  }

  // import modal
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importErr, setImportErr] = useState(null);

  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [err, setErr] = useState(null);

  // view controls
  const [groupBy, setGroupBy] = useState("type"); // type | ink | none
  const [sortBy, setSortBy] = useState("cost");   // cost | set | ink | name

  // deck
  const [deck, setDeck] = useState(()=>{
    try{ const raw=localStorage.getItem('lorcana_deck_mvp'); return raw? JSON.parse(raw) : {}; }catch{ return {}; }
  });
  const total = deckCount(deck);
  const inksInDeck = deckInks(deck);
  const inkableStats = useMemo(()=> deckInkableStats(deck), [deck]);
  const curveData = useMemo(()=> curveDataFromDeck(deck), [deck]);
  const fullTotals = useMemo(()=> fullNameTotals(deck), [deck]);

  // export & copy
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState(null);
  const [copyModal, setCopyModal] = useState({ open:false, text:"" });
  const copyAreaRef = useRef(null);

  // print decklist modal
  const [printOpen, setPrintOpen] = useState(false);

  // publish (poster)
  const [publishOpen, setPublishOpen] = useState(false);
  const [deckName, setDeckName] = useState("My Lorcana Deck");
  const [deckNotes, setDeckNotes] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishedLink, setPublishedLink] = useState(null);
  const [publishedImageUrl, setPublishedImageUrl] = useState(null);
  const [publishErr, setPublishErr] = useState(null);

  const closePublishModal = () => {
    if (publishedImageUrl) { try { URL.revokeObjectURL(publishedImageUrl); } catch {} }
    setPublishedImageUrl(null); setPublishedLink(null); setPublishErr(null); setPublishOpen(false);
  };

  // load sets
  useEffect(()=>{ (async()=>{
    try{ setLoadingSets(true); const s=await fetchSets(); setSets(s); }
    catch(e){ setErr(e?.message||String(e)); }
    finally{ setLoadingSets(false); }
  })(); },[]);

  // compute set ranks newest first
  const [setRanks, setSetRanks] = useState({});
  useEffect(()=>{
    const sorted = [...sets].sort((a,b)=>{
      const ad=a.releaseDate?Date.parse(a.releaseDate):0;
      const bd=b.releaseDate?Date.parse(b.releaseDate):0;
      if (ad && bd) return bd - ad;
      if (ad || bd) return bd - ad;
      return 0;
    });
    const ranks={}; sorted.forEach((s,idx)=>{ ranks[s.code]=sorted.length-idx; }); setSetRanks(ranks);
  }, [sets]);
  function setRankForCode(code){ return code ? (setRanks[code] ?? 0) : 0; }

  // search whenever filters change (debounced)
  const debounceRef = useRef(null);
  useEffect(()=>{
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async ()=>{
      try{
        setErr(null);
        const hasAny =
          (filters.text && filters.text.trim().length>0) ||
          (filters.inks?.length||0) || (filters.types?.length||0) ||
          (filters.rarities?.length||0) || (filters.sets?.length||0) ||
          (filters.costs?.length||0) || (filters.inkwell !== "any") ||
          (filters.keywords?.length||0) || (filters.archetypes?.length||0) ||
          (filters.format !== "any");

        if(!hasAny){ setCards([]); return; }
        setLoadingCards(true);
        const arr = await searchCards(filters, { page: 1, pagesize: 180 });
        setCards(arr);
        setPagesShown(1);
      }catch(e){ setErr(e?.message||String(e)); }
      finally{ setLoadingCards(false); }
    }, 250);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [filters]);

  // persist deck
  useEffect(()=>{ try{ localStorage.setItem('lorcana_deck_mvp', JSON.stringify(deck)); }catch{} }, [deck]);

  // deck ops
  function canAdd(card, n=1){
    const fn=fullNameKey(card); const already=fullTotals[fn]||0;
    if(already+n>4) return {ok:false, reason:'Max 4 copies per full name.'};
    if(card.ink){ const s=new Set(inksInDeck); s.add(card.ink); if(s.size>2) return {ok:false, reason:'Deck can only include up to 2 inks.'}; }
    return {ok:true};
  }
  function addToDeck(card, n=1){ const chk=canAdd(card,n); if(!chk.ok){ alert(chk.reason); return; }
    setDeck(d=>{ const cur=d[card.id]?.count||0; return { ...d, [card.id]: { card, count: cur+n } }; }); }
  function decEntry(id){ setDeck(d=>{ const cur=d[id]?.count||0; const next=Math.max(0, cur-1); const nd={...d}; if(next===0) delete nd[id]; else nd[id]={ card:d[id].card, count:next }; return nd; }); }
  function removeEntry(id){ setDeck(d=>{ const nd={...d}; delete nd[id]; return nd; }); }
  function clearDeck(){ if (confirm('Clear current deck?')) setDeck({}); }

  // GRID SORT default: ink -> set(new) -> number
  const inkOrder = useMemo(()=>{ const m={}; ALL_INKS.forEach((ink,i)=> m[ink]=i); return m; }, []);
  const sortedCards = useMemo(()=> [...cards].sort((a,b)=>{
    const ai = inkOrder[a.ink] ?? 999;
    const bi = inkOrder[b.ink] ?? 999;
    if (ai !== bi) return ai - bi;
    const as = setRankForCode(a.set?.code);
    const bs = setRankForCode(b.set?.code);
    if (as !== bs) return bs - as;
    const an = parseInt(a.collector_number || "0", 10) || 0;
    const bn = parseInt(b.collector_number || "0", 10) || 0;
    return an - bn;
  }), [cards, inkOrder, setRanks]);

  // Infinite scroll: show cumulative pages
  const pageSize = 24;
  const pageCount = Math.max(1, Math.ceil(sortedCards.length / pageSize));
  const [pagesShown, setPagesShown] = useState(1);
  const sentinelRef = useRef(null);
  const visibleCards = useMemo(()=> sortedCards.slice(0, pagesShown * pageSize), [sortedCards, pagesShown]);
  useEffect(()=>{
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries)=>{
      const entry = entries[0];
      if (entry.isIntersecting) setPagesShown(p => Math.min(pageCount, p + 1));
    }, { rootMargin: "600px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [pageCount, sortedCards.length]);

  // DECKLIST ORDER/GROUP
  const deckEntriesSorted = useMemo(()=>{
    const ents = deckEntries(deck);
    if (sortBy === "cost"){
      return ents.sort((a,b)=>{
        const ca=a.card.cost??999, cb=b.card.cost??999;
        if (ca!==cb) return ca-cb;
        const ta=TYPE_ORDER[a.card.type]??999, tb=TYPE_ORDER[b.card.type]??999;
        if (ta!==tb) return ta-tb;
        const ia=ALL_INKS.indexOf(a.card.ink??"zz"), ib=ALL_INKS.indexOf(b.card.ink??"zz");
        if (ia!==ib) return ia-ib;
        const ra=setRankForCode(a.card.set?.code), rb=setRankForCode(b.card.set?.code);
        if (ra!==rb) return rb-ra;
        const na=parseInt(a.card.collector_number||"0",10)||0, nb=parseInt(b.card.collector_number||"0",10)||0;
        if (na!==nb) return na-nb;
        return a.card.name.localeCompare(b.card.name);
      });
    }
    if (sortBy === "set"){
      return ents.sort((a,b)=>{
        const ra=setRankForCode(a.card.set?.code), rb=setRankForCode(b.card.set?.code);
        if (ra!==rb) return rb-ra;
        const na=parseInt(a.card.collector_number||"0",10)||0, nb=parseInt(b.card.collector_number||"0",10)||0;
        if (na!==nb) return na-nb;
        return a.card.name.localeCompare(b.card.name);
      });
    }
    if (sortBy === "ink"){
      return ents.sort((a,b)=>{
        const ia=ALL_INKS.indexOf(a.card.ink??"zz"), ib=ALL_INKS.indexOf(b.card.ink??"zz");
        if (ia!==ib) return ia-ib;
        const ra=setRankForCode(a.card.set?.code), rb=setRankForCode(b.card.set?.code);
        if (ra!==rb) return rb-ra;
        const na=parseInt(a.card.collector_number||"0",10)||0, nb=parseInt(b.card.collector_number||"0",10)||0;
        if (na!==nb) return na-nb;
        return a.card.name.localeCompare(b.card.name);
      });
    }
    return ents.sort((a,b)=> a.card.name.localeCompare(b.card.name));
  }, [deck, sortBy, setRanks]);

  const deckGrouped = useMemo(()=>{
    if (groupBy === "type"){
      const g = {}; for (const e of deckEntriesSorted){ const k = ALL_TYPES.includes(e.card.type) ? e.card.type : "Other"; (g[k] ||= []).push(e); }
      const ordered = {}; Object.keys(TYPE_ORDER).forEach(t => { if (g[t]) ordered[t]=g[t]; });
      Object.keys(g).forEach(k => { if (!(k in ordered)) ordered[k]=g[k]; });
      return ordered;
    }
    if (groupBy === "ink"){
      const g = {}; for (const e of deckEntriesSorted){ const k=e.card.ink||"—"; (g[k] ||= []).push(e); }
      const ordered = {}; ALL_INKS.forEach(i => { if (g[i]) ordered[i]=g[i]; });
      if (g["—"]) ordered["—"] = g["—"];
      Object.keys(g).forEach(k => { if (!(k in ordered)) ordered[k]=g[k]; });
      return ordered;
    }
    return { All: deckEntriesSorted };
  }, [deckEntriesSorted, groupBy]);

  // text export
  function buildDeckText(){
    const lines=[]; lines.push(`# Lorcana Deck (${total} cards)`); lines.push(`Inks: ${inksInDeck.join(', ') || '—'}`); lines.push('');
    const entries = deckEntries(deck).sort((a,b)=>{
      const ta = TYPE_ORDER[a.card.type] ?? 999;
      const tb = TYPE_ORDER[b.card.type] ?? 999;
      if (ta !== tb) return ta - tb;
      const ca = a.card.cost ?? 999, cb = b.card.cost ?? 999;
      if (ca !== cb) return ca - cb;
      const ia = ALL_INKS.indexOf(a.card.ink ?? "zz"), ib = ALL_INKS.indexOf(b.card.ink ?? "zz");
      if (ia !== ib) return ia - ib;
      const ra = setRankForCode(a.card.set?.code), rb = setRankForCode(b.card.set?.code);
      if (ra !== rb) return rb - ra;
      const na = parseInt(a.card.collector_number||"0",10)||0, nb = parseInt(b.card.collector_number||"0",10)||0;
      if (na !== nb) return na - nb;
      return a.card.name.localeCompare(b.card.name);
    });
    const groups = {}; for (const e of entries){ const k = ALL_TYPES.includes(e.card.type) ? e.card.type : "Other"; (groups[k] ||= []).push(e); }
    for (const type of Object.keys(TYPE_ORDER)){
      if (!groups[type]) continue;
      lines.push(`## ${type}`);
      for (const {card,count} of groups[type]){
        const nm=`${card.name}${card.version?` — ${card.version}`:''}`;
        const setInfo=card.set?` [${card.set.code}#${card.collector_number}]`:'';
        lines.push(`${count}x ${nm}${setInfo} · ${card.ink || '—'} · ${typeof card.cost==='number'?card.cost:'—'}`);
      }
      lines.push('');
    }
    return lines.join('\n');
  }

  // export grid (unique with bubbles)
  async function doExportGrid(){
    setExportErr(null); setExporting(true);
    try{
      const blob=await exportDeckAsPng(deck, { unique: true });
      if(!blob) throw new Error('Failed to build image blob');
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a'); a.href=url; a.download='lorcana-deck.png'; a.rel='noopener';
      document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(()=> URL.revokeObjectURL(url), 1500);
    }catch(e){ setExportErr(e?.message||String(e)); }
    finally{ setExporting(false); }
  }
  async function doExportList(){
    setExportErr(null); setExporting(true);
    try{
      const blob=await exportDeckListPng(deck, deckName || "Decklist", setRankForCode);
      if(!blob) throw new Error('Failed to build list image');
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a'); a.href=url; a.download='decklist.png'; a.rel='noopener';
      document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(()=> URL.revokeObjectURL(url), 1500);
    }catch(e){ setExportErr(e?.message||String(e)); }
    finally{ setExporting(false); }
  }

  // import flow
  async function importDeckFromText(){
    setImportErr(null);
    const { entries } = parseDeckText(importText);
    if (!entries.length){ setImportErr("No recognizable lines."); return; }
    const newDeck = { ...deck };
    for (const ent of entries){
      const q = ent.version ? `name~${encodeURIComponent(ent.name)};version~${encodeURIComponent(ent.version)}` : `name~${encodeURIComponent(ent.name)}`;
      const url = new URL(`${API_ROOT}/cards/fetch`);
      url.searchParams.set("search", q); url.searchParams.set("page","1"); url.searchParams.set("pagesize","50");
      try{
        const r = await fetch(url.toString());
        if (!r.ok) continue;
        const arr = (await r.json()).map(normalizeCard);
        if (!arr.length) continue;
        let candidate = arr[0];
        if (ent.setCode){
          const exact = arr.find(c => (c.set?.code||"").toUpperCase() === ent.setCode && String(c.collector_number) === String(ent.number||""));
          if (exact) candidate = exact;
        } else {
          candidate = arr.sort((a,b)=> ((setRankForCode(b.set?.code) - setRankForCode(a.set?.code)) || ((parseInt(b.collector_number||"0",10)||0) - (parseInt(a.collector_number||"0",10)||0)) ))[0];
        }
        const fn = fullNameKey(candidate);
        const existing = Object.values(newDeck).find(e => fullNameKey(e.card) === fn);
        const currentCount = existing?.count || 0;
        const toAdd = Math.min(4 - currentCount, ent.count);
        if (toAdd > 0){
          const key = candidate.id;
          const cur = newDeck[key]?.count || 0;
          newDeck[key] = { card: candidate, count: cur + toAdd };
        }
      }catch{}
    }
    setDeck(newDeck);
    setImportOpen(false);
    setImportText("");
  }

  /* ============== UI ============== */
  function FiltersSheet(){
    return (
      <div className="fixed inset-0 z-40 flex">
        <div className="flex-1 bg-black/50" onClick={()=> setFiltersOpen(false)} />
        <div className="w-full max-w-md h-full overflow-hidden bg-slate-950 border-l border-white/10 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Filters</div>
            <div className="flex items-center gap-2">
              <button type="button" className="text-xs px-2 py-1 rounded border border-white/20 text-white/80"
                onClick={()=> updateFilters({ text:'', inks:[], types:[], rarities:[], sets:[], costs:[], inkwell:'any', keywords:[], archetypes:[], format:'any' })}>Reset</button>
              <button type="button" className="text-xs px-2 py-1 rounded border border-white/20 text-white/80" onClick={()=> setFiltersOpen(false)}>✕ Close</button>
            </div>
          </div>

          <div ref={filterScrollRef} className="flex-1 overflow-y-auto pr-1">
            <Section title="Search">
              <input className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/20 outline-none"
                placeholder="Name (default), or prefix n: / e: (e.g., e:draw)"
                value={filters.text} onChange={(e)=> updateFilters(f=> ({...f, text:e.target.value}))} />
              <div className="mt-2 text-[11px] text-white/50">We build lorcana-api syntax for you (AND “;”, OR “;|”).</div>
            </Section>

            <Section title="Ink (OR)">
              <div className="flex flex-wrap">
                {ALL_INKS.map(ink=> (
                  <Chip key={ink} label={ink} active={filters.inks.includes(ink)}
                    onClick={()=> updateFilters(f=> ({...f, inks: f.inks.includes(ink) ? f.inks.filter(x=>x!==ink) : [...f.inks, ink]}))} />
                ))}
              </div>
            </Section>

            <Section title="Type (OR)">
              <div className="flex flex-wrap">
                {ALL_TYPES.map(t=> (
                  <Chip key={t} label={t} active={filters.types.includes(t)}
                    onClick={()=> updateFilters(f=> ({...f, types: f.types.includes(t) ? f.types.filter(x=>x!==t) : [...f.types, t]}))} />
                ))}
              </div>
            </Section>

            <Section title="Rarity (OR)">
              <div className="flex flex-wrap">
                {ALL_RARITIES.map(r=> (
                  <Chip key={r} label={r.replace('_',' ')} active={filters.rarities.includes(r)}
                    onClick={()=> updateFilters(f=> ({...f, rarities: f.rarities.includes(r) ? f.rarities.filter(x=>x!==r) : [...f.rarities, r]}))} />
                ))}
              </div>
            </Section>

            <Section title="Sets (OR)">
              <div className="max-h-40 overflow-auto pr-2">
                <div className="flex flex-wrap">
                  {loadingSets && <div className="text-xs text-white/70">Loading sets…</div>}
                  {!loadingSets && sets.map(s => (
                    <Chip key={s.code} label={`${s.code}`} active={filters.sets.includes(s.code)}
                      title={s.name}
                      onClick={()=> updateFilters(f=> ({...f, sets: f.sets.includes(s.code) ? f.sets.filter(x=>x!==s.code) : [...f.sets, s.code]}))} />
                  ))}
                </div>
              </div>
            </Section>

            <Section title="Cost">
              <div className="flex flex-wrap gap-2">
                {COST_CHOICES.map(n=> (
                  <button key={n} type="button"
                    className={`px-3 py-1 rounded-lg border text-sm ${ (filters.costs||[]).includes(n) ? 'bg-white text-black border-white' : 'border-white/25 hover:border-white/60'}`}
                    onClick={()=> updateFilters(f=> ({...f, costs: (f.costs||[]).includes(n) ? (f.costs||[]).filter(x=>x!==n) : [...(f.costs||[]), n]}))}
                    title={n===9? '9+': String(n)}>{n===9? '9+': n}
                  </button>
                ))}
                {(filters.costs?.length ?? 0) > 0 && (
                  <button type="button" className="ml-2 px-2 py-1 rounded border border-white/25 text-xs"
                    onClick={()=> updateFilters(f=> ({...f, costs: []}))}>Clear</button>
                )}
              </div>
            </Section>

            <Section title="Inkwell">
              <select className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/20"
                value={filters.inkwell} onChange={(e)=> updateFilters(f=> ({...f, inkwell: e.target.value}))}>
                <option value="any">Any</option>
                <option value="inkable">Inkable only</option>
                <option value="non-inkable">Non-inkable only</option>
              </select>
            </Section>

            <Section title="Archetypes (OR)">
              <div className="max-h-32 overflow-auto pr-1 flex flex-wrap">
                {ALL_ARCHETYPES.map(a=> (
                  <Chip key={a} label={a} active={filters.archetypes?.includes(a) || false}
                    onClick={()=> updateFilters(f=> ({...f, archetypes: (f.archetypes||[]).includes(a) ? (f.archetypes||[]).filter(x=>x!==a) : [...(f.archetypes||[]), a]}))} />
                ))}
              </div>
            </Section>

            <Section title="Keywords (OR)">
              <div className="max-h-32 overflow-auto pr-1 flex flex-wrap">
                {ALL_KEYWORDS.map(k=> (
                  <Chip key={k} label={k} active={filters.keywords?.includes(k) || false}
                    onClick={()=> updateFilters(f=> ({...f, keywords: (f.keywords||[]).includes(k) ? (f.keywords||[]).filter(x=>x!==k) : [...(f.keywords||[]), k]}))} />
                ))}
              </div>
            </Section>

            <Section title="Format">
              <select className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/20"
                value={filters.format} onChange={(e)=> updateFilters(f=> ({...f, format: e.target.value}))}>
                <option value="any">Any</option>
                <option value="core">Standard/Core legal</option>
                <option value="infinity">Infinity legal</option>
              </select>
            </Section>
          </div>

          <div className="pt-3 border-t border-white/10">
            <button type="button" className="w-full h-10 rounded-lg bg-white text-black font-medium" onClick={()=> setFiltersOpen(false)}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white bg-[#0b0f1a] pb-[calc(env(safe-area-inset-bottom)+64px)]">
      <header className="sticky top-0 z-30 backdrop-blur bg-[#0b0f1a]/75 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="text-lg font-bold">lorcana deck builder</div>
          <div className="flex items-center gap-2 ml-6">
            <button className="h-9 px-3 rounded-xl bg-[#2a2f45] border border-white/10 text-sm" onClick={()=> setFiltersOpen(true)}>Filters</button>
            <button className="h-9 px-3 rounded-xl bg-[#2a2f45] border border-white/10 text-sm" onClick={()=> setImportOpen(true)}>Import</button>
            <button className="h-9 px-3 rounded-xl bg-[#2a2f45] border border-white/10 text-sm" onClick={()=> setPrintOpen(true)}>Print Decklist</button>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs">
            <label className="opacity-70">Group by</label>
            <select className="px-2 py-1 rounded border border-white/20 bg-transparent" value={groupBy} onChange={e=> setGroupBy(e.target.value)}>
              <option value="type">Type</option>
              <option value="ink">Ink</option>
              <option value="none">None</option>
            </select>
            <label className="opacity-70 ml-2">Sort by</label>
            <select className="px-2 py-1 rounded border border-white/20 bg-transparent" value={sortBy} onChange={e=> setSortBy(e.target.value)}>
              <option value="cost">Cost</option>
              <option value="set">Set</option>
              <option value="ink">Ink</option>
              <option value="name">Name</option>
            </select>
          </div>
          <div className="text-xs text-white/60 ml-4">Data & Images: lorcana-api</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 grid gap-6 md:grid-cols-[minmax(0,1fr),400px]">
        {/* LEFT: card search/grid */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 relative">
              <input className="w-full h-11 pl-11 pr-40 rounded-xl bg-[#12172a] border border-white/10 outline-none placeholder-white/40"
                placeholder="Search…" value={filters.text}
                onChange={(e)=> updateFilters(f=> ({...f, text:e.target.value}))} />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">🔎</div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-white/60">{cards.length} cards</div>
            </div>
            <button type="button" className="h-11 px-3 rounded-xl bg-[#2a2f45] border border-white/10 text-sm"
              onClick={()=> updateFilters(f=> ({...f, text: 'i:amber or i:amethyst or i:emerald or i:ruby or i:sapphire or i:steel'}))}>
              Show all
            </button>
          </div>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visibleCards.map(c=> (
              <CardTile key={`${c.id}-${c.collector_number || c.name}`} card={c} onAdd={(card)=> addToDeck(card,1)} />
            ))}
          </div>

          <div ref={sentinelRef} className="h-8"></div>

          <div className="mt-4 mb-1 flex items-center justify-between">
            <div className="text-sm text-white/70">
              {loadingCards ? 'Searching…' : `${visibleCards.length} / ${sortedCards.length} shown`}
            </div>
            <div className="text-xs text-white/50">Scroll to load more</div>
          </div>

          {err && (<div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm">{err}</div>)}
        </section>

        {/* RIGHT: deck panel */}
        <aside className="md:sticky md:top-16 h-fit hidden md:block">
          <div className="rounded-xl bg-[#0a0e19] border border-white/10 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Unsaved deck</div>
                <div className="text-xs text-white/60">
                  {total} cards · Inks: {inksInDeck.join(', ') || '—'} {total < 60 && <span className="ml-1 text-amber-300">(needs ≥ 60)</span>}
                </div>
              </div>
              <div className="text-right text-xs">
                <div>Inkable: <span className="text-emerald-300">{inkableStats.inkable}</span></div>
                <div>Uninkable: <span className="text-rose-300">{inkableStats.uninkable}</span></div>
              </div>
            </div>

            <div className="mt-3 flex gap-2 flex-wrap">
              <button type="button" onClick={async()=>{
                  const text=buildDeckText();
                  const method=await copyToClipboardRobust(text);
                  if(method==='api'||method==='exec'){ alert('Deck copied to clipboard as text.'); }
                  else { setCopyModal({open:true, text}); setTimeout(()=>{ copyAreaRef.current?.focus?.(); copyAreaRef.current?.select?.(); },0); }
                }}
                className="px-3 py-1.5 rounded-lg border border-white/20 text-sm">Copy Text</button>
              <button type="button" disabled={exporting} onClick={doExportGrid}
                className="px-3 py-1.5 rounded-lg border border-white/20 text-sm">
                {exporting? 'Exporting…' : 'Export PNG'}
              </button>
              <button type="button" disabled={exporting} onClick={doExportList}
                className="px-3 py-1.5 rounded-lg border border-white/20 text-sm">
                {exporting? 'Exporting…' : 'Export Decklist (PNG)'}
              </button>
              <button type="button" onClick={()=> setPublishOpen(true)}
                className="px-3 py-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/20 text-emerald-200 text-sm">
                Publish
              </button>
              <button type="button" onClick={clearDeck}
                className="px-3 py-1.5 rounded-lg border border-white/20 text-sm">Clear</button>
            </div>

            <div className="mt-3">
              {Object.keys(deckGrouped).length === 0 ? (
                <div className="text-sm text-white/60">Add cards from the grid →</div>
              ) : (
                Object.entries(deckGrouped).map(([group, items]) => (
                  <div key={group} className="mb-2">
                    {groupBy !== "none" && <div className="text-xs uppercase tracking-wider text-white/60 mt-2 mb-1">{group}</div>}
                    {items.map(e=> (
                      <DeckRow key={e.card.id} entry={e}
                        onInc={()=> addToDeck(e.card,1)}
                        onDec={()=> decEntry(e.card.id)}
                        onRemove={()=> removeEntry(e.card.id)}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>

            <div className="mt-4">
              <div className="text-sm font-medium mb-2">Curve</div>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={curveData}>
                    <XAxis dataKey="cost" stroke="#aaa" />
                    <YAxis stroke="#aaa" allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="text-xs text-white/50 mt-1">Rules: ≥60 min, ≤4 per full name, ≤2 inks.</div>
              {exportErr && <div className="mt-2 text-xs text-rose-300">{exportErr}</div>}
            </div>
          </div>
        </aside>
      </main>

      {/* Copy modal */}
      {copyModal.open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={()=> setCopyModal({open:false, text:''})} />
          <div className="relative bg-[#0b0f1a] border border-white/10 rounded-xl w-[min(90vw,680px)] p-4">
            <div className="text-sm font-semibold mb-2">Copy deck text</div>
            <textarea ref={copyAreaRef} rows={10} className="w-full bg-black/30 border border-white/10 rounded p-2 font-mono text-xs"
              value={copyModal.text} onChange={()=>{}} />
            <div className="mt-3 flex justify-end">
              <button type="button" className="px-3 py-1.5 rounded-lg border border-white/20 text-sm"
                onClick={()=> setCopyModal({open:false, text:''})}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Import modal */}
      {importOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={()=> setImportOpen(false)} />
          <div className="relative bg-[#0b0f1a] border border-white/10 rounded-xl w-[min(96vw,900px)] max-h-[90vh] overflow-auto p-4">
            <div className="text-sm font-semibold mb-2">Import decklist (Dreamborn style)</div>
            <div className="text-xs text-white/70 mb-2">Paste lines like: <code>4x Elsa — Snow Queen [TFC#123]</code></div>
            <textarea rows={12} value={importText} onChange={e=> setImportText(e.target.value)}
              className="w-full px-3 py-2 rounded bg-black/30 border border-white/10 font-mono text-xs" />
            {importErr && <div className="mt-2 text-xs text-rose-300">{importErr}</div>}
            <div className="mt-3 flex justify-end gap-2">
              <button className="px-3 py-1.5 rounded-lg border border-white/20 text-sm" onClick={()=> setImportOpen(false)}>Cancel</button>
              <button className="px-3 py-1.5 rounded-lg bg-white text-black text-sm" onClick={importDeckFromText}>Import</button>
            </div>
          </div>
        </div>
      )}

      {/* Print Decklist modal */}
      {printOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center print:block">
          <div className="absolute inset-0 bg-black/60 print:hidden" onClick={()=> setPrintOpen(false)} />
          <div className="relative bg-white text-black border border-white/10 rounded-xl w-[min(96vw,900px)] max-h-[90vh] overflow-auto p-6 print:w-auto print:h-auto print:rounded-none print:overflow-visible">
            <div className="flex items-center justify-between mb-4 print:hidden">
              <div className="text-lg font-semibold">Print Decklist</div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded border text-sm" onClick={()=> window.print()}>Print</button>
                <button className="px-3 py-1.5 rounded border text-sm" onClick={()=> setPrintOpen(false)}>Close</button>
              </div>
            </div>
            <div className="prose prose-sm max-w-none">
              <h2 className="mt-0">{deckName || "Decklist"}</h2>
              <p className="mt-0 text-sm text-gray-600">Generated {new Date().toLocaleString()}</p>
              {Object.entries(deckGrouped).map(([group, items]) => (
                <div key={group} className="mt-4">
                  {groupBy !== "none" && <h3 className="mb-2">{group}</h3>}
                  <ul className="m-0">
                    {items.map(({card,count}) => (
                      <li key={card.id} className="text-sm list-none">
                        <span className="font-medium">{count}x {card.name}{card.version ? ` — ${card.version}` : ""}</span>
                        <span className="ml-2 opacity-70">{card.ink || "—"} · {typeof card.cost==='number'?card.cost:'—'}</span>
                        {card.set?.code && card.collector_number && <span className="ml-2 opacity-60">[{card.set.code}#{card.collector_number}]</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Publish modal */}
      {publishOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={closePublishModal} />
          <div className="relative bg-[#0b0f1a] border border-white/10 rounded-xl w-[min(96vw,900px)] max-h-[90vh] overflow-auto p-4">
            <div className="text-sm font-semibold mb-3">Publish deck poster</div>

            <div className="grid gap-4 md:grid-cols-[1fr,320px]">
              <div className="bg-black/20 border border-white/10 rounded-lg min-h-[280px] flex items-center justify-center">
                {publishedImageUrl
                  ? <img loading="lazy" src={publishedImageUrl} alt="Poster preview" className="max-w-full max-h-[60vh] object-contain" />
                  : <div className="text-white/50 text-sm">No poster yet. Click “Publish” to generate.</div>}
              </div>

              <div>
                <label className="block text-xs text-white/60 mb-1">Deck name</label>
                <input value={deckName} onChange={e=> setDeckName(e.target.value)}
                  className="w-full mb-3 px-3 py-2 rounded bg-black/30 border border-white/10" />

                <label className="block text-xs text-white/60 mb-1">Notes (optional)</label>
                <textarea rows={6} value={deckNotes} onChange={e=> setDeckNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-black/30 border border-white/10" />

                {publishedLink && (
                  <div className="mt-3 text-xs">
                    <div className="text-white/60 mb-1">Share link:</div>
                    <div className="p-2 rounded bg-black/30 border border-white/10 break-all">{publishedLink}</div>
                  </div>
                )}

                {publishErr && <div className="mt-2 text-xs text-rose-300">{publishErr}</div>}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 justify-end">
              <button
                className={`px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-sm ${publishing?'opacity-60 cursor-wait':''}`}
                disabled={publishing}
                onClick={async()=>{
                  setPublishing(true);
                  setPublishErr(null);
                  setPublishedLink(null);
                  if (publishedImageUrl) { try{ URL.revokeObjectURL(publishedImageUrl); }catch{} setPublishedImageUrl(null); }
                  try {
                    const blob = await exportDeckAsPng(deck, { unique: true });
                    const url = URL.createObjectURL(blob);
                    setPublishedImageUrl(url);
                    const share = `${location.origin}${location.pathname}#deck=${encodeURIComponent(
                      btoa(unescape(encodeURIComponent(JSON.stringify(deck))))
                    )}&title=${encodeURIComponent(deckName)}`;
                    setPublishedLink(share);
                  } catch(e) {
                    setPublishErr(e?.message || String(e));
                  } finally {
                    setPublishing(false);
                  }
                }}
              >
                {publishing ? 'Publishing…' : 'Publish'}
              </button>

              {publishedImageUrl && (
                <button
                  className="px-3 py-1.5 rounded-lg border border-white/20 text-sm"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = publishedImageUrl;
                    a.download = (deckName || 'deck') + '_poster.png';
                    a.rel = 'noopener';
                    a.target = '_blank';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  }}
                >
                  Download poster
                </button>
              )}

              <button className="px-3 py-1.5 rounded-lg border border-white/20 text-sm" onClick={closePublishModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {filtersOpen && <FiltersSheet/>}
    </div>
  );
}
