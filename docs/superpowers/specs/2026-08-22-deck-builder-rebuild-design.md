# Deck Builder Rebuild — Design

**Date:** 2026-08-22
**Status:** Approved
**Phase 1 scope:** builder shell. Phases 2–4 captured here, planned separately.

## Problem

User feedback on the current deck builder: clunky, hard to navigate, hard to name
decks, "overall not great."

The causes are structural, not cosmetic:

1. **Three overlapping filter surfaces.** A quick-filter bar, a floating magnifier
   button that opens an advanced `FilterPanel` modal, and an "Active filters" chip
   row that restates state the controls already hold. Filter state is never fully
   visible in one place, so an empty result set has no visible explanation.
2. **Deck naming is buried.** The deck name lives inside the `DeckManager` modal
   behind a pencil icon. There is no deck name visible while building.
3. **Deck state is hidden behind a gesture.** Curve, ink split, and inkable ratio
   require opening a panel.
4. **Saving is manual and over-signalled.** One Save press writes localStorage,
   POSTs `/api/decks`, opens a confirmation modal, and fires a toast. Nothing is
   saved until the user remembers to press it.
5. **`src/App.jsx` is 5,682 lines.** `AppInner` spans ~2,300 of them and mixes the
   deck reducer, filter reducer, card normalization, import parsers, and every
   panel component in one scope.

Reference points: dreamborn.ink and the duels.ink deckbuilder. Both use a
persistent filter rail, an always-visible deck panel with inline naming, and
autosave.

## Guiding decisions

| Decision | Choice |
|---|---|
| Layout | Three-pane workbench: filter rail, card results, deck panel |
| Migration | Parallel route `/builder2` behind a flag, then swap and delete old code |
| Logic | Extract existing reducers and parsers unchanged; rebuild only components |
| Saving | Autosave with quiet status; no Save button, no confirmation modal |
| Mobile | First-class. Filter rail becomes a sheet, deck panel a bottom sheet |
| Program scope | All four phases in scope; only Phase 1 planned now |

## Phase 1 — Builder shell

### Layout

Desktop (`lg` and up), three panes:

- **Left rail (~132px, collapsible)** — the single filter surface. Ink hexes, cost
  1–10, type, inkable tri-state, then rarity / set / keywords / franchise behind a
  "More filters" disclosure. A "Clear N" control shows the active filter count.
  This rail replaces the quick-filter bar, the floating magnifier button, the
  `FilterPanel` modal, and the "Active filters" chip row. All four are deleted.
- **Center — card results.** Search input, a result summary line
  ("142 cards · Amethyst, Ruby · cost 2–3") that makes empty results explainable,
  and a responsive grid of card tiles. A tile for a card already in the deck shows
  a count badge and an ink-colored border.
- **Right panel (~196px)** — deck identity and state. Inline-editable deck title,
  save status, card list grouped by type with per-row ink markers, and always-visible
  curve, average cost, and inkable ratio.

Below `lg`: single column. The filter rail opens as a sheet from the search bar;
the deck panel is a bottom sheet with a persistent card-count pill. The card grid
reflows. This is one breakpoint decision, not a separate mobile layout.

### Deck naming

The deck title is a click-to-edit field in the deck panel header, always visible
while building. A new deck is created as "Untitled deck" with the field focused
and selected, so naming is the first thing available rather than a step to
discover. Renaming is inline; there is no rename modal and no pencil-hunt.

Commit on blur or Enter, cancel on Escape. An empty name falls back to
"Untitled deck" rather than saving blank.

### Autosave

`useAutosave(deck)` writes to localStorage on every change and debounces the cloud
write (~2s) when the user is authenticated. It exposes `{status, lastSavedAt, retry}`
rendered as quiet text in the deck panel header:

- `Saved` / `Saved 2m ago`
- `Saving…`
- `Saved locally — sync failed` (retry affordance; the local write is never lost)
- `Saved locally` when signed out

The Save button, the save-confirmation modal, and the save toast are all removed.

### Module extraction

Moved out of `src/App.jsx` **unchanged**. Characterization tests are written
against current behavior *before* each move, so the extraction is provably
lossless.

| Module | Contents |
|---|---|
| `src/lib/cards/normalize.js` | `toAppCard`, `validateCardData`, `validateCardBatch`, `getPrimaryInk`, `getCardInks`, `cardComparator`, `getSetCodeAndName`, `normalizedSetCode` |
| `src/lib/cards/imageUrl.js` | `lorcanaImageProxyUrl`, `encodeImageURL`, `asUrl` |
| `src/lib/deck/deckReducer.js` | `deckReducer`, `initialDeckState`, `getDeckPayload` |
| `src/lib/deck/storage.js` | `loadAllDecks`, `saveAllDecks`, `saveCurrentDeckId`, `getDeckById`, `updateDeckMetadata`, `createNewDeck`, `duplicateDeck`, `deleteDeck`, `generateDeckId` |
| `src/lib/deck/stats.js` | curve, ink split, inkable ratio, type counts — pure and memoized |
| `src/lib/import/textImport.js` | `parseTextImport`, `matchCard`, `findCardByName`, `findCardByLorcanitoFormat` |
| `src/lib/import/csvImport.js` | `parseCSVImport` |
| `src/lib/filters/filterModel.js` | filter state, `applyFilters(cards, filters)`, `serializeFilterState`, `hydrateFilterState` |

