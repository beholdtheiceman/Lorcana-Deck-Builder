# Deck Builder Rebuild — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Lorcana deck builder as a three-pane workbench at `/builder2` — one persistent filter rail, inline deck naming, autosave, and always-visible deck stats — with all existing logic extracted from `src/App.jsx` into tested modules.

**Architecture:** Two independent tracks. Track A extracts pure logic out of the 5,682-line `src/App.jsx` into `src/lib/` modules, each pinned by characterization tests written *before* the move. Track B builds new presentational components under `src/features/builder/` against the interfaces this plan defines. Track C wires them together into `BuilderPage`, adds the route behind a flag, and handles responsive behavior. A and B have no dependency on each other and run concurrently.

**Tech Stack:** React 18, Vite, React Router 7, Tailwind 3, Vitest 4 + jsdom + @testing-library/react. Card data from the Lorcast API via `src/lib/cardsApi.js`.

**Spec:** `docs/superpowers/specs/2026-08-22-deck-builder-rebuild-design.md`

---

## Ground rules for every task

- **Commit as `sportlarry@gmail.com`.** Verify with `git config user.email` before your first commit.
- **Never `git add -A`.** Always use explicit pathspecs. Parallel agents share one git index in this worktree.
- **Run `npx vitest run` before every commit.** The suite must stay green. It was 119 passing as of 2026-07-02; treat any pre-existing failure as a regression to report, not to fix silently.
- **Do not modify `src/App.jsx` in Track A or B.** Extraction means *copy out and test*, leaving the original in place. `App.jsx` is only touched in Track C, Task 14, and deleted at swap time.
- **This worktree is CRLF.** Do not reformat files or normalize line endings; the diff will look enormous and reviews become useless.
- **`node --check` cannot validate `.jsx`.** Use `npx vitest run` and `npm run build` instead.
- Tests live in `src/test/*.test.js`. Vitest runs with `globals: true`, `environment: 'jsdom'`, setup at `src/test/setup.js` — so `describe`/`it`/`expect` are global and no import is needed.

## Shared interfaces

Every task below depends on these shapes. They are the contract between Track A and Track B — do not change them without updating this section.

```js
// Deck (existing shape from createNewDeck, unchanged)
{
  id: string,            // "deck_<ts>_<rand>"
  name: string,
  entries: { [deckKey]: { card: Card, count: number } },
  total: number,
  createdAt: number,
  updatedAt: number,
}

// DeckStats — produced by src/lib/deck/stats.js
{
  total: number,                          // total cards
  curve: [ {cost: number, count: number} ],   // costs 1..7, cost 7 bucket is "7+"
  avgCost: number,                        // rounded to 1 decimal
  inkable: { inkable: number, uninkable: number, ratio: number },  // ratio 0..1
  byType: [ {type: string, count: number} ],  // sorted desc by count
  inkSplit: [ {ink: string, count: number} ], // ink name -> card count
}

// FilterState — produced by src/lib/filters/filterModel.js
{
  text: string,
  inks: Set<string>, rarities: Set<string>, types: Set<string>,
  sets: Set<string>, classifications: Set<string>, abilities: Set<string>,
  selectedCosts: Set<number>,
  inkable: 'any' | 'yes' | 'no',          // replaces showInkablesOnly/showUninkablesOnly
  sortBy: string, sortDir: 'asc' | 'desc',
  setNumber: string, franchise: string, gamemode: string,
  loreMin: string, loreMax: string,
  willpowerMin: string, willpowerMax: string,
  strengthMin: string, strengthMax: string,
}

// SaveStatus — produced by useAutosave
{ status: 'idle' | 'saving' | 'saved' | 'local-only' | 'sync-failed',
  lastSavedAt: number | null,
  retry: () => void }
```

---

# TRACK A — Logic extraction

Tasks 1–5 are mutually independent and may run fully in parallel.

## Task 1: Extract card normalization

**Files:**
- Create: `src/lib/cards/normalize.js`
- Test: `src/test/cardsNormalize.test.js`
- Source (read only, do not modify): `src/App.jsx` lines 163–276, 285–405, 442–516, 616–701

**Functions to move, verbatim:** `normalizedSetCode` (163), `getSetByNumber` (204), `getSetByCode` (209), `primaryInk` (217), `collectorParts` (222), `cardComparator` (230), `getSetCodeAndName` (263), `validateCardData` (285), `validateCardBatch` (327), `getPrimaryInk` (442), `getCardInks` (458), `matchesInkFilter` (469), `splitDisplayName` (616), `canon` (626), `hasSubtitleLike` (636), `toAppCard` (644).

Copy the bodies exactly. Strip `console.log` calls that only trace entry/exit; keep `console.warn`/`console.error`. Export every function named above.

- [ ] **Step 1: Write the failing test**

```js
// src/test/cardsNormalize.test.js
import { toAppCard, getPrimaryInk, getCardInks, matchesInkFilter, cardComparator, validateCardData } from '../lib/cards/normalize.js'

const raw = {
  id: 'crd_1', name: 'Cinderella - Ballroom Sensation',
  cost: 2, inks: ['Amethyst'], type: 'Character', rarity: 'Super Rare',
  inkwell: true, lore: 2, strength: 2, willpower: 2,
  set: { code: 'TFC', num: 1 }, collector_number: '42',
}

describe('toAppCard', () => {
  it('splits name and subtitle on the dash', () => {
    const c = toAppCard(raw)
    expect(c.name).toBe('Cinderella')
    expect(c.subtitle).toBe('Ballroom Sensation')
  })

  it('preserves the raw payload under _raw', () => {
    expect(toAppCard(raw)._raw).toEqual(raw)
  })
})

describe('getPrimaryInk', () => {
  it('returns the first ink', () => {
    expect(getPrimaryInk(toAppCard(raw))).toBe('Amethyst')
  })
})

describe('getCardInks', () => {
  it('returns every ink on a dual-ink card', () => {
    const dual = toAppCard({ ...raw, inks: ['Amber', 'Steel'] })
    expect(getCardInks(dual).sort()).toEqual(['Amber', 'Steel'])
  })
})

describe('matchesInkFilter', () => {
  it('passes when the filter set is empty', () => {
    expect(matchesInkFilter(toAppCard(raw), new Set())).toBe(true)
  })

  it('matches on any shared ink', () => {
    expect(matchesInkFilter(toAppCard(raw), new Set(['Amethyst']))).toBe(true)
    expect(matchesInkFilter(toAppCard(raw), new Set(['Ruby']))).toBe(false)
  })
})

describe('validateCardData', () => {
  it('accepts a well-formed card', () => {
    expect(validateCardData(raw)).toBeTruthy()
  })

  it('rejects null', () => {
    expect(validateCardData(null)).toBeFalsy()
  })
})

describe('cardComparator', () => {
  it('is a total order over a card list', () => {
    const cards = [
      toAppCard({ ...raw, name: 'Zeus - God', cost: 5 }),
      toAppCard({ ...raw, name: 'Anna - Heir', cost: 1 }),
      toAppCard(raw),
    ]
    const sorted = [...cards].sort(cardComparator)
    expect(sorted).toHaveLength(3)
    expect([...cards].sort(cardComparator)).toEqual(sorted)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/cardsNormalize.test.js`
Expected: FAIL — `Failed to resolve import "../lib/cards/normalize.js"`

- [ ] **Step 3: Create the module**

