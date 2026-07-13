# Task M2 — Hypergeometric Calculator

Implementing engineer. Milestone 2 from `docs/databorn-tools/PLAN.md`. M0 + M1 are merged — build on them. Implement exactly this scope.

## Build on what exists
- `src/lib/deckPayload.js` — `DeckPayload = { cards: [{ name, count, cardId? }], meta? }`, `useIncomingDeck()`.
- `src/components/tools/DeckPasteImport.jsx` — paste/import → `DeckPayload` (reuse for standalone entry; it takes a `cards` prop and an `onImport` callback).
- `src/pages/tools/HypergeometricPage.jsx` is currently a stub — replace it with the real tool.
- Charts: **Recharts is already a dependency** — use it, add nothing new.
- Load the card catalog with `fetchAllCards` from `src/lib/cardsApi.js`. IMPORTANT: guard the fetch against StrictMode double-mount so an aborted fetch's empty result can't clobber the catalog — copy the pattern already used in `DeckChangePage.jsx` (`let alive = true; ... if (alive && loaded?.length) setCards(loaded); return () => { alive = false; controller.abort() }`).

## Deliverables
1. **`src/lib/hypergeometric.js`** — pure, no React:
   - `hypergeom(N, K, n, k)` — probability of exactly `k` successes (population `N`, successes `K`, draw `n`), plus a helper for "at least/at most/range" (min/max).
   - Multivariate joint probability: given the deck size `N`, a draw size `n`, and multiple **card groups** each `{ copies, min, max }`, return P(all groups satisfy their min/max in the drawn `n`). Compute exactly (multivariate hypergeometric), not by simulation.
   - `mulliganAdjust(...)` — model Lorcana's opening: 7-card hand, then the bottom-and-draw mulligan (alter any number of the 7 to the bottom and redraw that many). Provide a toggle-able "after mulligan" probability.
   - `byTurn({ N, groups, onThePlay, extraLooks })` — probability the constraints are satisfied by turn `t`: opening 7, +1 card per turn (on-the-play skips the first-turn draw), with optional `extraLooks` for scry-style sources. Return an array over turns.
2. **`src/pages/tools/HypergeometricPage.jsx`** — the tool UI:
   - Deck-size input (default 60; prefilled from an incoming `DeckPayload`'s total when deck-aware).
   - Dynamic list of card-group rows: label, copies-in-deck, desired min/max in the draw. Add/remove rows.
   - "After mulligan" toggle; optional scry/extra-looks input.
   - Exact joint-probability readout, plus a **by-turn** Recharts line chart.
   - Deck-aware: when opened from a deck (`useIncomingDeck()`), prefill deck size and let the user click cards from the list to seed a group with the correct copy count. Provide a `DeckPasteImport` fallback for standalone entry.
3. **`src/test/hypergeometric.test.js`** — cover: single-group closed-form values (cross-checkable by hand), an "at least 1" case, and a multi-group joint probability checked against a brute-force enumeration for small `N`.

## Constraints
- **No new dependencies.**
- Do not touch `src/App.jsx` or other milestones' files.
- Keep the full suite green (`npx vitest run`).
- Match existing Tailwind + CSS-variable styling (see `DeckChangePage.jsx` for the house style).

## Done criteria
- `/tools/hypergeometric` renders; entering a deck size + a card group shows a correct probability and a by-turn curve; "Analyze this deck" from the Deck Lab prefills deck size.
- Probability math has unit tests that pass, including the brute-force cross-check.
- End with a concise summary of files changed and any decisions/uncertainties.
