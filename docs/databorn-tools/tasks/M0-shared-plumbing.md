# Task M0 — Shared plumbing (foundation)

You are the implementing engineer. Read `docs/databorn-tools/PRD.md` and `docs/databorn-tools/PLAN.md` first — they are the source of truth. This task is **Milestone 0** from PLAN.md. Implement exactly this scope, no more.

## Context you must discover yourself
- Routing lives in `src/RouterApp.jsx` (react-router-dom v7). `NAV_ITEMS` and `TopNav` are there. Routes render under `AppLayout`.
- The Deck Lab is `src/App.jsx` (exported as `DeckBuilderApp`), mounted at `/builder`. It is a ~9,500-line monolith — **do not refactor it**. `AppInner` holds the deck state.
- Decklist text parsing already exists: `api/_lib/deckTextParse.js` exports `parseDeckText`. Reuse it — do not write a new parser. If it is not directly importable into client code, import the pure function or mirror it minimally; do not duplicate logic.
- Card data is loaded client-side via `src/lib/cardsApi.js` (Lorcast). Cards are normalized with `{ id, name, baseName, subname, cost, inks, type, image_url, ... }`.
- Styling uses Tailwind + CSS variables (`var(--text)`, `var(--canvas)`, `var(--line)`, `var(--muted)`, ink vars). Match the existing look (see `TopNav`, `LandingPage`).

## Deliverables (exactly these)
1. **Nav + routes** in `src/RouterApp.jsx`:
   - Add a `Tools` item to `NAV_ITEMS` (`/tools`).
   - Add a `/tools` route rendering `ToolsHubPage`, plus five child routes, each **`React.lazy`-loaded** inside `<Suspense>`:
     `/tools/hypergeometric`, `/tools/swiss`, `/tools/deck-change`, `/tools/proxy`, `/tools/performance`.
   - For M0 the five tool pages are **stub components** (heading + one line + a slot that shows any incoming deck) under `src/pages/tools/`. Real tools come in later milestones.
2. **`src/pages/tools/ToolsHubPage.jsx`** — a grid of five tool cards (icon, title, tag, one-line, link), mirroring databorn's landing grid, styled to the app.
3. **`src/lib/deckPayload.js`** — the deck handoff contract (PRD §3):
   - `DeckPayload = { cards: [{ name, count, cardId? }], meta?: { name?, inks?, deckId? } }`.
   - `toPayload(deckState)` — build a payload from the Deck Lab's deck state (discover its shape).
   - `encodePayload(payload)` / `decodePayload(str)` — URL-safe (base64url of a compact `{n,c}[]` form). Guard against oversized/malformed input (return null on bad decode).
   - `useIncomingDeck()` hook — returns a `DeckPayload` from `location.state.deck`, else the `?deck=` param, else `null`.
4. **`src/components/tools/DeckPasteImport.jsx`** — paste box + "From My Decks" picker (if a saved-decks source is readily available; otherwise paste-only for M0) that produces a `DeckPayload` via `parseDeckText` + client-side name resolution against the loaded card list. This is the standalone-entry fallback used by deck-aware tools.
5. **Deck Lab bridge** — the single allowed change to `src/App.jsx`:
   - Add a **small, read-only** accessor that yields the current deck as a `DeckPayload` (via `toPayload`).
   - Add an **"Analyze this deck ▸"** control in the deck panel header (near the existing Save button) that navigates to a chosen tool with `navigate('/tools/<x>', { state: { deck } })`.
   - Keep this surgical — no restructuring of `AppInner`.
6. **Tests** — `src/test/deckPayload.test.js`: round-trip `encode`/`decode`, empty payload, oversized/garbage decode returns null.

## Constraints
- **No new dependencies** in M0.
- Do not modify `App.jsx` beyond deliverable #5.
- Lazy-load the tool routes so they stay out of the main bundle.
- Keep the existing test suite green: `npx vitest run` must pass (was 119 passing).
- Match existing code style (2-space, no semicolons where the file omits them, functional components).

## Done criteria
- `Tools` appears in the top nav; `/tools` renders the grid; each of the 5 child routes lazy-loads its stub.
- A deck handed from the Deck Lab via "Analyze this deck" arrives in a stub tool through `useIncomingDeck()`.
- `deckPayload` round-trips; new tests + full suite pass.
- Report a concise summary of what you changed and any decisions/uncertainties at the end.
