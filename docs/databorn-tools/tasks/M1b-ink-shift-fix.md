# Task M1b — Fix Deck Change ink-shift aggregation bug

Small bugfix in the M1 tool you just built (`src/pages/tools/DeckChangePage.jsx`).

## Repro (verified in browser)
- Current deck: `4 Be Prepared` (Steel), `2 Dragon Fire` (Ruby).
- Target deck: `2 Be Prepared`, `4 Dragon Fire`, `1 Fire the Cannons!` (Ruby).
- **Cost-curve shift renders correctly** (7:-2, 5:+2, 1:+1) — so card resolution works.
- **"Ink copies" shift is wrong**: it shows only `Steel +1`. Expected: `Steel -2` and `Ruby +3` (cut 2 Steel copies of Be Prepared; net +3 Ruby copies across Dragon Fire and Fire the Cannons).

## Where to look
- `ShiftSummary` in `DeckChangePage.jsx` computes `aInks`/`bInks` via `inkCounts()`, which wraps `buildInkSplit()` (exported from `src/components/DeckStats.jsx`).
- `buildInkSplit(entries)` returns `{ segments: [{ ink, count }], classified }` keyed by each card's **primary ink** (see `primaryInk` / `INK_ORDER` in DeckStats.jsx). Confirm the ink key casing your `INKS` array uses matches what `buildInkSplit` emits, and that `deckEntries()` resolves BOTH decks' payload cards to catalog cards before the split (a mismatch here would drop deltas and produce exactly this symptom).
- The per-ink delta is `(bInks[ink] || 0) - (aInks[ink] || 0)`.

## Deliverables
1. Fix the ink-shift so per-ink deltas are correct for the repro above and in general.
2. Add a unit test — extract the ink-delta computation into a pure helper if needed so it can be tested without the DOM (e.g. `src/lib/deckDiff.js` or a small pure function), and cover the repro numbers (`Steel -2`, `Ruby +3`).
3. Keep the cost-curve shift and everything else in the tool unchanged.

## Constraints
- No new dependencies. Keep `npx vitest run` green. Match existing style.
- End with a concise summary of the root cause and the fix.
