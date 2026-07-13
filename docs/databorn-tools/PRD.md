# PRD — Competitive Tools Suite (Tiers 1 & 2)

**Status:** Draft · **Owner:** Larry · **Date:** 2026-07-13
**Inspiration:** [databorn.ink](https://databorn.ink) tool suite (self-contained tools only; the live-data tools — Meta Calculator, Market Data — are explicitly **out of scope** here as Tier 3).

---

## 1. Summary

Add five competitive-player utilities to Uninkable as a **deck-aware hybrid**: each tool is reachable standalone from a new **Tools** hub, and also wires into the Deck Lab so it can operate on the deck you're currently building or a saved deck.

The five tools, none of which depend on scraping third-party sites:

| # | Tool | Tier | Data source | Effort |
|---|------|------|-------------|--------|
| 1 | Hypergeometric Calculator | 1 (pure math) | none | S |
| 2 | Swiss Tournament Simulator | 1 (pure math) | none | M |
| 3 | Deck Change Calculator | 1 (pure math) | none | S |
| 4 | Proxy Card Creator | 1 (client + Lorcast) | Lorcast (already integrated) | M |
| 5 | Performance Analyzer | 2 (user upload) | user's own CSV | M |

**Why these:** high competitive value, zero external-data risk, and they lean on infrastructure the app already owns (Lorcast card layer, `parseDeckText`, Recharts, deck state).

---

## 2. Goals & non-goals

### Goals
- Ship all five tools behind a `/tools` hub with a consistent card-grid landing (mirrors databorn's UX).
- Make tools **deck-aware**: from the Deck Lab, an "Analyze this deck" action opens the relevant tool prefilled with the active list; from My Decks, a saved deck can be sent to a tool.
- Reuse existing primitives — no new decklist parser, no new charting lib, no duplicate card fetching.
- Keep each tool a **standalone route component**, not new code inside the `App.jsx` monolith.

### Non-goals (this PRD)
- **Meta Calculator** and **Market Data** (Tier 3) — they require live third-party feeds (Duels.ink, Lorcanito, InkDecks, TCGPlayer) via server-side proxies, plus cron + historical DB storage + ongoing maintenance and ToS review. Tracked separately.
- No account-gating: these tools should work for logged-out users too (deck-aware features that need a saved deck naturally require login, but the calculators themselves do not).
- No mobile-app-specific work beyond the responsive behavior the app already has.

---

## 3. Architecture: deck-aware hybrid

```
Tools hub (/tools)
  ├─ /tools/hypergeometric
  ├─ /tools/swiss
  ├─ /tools/deck-change
  ├─ /tools/proxy
  └─ /tools/performance
        ▲
        │  deck context bridge (query param or in-memory handoff)
        │
Deck Lab (/builder) ──► "Analyze this deck ▸" menu ──► opens tool with current list prefilled
My Decks (/my-decks) ──► "Send to tool ▸" ──────────► opens tool with saved list prefilled
```

**Deck handoff contract.** A single shared representation flows between the Deck Lab, My Decks, and every tool:

```
DeckPayload = {
  cards: Array<{ name: string, count: number, cardId?: string }>,
  meta?: { name?: string, inks?: string[], deckId?: string }
}
```

- Tools accept a `DeckPayload` via (a) in-memory navigation state (`useNavigate('/tools/x', { state })`) for same-session handoff, and (b) a compact URL param for shareable/deep-link entry, decoded back into a `DeckPayload`.
- Standalone entry (no payload) shows a paste box / import UI that produces the same `DeckPayload` using the existing `parseDeckText` → `summarizeNamedCards` pipeline.

This means **one integration path**; each tool just consumes a `DeckPayload`.

---

## 4. Tool specifications

### 4.1 Hypergeometric Calculator (`/tools/hypergeometric`)
**Problem:** "How often do I open my key card / combo?" Players guess instead of computing.

**Functional requirements**
- Deck size input (default 60; prefilled from `DeckPayload` total when deck-aware).
- One or more **card groups**, each: label, copies in deck, and desired min/max in the drawn set.
- Model **Lorcana's opening**: 7-card hand + the bottom-and-draw mulligan (alter any number of the 7 by putting them on the bottom and redrawing that many). Toggle for "after mulligan."
- Turn-based draws: probability of hitting by turn *N* (opening 7 + 1 per turn on the draw, account for on-the-play skipping first draw).
- Optional **scry sources** (e.g. Develop Your Brain–style bottom/top manipulation) modeled as extra effective looks.
- Output: exact joint probability + a small "by turn" table/curve (Recharts).

**Deck-aware:** when opened from a deck, auto-populate deck size and let the user click cards from the list to seed a group (with correct copy counts).

**Out of scope:** simulating full game sequencing; only draw combinatorics.

---

### 4.2 Swiss Tournament Simulator (`/tools/swiss`)
**Problem:** "If I go X-Y, do I make Day 2 / top cut? Is an intentional draw safe?"

**Functional requirements**
- Inputs: player count, number of Swiss rounds, your current record, optional per-round win probability (default 50%, or pull an estimate later from a deck's meta EV once Tier 3 exists).
- **Monte Carlo** simulation (configurable iterations, sane default e.g. 10k) producing:
  - Final points distribution.
  - Probability of finishing in top-N / hitting a points threshold.
  - Tiebreaker (OMW%) sensitivity — approximate.
  - Intentional-draw safety window: given your record and round, does drawing still make cut.
- Results as summary stats + histogram (Recharts). Runs client-side in a Web Worker to keep UI responsive.

**Deck-aware:** none required (deck-agnostic); may later accept a per-matchup win-rate vector from Tier 3.

**Out of scope:** exact real-world tiebreaker rules across every organizer; approximate OMW model is acceptable, clearly labeled.

---

### 4.3 Deck Change Calculator (`/tools/deck-change`)
**Problem:** "I'm transitioning from list A to list B — what do I cut and add?"

**Functional requirements**
- Two `DeckPayload` inputs (A = current, B = target), each via paste/import or deck handoff.
- Compute the diff: cards to **cut** (in A not B, or higher count in A), cards to **add** (in B not A, or higher count in B), and unchanged.
- Show counts delta per card, total cards changed, and ink/type/curve shift summary (reuse existing curve/stat helpers).
- Copy-to-clipboard of the change list.

**Deck-aware:** "current" side prefills from the active Deck Lab deck or a chosen saved deck; "target" pasted or chosen from My Decks.

**Out of scope:** suggesting *which* cards to change (that's the AI/meta layer).

---

### 4.4 Proxy Card Creator (`/tools/proxy`)
**Problem:** Players need cheap playtest proxies before buying cards.

**Functional requirements**
- Build a proxy set by (a) searching cards (existing Lorcast search) or (b) pasting/importing a decklist (`DeckPayload`).
- Render a **print-ready 3×3 grid**, standard card size (2.5"×3.5"), on Letter/A4 pages, exported as **PDF**.
- Two render modes: **image proxies** (Lorcast card image) and **text-only proxies** (name, cost, ink, type, stats, rules text) for when images are undesirable/unavailable.
- Respect card counts (4 copies → 4 slots), paginate across sheets, page-break correctly.
- Client-side generation (no server); a new PDF dependency (`pdf-lib` preferred — smaller, no canvas hacks).

**Deck-aware:** "Proxy this deck" from Deck Lab / My Decks prefills the full list.

**Legal/attribution:** clearly label output as proxies for playtesting; keep the Ravensburger Community Code attribution the app already carries. Do not add sale/monetization.

**Out of scope:** bleed/crop marks tuning beyond basic printable margins in v1.

---

### 4.5 Performance Analyzer (`/tools/performance`)
**Problem:** "Where am I actually losing?" Players have game logs (e.g. Duels.ink CSV export) but no analysis.

**Functional requirements**
- Upload a game-history **CSV** (client-side parse; no upload to server needed for v1).
- Column mapping step (tolerant to schema drift): detect/date, my deck, opponent deck, result, on-play/on-draw, notes.
- Analytics:
  - Overall win rate; win rate by **my deck** and by **matchup**.
  - **Play/draw** split win rates.
  - **Session/time trends** (win rate over time; rolling average).
  - **Tilt detection** heuristic (e.g. win-rate drop across consecutive games in a session).
  - Simple card/deck-level notes surfacing if present.
- Charts via Recharts; all computation client-side.
- **Shareable snapshot**: export a summary image/PDF (reuse Proxy Creator's PDF path or existing `deckImage.js` pattern).

**Deck-aware:** optional — if a deck name in the CSV matches a saved deck, link through.

**Out of scope:** persisting uploaded history to the DB; ingesting formats other than CSV in v1 (design the parser to be extendable).

---

## 5. Shared components & infra

- **Tools hub page** (`/tools`): grid of tool cards (title, tag, one-line, icon) mirroring databorn's landing. Add "Tools" to `TopNav` in `RouterApp.jsx`.
- **Deck context bridge** (`src/lib/deckPayload.js`): `toPayload(deckState)`, `encodePayload`/`decodePayload` (URL-safe), and a hook `useIncomingDeck()` that reads router state or URL param.
- **DeckPasteImport** shared component: paste box + "from My Decks" picker → `DeckPayload`, built on `parseDeckText` + `summarizeNamedCards`.
- **PDF export util** (`src/lib/pdf.js`): thin wrapper over `pdf-lib` used by Proxy Creator and Performance snapshot.
- **CSV parser util** (`src/lib/csv.js`): minimal, dependency-light (or `papaparse` if we prefer robustness).

---

## 6. Success metrics
- All five tools reachable, functional, and unit-tested (probability math + diff logic + CSV parse have deterministic tests).
- "Analyze this deck" round-trip works from Deck Lab and My Decks with zero re-entry of the list.
- No regression to the existing 119-test suite; new pure-logic modules covered.
- Proxy PDF prints at correct physical card dimensions (verified on a real printout or ruler-checked PDF).

## 7. Risks
- **App.jsx coupling:** the Deck Lab is a 9,500-line monolith; exposing the active deck as a `DeckPayload` requires a clean read-only accessor, not deeper entanglement. Mitigation: add one small export bridge, don't refactor the monolith.
- **PDF fidelity:** physical sizing and print margins vary by browser/printer. Mitigation: fixed point-based layout in `pdf-lib`, test with an actual print.
- **CSV schema drift:** Duels.ink export format may change. Mitigation: explicit column-mapping step, tolerant parser.
- **Bundle size:** `pdf-lib` (+ optional `papaparse`) add weight. Mitigation: lazy-load tool routes (`React.lazy`) so the calculators don't bloat the main bundle.
