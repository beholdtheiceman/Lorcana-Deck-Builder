# Post-mortem: Team Hub Review Workflow + AI Agent (2026-07-04)

Scope: the replay-review pipeline (`api/replays`, `api/reviews/*`, `api/_lib/replayParse.js`,
`api/_lib/reviewContext.js`, `api/_lib/cards.js`) and the review agent's grounding context.
Trigger: user request to give the review agent deck-list context. Investigation found the
agent's existing grounding is substantially broken, so those fixes are prerequisites.

---

## Findings

### A. CRITICAL (correctness) — Card oracle is 100% non-functional for duels.ink replays

- `api/_lib/replayParse.js` `normalizeGame()` (~lines 248–302): every raw frame's
  `takenAction` carries `cardId` ("set-num", e.g. `"11-163"`) — verified against the real
  fixture `src/test/fixtures/duels-match-replay.zip`. The normalizer **drops the id** and
  stores only `card: cardName` (a display name). ATTACK frames carry
  `attackerCardId`/`defenderCardId`; also dropped.
- `api/_lib/reviewContext.js` `cardIdsOf()` (149–161) collects `entry.card` (a *name*) as if
  it were an id; `renderCard()` (109–120) resolves via `getById()` which only accepts
  `"set-num"` keys (`api/_lib/cards.js:53–58`, keyed off `public/data/cards.min.json`).
- Net effect: the `--- CARD ORACLE ---` section renders **"unknown — do not infer"** for
  every card, and `renderEntry()` (174–189) appends `[cards: unknown, unknown]` to every log
  line. The system prompt says "Ground every claim in the provided log and card text" — there
  is no card text. Reviews are generated from action strings alone.
- Fix: keep `cardId` on events in the parser; make `renderCard` fall back to `getByName`;
  don't collect the name when the id is present (prevents duplicate "unknown" glossary rows).

### B. CRITICAL (missing integration) — Deck list is captured but never used

- `normalizeGame()` extracts `decklistMe` — the full 60-card list of the perspective player,
  as card ids (`replayParse.js:246`, returned at `:357`; test-verified). **Nothing consumes
  it.** `buildReviewContext()` never renders it; `api/reviews/index.js` never reads it.
- There is no deck-understanding capability anywhere server-side: nothing maps a decklist to
  an archetype, game plan, or key-card set. Archetype detection is ink-colors-only
  (`replayParse.js:335–338` → e.g. `"Amber/Steel"`), which does not match the archetype names
  used by the knowledge base (`src/data/agent-knowledge/meta-archetypes.md` uses names like
  "Dogs (Amber/Emerald)", "Blurple (Amethyst/Sapphire)"). Auto-primer matchup labels are
  therefore misaligned with the playbooks that describe them.
- Opponent deck: opp's revealed cards exist in events but are never summarized for the agent.
- `Deck` model (`prisma/schema.prisma:51`) stores full user decks
  (`data.entries[key] = {card, count}`) but there is no Replay↔Deck or Review↔Deck relation
  and no UI to attach one. (Non-blocking: for duels.ink replays, `decklistMe` IS the deck.)

### C. HIGH (missing integration) — Review agent has no knowledge base

- Review `SYSTEM_PROMPT` (`api/reviews/index.js:20–23`, duplicated in `[id].js:12–15`) is
  three sentences. The 124 KB curated knowledge dir (`src/data/agent-knowledge/`:
  role-theory, game-state-evaluation, gameplay-heuristics, archetype-playbooks, synergy-theory,
  tech-cards…) is used **only** by `autoGeneratePrimer()`, and only 3 of 10 files, each
  truncated to its first 4000 chars (`index.js:223–227`) — an arbitrary mid-document cut
  (meta-archetypes.md is 11.9 KB, so tier-2/3 archetypes are silently absent).

### D. HIGH (architectural fragility + one real bug) — Duplicated generation pipeline

- `api/reviews/index.js` and `api/reviews/[id].js` each carry private copies of: `MODEL`,
  `MAX_CONTEXT_CHARS`, `MAX_TOKENS`, `SYSTEM_PROMPT`, `ModelOutSchema`, `callModel()`,
  `extractJson()`, and the user-instruction template. Any context improvement must be made
  twice; they have already drifted:
- **Drift bug:** `[id].js:88–90` refuses to regenerate unless `review.primerId` is set. Reviews
  generated via the auto-primer path store `primerId: null` (`index.js:200`,
  `savedPrimerId` is only set for user-supplied primers) — so **every auto-primer review is
  permanently un-regenerable** (400 "no linked replay/primer").
- `findGame()` duplicated between `index.js:273–286` and `reviewContext.js:123–139`.

### E. MEDIUM (calibration) — Context truncation cuts the endgame

- Context order is header → primer → oracle → game log; over-budget contexts are sliced from
  the END (`index.js:168–169`, `[id].js:100–102`). When a long game overflows
  `MAX_CONTEXT_CHARS`, the **late turns — where the game is decided — are silently dropped**,
  while every early inking action survives. No log/warning is emitted.

### F. LOW — hygiene

- `index.js:100–110`: leftover `[review-debug]` block logs replay internals on every generate.
- `index.js:144`: `replay.playerDeck` fallback — column does not exist on `Replay`; dead code.
- `game.logs` (duels.ink message log — mulligans, draws, triggers) are parsed and stored but
  never fed to the agent (token-budget tradeoff; noted, not scheduled).
- `llmBudget` check-then-record is non-atomic; concurrent generates can overshoot the monthly
  cap by one request each. Acceptable at team scale; noted only.

---

## Implementation plans

| # | Plan | Priority rationale | Tier |
|---|------|--------------------|------|
| 1 | **Card identity pipeline** — parser keeps `cardId`/`attackerCardId`/`defenderCardId`; `renderCard` falls back to name lookup; suppress duplicate name-collection when id present; tests | Everything downstream (deck sections, oracle glossary) needs id→card resolution to work | OPUS_SAFE |
| 2 | **Unify LLM pipeline** — extract `api/_lib/reviewLlm.js` (constants, schema, callModel, extractJson, instruction builder, truncation); both endpoints import it; delete debug block + dead fallback | Must land before deck-context work so the upgrade is written once, not twice | OPUS_SAFE (pure extraction) |
| 3 | **Deck context + deck understanding** — new `api/_lib/deckContext.js`: render `decklistMe` (counts × name/cost/type/text via oracle), infer deck profile (curve, colors, engine cards), match against knowledge-base archetypes; add "opponent revealed cards" section; system-prompt upgrade to coach against the deck's game plan; regenerate-without-primer fix (D's drift bug); dedupe `findGame` | The user's headline feature; depends on 1 & 2 | FABLE_SUPERVISED (archetype matching + prompt calibration) |
| 4 | **Knowledge integration + truncation calibration** — give the review call relevant knowledge excerpts (role theory, game-state eval) sized to token budget; make truncation preserve the endgame (trim oracle bodies / early-turn detail first, keep final turns) | Quality layer on top of 3; calibration-heavy | FABLE_SUPERVISED |

Execution order: 1 & 2 in parallel (disjoint files) → review → 3 → 4 → full test pass.
