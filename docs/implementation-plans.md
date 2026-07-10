# Implementation plans — remaining work (2026-07-02)

Classification legend:
- **OPUS-ALONE** — self-contained, mechanically verifiable; an Opus subagent can evaluate
  and fully understand the whole task. Fable reviews the diff afterward.
- **OPUS+FABLE** — Opus executes bounded steps, Fable supervises sequencing, reviews each
  commit, and runs runtime verification before the next step.
- **FABLE** — judgment-heavy or touches prod state; Fable does it directly.
- **BLOCKED-HUMAN** — needs input only Larry can provide; see `handoff.md`.

Ground truth (verified 2026-07-02, do not trust older notes):
- `preview/team-hub-polish` is the live prod branch and a **superset** of
  `feature/replay-review` — the replay feature (all components, `api/replays`,
  `api/reviews/{index,import,[id]}.js` incl. regenerate/DELETE, primers) is already here
  and deployed. The stale `feature/replay-review` branch must NOT be merged (it would
  delete newer hub pages, tests, and deckExport).
- Prod DB already has Primer/Replay/Review tables (post-cascade `migrate diff` is empty).
- `ANTHROPIC_API_KEY`, rotated `DATABASE_URL`/`JWT_SECRET`, and `CRON_SECRET` are set in
  all Vercel envs.
- Vitest is configured; tests exist for deckExport and hubJoin only.
- The lone `.tsx` (`src/components/StandingsImageImport.tsx`) is real TypeScript,
  lazy-imported extension-less from `App.jsx` (no import changes needed on rename).

---

## Order of implementation

| # | Item | Class | Status |
|---|------|-------|--------|
| 1a | `members.js` → `withAuth` | OPUS-ALONE | delegated |
| 1b | Convert `StandingsImageImport.tsx` → `.jsx` | OPUS-ALONE | delegated |
| 2 | Phase 5: extract libs from App.jsx | OPUS+FABLE | after Wave 1 |
| 3 | Tests for extracted libs | OPUS-ALONE | after #2 |
| 4 | Rate limiting (Upstash) | BLOCKED-HUMAN → OPUS-ALONE | handoff.md |
| 5 | Replay parser validation | BLOCKED-HUMAN → FABLE | handoff.md |
| 6 | Phase 6: virtualize card grid | FABLE (evaluate) → OPUS+FABLE (implement) | conditional |
| 7 | Delete stale `feature/replay-review` branch | BLOCKED-HUMAN (confirm) | handoff.md |

Rationale: 1a/1b are disjoint quick wins that de-risk nothing else. Phase 5 must precede
new tests (#3) so tests target the extracted modules, not the monolith. #4/#5 are blocked
on human input and can land any time. #6 is last because Phase 2 memoization may have
already made it unnecessary — measure first.

---

## 1a. `api/hubs/[id]/members.js` → `withAuth` (OPUS-ALONE)

**Why:** last hand-rolled auth in the API; audit wants the shared wrapper (consistent 401,
error redaction, P2025→404, ZodError→400).

**Steps**
1. Read `api/_lib/withAuth.js` and 2 existing consumers (e.g. `api/decks/index.js`) for
   the house pattern.
2. Rewrap `members.js` (204 lines): `export default withAuth(async (req, res, session) => …)`;
   delete the manual `getSession`/401 block; replace its try/catch with the wrapper's;
   keep all permission logic (owner/member checks) intact.
3. Verify: `npx vite build` green; every response path still returns same status codes
   (compare method×role matrix by reading the code).
4. Commit (author sportlarry@gmail.com), do NOT push/deploy.

**Done when:** build green, no `getSession` import remains in the file, statuses unchanged.

## 1b. `StandingsImageImport.tsx` → `.jsx` (OPUS-ALONE)

**Why:** lone TS file in a JS project; no typecheck runs so annotations are dead weight.

**Steps**
1. `git mv` to `.jsx`; strip TS-only syntax (interfaces, type annotations, generics, `as`).
   No behavior change. The extension-less lazy import in `App.jsx:57` resolves `.jsx` —
   verify no other import references the `.tsx` path.
2. Verify: `npx vite build` green; component's exported API unchanged.
3. Commit, do NOT push/deploy.

## 2. Phase 5 — extract libs from `App.jsx` (OPUS+FABLE)

**Why:** 10.9k-line monolith; extraction enables testing (#3).

**Sequencing (one module per commit, Fable runtime-verifies each before the next):**
1. `src/lib/storage.js` — localStorage read/write/migration helpers (most mechanical).
2. `src/lib/cardsApi.js` — Lorcast fetch + caching + normalization.
3. `src/lib/images.js` — image cache/URL helpers (coordinate with ImageCacheProvider).
4. `src/lib/deckCloud.js` — deck save/load/sync serverless calls.

**Rules for the Opus subagent (per module):**
- Move code verbatim; no refactoring-while-moving, no renames, no signature changes.
- Named exports; `App.jsx` imports them; zero behavior delta.
- If a candidate function closes over App.jsx component state and can't move without a
  signature change — STOP, leave it, and report it back; do not invent parameters.
- Gate: `npx vite build` green + `npx vitest run` green.

**Fable's gate between modules:** run the app (vercel dev or preview deploy), exercise the
affected surface (decks load, images render, cloud save round-trips), then dispatch the
next module.

## 3. Tests for extracted libs (OPUS-ALONE, after #2)

Vitest unit tests per extracted module: storage round-trip/migration, cardsApi
normalization + set ordering (mock fetch), deckCloud request shaping (mock fetch),
images cache eviction cap. Target: meaningful behavior coverage, not %-chasing.

## 4. Rate limiting on auth endpoints (BLOCKED-HUMAN → OPUS-ALONE)

Blocked on Larry: pick provider + provide creds (see `handoff.md`). Once
`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` (or Vercel KV equivalent) exist:
sliding-window limiter in `api/_lib/rateLimit.js` (`@upstash/ratelimit`), applied to
`login` (10/min/IP), `register` (5/hr/IP), `forgot-password` (3/hr/IP+email),
`hubs/join` (20/hr/user). Fail-open if the store is unreachable (auth must not die with
Redis), log when tripped. Then OPUS-ALONE with the creds in env.

## 5. Replay parser validation (BLOCKED-HUMAN → FABLE)

`api/_lib/replayParse.js` was built against the documented `duels-match-replay-v1` format
but has never seen a real file (flagged in-code). Needs a real duels.ink export from
Larry (`handoff.md`). Then: run parser on it, fix mismatches, add the file (sanitized) as
a test fixture, verify Stage A/B review generation end-to-end on preview. FABLE because
success criteria are judgment calls (does the parsed summary faithfully describe the game?).

## 6. Phase 6 — virtualize card grid (FABLE evaluate first)

Measure before building: after Phase 2 memoization, scroll the full catalog on a
mid-range device profile (Chrome perf trace, 4x CPU throttle). Only if jank persists:
`react-window` FixedSizeGrid behind the existing responsive auto-fill layout (inline
gridTemplateColumns — see memory: Tailwind grid classes are NOT generated for this).
Implementation then OPUS+FABLE (it touches the monolith's hottest render path).

## 7. Stale branch cleanup (BLOCKED-HUMAN)

`feature/replay-review` (+ its remote) is fully superseded. Confirm-then-delete; see
`handoff.md`.
