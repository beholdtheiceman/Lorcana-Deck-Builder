# Implementation Plan — Competitive Tools Suite (Tiers 1 & 2)

Companion to [PRD.md](./PRD.md). Ordered so shared plumbing lands first, then quick wins, then the heavier tools. Every tool is a **lazy-loaded route component** under `src/pages/tools/` — nothing new goes into the `App.jsx` monolith.

**Total estimate:** ~2–3 focused weeks solo. Milestones are independently shippable.

---

## Tech decisions

| Concern | Decision | Reason |
|---|---|---|
| Charts | **Recharts** (already a dep) | No new lib; used across app already. |
| Decklist parsing | Reuse `api/_lib/deckTextParse.js` (`parseDeckText`) + `summarizeNamedCards` | Already tested; single source of truth. |
| PDF | Add **`pdf-lib`** | Pure JS, no canvas, precise point-based sizing for print. |
| CSV | **`papaparse`** (small) or hand-rolled `src/lib/csv.js` | Robust quoting/edge cases; decide at M5 start. |
| Heavy compute | **Web Worker** for Swiss Monte Carlo | Keeps UI responsive at 10k+ iterations. |
| Routing | `React.lazy` + `Suspense` per tool route | Keeps calculators out of the main bundle. |
| Card data | Existing `cardsApi.js` (Lorcast) | Already normalized (`cost`, `inks`, `type`, `image_url`, `inkable`, stats). |

New dependencies to add: `pdf-lib`, and (pending M5) `papaparse`.

---

## Milestone 0 — Shared plumbing (foundation)
*Blocks everything. ~2 days.*

1. **Route + nav scaffolding**
   - Add `Tools` to `NAV_ITEMS` in `src/RouterApp.jsx`.
   - Add routes: `/tools` (hub) + five child routes, each `React.lazy`-loaded under `<Suspense>`.
   - `src/pages/tools/ToolsHubPage.jsx` — reuse the tool-card grid pattern from `LandingPage`/hub styling.
2. **Deck payload bridge** — `src/lib/deckPayload.js`
   - `toPayload(deckState)` → `DeckPayload` (see PRD §3).
   - `encodePayload(payload)` / `decodePayload(str)` — URL-safe (base64url of a compact `{n,c}[]`).
   - `useIncomingDeck()` hook — reads `location.state.deck` first, else `?deck=` param, else `null`.
   - **Unit tests:** round-trip encode/decode, empty/oversized guard.
3. **Deck Lab export hook** — smallest possible read-only accessor
   - In `App.jsx`, expose the current deck as a `DeckPayload` via an existing context or a thin callback (no refactor of `AppInner`). Add an **"Analyze this deck ▸"** menu in the deck panel header (next to the recently added Save button) that navigates to a chosen tool with `{ state: { deck } }`.
4. **Shared import component** — `src/components/tools/DeckPasteImport.jsx`
   - Paste box + "From My Decks" picker → `DeckPayload` (via `parseDeckText` + name resolution).
   - Used as the standalone-entry fallback by every deck-aware tool.

**Exit check:** navigate `/tools`, open each stub route, and confirm a deck handed from the Deck Lab arrives as a `DeckPayload` in a stub tool.

---

## Milestone 1 — Deck Change Calculator (quick win)
*Smallest real tool; proves the payload bridge end-to-end. ~1 day.*

- `src/lib/deckDiff.js` — pure: `diff(a: DeckPayload, b: DeckPayload)` → `{ cuts, adds, unchanged, totals, curveShift }`.
- `src/pages/tools/DeckChangePage.jsx` — two `DeckPasteImport` panels, diff table, copy-to-clipboard, ink/curve shift summary (reuse existing curve/stat helpers from `deckCharts.jsx`/`DeckStats.jsx`).
- **Tests:** `deckDiff` with count deltas, disjoint lists, identical lists.

**Verify:** paste two known lists; confirm cut/add math by hand.

---

## Milestone 2 — Hypergeometric Calculator
*Pure math, high value. ~2–3 days.*

- `src/lib/hypergeometric.js` — pure functions:
  - `hypergeom(N, K, n, k)` and multivariate joint probability for multiple groups with min/max.
  - `mulliganAdjust(...)` modeling bottom-and-draw redraw.
  - `byTurn(...)` — probability of satisfying constraints by turn *t* (opening 7, +1/turn, on-play skip), optional scry "extra looks".
