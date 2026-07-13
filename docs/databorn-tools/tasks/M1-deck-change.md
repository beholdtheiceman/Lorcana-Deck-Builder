# Task M1 — Deck Change Calculator

Implementing engineer. Milestone 1 from `docs/databorn-tools/PLAN.md`. M0 (shared plumbing) is already merged — build on it. Implement exactly this scope.

## Build on what exists (from M0)
- `src/lib/deckPayload.js` — `DeckPayload = { cards: [{ name, count, cardId? }], meta? }`, plus `useIncomingDeck()`.
- `src/components/tools/DeckPasteImport.jsx` — paste/import UI that yields a `DeckPayload`. Reuse it for both sides.
- `src/pages/tools/DeckChangePage.jsx` currently a stub — replace it with the real tool.
- Existing stat/curve helpers live in `src/components/deckCharts.jsx` and `src/components/DeckStats.jsx` — reuse rather than reinvent for the curve/ink shift summary.

## Deliverables
1. **`src/lib/deckDiff.js`** — pure, no React:
   - `diff(a, b)` where `a`, `b` are `DeckPayload` (a = current, b = target).
   - Returns `{ cuts, adds, unchanged, totals, curveShift }`:
     - `cuts`: cards to remove or reduce (in A with higher count than B) — `[{ name, from, to, delta }]` (delta negative).
     - `adds`: cards to add or increase (in B with higher count than A) — `[{ name, from, to, delta }]` (delta positive).
     - `unchanged`: names present with equal count in both.
     - `totals`: `{ aCount, bCount, changed }` (changed = sum of |delta|).
   - Match cards by normalized name (trim + case-insensitive); preserve original display name in output.
2. **`src/pages/tools/DeckChangePage.jsx`** — the tool UI:
   - Two `DeckPasteImport` panels: "Current deck" (prefills from `useIncomingDeck()` when present) and "Target deck".
   - Render the diff: a cuts column and an adds column with per-card count deltas, plus a totals line and an ink/curve shift summary (reuse existing helpers).
   - "Copy changes" button → clipboard as text (e.g. `-2 Card`, `+2 Card`).
   - Empty/one-sided states handled gracefully.
3. **`src/test/deckDiff.test.js`** — cover: count deltas both directions, cards only in A, cards only in B, identical lists (all unchanged, changed=0), case/whitespace-insensitive name matching.

## Constraints
- No new dependencies.
- Do not touch `src/App.jsx` or other milestones' files.
- Keep the full suite green (`npx vitest run`).
- Match existing Tailwind + CSS-variable styling.

## Done criteria
- `/tools/deck-change` renders; pasting two lists shows correct cuts/adds; "Analyze this deck" from the Deck Lab prefills the current side.
- `deckDiff` tests + full suite pass.
- End with a concise summary of files changed and any decisions/uncertainties.