Create `src/lib/cards/normalize.js`. Copy each function listed above out of `src/App.jsx` at the given line numbers, verbatim. Add `export` to each. The module's only imports should be what those functions already reference — check the top of `App.jsx` for `SETS`, `CARD_TYPES`, and any constants they use, and import those from their existing homes (`./cardUtils.js` is at `src/lib/cardUtils.js`, so from `src/lib/cards/normalize.js` the path is `../cardUtils.js`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/cardsNormalize.test.js`
Expected: PASS, 8 tests

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: all previously-passing tests still pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/cards/normalize.js src/test/cardsNormalize.test.js
git commit -m "refactor(cards): extract card normalization from App.jsx"
```

---

## Task 2: Extract card image URL helpers

**Files:**
- Create: `src/lib/cards/imageUrl.js`
- Test: `src/test/cardsImageUrl.test.js`
- Source (read only): `src/App.jsx` lines 526–541 (`encodeImageURL`), 702–711 (`asUrl`), 712–835 (`lorcanaImageProxyUrl`)

- [ ] **Step 1: Write the failing test**

```js
// src/test/cardsImageUrl.test.js
import { asUrl, encodeImageURL, lorcanaImageProxyUrl } from '../lib/cards/imageUrl.js'

describe('asUrl', () => {
  it('returns a string url unchanged', () => {
    expect(asUrl('https://example.com/a.png')).toBe('https://example.com/a.png')
  })

  it('returns empty string for null', () => {
    expect(asUrl(null)).toBe('')
  })
})

describe('encodeImageURL', () => {
  it('encodes spaces in the path', () => {
    expect(encodeImageURL('https://x.com/a b.png')).toContain('%20')
  })

  it('is idempotent on an already-encoded url', () => {
    const once = encodeImageURL('https://x.com/a b.png')
    expect(encodeImageURL(once)).toBe(once)
  })
})

