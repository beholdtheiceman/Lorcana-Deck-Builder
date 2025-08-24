# 🎯 Comp Dashboard Implementation Guide
## Lorcana Deck Builder - Advanced Analytics Feature

### 📋 **Project Overview**
This document outlines the step-by-step implementation of a comprehensive competitive dashboard for the Lorcana Deck Builder. The dashboard will provide advanced analytics including curve analysis, role breakdowns, synergy detection, and meta tools.

---

## 🚀 **Implementation Phases**

### **Phase 1: Foundation & Imports** ✅
- [x] **Recharts already imported** - Basic chart components available
- [ ] **Add missing chart components**: `PieChart`, `Pie`, `Cell`, `Legend`

**Current Import (Lines 25-32):**
```js
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
```

**Updated Import:**
```js
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,    // ← Add this
  Pie,         // ← Add this  
  Cell,        // ← Add this
  Legend       // ← Add this
} from "recharts";
```

---

### **Phase 2: Heuristics & Utilities**
**Location:** After existing constants (around line 200-300)

**Key Functions to Add:**
- Role detection based on card text analysis
- Synergy detection for common Lorcana combos
- Regex patterns for draw/search/removal detection

**Implementation:**
```js
// --- Role & text helpers ---
const rx = (p)=>new RegExp(p,"i");
const RX_DRAW = rx("(draw|draws|draw a card|draw two|card advantage)");
const RX_SEARCH = rx("(search your deck|look at the top|reveal .* from your deck)");
const RX_REMOVAL = rx("(banish|deal \\d+ damage|return .* to (their|its) hand|exert target)");
const RX_RAMP = rx("(reduce(s)? cost|play .* for free|inkwell|gain ink)");
const RX_SONG = rx("\\bSong\\b|Action\\s*[-—]\\s*Song");
const RX_SINGER = rx("\\bSinger\\b");
const RX_FINISH = rx("(gain.*lore.*each|when this quests.*lore|ready .*again)");

const textOf = c => (c?.text || c?.rulesText || c?.Body_Text || "").toString();

function roleForCard(c){
  const t = textOf(c);
  const type = (c?.type||"").toLowerCase();

  if (RX_REMOVAL.test(t) || type==="action") return "Interaction";
  if (RX_DRAW.test(t) || RX_SEARCH.test(t)) return "Draw / Dig";
  if (RX_RAMP.test(t) || RX_SONG.test(t)) return "Ramp / Cost";
  if ((c?.lore ?? 0) >= 2 && (c?.cost ?? 0) >= 6 || RX_FINISH.test(t)) return "Finisher";
  if ((c?.lore ?? 0) >= 1 && type.includes("character")) return "Questers";
  return "Tech / Utility";
}

function detectSynergies(cards){
  const names = new Set(cards.map(c => (c.name||"").toLowerCase()));
  const has = (n)=>names.has(n.toLowerCase());

  const found = [];
  if (has("Magic Broom") && has("Merlin - Goat")) found.push("Loop: Magic Broom + Merlin – Goat");
  if (cards.some(c=>RX_SONG.test(c?.type)) && cards.some(c=>RX_SINGER.test(textOf(c))))
    found.push("Songs + Singer discount package");
  if (cards.some(c=>(c.subname||"").includes("Shift")) || cards.some(c=>/Shift\s+\d+/i.test(textOf(c))))
    found.push("Shift lines present (check base ↔ floodborn counts)");
  return found;
}
```

---

### **Phase 3: Memoized Datasets**
**Location:** Inside main `AppInner` component, after existing state variables (around line 6100)

**Data Structure Adaptation:**
Your current structure uses `deck.entries` with `{card, count}` format, so we need to adapt the proposed code:

