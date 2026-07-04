# Ask AI: Attach a Deck List — Design

**Date:** 2026-07-04
**Status:** Approved

## Goal

Let a hub member attach a deck list to their Ask AI questions so the advisor
can answer questions about that specific list ("what should I cut?", "how does
this curve look?", "how does this list handle Steel Song?").

## Decisions (made with user)

1. **Deck sources: both** — pick from the hub's saved decks, or paste a text
   list (Dreamborn/inktable style `4 Card Name` lines).
2. **Single deck** attached at a time. Multi-deck matchup comparison is out of
   scope (team primers already cover matchup context).
3. **Server-side resolution** — the API accepts a deck reference or raw text
   and resolves it against the server card oracle. One source of truth; the
   server needs card stats to build the prompt anyway.

## API

`POST /api/hubs/:id/ask` — body gains one optional field:

```js
{
  question: string,           // unchanged, 1..1000 chars
  deck?: { deckId: string }   // a saved Deck owned by a member of this hub
        | { text: string }    // raw pasted list, max 5000 chars
}
```

Response gains `deckWarnings?: string[]` (unresolved lines/cards), alongside
the existing `{ answer }`.

### Deck resolution (server)

Both paths converge on name+count pairs, then a shared summarizer:

- **`deckId` path:** load the Deck via Prisma; verify `deck.userId` is the hub
  owner or a hub member (same membership set as `api/hubs/[id]/decks.js` GET).
  Map `deck.data.entries` (`{ [key]: { card, count } }`) to
  `{ name: entry.card.name, count: entry.count }`.
- **`text` path:** new parser in `api/_lib/deckContext.js` (or sibling):
  - Split lines; skip blanks and non-card lines (section headers, comments).
  - Match `^(\d+)\s*x?\s+(.+)$` → count + name. Lines without a leading count
    are treated as count 1 only if they resolve to a card name; otherwise
    recorded as a warning.
  - Cap: 5000 chars / 120 card lines → 400 on overflow.

- **`summarizeNamedCards(pairs)`** (new, in `api/_lib/deckContext.js`):
  resolves each name via `getByName` from `api/_lib/cards.js` (already handles
  "Name - Subtitle" and short-name lookups), and returns the same summary
  shape as `summarizeDecklist` (cards, totalCards, colors, curve, typeCounts,
  avgCost, inkable) so the existing `renderDeckSection` renders it unchanged.
  Unresolved names are collected as warnings and listed honestly in the
  rendered section (mirroring the existing unverified/unknown patterns).

### Prompt assembly

- Deck section rendered by `renderDeckSection`, prepended to the context as
  `--- ATTACHED DECK ---` **before** team data.
- The `MAX_CONTEXT_CHARS` truncation applies to team data only — a long meta
  report must not push the attached deck out of context.
- System prompt gains one sentence: when a deck is attached, treat the
  question as being about that deck unless it says otherwise.

### Errors

- Unknown `deckId`, or deck not owned by a hub member → 404/403.
- Pasted text yields zero resolved cards → 400 ("no cards recognized") before
  any LLM call — no tokens burned.
- Oversized paste → 400.
- Partial resolution is OK: proceed, list unresolved entries in the prompt and
  return them in `deckWarnings`.

## Frontend (`src/pages/hub/AskPage.jsx`)

- "Attach deck" button above the question form opens an inline panel with two
  tabs:
  - **Saved decks** — list from existing `GET /api/hubs/:id/decks`
    (name, owner email, card count); click to attach.
  - **Paste list** — textarea + attach button.
- Attached deck renders as a chip: deck name (or "Pasted list · N cards") + ✕
  to remove. Persists across questions until removed.
- Client sends the deck payload with **every** ask while attached (endpoint is
  stateless; pasted text is re-sent and re-parsed each time).
- `deckWarnings` from the response are shown under the chip
  ("2 lines not recognized: …").
- The compact Ask AI widget on the Overview page is unchanged.

## Testing

- Unit tests (vitest, alongside `src/test/deckContext.test.js`): text parser
  (counts, `x` suffix, blank/header lines, unresolvable lines, caps) and
  `summarizeNamedCards` (aggregates match `summarizeDecklist` semantics,
  warnings for unknown names).
- Manual preview pass: attach saved deck, attach pasted list, ask a question,
  remove chip, warning display.

## Out of scope

- Multi-deck attachment / matchup comparison between two lists.
- Persisting conversations or attachments server-side.
- File upload (.txt/.csv).
- Changes to the Overview Ask AI widget.