describe('lorcanaImageProxyUrl', () => {
  it('returns a non-empty string for a valid source', () => {
    const out = lorcanaImageProxyUrl('https://cards.lorcast.io/card/digital/small/crd_1.avif')
    expect(typeof out).toBe('string')
    expect(out.length).toBeGreaterThan(0)
  })

  it('does not throw on empty input', () => {
    expect(() => lorcanaImageProxyUrl('')).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/cardsImageUrl.test.js`
Expected: FAIL — unresolved import

- [ ] **Step 3: Create the module**

Create `src/lib/cards/imageUrl.js` with the three functions copied verbatim from the line ranges above, each exported.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/cardsImageUrl.test.js`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/cards/imageUrl.js src/test/cardsImageUrl.test.js
git commit -m "refactor(cards): extract image url helpers from App.jsx"
```

---

## Task 3: Extract deck reducer and storage

**Files:**
- Create: `src/lib/deck/deckReducer.js`, `src/lib/deck/storage.js`
- Test: `src/test/deckReducerExtract.test.js`
- Source (read only): `src/App.jsx` lines 828–938 (`DECK_RULES`, `generateDeckId`, `createNewDeck`, `loadAllDecks`, `saveAllDecks`, `saveCurrentDeckId`, `getDeckById`, `updateDeckMetadata`, `deleteDeck`, `duplicateDeck`), 1575–1660 (`initialDeckState`, `deckReducer`), 3380–3383 (`getDeckPayload`)

`storage.js` gets the 828–938 range. `deckReducer.js` gets the reducer, `initialDeckState`, and `getDeckPayload`, importing `createNewDeck` and `loadAllDecks` from `./storage.js`, `deckKey` from `../cardUtils.js`, and `clamp` (App.jsx line 277 — copy it into `deckReducer.js` as a local helper, it is one line).

Strip the `console.log` tracing from `SWITCH_DECK` and `initialDeckState`. Keep all behavior identical, including the delete-on-zero semantics in `ADD`, `SET_COUNT`, and `REMOVE`.

- [ ] **Step 1: Write the failing test**

```js
// src/test/deckReducerExtract.test.js
import { deckReducer } from '../lib/deck/deckReducer.js'
import { createNewDeck, generateDeckId, duplicateDeck } from '../lib/deck/storage.js'

const card = { id: 'crd_1', name: 'Cinderella', subtitle: 'Ballroom Sensation', cost: 2, setCode: 'TFC', number: '42' }
const other = { id: 'crd_2', name: 'Mulan', subtitle: 'Imperial Soldier', cost: 3, setCode: 'TFC', number: '43' }

describe('deckReducer ADD', () => {
  it('adds a card and tracks the total', () => {
    const s = deckReducer(createNewDeck('T'), { type: 'ADD', card, count: 2 })
    expect(s.total).toBe(2)
  })

  it('caps copies at 4', () => {
    let s = createNewDeck('T')
    s = deckReducer(s, { type: 'ADD', card, count: 9 })
    expect(s.total).toBe(4)
  })

  it('removes the entry when decremented to zero rather than leaving a ghost', () => {
    let s = deckReducer(createNewDeck('T'), { type: 'ADD', card, count: 1 })
    s = deckReducer(s, { type: 'ADD', card, count: -1 })
    expect(Object.keys(s.entries)).toHaveLength(0)
    expect(s.total).toBe(0)
  })
})

describe('deckReducer SET_COUNT', () => {
  it('drops the entry at count 0', () => {
    let s = deckReducer(createNewDeck('T'), { type: 'ADD', card, count: 3 })
    s = deckReducer(s, { type: 'SET_COUNT', card, count: 0 })
    expect(Object.keys(s.entries)).toHaveLength(0)
  })

  it('clamps above 4', () => {
    let s = deckReducer(createNewDeck('T'), { type: 'SET_COUNT', card, count: 10 })
    expect(s.total).toBe(4)
  })
})

describe('deckReducer REMOVE', () => {
  it('removes only the named card', () => {
    let s = createNewDeck('T')
    s = deckReducer(s, { type: 'ADD', card, count: 2 })
    s = deckReducer(s, { type: 'ADD', card: other, count: 3 })
    s = deckReducer(s, { type: 'REMOVE', card })
    expect(s.total).toBe(3)
  })
})

describe('deckReducer SET_NAME', () => {
  it('sets the name', () => {
    expect(deckReducer(createNewDeck('T'), { type: 'SET_NAME', name: 'Ruby Aggro' }).name).toBe('Ruby Aggro')
  })

  it('falls back to Untitled Deck on empty', () => {
    expect(deckReducer(createNewDeck('T'), { type: 'SET_NAME', name: '' }).name).toBe('Untitled Deck')
  })
})

describe('storage', () => {
  it('generates unique deck ids', () => {
    expect(generateDeckId()).not.toBe(generateDeckId())
  })

  it('duplicates a deck under a new id', () => {
    const base = createNewDeck('Original')
    const decks = { [base.id]: base }
    const { decks: after } = duplicateDeck(decks, base.id, 'Copy')
    const ids = Object.keys(after)
    expect(ids).toHaveLength(2)
  })
})
```

Note: `duplicateDeck`'s exact return shape is defined by the existing implementation at `src/App.jsx:921`. Read it before writing the last test and adjust the destructuring to match what it actually returns — do not change the implementation to fit the test.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/deckReducerExtract.test.js`
Expected: FAIL — unresolved imports

- [ ] **Step 3: Create both modules**

As described above.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/deckReducerExtract.test.js`
Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`

- [ ] **Step 6: Commit**

```bash
git add src/lib/deck/deckReducer.js src/lib/deck/storage.js src/test/deckReducerExtract.test.js
git commit -m "refactor(deck): extract deck reducer and storage from App.jsx"
```

---

## Task 4: Create deck stats module

**Files:**
- Create: `src/lib/deck/stats.js`
- Test: `src/test/deckStats.test.js`

This is new code, not an extraction. The current stats are computed inline inside `DeckStats.jsx` and `AppInner`; this module is the single pure source. Produce exactly the `DeckStats` shape from the Shared Interfaces section.

- [ ] **Step 1: Write the failing test**

```js
// src/test/deckStats.test.js
import { computeDeckStats } from '../lib/deck/stats.js'

const mk = (id, cost, inks, type, inkable) => ({
  id, name: id, cost, inks, type, inkable,
})

const deck = {
  entries: {
    a: { card: mk('a', 1, ['Ruby'], 'Character', true), count: 4 },
    b: { card: mk('b', 3, ['Amethyst'], 'Character', true), count: 4 },
    c: { card: mk('c', 9, ['Ruby'], 'Action', false), count: 2 },
  },
  total: 10,
}

describe('computeDeckStats', () => {
  it('totals the cards', () => {
    expect(computeDeckStats(deck).total).toBe(10)
  })

  it('buckets cost 7 and above into the 7+ bucket', () => {
    const curve = computeDeckStats(deck).curve
    expect(curve.find((b) => b.cost === 7).count).toBe(2)
    expect(curve.find((b) => b.cost === 1).count).toBe(4)
    expect(curve.find((b) => b.cost === 3).count).toBe(4)
  })

  it('always returns buckets 1 through 7', () => {
    expect(computeDeckStats(deck).curve.map((b) => b.cost)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('computes average cost to one decimal', () => {
    expect(computeDeckStats(deck).avgCost).toBe(3.4)
  })

  it('counts inkable and uninkable', () => {
    const ink = computeDeckStats(deck).inkable
    expect(ink.inkable).toBe(8)
    expect(ink.uninkable).toBe(2)
    expect(ink.ratio).toBeCloseTo(0.8, 5)
  })

  it('groups by type descending', () => {
    expect(computeDeckStats(deck).byType).toEqual([
      { type: 'Character', count: 8 },
      { type: 'Action', count: 2 },
    ])
  })

  it('counts ink split', () => {
    const split = computeDeckStats(deck).inkSplit
    expect(split.find((s) => s.ink === 'Ruby').count).toBe(6)
    expect(split.find((s) => s.ink === 'Amethyst').count).toBe(4)
  })

  it('returns zeroed stats for an empty deck', () => {
    const s = computeDeckStats({ entries: {}, total: 0 })
    expect(s.total).toBe(0)
    expect(s.avgCost).toBe(0)
    expect(s.inkable.ratio).toBe(0)
    expect(s.curve).toHaveLength(7)
  })

  it('does not throw on a null deck', () => {
    expect(() => computeDeckStats(null)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/deckStats.test.js`
Expected: FAIL — unresolved import

- [ ] **Step 3: Write the implementation**

```js
// src/lib/deck/stats.js
const EMPTY = {
  total: 0,
  curve: [1, 2, 3, 4, 5, 6, 7].map((cost) => ({ cost, count: 0 })),
  avgCost: 0,
  inkable: { inkable: 0, uninkable: 0, ratio: 0 },
  byType: [],
  inkSplit: [],
}

function isInkable(card) {
  if (typeof card?.inkable === 'boolean') return card.inkable
  if (typeof card?._raw?.inkable === 'boolean') return card._raw.inkable
  if (typeof card?._raw?.inkwell === 'boolean') return card._raw.inkwell
  return false
}

export function computeDeckStats(deck) {
  const entries = Object.values(deck?.entries || {}).filter((e) => e?.card && e.count > 0)
  if (!entries.length) return EMPTY

  const curveMap = new Map([1, 2, 3, 4, 5, 6, 7].map((c) => [c, 0]))
  const typeMap = new Map()
  const inkMap = new Map()
  let total = 0
  let costSum = 0
  let inkableCount = 0

  for (const { card, count } of entries) {
    total += count
    const cost = Number(card.cost) || 0
    costSum += cost * count
    const bucket = cost >= 7 ? 7 : Math.max(1, cost)
    curveMap.set(bucket, curveMap.get(bucket) + count)

    const type = card.type || 'Unknown'
    typeMap.set(type, (typeMap.get(type) || 0) + count)

    for (const ink of card.inks || []) {
      inkMap.set(ink, (inkMap.get(ink) || 0) + count)
    }

    if (isInkable(card)) inkableCount += count
  }

  return {
    total,
    curve: [...curveMap.entries()].map(([cost, count]) => ({ cost, count })),
    avgCost: Math.round((costSum / total) * 10) / 10,
    inkable: {
      inkable: inkableCount,
      uninkable: total - inkableCount,
      ratio: inkableCount / total,
    },
    byType: [...typeMap.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    inkSplit: [...inkMap.entries()]
      .map(([ink, count]) => ({ ink, count }))
      .sort((a, b) => b.count - a.count),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/deckStats.test.js`
Expected: PASS, 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/deck/stats.js src/test/deckStats.test.js
git commit -m "feat(deck): add pure deck stats module"
```

---

## Task 5: Extract import parsers

**Files:**
- Create: `src/lib/import/textImport.js`, `src/lib/import/csvImport.js`
- Test: `src/test/importExtract.test.js`
- Source (read only): `src/App.jsx` lines 939–983 (`importDeck`), 984–1037 (`findCardByLorcanitoFormat`), 1038–1328 (`parseTextImport`), 1329–1441 (`matchCard`), 1442–1554 (`findCardByName`), 1555–1574 (`parseCSVImport`)

`textImport.js` gets everything except `parseCSVImport`. This is the most fragile logic in the codebase — it encodes real edge cases from live user pastes. **Copy it verbatim. Do not "clean it up," do not change a regex, do not reorder the fallback chain.** Strip only pure-tracing `console.log` lines.

There is an existing test at `src/test/deckTextParse.test.js`. Read it first — it already pins some of this behavior and must keep passing against the extracted module.

- [ ] **Step 1: Write the failing test**

```js
// src/test/importExtract.test.js
import { parseTextImport, matchCard, findCardByName } from '../lib/import/textImport.js'
import { parseCSVImport } from '../lib/import/csvImport.js'

const db = [
  { id: 'crd_1', name: 'Cinderella', subtitle: 'Ballroom Sensation', cost: 2, setCode: 'TFC', number: '42', inks: ['Amethyst'], type: 'Character' },
  { id: 'crd_2', name: 'Mulan', subtitle: 'Imperial Soldier', cost: 3, setCode: 'TFC', number: '43', inks: ['Ruby'], type: 'Character' },
]

describe('parseTextImport', () => {
  it('parses "4 Name - Subtitle" lines', () => {
    const out = parseTextImport('4 Cinderella - Ballroom Sensation\n3 Mulan - Imperial Soldier', db)
    expect(out).toBeTruthy()
  })

  it('does not throw on empty input', () => {
    expect(() => parseTextImport('', db)).not.toThrow()
  })

  it('does not throw on garbage input', () => {
    expect(() => parseTextImport('!!!! nonsense ????', db)).not.toThrow()
  })
})

describe('findCardByName', () => {
  it('finds an exact name plus subtitle match', () => {
    expect(findCardByName('4 Cinderella - Ballroom Sensation', db)).toBeTruthy()
  })

  it('returns falsy for an unknown card', () => {
    expect(findCardByName('4 Nonexistent Card - Nowhere', db)).toBeFalsy()
  })
})

describe('parseCSVImport', () => {
  it('does not throw on an empty string', () => {
    expect(() => parseCSVImport('')).not.toThrow()
  })
})
```

The precise return shape of `parseTextImport` and `findCardByName` is whatever the current implementation returns. Read `src/App.jsx:1038` and `src/App.jsx:1442` first and tighten these assertions to match actual behavior — the goal is to pin what exists, not to invent a contract.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/importExtract.test.js`
Expected: FAIL — unresolved imports

- [ ] **Step 3: Create both modules**

Verbatim copies as described.

- [ ] **Step 4: Run both the new and the existing parse tests**

Run: `npx vitest run src/test/importExtract.test.js src/test/deckTextParse.test.js`
Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`

- [ ] **Step 6: Commit**

```bash
git add src/lib/import/textImport.js src/lib/import/csvImport.js src/test/importExtract.test.js
git commit -m "refactor(import): extract text and csv import parsers from App.jsx"
```

---

## Task 6: Extract filter model, with the inkable tri-state change

**Files:**
- Create: `src/lib/filters/filterModel.js`
- Test: `src/test/filterModel.test.js`
- Source (read only): `src/App.jsx` lines 1667–1759 (`initialFilterState`, `serializeFilterState`, `hydrateFilterState`), 1760–1929 (`filterReducer`), 5022–5509 (`applyFilters`)

`applyFilters` at line 5022 is already a pure top-level function — copy it verbatim, minus the `console.log` tracing (there is a lot of it, including a per-card log in the franchise filter that is a real performance problem).

**The one intentional behavior change in this whole track:** replace `showInkablesOnly` and `showUninkablesOnly` with a single `inkable: 'any' | 'yes' | 'no'` field, and delete `_resetTimestamp` and `showFilterPanel` entirely — the new rail is always mounted and always visible, so neither the remount hack nor the panel-open flag has a purpose. Update `applyFilters`, `initialFilterState`, `serializeFilterState`, `hydrateFilterState`, and the reducer accordingly. `hydrateFilterState` must migrate old persisted state: `showUninkablesOnly === true` → `'no'`, else `showInkablesOnly === true` → `'yes'`, else `'any'`.

Add a `SET_INKABLE` action and remove `SET_SHOW_INKABLES` / `SET_SHOW_UNINKABLES` / `TOGGLE_PANEL`.

- [ ] **Step 1: Write the failing test**

```js
// src/test/filterModel.test.js
import {
  initialFilterState, filterReducer, applyFilters,
  serializeFilterState, hydrateFilterState, countActiveFilters,
} from '../lib/filters/filterModel.js'

const cards = [
  { id: '1', name: 'Cinderella', cost: 2, inks: ['Amethyst'], type: 'Character', rarity: 'Rare', inkable: true, setNum: 1 },
  { id: '2', name: 'Mulan', cost: 3, inks: ['Ruby'], type: 'Character', rarity: 'Common', inkable: false, setNum: 9 },
  { id: '3', name: 'Be Prepared', cost: 7, inks: ['Ruby'], type: 'Action', rarity: 'Rare', inkable: true, setNum: 9 },
]

const base = () => ({ ...initialFilterState(), inks: new Set(), selectedCosts: new Set(), types: new Set(), rarities: new Set(), sets: new Set(), classifications: new Set(), abilities: new Set() })

describe('applyFilters', () => {
  it('returns everything with a default filter state', () => {
    expect(applyFilters(cards, base())).toHaveLength(3)
  })

  it('filters by ink', () => {
    const out = applyFilters(cards, { ...base(), inks: new Set(['Ruby']) })
    expect(out.map((c) => c.id).sort()).toEqual(['2', '3'])
  })

  it('filters by cost', () => {
    expect(applyFilters(cards, { ...base(), selectedCosts: new Set([2]) })).toHaveLength(1)
  })

  it('filters by type', () => {
    expect(applyFilters(cards, { ...base(), types: new Set(['Action']) })).toHaveLength(1)
  })

  it('filters by text on name', () => {
    expect(applyFilters(cards, { ...base(), text: 'mulan' })).toHaveLength(1)
  })

  it('returns everything when inkable is any', () => {
    expect(applyFilters(cards, { ...base(), inkable: 'any' })).toHaveLength(3)
  })

  it('returns only inkable cards when inkable is yes', () => {
    expect(applyFilters(cards, { ...base(), inkable: 'yes' }).map((c) => c.id).sort()).toEqual(['1', '3'])
  })

  it('returns only uninkable cards when inkable is no', () => {
    expect(applyFilters(cards, { ...base(), inkable: 'no' }).map((c) => c.id)).toEqual(['2'])
  })

  it('does not mutate the input array', () => {
    const input = [...cards]
    applyFilters(input, { ...base(), inks: new Set(['Ruby']) })
    expect(input).toHaveLength(3)
  })

  it('returns all cards when the filter object is missing', () => {
    expect(applyFilters(cards, null)).toHaveLength(3)
  })
})

describe('filterReducer', () => {
  it('toggles an ink on and off', () => {
    let s = filterReducer(base(), { type: 'TOGGLE_INK', ink: 'Ruby' })
    expect(s.inks.has('Ruby')).toBe(true)
    s = filterReducer(s, { type: 'TOGGLE_INK', ink: 'Ruby' })
    expect(s.inks.has('Ruby')).toBe(false)
  })

  it('sets the inkable tri-state', () => {
    expect(filterReducer(base(), { type: 'SET_INKABLE', value: 'no' }).inkable).toBe('no')
  })

  it('resets to defaults', () => {
    let s = filterReducer(base(), { type: 'TOGGLE_INK', ink: 'Ruby' })
    s = filterReducer(s, { type: 'RESET' })
    expect(s.inks.size).toBe(0)
    expect(s.inkable).toBe('any')
  })
})

describe('countActiveFilters', () => {
  it('is zero for a default state', () => {
    expect(countActiveFilters(base())).toBe(0)
  })

  it('counts each active dimension once', () => {
    const s = { ...base(), inks: new Set(['Ruby', 'Amber']), selectedCosts: new Set([2]), inkable: 'yes' }
    expect(countActiveFilters(s)).toBe(3)
  })
})

describe('state persistence round trip', () => {
  it('survives serialize then hydrate', () => {
    const s = { ...base(), inks: new Set(['Ruby']), inkable: 'no', text: 'x' }
    const back = hydrateFilterState(JSON.parse(JSON.stringify(serializeFilterState(s))))
    expect(back.inks instanceof Set).toBe(true)
    expect(back.inks.has('Ruby')).toBe(true)
    expect(back.inkable).toBe('no')
    expect(back.text).toBe('x')
  })

  it('migrates legacy showUninkablesOnly to inkable no', () => {
    expect(hydrateFilterState({ showUninkablesOnly: true }).inkable).toBe('no')
  })

  it('migrates legacy showInkablesOnly to inkable yes', () => {
    expect(hydrateFilterState({ showInkablesOnly: true }).inkable).toBe('yes')
  })

  it('defaults legacy state with neither flag to any', () => {
    expect(hydrateFilterState({}).inkable).toBe('any')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/filterModel.test.js`
Expected: FAIL — unresolved import

- [ ] **Step 3: Create the module**

Include a new exported `countActiveFilters(state)` that returns the number of active filter *dimensions* (not values): text, inks, rarities, types, sets, classifications, abilities, selectedCosts, inkable !== 'any', setNumber, franchise, gamemode, and each of the six min/max stat fields as one dimension per pair.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/filterModel.test.js`
Expected: PASS, 20 tests

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`

- [ ] **Step 6: Commit**

```bash
git add src/lib/filters/filterModel.js src/test/filterModel.test.js
git commit -m "refactor(filters): extract filter model, collapse inkable flags to tri-state"
```

---

# TRACK B — Components

Tasks 7–10 are mutually independent and may run in parallel with Track A. They depend only on the Shared Interfaces above, not on Track A's files existing yet — build against the documented shapes.

**Styling rules for every Track B task:**
- Use `src/tokens.css` variables for all colors: `var(--canvas)`, `var(--text)`, `var(--muted)`, `var(--line)`, and the ink vars `var(--amber)`, `var(--amethyst)`, `var(--emerald)`, `var(--ruby)`, `var(--sapphire)`, `var(--steel)`.
- **Never** use raw Tailwind palette classes (`violet-500`, `emerald-600`, `gray-950`, `white/10`). Removing these is a stated goal of the rebuild.
- Reuse existing primitives from `src/components/ui/`: `Button`, `Input`, `Pill`, `Panel`, `CostHex`, `HexGlyph`, `InkCurve`, `InkSplitBar`. Read `src/components/ui/index.js` for the exports before writing new markup.
- No emoji anywhere in the UI.
- Every interactive element needs an accessible name. Icon-only buttons need `aria-label`. Toggles need `aria-pressed`.

## Task 7: FilterRail

**Files:**
- Create: `src/features/builder/FilterRail.jsx`, `src/features/builder/filters/InkFilter.jsx`, `src/features/builder/filters/CostFilter.jsx`, `src/features/builder/filters/TypeFilter.jsx`, `src/features/builder/filters/MoreFilters.jsx`
- Test: `src/test/filterRail.test.jsx`

**Props contract:**

```js
FilterRail({ filters, onChange, activeCount, onClear })
// filters: FilterState (see Shared Interfaces)
// onChange: (action) => void   — dispatches filterReducer actions
// activeCount: number          — from countActiveFilters
// onClear: () => void          — dispatches { type: 'RESET' }
```

Each child receives the slice it needs plus `onChange`. `InkFilter` renders six hex toggles using `clipPath: 'var(--hex)'` and the ink color vars, at full opacity when active and `0.28` when not, each with `aria-pressed` and `aria-label` set to the ink name. `CostFilter` renders buttons 1–10. `TypeFilter` renders Character / Action / Item / Location / Song pills. `MoreFilters` is a `<details>` disclosure containing rarity, set, keywords, and franchise controls.

The rail header shows "Filters" and, when `activeCount > 0`, a "Clear {activeCount}" button.

- [ ] **Step 1: Write the failing test**

```jsx
// src/test/filterRail.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FilterRail from '../features/builder/FilterRail.jsx'

const baseFilters = {
  text: '', inks: new Set(), rarities: new Set(), types: new Set(),
  sets: new Set(), classifications: new Set(), abilities: new Set(),
  selectedCosts: new Set(), inkable: 'any',
  sortBy: 'ink-set-number', sortDir: 'asc',
  setNumber: '', franchise: '', gamemode: '',
  loreMin: '', loreMax: '', willpowerMin: '', willpowerMax: '', strengthMin: '', strengthMax: '',
}

const setup = (overrides = {}) => {
  const onChange = vi.fn()
  const onClear = vi.fn()
  render(
    <FilterRail
      filters={{ ...baseFilters, ...overrides.filters }}
      onChange={onChange}
      activeCount={overrides.activeCount ?? 0}
      onClear={onClear}
    />
  )
  return { onChange, onClear }
}

describe('FilterRail', () => {
  it('renders all six ink toggles with accessible names', () => {
    setup()
    for (const ink of ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel']) {
      expect(screen.getByRole('button', { name: ink })).toBeInTheDocument()
    }
  })

  it('dispatches TOGGLE_INK when an ink is clicked', async () => {
    const { onChange } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Ruby' }))
    expect(onChange).toHaveBeenCalledWith({ type: 'TOGGLE_INK', ink: 'Ruby' })
  })

  it('marks an active ink as pressed', () => {
    setup({ filters: { inks: new Set(['Ruby']) } })
    expect(screen.getByRole('button', { name: 'Ruby' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Amber' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('dispatches TOGGLE_COST when a cost is clicked', async () => {
    const { onChange } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Cost 3' }))
    expect(onChange).toHaveBeenCalledWith({ type: 'TOGGLE_COST', cost: 3 })
  })

  it('dispatches SET_INKABLE from the tri-state control', async () => {
    const { onChange } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Inkable only' }))
    expect(onChange).toHaveBeenCalledWith({ type: 'SET_INKABLE', value: 'yes' })
  })

  it('hides the clear control when nothing is active', () => {
    setup({ activeCount: 0 })
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument()
  })

  it('shows the active count and calls onClear', async () => {
    const { onClear } = setup({ activeCount: 3 })
    const clear = screen.getByRole('button', { name: /clear 3/i })
    await userEvent.click(clear)
    expect(onClear).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/filterRail.test.jsx`
Expected: FAIL — unresolved import

- [ ] **Step 3: Build the components**

Per the props contract above. Keep `FilterRail.jsx` under 150 lines by pushing each control group into its child file.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/filterRail.test.jsx`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/features/builder/FilterRail.jsx src/features/builder/filters src/test/filterRail.test.jsx
git commit -m "feat(builder): add FilterRail with single-surface filter controls"
```

---

## Task 8: CardResults

**Files:**
- Create: `src/features/builder/CardResults.jsx`, `src/features/builder/results/SearchBar.jsx`, `src/features/builder/results/ResultSummary.jsx`, `src/features/builder/results/CardTile.jsx`
- Test: `src/test/cardResults.test.jsx`

**Props contract:**

```js
CardResults({ cards, deck, filters, loading, error, onSearch, onAdd, onInspect, onRetry })
// cards: Card[]        — already filtered
// deck: Deck           — used to show per-card counts
// filters: FilterState — used by ResultSummary to describe the active filter
// onAdd: (card) => void
// onInspect: (card) => void
```

`ResultSummary` renders "{n} cards" plus a human description of active filters, e.g. `142 cards · Amethyst, Ruby · cost 2–3`. `CardTile` shows the card image, name, subtitle, a cost badge, and — when the card is in the deck — a count badge and an ink-colored border. Clicking the tile adds; a separate inspect control opens the detail view.

Empty and error states live here: zero results renders a message naming the filters to clear; `error` renders a retry control.

- [ ] **Step 1: Write the failing test**

```jsx
// src/test/cardResults.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CardResults from '../features/builder/CardResults.jsx'

const cards = [
  { id: '1', name: 'Cinderella', subtitle: 'Ballroom Sensation', cost: 2, inks: ['Amethyst'], type: 'Character' },
  { id: '2', name: 'Mulan', subtitle: 'Imperial Soldier', cost: 3, inks: ['Ruby'], type: 'Character' },
]
const emptyFilters = {
  text: '', inks: new Set(), selectedCosts: new Set(), types: new Set(),
  rarities: new Set(), sets: new Set(), classifications: new Set(), abilities: new Set(),
  inkable: 'any', setNumber: '', franchise: '', gamemode: '',
}
const emptyDeck = { entries: {}, total: 0 }

const setup = (props = {}) => {
  const onAdd = vi.fn()
  const onRetry = vi.fn()
  const onSearch = vi.fn()
  render(
    <CardResults
      cards={cards} deck={emptyDeck} filters={emptyFilters}
      loading={false} error={null}
      onAdd={onAdd} onInspect={vi.fn()} onRetry={onRetry} onSearch={onSearch}
      {...props}
    />
  )
  return { onAdd, onRetry, onSearch }
}

describe('CardResults', () => {
  it('renders a tile per card', () => {
    setup()
    expect(screen.getByText('Cinderella')).toBeInTheDocument()
    expect(screen.getByText('Mulan')).toBeInTheDocument()
  })

  it('reports the result count', () => {
    setup()
    expect(screen.getByText(/2 cards/i)).toBeInTheDocument()
  })

  it('describes active filters in the summary', () => {
    setup({ filters: { ...emptyFilters, inks: new Set(['Ruby']) } })
    expect(screen.getByText(/Ruby/)).toBeInTheDocument()
  })

  it('calls onAdd when a tile is clicked', async () => {
    const { onAdd } = setup()
    await userEvent.click(screen.getByRole('button', { name: /add Cinderella/i }))
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }))
  })

  it('shows a count badge for a card already in the deck', () => {
    setup({ deck: { entries: { k: { card: cards[0], count: 3 } }, total: 3 } })
    expect(screen.getByLabelText(/Cinderella.*3 in deck/i)).toBeInTheDocument()
  })

  it('renders an empty state with no results', () => {
    setup({ cards: [] })
    expect(screen.getByText(/no cards match/i)).toBeInTheDocument()
  })

  it('renders an error state with a retry control', async () => {
    const { onRetry } = setup({ error: new Error('network down'), cards: [] })
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('calls onSearch as the user types', async () => {
    const { onSearch } = setup()
    await userEvent.type(screen.getByRole('searchbox'), 'mul')
    expect(onSearch).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/cardResults.test.jsx`
Expected: FAIL — unresolved import

- [ ] **Step 3: Build the components**

Card images come from `src/lib/cards/imageUrl.js` (Task 2). If Track A has not landed yet, import it anyway — the test does not assert on images, and the import resolves once Task 2 commits. Coordinate with the reviewer if the build breaks.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/cardResults.test.jsx`
Expected: PASS, 8 tests

- [ ] **Step 5: Commit**

```bash
git add src/features/builder/CardResults.jsx src/features/builder/results src/test/cardResults.test.jsx
git commit -m "feat(builder): add CardResults grid with summary, empty and error states"
```

---

## Task 9: DeckPanel with inline naming

**Files:**
- Create: `src/features/builder/DeckPanel.jsx`, `src/features/builder/deck/DeckTitle.jsx`, `src/features/builder/deck/SaveStatus.jsx`, `src/features/builder/deck/DeckList.jsx`, `src/features/builder/deck/DeckRow.jsx`, `src/features/builder/deck/DeckStatsPanel.jsx`
- Test: `src/test/deckPanel.test.jsx`

**Props contract:**

```js
DeckPanel({ deck, stats, saveStatus, onRename, onSetCount, onRemove })
// stats: DeckStats (see Shared Interfaces)
// saveStatus: SaveStatus
// onRename: (name: string) => void
```

`DeckTitle` is the centerpiece fix. It renders the deck name as a button that becomes a text input on click. Commit on blur and on Enter. Cancel on Escape, restoring the previous name. An empty or whitespace-only value commits as `Untitled Deck` — capital D, matching the fallback already baked into `deckReducer`'s `SET_NAME` case, so the product only ever shows one default deck name.

`DeckList` groups entries by card type with a count per group. `DeckRow` shows count, name, an ink marker, and controls to change count and remove. `DeckStatsPanel` renders the curve, average cost, and inkable ratio from `stats` — always visible, never behind a toggle.

- [ ] **Step 1: Write the failing test**

```jsx
// src/test/deckPanel.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DeckPanel from '../features/builder/DeckPanel.jsx'

const card = { id: '1', name: 'Cinderella', subtitle: 'Ballroom Sensation', cost: 2, inks: ['Amethyst'], type: 'Character' }
const deck = { id: 'd1', name: 'Ruby Aggro', entries: { k: { card, count: 4 } }, total: 4 }
const stats = {
  total: 4,
  curve: [1, 2, 3, 4, 5, 6, 7].map((cost) => ({ cost, count: cost === 2 ? 4 : 0 })),
  avgCost: 2,
  inkable: { inkable: 4, uninkable: 0, ratio: 1 },
  byType: [{ type: 'Character', count: 4 }],
  inkSplit: [{ ink: 'Amethyst', count: 4 }],
}
const saved = { status: 'saved', lastSavedAt: Date.now(), retry: () => {} }

const setup = (props = {}) => {
  const onRename = vi.fn()
  const onSetCount = vi.fn()
  const onRemove = vi.fn()
  render(
    <DeckPanel deck={deck} stats={stats} saveStatus={saved}
      onRename={onRename} onSetCount={onSetCount} onRemove={onRemove} {...props} />
  )
  return { onRename, onSetCount, onRemove }
}

describe('DeckTitle', () => {
  it('shows the deck name without any interaction', () => {
    setup()
    expect(screen.getByText('Ruby Aggro')).toBeInTheDocument()
  })

  it('becomes an editable input on click', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /rename deck/i }))
    expect(screen.getByRole('textbox')).toHaveValue('Ruby Aggro')
  })

  it('commits the new name on Enter', async () => {
    const { onRename } = setup()
    await userEvent.click(screen.getByRole('button', { name: /rename deck/i }))
    const input = screen.getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, 'Amethyst Control{Enter}')
    expect(onRename).toHaveBeenCalledWith('Amethyst Control')
  })

  it('commits on blur', async () => {
    const { onRename } = setup()
    await userEvent.click(screen.getByRole('button', { name: /rename deck/i }))
    const input = screen.getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, 'Steel Ramp')
    await userEvent.tab()
    expect(onRename).toHaveBeenCalledWith('Steel Ramp')
  })

  it('cancels on Escape without renaming', async () => {
    const { onRename } = setup()
    await userEvent.click(screen.getByRole('button', { name: /rename deck/i }))
    const input = screen.getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, 'Discarded{Escape}')
    expect(onRename).not.toHaveBeenCalled()
    expect(screen.getByText('Ruby Aggro')).toBeInTheDocument()
  })

  it('falls back to Untitled Deck on an empty name', async () => {
    const { onRename } = setup()
    await userEvent.click(screen.getByRole('button', { name: /rename deck/i }))
    const input = screen.getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, '   {Enter}')
    expect(onRename).toHaveBeenCalledWith('Untitled Deck')
  })
})

describe('SaveStatus', () => {
  it('reports saved', () => {
    setup()
    expect(screen.getByText(/saved/i)).toBeInTheDocument()
  })

  it('reports a failed sync', () => {
    setup({ saveStatus: { status: 'sync-failed', lastSavedAt: Date.now(), retry: () => {} } })
    expect(screen.getByText(/sync failed/i)).toBeInTheDocument()
  })
})

describe('DeckPanel body', () => {
  it('shows the card total against the deck size', () => {
    setup()
    expect(screen.getByText(/4\s*\/\s*60/)).toBeInTheDocument()
  })

  it('lists deck entries with counts', () => {
    setup()
    expect(screen.getByText('Cinderella')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('shows stats without any interaction', () => {
    setup()
    expect(screen.getByText(/avg/i)).toBeInTheDocument()
    expect(screen.getByText(/inkable/i)).toBeInTheDocument()
  })

  it('calls onRemove from a row', async () => {
    const { onRemove } = setup()
    await userEvent.click(screen.getByRole('button', { name: /remove Cinderella/i }))
    expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/deckPanel.test.jsx`
Expected: FAIL — unresolved import

- [ ] **Step 3: Build the components**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/deckPanel.test.jsx`
Expected: PASS, 12 tests

- [ ] **Step 5: Commit**

```bash
git add src/features/builder/DeckPanel.jsx src/features/builder/deck src/test/deckPanel.test.jsx
git commit -m "feat(builder): add DeckPanel with inline deck naming and always-visible stats"
```

---

## Task 10: useAutosave and useCardPool

**Files:**
- Create: `src/features/builder/hooks/useAutosave.js`, `src/features/builder/hooks/useCardPool.js`
- Test: `src/test/useAutosave.test.jsx`

`useAutosave(deck, { isAuthenticated })` writes to localStorage synchronously on every deck change and debounces the cloud POST to `/api/decks` by 2000ms. It returns `SaveStatus`. The local write happens first and unconditionally; a failed cloud write never loses it.

Status transitions: local write done and signed out → `local-only`. Signed in, debounce pending or request in flight → `saving`. Cloud write succeeded → `saved`. Cloud write rejected → `sync-failed`, with `retry()` re-attempting the cloud write only.

`useCardPool()` wraps `fetchAllCards` from `src/lib/cardsApi.js`, maps results through `toAppCard`, and returns `{ cards, loading, error, retry }`.

- [ ] **Step 1: Write the failing test**

```jsx
// src/test/useAutosave.test.jsx
import { renderHook, act, waitFor } from '@testing-library/react'
import useAutosave from '../features/builder/hooks/useAutosave.js'

const deck = { id: 'd1', name: 'Ruby Aggro', entries: {}, total: 0, updatedAt: 1 }

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('useAutosave', () => {
  it('writes to localStorage immediately', () => {
    renderHook(() => useAutosave(deck, { isAuthenticated: false }))
    expect(localStorage.length).toBeGreaterThan(0)
  })

  it('reports local-only when signed out', async () => {
    const { result } = renderHook(() => useAutosave(deck, { isAuthenticated: false }))
    await waitFor(() => expect(result.current.status).toBe('local-only'))
  })

  it('reaches saved after a successful cloud write', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) }))
    const { result } = renderHook(() => useAutosave(deck, { isAuthenticated: true }))
    await waitFor(() => expect(result.current.status).toBe('saved'), { timeout: 4000 })
  })

  it('reports sync-failed when the cloud write rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const { result } = renderHook(() => useAutosave(deck, { isAuthenticated: true }))
    await waitFor(() => expect(result.current.status).toBe('sync-failed'), { timeout: 4000 })
  })

  it('keeps the local write even when the cloud write fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const { result } = renderHook(() => useAutosave(deck, { isAuthenticated: true }))
    await waitFor(() => expect(result.current.status).toBe('sync-failed'), { timeout: 4000 })
    expect(localStorage.length).toBeGreaterThan(0)
  })

  it('debounces rather than posting once per keystroke', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const { rerender } = renderHook(({ d }) => useAutosave(d, { isAuthenticated: true }), {
      initialProps: { d: deck },
    })
    for (let i = 2; i < 8; i++) {
      await act(async () => { rerender({ d: { ...deck, name: `n${i}`, updatedAt: i } }) })
    }
    await waitFor(() => expect(fetchMock).toHaveBeenCalled(), { timeout: 4000 })
    expect(fetchMock.mock.calls.length).toBeLessThan(7)
  })

  it('exposes a retry that re-attempts the cloud write', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useAutosave(deck, { isAuthenticated: true }))
    await waitFor(() => expect(result.current.status).toBe('sync-failed'), { timeout: 4000 })
    await act(async () => { result.current.retry() })
    await waitFor(() => expect(result.current.status).toBe('saved'), { timeout: 4000 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/useAutosave.test.jsx`
Expected: FAIL — unresolved import

- [ ] **Step 3: Write both hooks**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/useAutosave.test.jsx`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/features/builder/hooks src/test/useAutosave.test.jsx
git commit -m "feat(builder): add useAutosave and useCardPool hooks"
```

---

# TRACK C — Integration

Tasks 11–14 are sequential and depend on Tracks A and B being complete.

## Task 11: BuilderPage shell

**Files:**
- Create: `src/features/builder/BuilderPage.jsx`
- Test: `src/test/builderPage.test.jsx`

`BuilderPage` is the only stateful component. It holds deck state (`useReducer(deckReducer, undefined, initialDeckState)`), filter state (`useReducer(filterReducer, undefined, initialFilterState)`), and the card pool (`useCardPool()`). It derives `filteredCards` via `useMemo(() => applyFilters(cards, filters), [cards, filters])` and `stats` via `useMemo(() => computeDeckStats(deck), [deck])`, then renders `FilterRail`, `CardResults`, and `DeckPanel` in a three-column grid.

Desktop grid: `lg:grid-cols-[132px_minmax(0,1fr)_196px]`. Below `lg`: single column — see Task 13.

- [ ] **Step 1: Write the failing test**

```jsx
// src/test/builderPage.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BuilderPage from '../features/builder/BuilderPage.jsx'

vi.mock('../features/builder/hooks/useCardPool.js', () => ({
  default: () => ({
    cards: [
      { id: '1', name: 'Cinderella', subtitle: 'Ballroom Sensation', cost: 2, inks: ['Amethyst'], type: 'Character', inkable: true },
      { id: '2', name: 'Mulan', subtitle: 'Imperial Soldier', cost: 3, inks: ['Ruby'], type: 'Character', inkable: false },
    ],
    loading: false, error: null, retry: vi.fn(),
  }),
}))

beforeEach(() => localStorage.clear())

describe('BuilderPage', () => {
  it('renders all three panes', async () => {
    render(<BuilderPage />)
    expect(screen.getByText(/filters/i)).toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: /rename deck/i })).toBeInTheDocument())
  })

  it('adding a card updates the deck panel total', async () => {
    render(<BuilderPage />)
    await userEvent.click(screen.getByRole('button', { name: /add Cinderella/i }))
    await waitFor(() => expect(screen.getByText(/1\s*\/\s*60/)).toBeInTheDocument())
  })

  it('filtering by ink narrows the results', async () => {
    render(<BuilderPage />)
    expect(screen.getByText('Mulan')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Amethyst' }))
    await waitFor(() => expect(screen.queryByText('Mulan')).not.toBeInTheDocument())
    expect(screen.getByText('Cinderella')).toBeInTheDocument()
  })

  it('clearing filters restores every card', async () => {
    render(<BuilderPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Amethyst' }))
    await waitFor(() => expect(screen.queryByText('Mulan')).not.toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /clear 1/i }))
    await waitFor(() => expect(screen.getByText('Mulan')).toBeInTheDocument())
  })

  it('renaming the deck updates the visible title', async () => {
    render(<BuilderPage />)
    await userEvent.click(screen.getByRole('button', { name: /rename deck/i }))
    const input = screen.getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, 'My New Deck{Enter}')
    await waitFor(() => expect(screen.getByText('My New Deck')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/builderPage.test.jsx`
Expected: FAIL — unresolved import

- [ ] **Step 3: Build BuilderPage**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/builderPage.test.jsx`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/features/builder/BuilderPage.jsx src/test/builderPage.test.jsx
git commit -m "feat(builder): wire BuilderPage three-pane shell"
```

---

## Task 12: Route behind a flag

**Files:**
- Modify: `src/RouterApp.jsx`
- Create: `src/features/builder/flag.js`
- Test: `src/test/builderFlag.test.js`

`flag.js` exports `isNewBuilderEnabled()`, true when `import.meta.env.VITE_NEW_BUILDER === '1'` or `localStorage.getItem('newBuilder') === '1'`. The localStorage override is what lets you dogfood on a preview deploy without a redeploy.

Add a lazy route `/builder2` → `BuilderPage`, following the existing `LazyTool` pattern already in `RouterApp.jsx`. **Do not touch the `/builder` route.** Do not add `/builder2` to `NAV_ITEMS` — it is reachable by URL only until the swap.

- [ ] **Step 1: Write the failing test**

```js
// src/test/builderFlag.test.js
import { isNewBuilderEnabled } from '../features/builder/flag.js'

beforeEach(() => localStorage.clear())

describe('isNewBuilderEnabled', () => {
  it('is false by default', () => {
    expect(isNewBuilderEnabled()).toBe(false)
  })

  it('is true with the localStorage override', () => {
    localStorage.setItem('newBuilder', '1')
    expect(isNewBuilderEnabled()).toBe(true)
  })

  it('is false for any other localStorage value', () => {
    localStorage.setItem('newBuilder', 'yes')
    expect(isNewBuilderEnabled()).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/builderFlag.test.js`
Expected: FAIL — unresolved import

- [ ] **Step 3: Add the flag and the route**

- [ ] **Step 4: Verify the build**

Run: `npx vitest run src/test/builderFlag.test.js && npm run build`
Expected: tests PASS, build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/features/builder/flag.js src/RouterApp.jsx src/test/builderFlag.test.js
git commit -m "feat(builder): add /builder2 route behind a flag"
```

---

## Task 13: Responsive layout

**Files:**
- Modify: `src/features/builder/BuilderPage.jsx`
- Create: `src/features/builder/MobileSheets.jsx`
- Test: `src/test/builderResponsive.test.jsx`

Below `lg`, `BuilderPage` renders a single column: the search bar with a Filters button that opens `FilterRail` in a sheet, the card grid, and a fixed bottom bar with a card-count pill that opens `DeckPanel` in a bottom sheet.

Both sheets are real in-flow overlays: `role="dialog"`, `aria-modal="true"`, an accessible name, focus moved to the sheet on open, Escape closes, and focus returns to the trigger. Do not reuse the old `mobileTab` pattern from `App.jsx`.

- [ ] **Step 1: Write the failing test**

```jsx
// src/test/builderResponsive.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterSheet, DeckSheet } from '../features/builder/MobileSheets.jsx'

describe('FilterSheet', () => {
  it('is not rendered when closed', () => {
    render(<FilterSheet open={false} onClose={vi.fn()}><p>rail</p></FilterSheet>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders as a labelled modal dialog when open', () => {
    render(<FilterSheet open onClose={vi.fn()}><p>rail</p></FilterSheet>)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName(/filters/i)
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(<FilterSheet open onClose={onClose}><p>rail</p></FilterSheet>)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('closes from the close control', async () => {
    const onClose = vi.fn()
    render(<FilterSheet open onClose={onClose}><p>rail</p></FilterSheet>)
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('DeckSheet', () => {
  it('renders as a labelled modal dialog when open', () => {
    render(<DeckSheet open onClose={vi.fn()}><p>deck</p></DeckSheet>)
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/deck/i)
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(<DeckSheet open onClose={onClose}><p>deck</p></DeckSheet>)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/builderResponsive.test.jsx`
Expected: FAIL — unresolved import

- [ ] **Step 3: Build the sheets and wire them into BuilderPage**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/builderResponsive.test.jsx`
Expected: PASS, 6 tests

- [ ] **Step 5: Verify in a real browser at 375px**

Start the dev server and check at 375×812: the filter sheet opens and closes, the deck sheet opens and closes, the card grid reflows to at least two columns, and nothing scrolls horizontally.

- [ ] **Step 6: Commit**

```bash
git add src/features/builder/MobileSheets.jsx src/features/builder/BuilderPage.jsx src/test/builderResponsive.test.jsx
git commit -m "feat(builder): responsive filter and deck sheets below lg"
```

---

## Task 14: End-to-end persistence test

**Files:**
- Test: `src/test/builderPersistence.test.jsx`

- [ ] **Step 1: Write the test**

```jsx
// src/test/builderPersistence.test.jsx
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BuilderPage from '../features/builder/BuilderPage.jsx'

vi.mock('../features/builder/hooks/useCardPool.js', () => ({
  default: () => ({
    cards: [{ id: '1', name: 'Cinderella', subtitle: 'Ballroom Sensation', cost: 2, inks: ['Amethyst'], type: 'Character', inkable: true }],
    loading: false, error: null, retry: vi.fn(),
  }),
}))

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
})

describe('builder persistence', () => {
  it('survives a full unmount and remount', async () => {
    render(<BuilderPage />)

    await userEvent.click(screen.getByRole('button', { name: /add Cinderella/i }))
    await waitFor(() => expect(screen.getByText(/1\s*\/\s*60/)).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /rename deck/i }))
    const input = screen.getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, 'Persisted Deck{Enter}')
    await waitFor(() => expect(screen.getByText('Persisted Deck')).toBeInTheDocument())

    cleanup()
    render(<BuilderPage />)

    await waitFor(() => expect(screen.getByText('Persisted Deck')).toBeInTheDocument())
    expect(screen.getByText(/1\s*\/\s*60/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/test/builderPersistence.test.jsx`
Expected: PASS

If it fails, the bug is real — autosave is not persisting, or `initialDeckState` is not reading it back. Fix the implementation, not the test.

- [ ] **Step 3: Run the whole suite and build**

Run: `npx vitest run && npm run build`
Expected: all tests pass, build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/test/builderPersistence.test.jsx
git commit -m "test(builder): end-to-end add, rename, autosave, reload"
```

---

## After Task 14 — dogfooding, then the swap

**Not part of this plan's tasks.** Once Task 14 lands:

1. Deploy the branch to a Vercel preview and exercise `/builder2` against real card data.
2. Compare side by side with `/builder` on the same deploy.
3. Only when accepted: point `/builder` at `BuilderPage`, remove the flag, delete `src/App.jsx` and its now-unused imports, and rename `/builder2` away. That swap gets its own commit and its own review.

**Do not delete `src/App.jsx` as part of any task above.** It is still serving live traffic at `/builder` until the swap.

## Parallelization map

| Wave | Tasks | Notes |
|---|---|---|
| 1 | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 | All independent. Tracks A and B run concurrently. |
| 2 | 11 | Needs Tracks A and B complete. |
| 3 | 12, 13 | 12 and 13 are independent of each other; both need 11. |
| 4 | 14 | Needs 11, 12, 13. |

Every task commits with explicit pathspecs. Two agents must never `git add -A` — they share one index in this worktree.