```js
const cards = useMemo(() => 
  Object.values(deck?.entries || {})
    .filter(e => e.count > 0)
    .flatMap(e => Array(e.count).fill(e.card))
, [deck]);

// --- Curve (stacked inkable/uninkable) ---
const curveData = useMemo(() => {
  const buckets = {};
  cards.forEach(c => {
    const cost = Math.min(Math.max(Number(c.cost ?? 0), 0), 8);
    const key = cost >= 7 ? "7+" : String(cost);
    if (!buckets[key]) buckets[key] = { cost: key, inkable: 0, uninkable: 0 };
    (c.inkable ? buckets[key].inkable++ : buckets[key].uninkable++);
  });
  const order = ["0","1","2","3","4","5","6","7+"];
  return order.filter(k => buckets[k]).map(k => buckets[k]);
}, [cards]);

// --- Ink pie ---
const inkPieData = useMemo(() => {
  const counts = new Map();
  cards.forEach(c => (Array.isArray(c.inks)?c.inks:[c.inks].filter(Boolean))
    .forEach(i => counts.set(i, (counts.get(i)||0)+1)));
  return [...counts.entries()].map(([name, value]) => ({ name, value }));
}, [cards]);

// --- Draw / consistency ---
const drawConsistency = useMemo(() => {
  let drawCount=0, searchCount=0, rawDrawPieces=0;
  cards.forEach(c => {
    const t = textOf(c);
    if (RX_DRAW.test(t)) { drawCount++; rawDrawPieces++; }
    if (RX_SEARCH.test(t)) { searchCount++; rawDrawPieces++; }
  });
  const density = (rawDrawPieces / Math.max(cards.length,1))*100;
  return { drawCount, searchCount, density: Number(density.toFixed(1)) };
}, [cards]);

// --- Average lore per card ---
const avgLorePerCard = useMemo(() => {
  const totalLore = cards.reduce((a,c)=>a + Number(c.lore||0), 0);
  return Number((totalLore / Math.max(cards.length,1)).toFixed(2));
}, [cards]);

// --- Roles breakdown ---
const roleData = useMemo(() => {
  const counts = {};
  cards.forEach(c => {
    const r = roleForCard(c);
    counts[r] = (counts[r]||0)+1;
  });
  return Object.entries(counts).map(([role,value])=>({role, value}));
}, [cards]);

// --- Synergies list ---
const synergies = useMemo(() => detectSynergies(cards), [cards]);
```

---

### **Phase 4: Dashboard UI Components**
**Location:** After existing `DeckStats` component in the right panel (around line 7350)

**Implementation:**
```jsx
{/* Comp Dashboard */}
<div className="border-t border-gray-800 pt-4 mt-4">
  <h3 className="text-lg font-semibold mb-4 text-emerald-400">Competitive Analysis</h3>
  
  {/* Curve & Cost */}
  <div className="card p-4 mb-4">
    <h3 className="mb-2 text-sm font-medium">Curve (Inkable vs Uninkable)</h3>
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={curveData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="cost" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Bar dataKey="inkable" stackId="a" fill="#10b981" />
        <Bar dataKey="uninkable" stackId="a" fill="#f59e0b" />
      </BarChart>
    </ResponsiveContainer>
  </div>

  {/* Ink Colors */}
  <div className="card p-4 mb-4">
    <h3 className="mb-2 text-sm font-medium">Ink Colors</h3>
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={inkPieData} dataKey="value" nameKey="name" outerRadius={80} label />
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  </div>

  {/* Draw / Consistency */}
  <div className="card p-4 mb-4">
    <h3 className="mb-2 text-sm font-medium">Consistency</h3>
    <ul className="space-y-1 text-sm">
      <li><strong>Draw pieces:</strong> {drawConsistency.drawCount}</li>
      <li><strong>Search/Dig pieces:</strong> {drawConsistency.searchCount}</li>
      <li><strong>Card advantage density:</strong> {drawConsistency.density}% of deck</li>
    </ul>
    <p className="text-xs text-gray-400 mt-2">Heuristic: scans rules text for draw/search verbs.</p>
  </div>

  {/* Lore potential */}
  <div className="card p-4 mb-4">
    <h3 className="mb-2 text-sm font-medium">Lore Efficiency</h3>
    <div><strong>Avg Lore / Card:</strong> {avgLorePerCard}</div>
  </div>

  {/* Roles & Synergies */}
  <div className="card p-4 mb-4">
    <h3 className="mb-2 text-sm font-medium">Roles</h3>
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={roleData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="role" interval={0} angle={-10} textAnchor="end" height={60}/>
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="value" fill="#8b5cf6" />
      </BarChart>
    </ResponsiveContainer>

    {synergies.length > 0 ? (
      <div className="mt-3">
        <h4 className="font-medium mb-1 text-sm">Detected Synergies</h4>
        <ul className="list-disc ml-5 text-sm">{synergies.map(s=> <li key={s}>{s}</li>)}</ul>
      </div>
    ) : <p className="text-sm text-gray-400 mt-3">No obvious synergies detected.</p>}
  </div>

  {/* Meta Tools (stub) */}
  <div className="card p-4">
    <h3 className="mb-2 text-sm font-medium">Meta Tools</h3>
    <p className="text-sm text-gray-300 mb-2">
      Tag your deck against common archetypes and add matchup notes. (Hook this to your DB / PlayHub scrape later.)
    </p>
    <div className="grid md:grid-cols-2 gap-3">
      <div>
        <label className="block text-xs uppercase text-gray-400">Archetype tags</label>
        <input className="w-full bg-gray-800 rounded px-2 py-1 text-sm" placeholder="e.g., Amber/Amethyst Control, Ruby/Emerald Aggro" />
      </div>
      <div>
        <label className="block text-xs uppercase text-gray-400">Tech slots (notes)</label>
        <input className="w-full bg-gray-800 rounded px-2 py-1 text-sm" placeholder="e.g., +2 Banish; +1 Evasive hate" />
      </div>
    </div>
    <div className="mt-3">
      <label className="block text-xs uppercase text-gray-400">Matchup notes</label>
      <textarea rows={3} className="w-full bg-gray-800 rounded px-2 py-1 text-sm" placeholder="Vs. Amethyst/Sapphire: keep hand w/ draw + 2s; Songs overperform." />
    </div>
  </div>
</div>
```

