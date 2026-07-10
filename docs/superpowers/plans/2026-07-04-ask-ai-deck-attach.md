# Ask AI Deck Attachment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a hub member attach one deck (saved hub deck or pasted text list) to Ask AI questions so the advisor answers about that specific list.

**Architecture:** `POST /api/hubs/:id/ask` accepts an optional `deck` field (`{deckId}` or `{text}`). Both paths resolve server-side into name+count pairs, feed the existing `summarizeDecklist` aggregator via a new `summarizeNamedCards` helper, and the deck section is prepended to the LLM context (exempt from the team-data truncation cap). The Ask page gets an attach panel (saved decks tab + paste tab) and a removable chip; the client re-sends the deck with every question since the endpoint is stateless.

**Tech Stack:** Vercel serverless functions (plain JS, ESM), Prisma, zod, `@anthropic-ai/sdk`, React (JSX, Tailwind classes), vitest.

**Spec:** `docs/superpowers/specs/2026-07-04-ask-ai-deck-attach-design.md`

**File map:**
- Modify: `api/_lib/deckContext.js` — add `summarizeNamedCards`, `namedPairsFromDeckData`; add optional `title` param to `renderDeckSection`
- Create: `api/_lib/deckTextParse.js` — pasted-text line parser (single responsibility: text → pairs; no oracle access)
- Modify: `api/hubs/[id]/ask.js` — schema + deck resolution + prompt assembly + `deckWarnings`
- Modify: `src/pages/hub/AskPage.jsx` — attach panel, chip, warnings display
- Test: `src/test/deckContext.test.js` (extend), Create: `src/test/deckTextParse.test.js`

