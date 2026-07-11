# Uninkable — Implementation Plans (Step 2)

Companion to `POSTMORTEM.md`. Plans are grouped into clusters, ordered by priority (P0 → P4), and each task is tiered:

- **OPUS_SAFE** — well-defined, self-contained, verifiable by the subagent itself (with a "stop if ambiguous" instruction).
- **FABLE_SUPERVISED** — cross-system judgment, security-sensitive, subtle tradeoffs, or calibration needing oversight. Done by the orchestrator directly.

Verification gate after **every** cluster: `npx vitest run` must stay green (baseline 152/22). Security fixes also get a reasoning trace or a targeted test.

---

## Priority order (why this sequence)

1. **P0 — Security & data-loss** must land first: they're live exploits (arbitrary deck deletion, team-wipe cascade) that any later work could otherwise ship on top of.
2. **P1 — Silent-broken features & permission cascade**: things users think work but don't (hub permissions, digest, post-reset login, text import).
3. **P2 — Correctness & hardening**: races, stale closures, validation, rate limiting.
4. **P3 — Architecture enablers**: resolve the circular import, introduce the LLM gateway, the token system, card-DB + deck-versioning groundwork. These unlock the from-scratch north star incrementally.
5. **P4 — UI redesign**: adopt the approved three-comp design system (tokens → shared primitives → per-surface restyle).

Dependencies: P3 monolith-split is **blocked by** H9 (circular import) and the token system. Deck-versioning (P3) is **blocked by** the card-DB decision. UI redesign (P4) is **blocked by** the token system (P3).

---

## P0 — Security & data loss  *(all FABLE_SUPERVISED — security-critical)*

- **P0.1 [FABLE] C1 arbitrary deck deletion** — `api/hubs/[id]/decks.js` DELETE: compute `memberIds` (as GET does) and scope delete to `deckId` + membership; non-owners restricted to own decks. Add a regression test asserting a non-member deck is untouched.
- **P0.2 [FABLE] H1 team-wipe cascade** — `prisma/schema.prisma:73` `onDelete: Cascade` → `Restrict`; add a hand-applied SQL note (matches repo's db-push convention). Judgment: whether to also add `SetNull` + ownership transfer (defer transfer UI to P3).
- **P0.3 [FABLE] H3 Discord review injection** — `api/discord/interactions.js`: require the Discord user map to a hub member before writing a Review; reject otherwise. Judgment: how identity mapping should work (may downgrade to "disable write until mapping exists").

## P1 — Silent-broken features & permission cascade

- **P1.1 [OPUS_SAFE] C2 dead `user` key** — `src/pages/HubDetailLayout.jsx:25` → `const { user } = useAuth()`. Mechanical, verifiable (grep + render).
- **P1.2 [OPUS_SAFE] H8 post-reset login** — `src/pages/ResetPasswordPage.jsx`: replace non-existent `refreshUser` with `checkAuth` from `useAuth()`. Mechanical.
- **P1.3 [OPUS_SAFE] H2 digest typo** — `api/hubs/digest.js:16` `playTestGame` → `playtestGame`. One-char class of fix; verifiable against schema.
- **P1.4 [FABLE] C3 + H4 text import** — `App.jsx parseTextImport`: declare/derive the missing vars AND repoint resolution from `shownCards` to `allCards`. FABLE because it's inside the monolith's highest-risk pipeline and the two bugs interact.

## P2 — Correctness & hardening

- **P2.1 [FABLE] H5 stale-closure shortcuts** — `App.jsx:5477-5507`: ref-based handlers. Monolith judgment.
- **P2.2 [FABLE] H6 double ImageCacheProvider** — remove inner provider (`App.jsx:6272`). Monolith judgment (which provider is canonical).
- **P2.3 [OPUS_SAFE] H7 replay bounds** — `api/replays/index.js`: add `take`, drop `parsed` from list; `replayParse.js`: cap decompressed size. Self-contained + testable against the existing replay fixture.
- **P2.4 [OPUS_SAFE] Pod delete guard** — add `createdById` to `Pod` + guard `api/pods/[id].js` DELETE to creator-or-owner, mirroring Practice. Self-contained.
- **P2.5 [OPUS_SAFE] Deck input validation** — zod schema + size cap in `api/decks/index.js`. Self-contained.
- **P2.6 [FABLE] Rate limiting** — introduce a shared limiter (Upstash/@vercel/kv or in-memory fallback) on auth + join endpoints. FABLE: infra choice + calibration of limits.
- **P2.7 [OPUS_SAFE] Reset-token hardening** — store SHA-256 of token, look up by hash (`forgot-password.js` + `reset-password.js`). Self-contained, verifiable.
- **P2.8 [OPUS_SAFE] Env docs** — add the 3 missing vars to `env.example`; guard `RESEND_FROM_EMAIL`; pin reset-link host to the canonical domain. Self-contained.
- **P2.9 [OPUS_SAFE] Dead-code deletion** — remove `DeckViewModal.jsx`, ImportModal `savedLorcanaDecks` section, collapse `TeamHub.jsx` into `HubListPage` OR delete if unused. FABLE if collapse touches live routes → verify caller graph first.

## P3 — Architecture enablers  *(mostly FABLE; these are the north-star adoption)*

- **P3.1 [FABLE] LLM gateway** — one module owning model id, max_tokens, thinking, retries, `stop_reason` handling, single Anthropic client. Migrate all 5 call sites. **Blocked-by:** confirm `claude-sonnet-5`+`adaptive` validity first (§8 unknown).
- **P3.2 [FABLE] Resolve circular import (H9)** — extract the 14 shared helpers out of `App.jsx` into `src/lib`/`src/components`; repoint `DeckPresentationView`. Prereq for any monolith split.
- **P3.3 [FABLE] Token system** — single `src/tokens.css` (the comp's tokens), Tailwind consumes it, delete the duplicate `--bg` across index.css/styles.css. Prereq for P4.
- **P3.4 [FABLE] Card DB + deck versioning groundwork** — nightly ingest of Lorcast → Postgres; `DeckVersion`/`DeckCard` relational model behind the existing `Deck.data` blob (additive, non-breaking). Large; spec separately before building.

## P4 — UI redesign  *(design comps approved; build on P3.3 tokens)*

- **P4.1 [OPUS_SAFE] Shared primitives** — Button, Panel, hex/ink glyphs, ink-ledger, curve chart, as token-driven components matching the comps. Self-contained once tokens exist.
- **P4.2 [FABLE] Per-surface restyle** — Deck detail, Team Hub, Deck Lab per the three approved comps. FABLE: layout judgment, incremental rollout behind the live app.

---

## Execution notes
- Batch OPUS_SAFE tasks by file locality to avoid redundant subagent context cost.
- Every Opus prompt: fully self-contained + "Only perform tasks you can fully understand and verify. If anything is ambiguous, underdefined, or requires judgment beyond the spec, stop and say so rather than guessing."
- HANDOFF.md written at each pause / after each cluster.
- Commit per cluster with explicit pathspecs (never `git add -A` per project rules); commit author `sportlarry@gmail.com`.