- `src/pages/tools/HypergeometricPage.jsx` — deck-size field, dynamic card-group rows, "after mulligan" toggle, by-turn Recharts line, exact-probability readout. Deck-aware: click cards from an incoming `DeckPayload` to seed groups with correct copy counts.
- **Tests:** known closed-form cases (single group), multi-group joint against brute-force enumeration for small N.

**Verify:** cross-check a couple of values against an external hypergeometric calculator.

---

## Milestone 3 — Proxy Card Creator
*First tool needing a new dep + print correctness. ~2–4 days.*

- Add `pdf-lib`. Create `src/lib/pdf.js` wrapper.
- `src/lib/proxyLayout.js` — pure layout math: card = 180×252 pt (2.5"×3.5"), 3×3 per Letter/A4 page, margins, pagination from a `DeckPayload` (expanded by count).
- `src/pages/tools/ProxyPage.jsx`:
  - Build set via existing Lorcast search **or** `DeckPasteImport`.
  - Toggle **image** vs **text-only** proxies.
  - "Download PDF" → `pdf.js` renders pages (embed Lorcast images for image mode; draw text blocks for text mode).
- Deck-aware: "Proxy this deck" entry.
- **Tests:** `proxyLayout` pagination (e.g. 60 cards → 7 pages, last page partial), slot positions.

**Verify:** open the generated PDF, ruler-check a card = 2.5"×3.5"; print one page.

---

## Milestone 4 — Swiss Tournament Simulator
*Monte Carlo in a Worker. ~3–4 days.*

- `src/lib/swiss.js` — pure sim core: given players/rounds/record/win-prob, run N iterations → points distribution, top-N probability, threshold odds, approximate OMW% band, intentional-draw safety.
- `src/workers/swiss.worker.js` — runs `swiss.js` off the main thread; message in params, post back results.
- `src/pages/tools/SwissPage.jsx` — inputs, run button, histogram + summary stats (Recharts). Progress indicator while the worker runs.
- **Tests:** `swiss.js` determinism with a seeded RNG; sanity (50% win prob over R rounds centers on R/2 points).

**Verify:** run a known scenario (e.g. 9 rounds, 6-3 needed for cut) and sanity-check the probability.

---

## Milestone 5 — Performance Analyzer
*User CSV → analytics. ~1 week (analytics depth is the work).*

- Decide CSV lib (`papaparse` recommended). `src/lib/csv.js` if hand-rolled.
- `src/lib/performanceStats.js` — pure: from normalized rows → overall/by-deck/by-matchup win rates, play/draw splits, time-series with rolling average, tilt heuristic.
- `src/pages/tools/PerformancePage.jsx`:
  - Upload → **column-mapping** step (tolerant to schema drift) → analytics dashboard (Recharts).
  - "Export snapshot" (reuse `pdf.js` or `deckImage.js`).
- Deck-aware: link matching deck names to saved decks.
- **Tests:** `performanceStats` on a fixture CSV (known win rates, play/draw, tilt trigger); parser handles quoted fields, missing columns, empty file.

**Verify:** feed a small hand-made CSV with known outcomes; confirm every stat.

---

## Sequencing rationale
- **M0 first** — the payload bridge is the backbone; every deck-aware tool depends on it.
- **M1 (Deck Change)** next — cheapest tool, validates the bridge before investing in bigger tools.
- **M2 (Hypergeometric)** — pure math, high daily value, no new deps.
- **M3 (Proxy)** — introduces PDF; isolated risk (print fidelity) contained to one milestone.
- **M4 (Swiss)** — introduces the Worker pattern; independent of the others.
- **M5 (Performance)** last — largest surface area and the only one with external file-format tolerance to design for.

## Testing & verification strategy
- **Unit:** all `src/lib/*` modules are pure and get deterministic Vitest coverage (probability, diff, layout, swiss, stats, csv, payload codec). Keep the suite green (currently 119).
- **Runtime:** for each UI milestone, `npx vite preview` and exercise the flow in the browser; for Proxy, verify an actual PDF/print; for Swiss, watch the Worker doesn't block the UI.
- **Regression:** run `npx vitest run` after each milestone.

## Rollout
- Land milestones as separate commits/PRs on a `feature/tools-suite` branch off the current work.
- Ship behind the `/tools` route from M0; each milestone lights up its route. No prod deploy until you explicitly say "deploy" (per project rules) — and only after the print check and a green suite.

## Explicitly deferred (Tier 3, separate project)
Meta Calculator and Market Data — require serverless proxies to Duels.ink/Lorcanito/InkDecks/TCGPlayer, daily cron snapshots into Neon, historical tables, and ToS/attribution review. Not part of this plan.