Run tests with: `npx vitest run src/test/<file>` from the repo root (plain `npm test` starts watch mode — don't use it in automation).

---

### Task 1: `renderDeckSection` title parameter

`renderDeckSection` currently hardcodes the header `--- YOUR DECK (N cards) ---`. The ask endpoint needs `--- ATTACHED DECK: <label> (N cards) ---`. Add an optional param; existing callers (review agent) unchanged.

**Files:**
- Modify: `api/_lib/deckContext.js` (function `renderDeckSection`, ~line 168)
- Test: `src/test/deckContext.test.js`

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe('renderDeckSection', ...)` block in `src/test/deckContext.test.js`:

```js
  it('accepts a custom section title', () => {
    const s = summarizeDecklist(['1-1'])
    const text = renderDeckSection(s, 'ATTACHED DECK: My Ruby List')
    expect(text).toContain('--- ATTACHED DECK: My Ruby List (1 cards) ---')
    expect(text).not.toContain('YOUR DECK')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/deckContext.test.js`
Expected: the new test FAILS (header still says `YOUR DECK`); all pre-existing tests PASS.

- [ ] **Step 3: Implement**

In `api/_lib/deckContext.js`, change the `renderDeckSection` signature and header line:

```js
export function renderDeckSection(summary, title = "YOUR DECK") {
  if (!summary) return null;
  const out = [];
  out.push(`--- ${title} (${summary.totalCards} cards) ---`);
```

(The rest of the function body is unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/deckContext.test.js`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/deckContext.js src/test/deckContext.test.js
git commit -m "feat: renderDeckSection accepts a custom section title"
```

---

### Task 2: `summarizeNamedCards` + `namedPairsFromDeckData`

Both deck sources (saved deck entries, parsed text lines) converge on `[{name, count, implicit?}]` pairs. `summarizeNamedCards` resolves names via the oracle and reuses `summarizeDecklist` for all aggregation (DRY): resolved cards contribute their oracle id once per copy; explicit-count unresolved names are passed through as raw "ids" so `summarizeDecklist`/`renderDeckSection` surface them via the existing unknown-id path; implicit (count-less) unresolved lines are dropped with a warning — they're almost certainly section headers, not cards.

**Files:**
- Modify: `api/_lib/deckContext.js` (append two functions at end of file)
- Test: `src/test/deckContext.test.js`

- [ ] **Step 1: Write the failing tests**

Append at the end of `src/test/deckContext.test.js` (also add `summarizeNamedCards, namedPairsFromDeckData` to the import list from `deckContext.js` at the top):

```js
describe('summarizeNamedCards', () => {
  it('resolves names, aggregates counts, and reports no warnings for clean input', () => {
    const { summary, warnings } = summarizeNamedCards([
      { name: 'Mickey Mouse - Brave Little Tailor', count: 3 },
    ])
    expect(warnings).toEqual([])
    expect(summary.totalCards).toBe(3)
    expect(summary.cards).toHaveLength(1)
    expect(summary.cards[0].card.name).toBe('Mickey Mouse - Brave Little Tailor')
    expect(summary.cards[0].count).toBe(3)
    expect(summary.colors).toContain('Ruby')
  })

  it('keeps explicit-count unknown names in the deck as unresolved, with a warning', () => {
    const { summary, warnings } = summarizeNamedCards([
      { name: 'Mickey Mouse - Brave Little Tailor', count: 1 },
      { name: 'Totally Fake Card', count: 2 },
    ])
    expect(warnings).toEqual(['Card not found: "Totally Fake Card"'])
    expect(summary.totalCards).toBe(3)
    expect(summary.unknownIds).toEqual(['Totally Fake Card'])
  })

  it('drops implicit (count-less) unresolved lines with a warning', () => {
    const { summary, warnings } = summarizeNamedCards([
      { name: 'Ruby / Sapphire Midrange', count: 1, implicit: true },
      { name: 'Mickey Mouse - Brave Little Tailor', count: 4 },
    ])
    expect(warnings).toEqual(['Skipped line: "Ruby / Sapphire Midrange"'])
    expect(summary.totalCards).toBe(4)
    expect(summary.unknownIds).toEqual([])
  })

  it('resolves implicit lines that ARE real card names as count 1', () => {
    const { summary, warnings } = summarizeNamedCards([
      { name: 'Mickey Mouse - Brave Little Tailor', count: 1, implicit: true },
    ])
    expect(warnings).toEqual([])
    expect(summary.totalCards).toBe(1)
  })

  it('returns null summary when nothing resolves', () => {
    const { summary, warnings } = summarizeNamedCards([
      { name: 'Header Line', count: 1, implicit: true },
    ])
    expect(summary).toBeNull()
    expect(warnings).toHaveLength(1)
  })
})

describe('namedPairsFromDeckData', () => {
  it('maps deck data entries to name+count pairs', () => {
    const data = {
      entries: {
        k1: { card: { name: 'Mickey Mouse - Brave Little Tailor' }, count: 4 },
        k2: { card: { name: 'Some Other Card' }, count: 2 },
      },
    }
    expect(namedPairsFromDeckData(data)).toEqual([
      { name: 'Mickey Mouse - Brave Little Tailor', count: 4 },
      { name: 'Some Other Card', count: 2 },
    ])
  })

  it('skips malformed entries and handles missing data', () => {
    expect(namedPairsFromDeckData(null)).toEqual([])
    expect(namedPairsFromDeckData({})).toEqual([])
    expect(
      namedPairsFromDeckData({
        entries: { a: { card: {}, count: 3 }, b: { card: { name: 'X' }, count: 0 }, c: null },
      })
    ).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/deckContext.test.js`
Expected: FAIL — `summarizeNamedCards is not a function` (import error or undefined).

- [ ] **Step 3: Implement**

Append to `api/_lib/deckContext.js`:

```js
/**
 * Summarize a deck given as name+count pairs (saved-deck entries or a parsed
 * pasted list). Names resolve through the oracle; resolved cards are expanded
 * to their oracle ids and fed through summarizeDecklist so all profile math
 * and rendering stay in one place. Unresolved names with an explicit count
 * stay in the deck via the unknown-id path; count-less lines that don't
 * resolve are dropped — they're section headers, not cards.
 *
 * @param {Array<{name:string, count:number, implicit?:boolean}>} pairs
 * @returns {{summary: object|null, warnings: string[]}}
 */
export function summarizeNamedCards(pairs) {
  const ids = [];
  const warnings = [];
  for (const { name, count, implicit } of pairs ?? []) {
    if (!name || !Number.isFinite(count) || count < 1) continue;
    const card = getByName(name);
    if (!card) {
      if (implicit) {
        warnings.push(`Skipped line: "${name}"`);
        continue;
      }
      warnings.push(`Card not found: "${name}"`);
      for (let i = 0; i < count; i++) ids.push(name);
      continue;
    }
    for (let i = 0; i < count; i++) ids.push(card.id);
  }
  return { summary: summarizeDecklist(ids), warnings };
}

/**
 * Extract name+count pairs from a saved Deck row's `data` JSON
 * ({ entries: { [key]: { card, count } } }). Malformed entries are skipped.
 */
export function namedPairsFromDeckData(data) {
  const entries = data?.entries;
  if (!entries || typeof entries !== "object") return [];
  const pairs = [];
  for (const e of Object.values(entries)) {
    const name = e?.card?.name;
    const count = Number(e?.count) || 0;
    if (name && count > 0) pairs.push({ name, count });
  }
  return pairs;
}
```

Note: `getByName` is already imported at the top of `deckContext.js`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/deckContext.test.js`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/deckContext.js src/test/deckContext.test.js
git commit -m "feat: summarize decks given as name+count pairs (saved decks / pasted lists)"
```

---

### Task 3: Pasted-text parser `parseDeckText`

Pure text → pairs. No oracle access (name resolution is `summarizeNamedCards`'s job). Permissive: `4 Card Name`, `4x Card Name`, `4X Card Name`; blank lines skipped; count-less lines passed through flagged `implicit: true`; duplicate names merged by summing counts downstream is NOT needed (summarizeNamedCards expands per-copy, so duplicates merge naturally in `summarizeDecklist`).

**Files:**
- Create: `api/_lib/deckTextParse.js`
- Test: `src/test/deckTextParse.test.js` (create)

- [ ] **Step 1: Write the failing tests**

Create `src/test/deckTextParse.test.js`:

```js
// Tests for api/_lib/deckTextParse.js — permissive pasted-decklist parsing.
// Pure text→pairs; card-name resolution happens later in summarizeNamedCards.
import { describe, it, expect } from 'vitest'
import { parseDeckText, MAX_DECK_TEXT_CHARS } from '../../api/_lib/deckTextParse.js'

describe('parseDeckText', () => {
  it('parses "N Name" and "Nx Name" lines', () => {
    const { pairs, error } = parseDeckText('4 Be Prepared\n2x Mickey Mouse - Brave Little Tailor\n1X Lantern')
    expect(error).toBeUndefined()
    expect(pairs).toEqual([
      { name: 'Be Prepared', count: 4 },
      { name: 'Mickey Mouse - Brave Little Tailor', count: 2 },
      { name: 'Lantern', count: 1 },
    ])
  })

  it('skips blank lines and passes count-less lines through as implicit', () => {
    const { pairs } = parseDeckText('Ruby/Sapphire\n\n  \n4 Be Prepared')
    expect(pairs).toEqual([
      { name: 'Ruby/Sapphire', count: 1, implicit: true },
      { name: 'Be Prepared', count: 4 },
    ])
  })

  it('rejects out-of-range counts as implicit-style lines rather than huge decks', () => {
    const { pairs } = parseDeckText('999 Be Prepared')
    expect(pairs).toEqual([{ name: '999 Be Prepared', count: 1, implicit: true }])
  })

  it('errors on oversized input', () => {
    const { error } = parseDeckText('x'.repeat(MAX_DECK_TEXT_CHARS + 1))
    expect(error).toMatch(/too (long|large)/i)
  })

  it('errors on empty input', () => {
    expect(parseDeckText('').error).toBeTruthy()
    expect(parseDeckText('   \n  ').error).toBeTruthy()
  })

  it('caps the number of lines', () => {
    const big = Array.from({ length: 200 }, () => '4 Be Prepared').join('\n')
    const { error } = parseDeckText(big)
    expect(error).toMatch(/too many lines/i)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/deckTextParse.test.js`
Expected: FAIL — cannot resolve `../../api/_lib/deckTextParse.js`.

- [ ] **Step 3: Implement**

Create `api/_lib/deckTextParse.js`:

```js
// api/_lib/deckTextParse.js
// Permissive parser for pasted deck lists ("4 Card Name" / "4x Card Name",
// one card per line — the common Dreamborn/inktable export shape). Pure
// text → {name, count} pairs; resolving names against the card oracle is
// deckContext.summarizeNamedCards' job. Count-less lines are passed through
// flagged `implicit` so the resolver can drop them (section headers) unless
// they happen to be a real card name.

export const MAX_DECK_TEXT_CHARS = 5000;
export const MAX_DECK_TEXT_LINES = 120;
const MAX_COPIES = 60; // sanity bound per line, not a legality check

const LINE_RE = /^(\d{1,2})\s*[xX]?\s+(.+)$/;

/**
 * @param {string} text
 * @returns {{pairs: Array<{name:string, count:number, implicit?:boolean}>, error?: string}}
 */
export function parseDeckText(text) {
  const raw = String(text ?? "");
  if (raw.length > MAX_DECK_TEXT_CHARS) {
    return { pairs: [], error: `Deck list is too long (max ${MAX_DECK_TEXT_CHARS} characters).` };
  }
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { pairs: [], error: "Deck list is empty." };
  if (lines.length > MAX_DECK_TEXT_LINES) {
    return { pairs: [], error: `Deck list has too many lines (max ${MAX_DECK_TEXT_LINES}).` };
  }

  const pairs = [];
  for (const line of lines) {
    const m = line.match(LINE_RE);
    const count = m ? parseInt(m[1], 10) : NaN;
    if (m && count >= 1 && count <= MAX_COPIES) {
      pairs.push({ name: m[2].trim(), count });
    } else {
      // No leading count (or a nonsense one): could be a section header or a
      // bare card name — let the resolver decide, at count 1.
      pairs.push({ name: line, count: 1, implicit: true });
    }
  }
  return { pairs };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/deckTextParse.test.js`
Expected: PASS.

Note: the `999 Be Prepared` test passes because `LINE_RE` only allows 1–2 digit counts, so a 3-digit count falls through to the implicit path with the full line as the name.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/deckTextParse.js src/test/deckTextParse.test.js
git commit -m "feat: permissive pasted deck-list text parser"
```

---

### Task 4: Wire deck attachment into the ask endpoint

Thin wiring — resolution logic already unit-tested in Tasks 2–3. All deck failures return before the Anthropic call so no tokens are burned.

**Files:**
- Modify: `api/hubs/[id]/ask.js`

- [ ] **Step 1: Update imports and schema**

In `api/hubs/[id]/ask.js`, extend the imports:

```js
import {
  summarizeNamedCards,
  namedPairsFromDeckData,
  renderDeckSection,
} from "../../_lib/deckContext.js";
import { parseDeckText, MAX_DECK_TEXT_CHARS } from "../../_lib/deckTextParse.js";
```

Replace `AskSchema`:

```js
const AskSchema = z.object({
  question: z.string().min(1).max(1000),
  deck: z
    .union([
      z.object({ deckId: z.string().min(1) }),
      z.object({ text: z.string().min(1).max(MAX_DECK_TEXT_CHARS) }),
    ])
    .optional(),
});
```

- [ ] **Step 2: Resolve the attached deck after input validation**

Immediately after `const { question } = parsed.data;` (change that line to also pull `deck`), insert:

```js
  const { question, deck } = parsed.data;

  // Resolve the optional attached deck to a rendered prompt section before
  // anything expensive — every failure here must return without an LLM call.
  let deckSection = null;
  let deckWarnings = [];
  if (deck) {
    let pairs;
    let deckLabel;
    if ("deckId" in deck) {
      const deckRow = await prisma.deck.findUnique({
        where: { id: deck.deckId },
        select: { title: true, data: true, userId: true },
      });
      if (!deckRow) return res.status(404).json({ error: "Deck not found" });
      // The deck must belong to someone in this hub (owner or member).
      const inHub = await prisma.hub.findFirst({
        where: {
          id: hubId,
          OR: [{ ownerId: deckRow.userId }, { members: { some: { userId: deckRow.userId } } }],
        },
        select: { id: true },
      });
      if (!inHub) return res.status(403).json({ error: "That deck does not belong to this hub" });
      pairs = namedPairsFromDeckData(deckRow.data);
      deckLabel = deckRow.title;
    } else {
      const parsedText = parseDeckText(deck.text);
      if (parsedText.error) return res.status(400).json({ error: parsedText.error });
      pairs = parsedText.pairs;
      deckLabel = "Pasted list";
    }

    const { summary, warnings } = summarizeNamedCards(pairs);
    deckWarnings = warnings;
    if (!summary) {
      return res.status(400).json({
        error: "No cards in that deck list could be recognized.",
        deckWarnings,
      });
    }
    deckSection = renderDeckSection(summary, `ATTACHED DECK: ${deckLabel}`);
  }
```

- [ ] **Step 3: Include the deck in the prompt**

Replace the `userMessage` assembly (the truncation of `context` above it stays exactly as is — the cap applies to team data only, so the deck can't be pushed out):

```js
  const deckPart = deckSection ? `${deckSection}\n\n` : "";
  const userMessage = `Question: ${question}\n\n${deckPart}=== TEAM DATA ===\n${context}`;
```

And make the system prompt deck-aware — replace `system: SYSTEM_PROMPT,` in the `client.messages.create` call with:

```js
    system: deckSection
      ? SYSTEM_PROMPT +
        " A deck list is attached to this question; treat the question as being about that deck unless it says otherwise."
      : SYSTEM_PROMPT,
```

- [ ] **Step 4: Return warnings**

Replace the final response line:

```js
  return res.status(200).json({
    answer,
    ...(deckWarnings.length > 0 ? { deckWarnings } : {}),
  });
```

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — no regressions (this task has no new unit tests; the logic it composes is covered by Tasks 2–3, and the wiring is exercised in Task 6's manual pass).

- [ ] **Step 6: Commit**

```bash
git add api/hubs/[id]/ask.js
git commit -m "feat: ask endpoint accepts an attached deck (saved deckId or pasted text)"
```

---

### Task 5: AskPage attach UI

Attach panel with two tabs (saved decks / paste), removable chip, deck sent with every question, warnings shown under the chip. Styling follows the page's existing Tailwind idiom (gray-800 inputs, violet accents, `rounded-xl` cards).

**Files:**
- Modify: `src/pages/hub/AskPage.jsx`

- [ ] **Step 1: Add attachment state and wire it into `ask()`**

In `AskPage()`, add state below the existing `useState` calls:

```jsx
  const [attachedDeck, setAttachedDeck] = useState(null); // { type:'saved', deckId, title, cardCount } | { type:'text', text }
  const [deckWarnings, setDeckWarnings] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState('saved'); // 'saved' | 'paste'
  const [savedDecks, setSavedDecks] = useState(null); // null = not loaded
  const [pasteText, setPasteText] = useState('');
```

Update the `ask` function's fetch body and response handling:

```jsx
      const res = await fetch(`/api/hubs/${hub.id}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          ...(attachedDeck
            ? {
                deck:
                  attachedDeck.type === 'saved'
                    ? { deckId: attachedDeck.deckId }
                    : { text: attachedDeck.text },
              }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setDeckWarnings(data.deckWarnings || []);
      setHistory(prev => [{ question: text, answer: data.answer }, ...prev].slice(0, 5));
      setQuestion('');
```

- [ ] **Step 2: Add panel handlers**

Below `ask`, add:

```jsx
  const openPanel = async () => {
    setPanelOpen(true);
    if (savedDecks === null) {
      try {
        const res = await fetch(`/api/hubs/${hub.id}/decks`);
        const data = await res.json();
        setSavedDecks(res.ok && Array.isArray(data) ? data : []);
      } catch {
        setSavedDecks([]);
      }
    }
  };

  const attachSaved = (d) => {
    setAttachedDeck({ type: 'saved', deckId: d.id, title: d.title, cardCount: d.cardCount });
    setDeckWarnings([]);
    setPanelOpen(false);
  };

  const attachPasted = () => {
    const text = pasteText.trim();
    if (!text) return;
    setAttachedDeck({ type: 'text', text });
    setDeckWarnings([]);
    setPanelOpen(false);
  };

  const removeDeck = () => {
    setAttachedDeck(null);
    setDeckWarnings([]);
  };
```

- [ ] **Step 3: Render the attach row, panel, and chip**

Insert between `<LlmBudgetBar hubId={hub.id} />` and the `<form ...>`:

```jsx
      <div className="space-y-2">
        {!attachedDeck && (
          <button
            type="button"
            onClick={() => (panelOpen ? setPanelOpen(false) : openPanel())}
            className="text-xs px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-gray-300 hover:bg-white/[0.06] transition-colors"
          >
            📎 Attach a deck
          </button>
        )}

        {attachedDeck && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/[0.08] text-violet-200">
              🃏 {attachedDeck.type === 'saved'
                ? `${attachedDeck.title}${attachedDeck.cardCount ? ` · ${attachedDeck.cardCount} cards` : ''}`
                : 'Pasted list'}
              <button
                type="button"
                onClick={removeDeck}
                aria-label="Remove attached deck"
                className="text-violet-300 hover:text-white"
              >
                ✕
              </button>
            </span>
            <span className="text-xs text-gray-500">Attached to every question until removed</span>
          </div>
        )}

        {deckWarnings.length > 0 && (
          <p className="text-xs text-amber-400">
            {deckWarnings.length} deck line{deckWarnings.length > 1 ? 's' : ''} not recognized: {deckWarnings.join('; ')}
          </p>
        )}

        {panelOpen && !attachedDeck && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
            <div className="flex gap-2">
              {[['saved', 'Saved decks'], ['paste', 'Paste a list']].map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPanelTab(tab)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    panelTab === tab
                      ? 'border-violet-500/50 bg-violet-500/[0.12] text-violet-200'
                      : 'border-white/10 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {panelTab === 'saved' && (
              <div className="max-h-56 overflow-y-auto space-y-1">
                {savedDecks === null && <p className="text-xs text-gray-500">Loading decks…</p>}
                {savedDecks?.length === 0 && (
                  <p className="text-xs text-gray-500">No saved decks in this hub yet — try pasting a list instead.</p>
                )}
                {savedDecks?.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => attachSaved(d)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/[0.06] transition-colors"
                  >
                    <span className="text-sm text-gray-200">{d.title}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      {d.cardCount} cards · {d.user?.email}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {panelTab === 'paste' && (
              <div className="space-y-2">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={'4 Be Prepared\n3 Mickey Mouse - Brave Little Tailor\n…'}
                  rows={6}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm font-mono resize-none focus:border-violet-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={attachPasted}
                  disabled={!pasteText.trim()}
                  className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
                >
                  Attach list
                </button>
              </div>
            )}
          </div>
        )}
      </div>
```

- [ ] **Step 4: Update the page subtitle and placeholder for discoverability**

Change the `<p className="text-sm text-gray-400">` subtitle to:

```jsx
        <p className="text-sm text-gray-400">
          Ask questions about your team's data — matchup win rates, primers, and meta reports are all in context.
          Attach a deck to ask about a specific list.
        </p>
```

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/pages/hub/AskPage.jsx
git commit -m "feat: Ask AI page — attach a saved deck or pasted list to questions"
```

---

### Task 6: Manual verification (preview server)

**Files:** none (verification only)

- [ ] **Step 1: Start the preview server** (`preview_start` with the existing `.claude/launch.json` config; the AI calls require `ANTHROPIC_API_KEY` in the local env — if it's absent, verify everything up to the 501 response and note it).

- [ ] **Step 2: Verify the UI flow** on `/team-hub/<hubId>/ask`:
  - "📎 Attach a deck" opens the panel; both tabs render.
  - Saved decks list loads (or shows the empty-state hint).
  - Pasting `4 Be Prepared\n3 Mickey Mouse - Brave Little Tailor` and attaching shows the "Pasted list" chip.
  - Asking a question sends `deck: { text: … }` in the request body (check `preview_network`).
  - A junk line (e.g. `4 Totally Fake Card`) produces the amber warnings line after asking.
  - ✕ removes the chip and subsequent asks send no `deck` field.

- [ ] **Step 3: Screenshot** the attached-chip + answer state and share it.

---

## Self-review notes

- Spec coverage: deck sources both (Tasks 4–5), single deck (chip replaces, no multi-attach UI), server-side resolution (Tasks 2–4), warnings surfaced (Tasks 4–5), truncation exemption (Task 4 Step 3), no-tokens-on-failure (Task 4 Step 2 ordering), overview widget untouched. ✔
- Types/signatures consistent: `parseDeckText → {pairs, error?}`, `summarizeNamedCards → {summary, warnings}`, `renderDeckSection(summary, title?)`. ✔
- No placeholders. ✔
