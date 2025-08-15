import React, { useEffect, useMemo, useRef, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

/* =========================
   Constants / simple lists
   ========================= */
const API_ROOT = "https://api.lorcast.com/v0";

const ALL_INKS = ["Amber","Amethyst","Emerald","Ruby","Sapphire","Steel"];
const ALL_TYPES = ["Character","Action","Song","Item","Location"];
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
   API helpers
   ========================= */
function fullNameKey(card){ return `${card.name} — ${card.version ?? ""}`.trim(); }

async function fetchSets(){
  const r = await fetch(`${API_ROOT}/sets`);
  if (!r.ok) throw new Error("Failed to load sets");
  const j = await r.json();
  return j.results ?? [];
}

async function searchCards(query, unique = "cards"){
  const url = new URL(`${API_ROOT}/cards/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("unique", unique);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error("Search failed");
  const j = await r.json();
  return j.results ?? [];
}

function buildQuery(f){
  const parts = [];
  const raw = (f.text || "").trim();
  if (raw) {
    if (raw.startsWith("n:")) parts.push(`name:${JSON.stringify(raw.slice(2).trim())}`);
    else if (raw.startsWith("e:")) parts.push(`text:${JSON.stringify(raw.slice(2).trim())}`);
    else parts.push(JSON.stringify(raw));
  }
  if (f.inks?.length) parts.push(`(${f.inks.map(i=>`i:${i.toLowerCase()}`).join(" or ")})`);
  if (f.types?.length) parts.push(`(${f.types.map(t=>`t:${t.toLowerCase()}`).join(" or ")})`);
  if (f.rarities?.length) parts.push(`(${f.rarities.map(r=>`r:${r.toLowerCase()}`).join(" or ")})`);
  if (f.sets?.length) parts.push(`(${f.sets.map(s=>`s:${s}`).join(" or ")})`);
  if (f.costs?.length) {
    const cs = f.costs.map(n=> n>=9? "c>=9" : `c=${n}`);
    parts.push(`(${cs.join(" or ")})`);
  }
  if (typeof f.costMin === 'number') parts.push(`c>=${f.costMin}`);
  if (typeof f.costMax === 'number') parts.push(`c<=${f.costMax}`);
  if (f.inkwell === 'inkable') parts.push('iw');
  if (f.inkwell === 'non-inkable') parts.push('-iw');
  if (f.keywords?.length) parts.push(`(${f.keywords.map(k=>`keyword:${k.toLowerCase().replace(/\s+/g,'_')}`).join(" or ")})`);
  if (f.archetypes?.length) parts.push(`(${f.archetypes.map(a=>`t:${a.toLowerCase()}`).join(" or ")})`);
  if (f.format === 'core') parts.push('format:core');
  if (f.format === 'infinity') parts.push('format:infinity');
  return parts.join(" ").trim();
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
   EXPORT HELPERS (images)
   ========================= */

// CORS-safe proxy for drawing remote images on canvas
function proxyImageUrl(rawUrl) {
  if (!rawUrl) return null;
  const noProto = rawUrl.replace(/^https?:\/\//, "");
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

// UNIQUE tile grid (one tile per full name) or per-copy grid (old mode)
async function exportDeckAsPng(deck, { unique = false } = {}) {
  // Build entries
  const entries = Object.values(deck)
    .filter(e => e.count > 0)
    .sort((a, b) =>
      (a.card.cost ?? 0) - (b.card.cost ?? 0) ||
      (a.card.name > b.card.name ? 1 : -1)
    );

  // Totals per full name + representative print
  const totalByFullName = {};
  const repByFullName = {};
  const prints = [];

  for (const { card, count } of entries) {
    const key = fullNameKey(card);
    totalByFullName[key] = (totalByFullName[key] || 0) + count;
    if (!repByFullName[key]) repByFullName[key] = card;
    if (!unique) {
      for (let i = 0; i < count; i++) prints.push(card);
    }
  }
  if (unique) {
    for (const key of Object.keys(repByFullName)) prints.push(repByFullName[key]);
  }

  // Layout
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

    // frame
    ctx.fillStyle = "#171b2b"; ctx.fillRect(x, y, cellW, cellH);
    ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);

    // image
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
      } catch { /* keep placeholder */ }
    }

    // count bubble
    const key = fullNameKey(card);
    const totalForThis = totalByFullName[key] || 0;
    if (unique) {
      drawCountBubble(ctx, x + cellW - 18, y + 18, totalForThis);
    } else {
      const firstIdx = prints.findIndex(p => fullNameKey(p) === key);
      if (firstIdx === idx) drawCountBubble(ctx, x + cellW - 18, y + 18, totalForThis);
    }
  }

  // footer
  ctx.fillStyle = "#fff"; ctx.font = "10px ui-sans-serif, system-ui";
  ctx.fillText(`Exported ${new Date().toLocaleString()} — Powered by Lorcast`, pad, H - 6);

  return new Promise(res => canvas.toBlob(b => res(b), "image/png"));
}

/* Poster export for Publish: grid (left) + decklist/notes (right) */
async function exportDeckPoster(deck, title, notes, { unique = false } = {}) {
  // grid image
  const gridBlob = await exportDeckAsPng(deck, { unique });
  if (!gridBlob) throw new Error("Failed to build grid image");
  const gridUrl = URL.createObjectURL(gridBlob);

  const gridImg = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = gridUrl;
  });

  // decklist for right column
  const entries = Object.values(deck)
    .sort((a, b) => (a.card.cost ?? 0) - (b.card.cost ?? 0) || (a.card.name > b.card.name ? 1 : -1))
    .map((e) => ({
      count: e.count,
      name: `${e.card.name}${e.card.version ? ` — ${e.card.version}` : ""}`,
      set: e.card.set?.code,
      num: e.card.collector_number,
      cost: e.card.cost,
      ink: e.card.ink,
    }));

  // layout
  const pad = 24;
  const rightW = 460;
  const lineH = 20;
  const headerH = 64;
  const footerH = 28;

  const H = Math.max(
    gridImg.height + pad * 2,
    pad + headerH + entries.length * lineH + footerH + (notes ? 90 : 0)
  );
  const W = gridImg.width + pad + rightW + pad * 2;

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0b0f1a";
  ctx.fillRect(0, 0, W, H);

  // grid
  const gridX = pad;
  const gridY = pad;
  ctx.drawImage(gridImg, gridX, gridY);

  // right column bg
  const rightX = gridX + gridImg.width + pad;
  ctx.fillStyle = "#0a0e19";
  ctx.fillRect(rightX, pad, rightW, H - pad * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.strokeRect(rightX + 0.5, pad + 0.5, rightW - 1, H - pad * 2 - 1);

  // header
  ctx.fillStyle = "#fff";
  ctx.font = "bold 20px ui-sans-serif, system-ui";
  ctx.fillText(title || "Untitled Deck", rightX + 14, pad + 26);
  ctx.font = "12px ui-sans-serif, system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(new Date().toLocaleString(), rightX + 14, pad + 44);

  // decklist
  ctx.fillStyle = "#fff";
  ctx.font = "13px ui-sans-serif, system-ui";
  let y = pad + headerH;
  for (const e of entries) {
    const line = `${e.count}x  ${e.name}${
      e.set && e.num ? ` [${e.set}#${e.num}]` : ""
    }  · ${e.ink || "—"} · ${typeof e.cost === "number" ? e.cost : "—"}`;
    ctx.fillText(line, rightX + 14, y);
    y += lineH;
  }

  // notes
  if (notes) {
    const boxY = Math.min(y + 12, H - footerH - 78);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(rightX + 10, boxY, rightW - 20, 60);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px ui-sans-serif, system-ui";
    ctx.fillText("Notes", rightX + 18, boxY + 18);
    ctx.font = "12px ui-sans-serif, system-ui";
    wrap(ctx, notes, rightX + 18, boxY + 36, rightW - 36, 16);
  }

  // footer
  ctx.font = "11px ui-sans-serif, system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(
    "Generated with Lorcast data · deckbuilder",
    rightX + 14,
    H - 10
  );

  URL.revokeObjectURL(gridUrl);

  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png", 0.92)
  );

  function wrap(c, text, x, oy, maxW, lh) {
    const words = (text || "").split(/\s+/);
    let line = "";
    let y2 = oy;
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (c.measureText(test).width > maxW) {
        c.fillText(line, x, y2);
        line = w;
        y2 += lh;
      } else {
        line = test;
      }
    }
    if (line) c.fillText(line, x, y2);
  }
}

/* =========================
   Small UI atoms
   ========================= */
function Chip({ active, label, onClick, title }){
  return (
    <button type="button" title={title} onClick={onClick}
      className={`px-3 py-1 rounded-full border text-sm mr-2 mb-2 transition ${
        active ? 'bg-white text-black border-white' : 'border-white/25 hover:border-white/60'
      }`}>
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
        {img ? (<img src={img} alt={name} className="w-full h-full object-contain" />) : (<div className="text-white/40 text-xs">No image</div>)}
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
        {card.image_uris?.digital?.small ? (<img src={card.image_uris.digital.small} alt={name} className="h-full object-contain" />) : null}
      </div>
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium text-sm">{name}</div>
        <div className="text-xs text-white/60 flex gap-2">{card.ink ?? '—'} {typeof card.cost === 'number' ? `· ${card.cost}` : ''}</div>
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
export default function LorcanaDeckBuilderApp(){
  // sets
  const [sets, setSets] = useState([]);
  const [loadingSets, setLoadingSets] = useState(true);

  // filters & results
  const [filters, setFilters] = useState({
    text:"", inks:[], types:[], rarities:[], sets:[],
    costMin:undefined, costMax:undefined, costs:[],
    inkwell:"any", keywords:[], archetypes:[], format:"any"
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [uniqueMode, setUniqueMode] = useState("cards");
  const [err, setErr] = useState(null);

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

  // publish (UI only)
  const [publishOpen, setPublishOpen] = useState(false);
  const [deckName, setDeckName] = useState("My Lorcana Deck");
  const [deckNotes, setDeckNotes] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishedLink, setPublishedLink] = useState(null);
  const [publishedImageUrl, setPublishedImageUrl] = useState(null);
  const [publishErr, setPublishErr] = useState(null);

  // load sets
  useEffect(()=>{ (async()=>{ try{ setLoadingSets(true); const s=await fetchSets(); setSets(s); } catch(e){ setErr(e?.message||String(e)); } finally{ setLoadingSets(false); } })(); },[]);

  // build query (debounced)
  const debounceRef = useRef(null);
  useEffect(()=>{
    const q = buildQuery(filters);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(()=> setQuery(q), 250);
  }, [filters]);

  // search
  useEffect(()=>{ (async()=>{ try{
      setErr(null);
      if(!query || !query.trim()){ setCards([]); return; }
      setLoadingCards(true);
      const res=await searchCards(query, uniqueMode);
      setCards(res);
    } catch(e){ setErr(e?.message||String(e)); }
    finally{ setLoadingCards(false); } })();
  }, [query, uniqueMode]);

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

  // deck text
  function buildDeckText(){
    const lines=[]; lines.push(`# Lorcana Deck (${total} cards)`); lines.push(`Inks: ${inksInDeck.join(', ') || '—'}`); lines.push('');
    Object.values(deck).sort((a,b)=>(a.card.cost??0)-(b.card.cost??0)||(a.card.name>b.card.name?1:-1)).forEach(({card,count})=>{
      const nm=`${card.name}${card.version?` — ${card.version}`:''}`;
      const setInfo=card.set?` [${card.set.code}#${card.collector_number}]`:'';
      lines.push(`${count}x ${nm}${setInfo}`);
    });
    return lines.join('\n');
  }
  async function copyTextExport(){
    const text=buildDeckText();
    const method=await copyToClipboardRobust(text);
    if(method==='api'||method==='exec'){ alert('Deck copied to clipboard as text.'); return; }
    setCopyModal({open:true, text}); setTimeout(()=>{ copyAreaRef.current?.focus?.(); copyAreaRef.current?.select?.(); },0);
  }
  async function doExport(){
    setExportErr(null); setExporting(true);
    try{
      // unique tiles with count bubbles
      const blob=await exportDeckAsPng(deck, { unique: true });
      if(!blob) throw new Error('Failed to build image blob');
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a'); a.href=url; a.download='lorcana-deck.png'; a.rel='noopener';
      document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(()=> URL.revokeObjectURL(url), 1500);
    }catch(e){ setExportErr(e?.message||String(e)); }
    finally{ setExporting(false); }
  }

  // sorting & pagination
  const [page, setPage] = useState(1);
  const pageSize = 24;
  const setOrder = useMemo(()=>{ const m={}; sets.forEach((s,i)=> m[s.code]=i); return m; }, [sets]);
  const sortedCards = useMemo(()=> [...cards].sort((a,b)=>{
    const ac=a.set?.code||''; const bc=b.set?.code||'';
    const ai=setOrder[ac]??9999; const bi=setOrder[bc]??9999; if(ai!==bi) return ai-bi;
    const an=parseInt(a.collector_number||'0',10)||0; const bn=parseInt(b.collector_number||'0',10)||0; return an-bn;
  }), [cards, setOrder]);
  const pageCount = Math.max(1, Math.ceil(sortedCards.length / pageSize));
  useEffect(()=> setPage(1), [sortedCards.length]);
  const view = useMemo(()=> sortedCards.slice((page-1)*pageSize, page*pageSize), [sortedCards, page]);

  /* ============== UI ============== */
  function FiltersSheet(){
    return (
      <div className="fixed inset-0 z-40 flex">
        <div className="flex-1 bg-black/50" onClick={()=> setFiltersOpen(false)} />
        <div className="w-full max-w-md h-full overflow-y-auto bg-slate-950 border-l border-white/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Filters</div>
            <button type="button" className="text-xs underline text-white/70"
              onClick={()=> setFilters({ text:'', inks:[], types:[], rarities:[], sets:[], costMin:undefined, costMax:undefined, costs:[], inkwell:'any', keywords:[], archetypes:[], format:'any' })}>
              Reset
            </button>
          </div>

          <Section title="Search">
            <input className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/20 outline-none"
              placeholder="Name (default), or prefix n: / e: (e.g., e:draw)"
              value={filters.text} onChange={(e)=> setFilters(f=> ({...f, text:e.target.value}))} />
            <div className="mt-2 text-[11px] text-white/50">
              Supports i:/t:/r:/s:/c:/iw, <span className="font-mono">keyword:</span>, and <span className="font-mono">format:core|infinity</span>.
            </div>
          </Section>

          <Section title="Ink (OR)">
            <div className="flex flex-wrap">
              {ALL_INKS.map(ink=> (
                <Chip key={ink} label={ink} active={filters.inks.includes(ink)}
                  onClick={()=> setFilters(f=> ({...f, inks: f.inks.includes(ink) ? f.inks.filter(x=>x!==ink) : [...f.inks, ink]}))} />
              ))}
            </div>
          </Section>

          <Section title="Type (OR)">
            <div className="flex flex-wrap">
              {ALL_TYPES.map(t=> (
                <Chip key={t} label={t} active={filters.types.includes(t)}
                  onClick={()=> setFilters(f=> ({...f, types: f.types.includes(t) ? f.types.filter(x=>x!==t) : [...f.types, t]}))} />
              ))}
            </div>
          </Section>

          <Section title="Rarity (OR)">
            <div className="flex flex-wrap">
              {ALL_RARITIES.map(r=> (
                <Chip key={r} label={r.replace('_',' ')} active={filters.rarities.includes(r)}
                  onClick={()=> setFilters(f=> ({...f, rarities: f.rarities.includes(r) ? f.rarities.filter(x=>x!==r) : [...f.rarities, r]}))} />
              ))}
            </div>
          </Section>

          <Section title="Sets (OR)">
            <div className="max-h-40 overflow-auto pr-2">
              {loadingSets ? (<div className="text-white/60 text-sm">Loading sets…</div>) : (
                <div className="flex flex-wrap">
                  {sets.map(s=> (
                    <Chip key={s.code} label={`${s.name} (${s.code})`} active={filters.sets.includes(s.code)}
                      onClick={()=> setFilters(f=> ({...f, sets: f.sets.includes(s.code) ? f.sets.filter(x=>x!==s.code) : [...f.sets, s.code]}))} />
                  ))}
                </div>
              )}
            </div>
          </Section>

          <Section title="Cost">
            <div className="flex flex-wrap gap-2">
              {COST_CHOICES.map(n=> (
                <button key={n} type="button"
                  className={`px-3 py-1 rounded-lg border text-sm ${ (filters.costs||[]).includes(n) ? 'bg-white text-black border-white' : 'border-white/25 hover:border-white/60'}`}
                  onClick={()=> setFilters(f=> ({...f, costs: (f.costs||[]).includes(n) ? (f.costs||[]).filter(x=>x!==n) : [...(f.costs||[]), n]}))}
                  title={n===9? '9+': String(n)}>{n===9? '9+': n}
                </button>
              ))}
              {(filters.costs?.length ?? 0) > 0 && (
                <button type="button" className="ml-2 px-2 py-1 rounded border border-white/25 text-xs"
                  onClick={()=> setFilters(f=> ({...f, costs: []}))}>Clear</button>
              )}
            </div>
          </Section>

          <Section title="Inkwell">
            <select className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/20"
              value={filters.inkwell} onChange={(e)=> setFilters(f=> ({...f, inkwell: e.target.value}))}>
              <option value="any">Any</option>
              <option value="inkable">Inkable only</option>
              <option value="non-inkable">Non-inkable only</option>
            </select>
          </Section>

          <Section title="Archetypes (Classifications, OR)">
            <div className="max-h-32 overflow-auto pr-1 flex flex-wrap">
              {ALL_ARCHETYPES.map(a=> (
                <Chip key={a} label={a} active={filters.archetypes?.includes(a) || false}
                  onClick={()=> setFilters(f=> ({...f, archetypes: (f.archetypes||[]).includes(a) ? (f.archetypes||[]).filter(x=>x!==a) : [...(f.archetypes||[]), a]}))} />
              ))}
            </div>
          </Section>

          <Section title="Keywords (OR)">
            <div className="max-h-32 overflow-auto pr-1 flex flex-wrap">
              {ALL_KEYWORDS.map(k=> (
                <Chip key={k} label={k} active={filters.keywords?.includes(k) || false}
                  onClick={()=> setFilters(f=> ({...f, keywords: (f.keywords||[]).includes(k) ? (f.keywords||[]).filter(x=>x!==k) : [...(f.keywords||[]), k]}))} />
              ))}
            </div>
          </Section>

          <Section title="Format">
            <select className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/20"
              value={filters.format} onChange={(e)=> setFilters(f=> ({...f, format: e.target.value}))}>
              <option value="any">Any</option>
              <option value="core">Standard/Core legal</option>
              <option value="infinity">Infinity legal</option>
            </select>
          </Section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white bg-[#0b0f1a]">
      <header className="sticky top-0 z-30 backdrop-blur bg-[#0b0f1a]/75 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="text-lg font-bold">lorcana deck builder</div>
          <div className="text-xs text-white/60 ml-auto">Data & Images: Lorcast</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 grid gap-6 md:grid-cols-[minmax(0,1fr),400px]">
        {/* LEFT: card search/grid */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 relative">
              <input className="w-full h-11 pl-11 pr-40 rounded-xl bg-[#12172a] border border-white/10 outline-none placeholder-white/40"
                placeholder="Search…" value={filters.text}
                onChange={(e)=> setFilters(f=> ({...f, text:e.target.value}))} />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">🔎</div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-white/60">{sortedCards.length} cards</div>
            </div>
            <button type="button" className="h-11 px-4 rounded-xl bg-[#2a2f45] border border-white/10 hover:border-white/30"
              onClick={()=> setFiltersOpen(true)}>Filters</button>
            <button type="button" className="h-11 px-3 rounded-xl bg-[#2a2f45] border border-white/10 text-sm"
              onClick={()=> setFilters(f=> ({...f, text: 'i:amber or i:amethyst or i:emerald or i:ruby or i:sapphire or i:steel'}))}>
              Show all
            </button>
          </div>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {view.map(c=> (
              <CardTile key={`${c.id}-${c.collector_number}`} card={c} onAdd={(card)=> addToDeck(card,1)} />
            ))}
          </div>

          <div className="mt-4 mb-1 flex items-center justify-between">
            <div className="text-sm text-white/70">{loadingCards ? 'Searching…' : `${sortedCards.length} results`}</div>
            <div className="flex items-center gap-2">
              <label className="text-xs">Unique:</label>
              <select className="px-2 py-1 rounded border border-white/20 bg-[#12172a] text-sm" value={uniqueMode}
                onChange={(e)=> setUniqueMode(e.target.value)}>
                <option value="cards">Cards</option>
                <option value="prints">Prints</option>
              </select>
              <button type="button" className="px-3 py-1.5 rounded-lg border border-white/20 text-sm"
                onClick={()=> setPage(p=> Math.max(1, p-1))}>← Prev</button>
              <div className="text-sm">Page {page} / {pageCount}</div>
              <button type="button" className="px-3 py-1.5 rounded-lg border border-white/20 text-sm"
                onClick={()=> setPage(p=> Math.min(pageCount, p+1))}>Next →</button>
            </div>
          </div>

          {err && (<div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm">{err}</div>)}
        </section>

        {/* RIGHT: deck panel */}
        <aside className="md:sticky md:top-16 h-fit">
          <div className="rounded-xl bg-[#0a0e19] border border-white/10 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Unsaved deck</div>
                <div className="text-xs text-white/60">
                  {total} cards · Inks: {inksInDeck.join(', ') || '—'} {total < 60 && <span className="ml-1 text-amber-300">(needs ≥ 60)</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs">Inkable: <span className="text-emerald-300 font-medium">{inkableStats.inkable}</span></div>
                <div className="text-xs">Uninkable: <span className="text-rose-300 font-medium">{inkableStats.uninkable}</span></div>
              </div>
            </div>

            <div className="mt-3 inline-flex rounded-full border border-white/10 p-1 bg-[#12172a]">
              <button className="px-3 py-1 rounded-full bg-white text-black text-sm">Cards</button>
              <button className="px-3 py-1 rounded-full text-white/80 text-sm">Info</button>
            </div>

            <div className="mt-3 max-h-[46vh] overflow-auto pr-2">
              {Object.values(deck).length === 0 ? (
                <div className="text-white/60 text-sm">Add cards from the grid →</div>
              ) : (
                Object.values(deck)
                  .sort((a,b)=>(a.card.cost??0)-(b.card.cost??0)||(a.card.name>b.card.name?1:-1))
                  .map((e)=> (
                    <DeckRow key={e.card.id} entry={e}
                      onInc={()=> addToDeck(e.card,1)}
                      onDec={()=> decEntry(e.card.id)}
                      onRemove={()=> removeEntry(e.card.id)} />
                  ))
              )}
            </div>

            <div className="mt-4">
              <div className="text-xs mb-1 text-white/70">Curve</div>
              <div className="h-40 bg-[#12172a] rounded-lg border border-white/10 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={curveData}>
                    <XAxis dataKey="cost" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                    <Bar dataKey="count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button type="button" className="px-3 py-1.5 rounded-lg bg-[#2a2f45] border border-white/10 text-sm" onClick={copyTextExport}>Copy Text</button>
              <button type="button" className={`px-3 py-1.5 rounded-lg border text-sm ${exporting? 'opacity-60 cursor-wait border-white/10':'border-white/20'}`} onClick={doExport} disabled={exporting} aria-busy={exporting}>{exporting? 'Exporting…':'Export PNG'}</button>
              <button type="button" className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-sm"
                onClick={()=> setPublishOpen(true)}>Publish</button>
              <button type="button" className="ml-auto px-3 py-1.5 rounded-lg bg-[#2a2f45] border border-white/10 text-sm" onClick={clearDeck}>Clear</button>
            </div>

            {exportErr && (<div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-400/40 text-sm">Export note: {exportErr}</div>)}
            <div className="mt-2 text-[10px] text-white/40">Rules: ≥60 min, ≤4 per full name, ≤2 inks.</div>
          </div>
        </aside>
      </main>

      {/* Filters slide-over */}
      {filtersOpen && <FiltersSheet />}

      {/* Manual copy modal */}
      {copyModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">Manual Copy</div>
              <button type="button" className="text-xs underline text-white/70" onClick={()=> setCopyModal({ open:false, text:"" })}>Close</button>
            </div>
            <textarea ref={copyAreaRef} className="w-full h-64 p-2 rounded-lg bg-black/40 border border-white/20 font-mono text-xs" value={copyModal.text} readOnly />
            <div className="mt-2 flex gap-2">
              <button type="button" className="px-3 py-1.5 rounded-lg border border-white/20 text-sm"
                onClick={()=>{ copyAreaRef.current?.focus?.(); copyAreaRef.current?.select?.(); try { document.execCommand('copy'); alert('Text selected. Press Ctrl/Cmd+C if not auto-copied.'); } catch { alert('Select all (Ctrl/Cmd+A) then copy.'); } }}>
                Select all & Copy
              </button>
              <button type="button" className="px-3 py-1.5 rounded-lg border border-white/20 text-sm" onClick={()=> setCopyModal({ open:false, text:"" })}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Publish modal */}
      {publishOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">Publish Deck</div>
              <button type="button" className="text-xs underline text-white/70" onClick={()=> setPublishOpen(false)}>Close</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/70">Deck name</label>
                <input className="w-full mt-1 px-3 py-2 rounded-lg bg-black/40 border border-white/20"
                  value={deckName} onChange={(e)=> setDeckName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-white/70">Notes (optional)</label>
                <textarea className="w-full mt-1 h-28 p-2 rounded-lg bg-black/40 border border-white/20"
                  value={deckNotes} onChange={(e)=> setDeckNotes(e.target.value)} />
              </div>

              {publishedImageUrl && (
                <div className="mt-2">
                  <div className="text-xs text-white/70 mb-1">Preview</div>
                  <img src={publishedImageUrl} alt="deck preview" className="max-h-60 rounded border border-white/10" />
                </div>
              )}
              {publishedLink && (
                <div className="mt-2 text-xs break-all">
                  Permalink: <a className="underline" href={publishedLink} target="_blank" rel="noreferrer">{publishedLink}</a>
                  <button className="ml-2 text-[11px] px-2 py-1 rounded border border-white/20"
                    onClick={async()=>{ await copyToClipboardRobust(publishedLink); alert('Link copied'); }}>
                    Copy link
                  </button>
                </div>
              )}
              {publishErr && <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-xs">{publishErr}</div>}

              <div className="flex items-center gap-2">
                <button
                  className={`px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-sm ${publishing?'opacity-60 cursor-wait':''}`}
                  disabled={publishing}
                  onClick={async()=>{
                    setPublishing(true); setPublishErr(null); setPublishedLink(null); setPublishedImageUrl(null);
                    try {
                      // UNIQUE poster (one tile per card + bubble)
                      const blob = await exportDeckPoster(deck, deckName || 'Untitled Deck', deckNotes, { unique: true });
                      const url = URL.createObjectURL(blob);
                      setPublishedImageUrl(url);

                      // share link (deck encoded in hash)
                      const share = `${location.origin}${location.pathname}#deck=${encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(deck)))))}&title=${encodeURIComponent(deckName)}`;
                      setPublishedLink(share);

                      // auto-download the poster
                      const a = document.createElement('a');
                      a.href = url; a.download = 'deck_poster.png';
                      document.body.appendChild(a); a.click(); a.remove();
                    } catch(e){ setPublishErr(e?.message || String(e)); }
                    finally { setPublishing(false); }
                  }}>
                  {publishing? 'Publishing…':'Publish'}
                </button>
                <button className="px-3 py-1.5 rounded-lg border border-white/20 text-sm" onClick={()=> setPublishOpen(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