---

## 🔧 **Technical Details**

### **Data Flow**
1. **Deck Changes** → `deck` state updates
2. **useMemo Dependencies** → Charts recalculate automatically
3. **Real-time Updates** → All analytics update as users modify deck

### **Performance Considerations**
- **Memoization**: Charts only rebuild when `deck` changes
- **Efficient Processing**: Single pass through cards for multiple metrics
- **Lazy Loading**: Charts render only when dashboard is visible

### **Integration Points**
- **Existing Layout**: Fits perfectly in your `lg:grid-cols-[1fr_380px]` grid
- **Styling Consistency**: Uses your existing `card p-4` classes
- **State Management**: Integrates with your existing `deck` reducer

---

## 📚 **Future Enhancements**

### **Phase 5: Advanced Features**
- [ ] **Tournament Data Integration**: Connect to PlayHub/Melee APIs
- [ ] **Meta Analysis**: Track local meta trends and suggest tech
- [ ] **Deck Comparison**: Side-by-side analysis of multiple decks
- [ ] **Export Analytics**: Generate detailed reports for tournament prep

### **Phase 6: Machine Learning**
- [ ] **Win Rate Prediction**: Based on deck composition
- [ ] **Optimal Mulligan**: Suggest best starting hands
- [ ] **Sideboard Optimization**: Recommend tech choices against specific matchups

---

## 🚨 **Important Notes**

### **Card Data Structure**
Your cards use a different structure than the original proposal:
- **Proposed**: `deck.cards` (array of card objects)
- **Your Structure**: `deck.entries` (object with `{card, count}` pairs)
- **Adaptation**: Use `Object.values(deck.entries).filter(e => e.count > 0).flatMap(e => Array(e.count).fill(e.card))`

### **Field Mapping**
Some card fields may need adjustment:
- **Ink Colors**: Check if `c.inks` exists, fallback to `c._raw?.inks`
- **Lore/Strength**: Use `c.lore` or `c._raw?.Lore`
- **Type Detection**: Leverage your existing `normalizedType()` function

---

## 📝 **Implementation Checklist**

- [ ] **Phase 1**: Add missing Recharts imports
- [ ] **Phase 2**: Implement heuristics and utilities
- [ ] **Phase 3**: Create memoized datasets
- [ ] **Phase 4**: Add dashboard UI components
- [ ] **Testing**: Verify with different deck sizes and compositions
- [ ] **Performance**: Ensure smooth updates with 60-card decks
- [ ] **Styling**: Match existing design system

---

## 🎯 **Success Criteria**

✅ **Functional Requirements**
- Real-time curve analysis with inkable/uninkable breakdown
- Accurate role detection based on card text
- Synergy detection for common Lorcana combos
- Responsive charts that update with deck changes

✅ **Performance Requirements**
- Charts update within 100ms of deck changes
- No performance impact on existing deck building
- Smooth scrolling and interaction

✅ **User Experience**
- Intuitive visual representation of deck composition
- Actionable insights for competitive play
- Consistent with existing UI patterns

---

*This document will be updated as implementation progresses. Each phase builds upon the previous one, ensuring a solid foundation for advanced competitive features.*
