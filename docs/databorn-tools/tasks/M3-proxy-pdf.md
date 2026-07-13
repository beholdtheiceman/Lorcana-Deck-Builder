# Task M3 — Proxy Card Creator

Implementing engineer. Milestone 3 from `docs/databorn-tools/PLAN.md`. M0–M2 merged. Implement exactly this scope.

## Build on what exists
- `src/lib/deckPayload.js` (`DeckPayload`, `useIncomingDeck`), `src/components/tools/DeckPasteImport.jsx`.
- Card catalog via `fetchAllCards` (`src/lib/cardsApi.js`) — cards have `image_url`, `name`, `cost`, `inks`, `type`, `text`, `rarity`, stats. Reuse the StrictMode-safe fetch pattern from `DeckChangePage.jsx`.
- `src/pages/tools/ProxyPage.jsx` is a stub — replace it.
- **`pdf-lib` (v1.17.1) is already installed** — use it. Do NOT add any other dependency.

## Deliverables
1. **`src/lib/proxyLayout.js`** — pure layout math (no pdf-lib, no React):
   - Card size = 180×252 pt (2.5"×3.5"), 3×3 grid per page. Support Letter (612×792 pt) and A4 (595×842 pt) with centered margins and a small gutter.
   - `paginate(items, perPage = 9)` and slot-position helpers: given N expanded cards, return pages each with up to 9 `{ x, y, w, h }` slots in points.
   - Deterministic and unit-testable.
2. **`src/lib/pdf.js`** — thin wrapper over `pdf-lib`:
   - Build a multi-page PDF from a list of proxy cards using `proxyLayout`. Two render modes:
     - **image**: embed each card's Lorcast image (fetch bytes → `embedPng`/`embedJpg`; detect type; on fetch/embupt failure fall back to that card's text box so one bad image doesn't abort the whole PDF).
     - **text-only**: draw a bordered box with name, cost, ink(s), type, stats, and wrapped rules text.
   - Return a `Uint8Array`/Blob the page can download.
3. **`src/pages/tools/ProxyPage.jsx`** — the tool UI:
   - Build the proxy set via (a) existing Lorcast card search or (b) `DeckPasteImport`; expand by card count (4 copies → 4 slots).
   - Toggle **image** vs **text-only**; page-size selector (Letter/A4).
   - "Download PDF" triggers generation and downloads the file. Show a progress/disabled state during generation.
   - Deck-aware: "Proxy this deck" prefills from `useIncomingDeck()`.
   - Label the output as playtest proxies; keep it non-commercial.
4. **`src/test/proxyLayout.test.js`** — pagination math: e.g. 60 cards → 7 pages (last page 6 slots), slot coordinates for the first page, Letter vs A4 differences.

## Constraints
- No new dependencies beyond the already-installed `pdf-lib`.
- Do not touch `src/App.jsx` or other milestones' files.
- Keep the full suite green (`npx vitest run`).
- Match existing Tailwind + CSS-variable styling.

## Done criteria
- `/tools/proxy` renders; building a set and clicking Download produces a valid multi-page PDF with correctly sized 3×3 cards; text-only mode works without images.
- `proxyLayout` pagination has passing unit tests.
- End with a concise summary of files changed and any decisions/uncertainties (call out any CORS/image-embedding caveats you hit).