`filterModel.js` keeps the existing filter reducer behavior in Phase 1, with one
deliberate exception: the `_resetTimestamp` remount hack and the overlapping
`showInkablesOnly` / `showUninkablesOnly` flags are replaced by a single
`inkable: 'any' | 'yes' | 'no'` field, since the new rail renders inkable as a
tri-state control. This change is covered by its own tests.

### Component tree

Under `src/features/builder/`:

```
BuilderPage              owns deck state, filter state, card pool; the only
                         stateful component
├── FilterRail           props: filters, onChange, activeCount, onClear
│   ├── InkFilter
│   ├── CostFilter
│   ├── TypeFilter
│   └── MoreFilters      rarity, set, keywords, franchise
├── CardResults          props: cards, deck, onAdd, onInspect
│   ├── SearchBar
│   ├── ResultSummary
│   └── CardTile         count badge + ink border when in deck
└── DeckPanel            props: deck, stats, saveStatus, onRename, onSetCount, onRemove
    ├── DeckTitle        inline click-to-edit
    ├── SaveStatus
    ├── DeckList → DeckRow
    └── DeckStats        curve, avg cost, inkable ratio
```

Every component below `BuilderPage` takes props and calls callbacks. None reach
into global state. Target: no file over ~300 lines.

Two hooks carry cross-cutting behavior:

- `useAutosave(deck)` → `{status, lastSavedAt, retry}`
- `useCardPool()` → `{cards, loading, error, retry}` — owns fetch, cache, and
  normalization of Lorcast data

Existing `src/components/ui/` primitives (`Button`, `Input`, `Pill`, `Panel`,
`CostHex`, `InkCurve`, `InkSplitBar`, `HexGlyph`) are reused rather than
re-authored. The builder introduces no new design tokens; it uses
`src/tokens.css` as the source of truth for ink and surface colors, replacing the
raw Tailwind palette classes (`violet-500`, `emerald-600`, `gray-950`) currently
scattered through the builder markup.

### Error handling

Three cases that currently fail silently:

1. **Card fetch failure.** The results pane renders an error state with a retry
   control, not an empty grid.
2. **Cloud sync failure.** Status reads "Saved locally — sync failed" with retry.
   The local write always succeeds first, so no edit is ever lost to a network
   error.
3. **Unmatched import lines.** `matchCard` currently drops lines it cannot resolve
   without telling the user. Phase 1 surfaces the count; Phase 3 builds the full
   preview.

### Testing

- Characterization tests on each extracted module, written before the move.
- Component tests for `FilterRail` (filter changes propagate, Clear resets,
  active count is correct) and `DeckPanel` (inline rename commits on blur and
  Enter, cancels on Escape; count changes propagate).
- One integration test: search → add card → rename deck → autosave fires →
  reload → deck and name persist.
- `npx vitest run` must stay green throughout (119 passing as of 2026-07-02).

### Migration

1. Build at `/builder2` behind a flag. `/builder` keeps serving the current
   builder untouched.
2. Dogfood on the Vercel preview; compare side by side.
3. When accepted, `/builder` routes to the new page.
4. Delete `src/App.jsx` and its now-unused component definitions. The flag is
   removed. The flag exists to enable dogfooding, not to live permanently.

### Done means

- Naming a deck takes zero clicks beyond typing, and the name is visible while
  building.
- Every active filter is visible in one place, and an empty result set explains
  itself.
- Curve, ink split, and inkable ratio are on screen without a gesture.
- No edit is ever lost, and no save gesture is required.
- The builder is usable one-handed on a phone.
- `src/App.jsx` no longer exists.
- Test suite green.

## Phase 2 — Deck lifecycle

Rebuild `MyDecksPage` to match the builder: create, duplicate, delete, rename,
sort, and search decks, with ink-pair badges reusing the existing meta art. The
`DeckManager` modal is deleted — its responsibilities split between inline naming
(Phase 1) and this page.

## Phase 3 — Import / export / print

Parsers are unchanged from Phase 1's extraction; the surfaces are rebuilt.
Paste-to-import gains a live preview showing exactly which lines matched and which
did not, replacing today's silent drop. Export gains a format picker.
`PrintableSheet` is re-skinned into the new shell.

## Phase 4 — AI in the builder

Deck analysis and card suggestions in the right rail, drawing on the meta data
already flowing through `/api/stats/meta`. Deferred until the shell is stable.

## Out of scope

Nothing in the program is out of scope. Phases 2–4 are sequenced, not cut, and
each gets its own implementation plan after the phase before it ships.
