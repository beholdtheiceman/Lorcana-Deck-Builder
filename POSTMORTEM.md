# Uninkable — Codebase Post-Mortem

**Branch:** `feature/uninkable-overhaul`
**Date:** 2026-07-11
**Method:** 6 Opus 4.8 readers fanned out over the highest-risk subsystems; every CRITICAL/HIGH below re-verified by reading the actual code (verification notes inline). Test baseline before any change: **152 passing / 22 files** (`npx vitest run`).

Severity: **CRITICAL** (data loss / account takeover / feature 100% dead) · **HIGH** (security or correctness affecting many users) · **MEDIUM** · **LOW**.

---

## 0. Executive summary

The product works, but risk is concentrated in five places:

1. **Broken authorization** — one bug lets any user delete *any* deck on the platform; another lets one account deletion wipe an entire team's data.
2. **A dead client-side `user` key** silently disables every owner/author permission across the whole Team Hub.
3. **Two 100%-dead features** shipped: the weekly Discord digest (Prisma typo) and the entire tournament-results sync (no frontend).
4. **The `App.jsx` monolith** (7,475 lines) contains a text-import path that throws `ReferenceError` on the common case, plus stale-closure and double-provider bugs — and a circular import that blocks decomposition.
5. **Systemic fragility**: no rate limiting anywhere, no CI, schema managed by `db push` with unversioned SQL, LLM plumbing hand-patched per-file, and three overlapping CSS token systems.

Nothing here needs a ground-up rewrite. The fixes are surgical; the *architecture* changes (monolith split, card DB, deck versioning, token system, agent-with-tools) are the from-scratch north star and can be adopted incrementally on top of the bug fixes.

---

## 1. CRITICAL findings (verified)

### C1 — Platform-wide arbitrary deck deletion (IDOR)
`api/hubs/[id]/decks.js:39-53`. The DELETE branch guards with `if (!ownDeck && !isHubOwner) 403`, then runs `prisma.deck.deleteMany({ where: { id: deckId } })` — **not scoped to hub members** (unlike the GET branch, which scopes to `memberIds` at line 27). Since any user can create a hub and become its owner, `isHubOwner` is trivially satisfiable.
**Exploit:** create a hub → `DELETE /api/hubs/<my-hub>/decks` with `{deckId:"<any victim deck uuid>"}` → deleted.
**✓ Verified by reading the file.** Fix: scope the delete to `deckId` **and** membership (`userId: { in: memberIds }`), or to `userId` for non-owners.

### C2 — Dead `user` localStorage key disables all hub permissions
`src/pages/HubDetailLayout.jsx:25` — `JSON.parse(localStorage.getItem('user')||'null')`. Nothing in the repo ever writes `user` to localStorage (AuthContext keeps it in React state only). **✓ Verified: grep for any `setItem('user')` returns zero.**
**Cascade:** `user` is always `null`, passed as Outlet context to every hub subpage → `isOwner`/`canDelete`/author checks are permanently false. Owners can't edit webhooks or controls; authors can never delete their own primers; the onboarding banner shows even to owners.
Fix: `const { user } = useAuth()` (HubListPage already does this correctly).

### C3 — Text import throws ReferenceError on the common path
`src/App.jsx:1435-1498` (`parseTextImport`). The ambiguous- and not-found branches read `cardSubtitle`, `cardSet`, `cardNumber` — **never declared** (only `cardName`/`count`/`fullCardName` exist). **✓ Verified: 14 read sites, zero declarations.** These are reads inside template literals → `ReferenceError`, aborting the entire paste. Triggered by any card the lookup can't resolve — which is the norm because of H4 below.
Fix: declare/derive the three vars (or remove them from the placeholder objects).

---

## 2. HIGH findings (verified)

### H1 — One account deletion wipes an entire team
`prisma/schema.prisma:73` — `owner User @relation("HubOwner", ..., onDelete: Cascade)`. **✓ Verified.** Deleting the owner's `User` cascades to `Hub`, which cascades to every hub-scoped model (replays, reviews, primers, practices, pods, meta reports, results) contributed by *all* members. There is no ownership-transfer path.
Fix: change to `onDelete: Restrict` (or `SetNull` with a nullable owner) and require ownership transfer before account/hub deletion.

### H2 — Weekly Discord digest is 100% dead
`api/hubs/digest.js:16` — `prisma.playTestGame.findMany` (wrong casing; model is `playtestGame`). **✓ Verified.** `prisma.playTestGame` is `undefined` → `.findMany` throws → swallowed by the per-hub try/catch → endpoint returns `{sent:0}` for all hubs, forever, silently.
Fix: `prisma.playtestGame` (correct casing used everywhere else).

### H3 — Discord review injection with only an invite code
`api/discord/interactions.js:77-98`. After signature verification (which only proves the request came via Discord), any Discord user can file a `Review` into any hub by supplying its `inviteCode` — no mapping from Discord user → hub member. Also sets `generatedBy:"discord"`, outside the documented `llm|agent|human` set.
Fix: correlate Discord user to a hub member before writing; reject otherwise.

### H4 — Text import resolves against filtered cards, not the catalog
`src/App.jsx:5597` binds `window.getCurrentCards = () => shownCards || []`; `parseTextImport`/`findCardByLorcanitoFormat` resolve names through it. `shownCards` is the **filtered** output of `applyFilters`. Any active filter/search at import time (or the mount race before the filter effect runs) makes most cards unresolvable → placeholders → and (per C3) a throw. Fix: resolve imports against `allCards`.

### H5 — Keyboard shortcuts capture stale closures
`src/App.jsx:5477-5507`. The `keydown` effect has `deps:[]`, so Ctrl+S/N/etc. call the mount-render `handleSaveDeck`/`handleNewDeck`/... which close over mount-time `deck`/`currentDeckId` (`null`). Ctrl+S saves stale/empty content or toasts "No deck to save". Fix: use refs for the handlers or add correct deps.

### H6 — Nested `ImageCacheProvider` (split-brain cache)
`src/App.jsx:6272` wraps AppInner's subtree in a *second* `ImageCacheProvider`; `App` (7471) already wrapped it once. Two independent `useState` caches both persist to the same `LS_KEYS.CACHE_IMG` on 800ms timers → last-writer-wins clobber; batch-loaded entries invisible to inner consumers. Fix: remove the inner provider.

### H7 — Unbounded replay list + gzip-bomb ingestion
`api/replays/index.js:87-93` — GET returns all replays with full `parsed` blobs, no `take` cap → multi-MB payloads built in serverless memory → timeout as replays accumulate. `api/_lib/replayParse.js:95,213` — `gunzipSync`/JSZip on member-supplied archives with no size cap → decompression bomb → OOM crash. Fix: add `take`, strip `parsed` from list view, cap decompressed size.

### H8 — `refreshUser` does not exist (post-reset login broken)
`src/pages/ResetPasswordPage.jsx:9,53` destructures `refreshUser` from `useAuth()`, which exposes only `{user,loading,login,register,logout,checkAuth}`. Guarded by `if(refreshUser)` → permanent no-op → after reset, in-memory `user` stays null until full reload. Fix: call `checkAuth`.

### H9 — Circular import blocks monolith decomposition
`src/components/DeckPresentationView.jsx:41-56` imports **14 symbols** from `App.jsx` (charts, stat components, helpers) while `App.jsx` imports `DeckPresentationView`. This is the single biggest obstacle to splitting the monolith and must be resolved first (extract the shared helpers into `src/lib`/`src/components`).

---

## 3. MEDIUM findings (by cluster)

**LLM pipeline**
- No single gateway: `max_tokens=6000` hard-coded as 3 literals; `new Anthropic()` instantiated in 5 files — the exact drift class that caused the recent temperature/thinking/budget fixes. (`agent.js:19`, `reviewLlm.js:14`, `reports/draft.js:11`)
- `runAgent` ignores `stop_reason==="max_tokens"` (`agent.js:83-90`) → blank/truncated 200 responses.
- SIMULATION/curve mode in the coach prompt has no compute backend — no calculator/code tool in `TOOL_SPECS`; hypergeometric "odds" are ungrounded arithmetic. (`coachPrompt.js:80`)
- `reports/draft.js:19-24` bypasses the coach persona (`060404d` said coachPrompt is the source of truth).
- `lorcana-console-agent.md:24-25,178-179` prescribes temperature 0.3/0.2 and max_tokens 1500 — the two bugs the app already fixed. Doc will re-introduce them.

**Data model / team APIs**
- Pod delete has no `createdById` guard (`api/pods/[id].js:39`) — any hub member deletes any pod; the parallel Practice feature guards exactly this. **✓ Verified** (comment literally says "any hub member").
- `/api/results` + `TournamentResult` fully built, **zero frontend callers** — dead feature. `StandingsImageImport` persists only to localStorage.
- `api/decks/index.js:16-34` — no zod validation, unbounded JSON blob written to `Deck.data`.
- Event/practice times formatted server-local (UTC) with no tz label (`events/index.js:75`, `practices.js:56-58`).
- `Replay` denormalized columns duplicate `parsed` → desync after any re-parse.
- Two membership-gate idioms coexist (`assertHubMember` write-then-check-`writableEnded` vs `requireHubMember`).

**Frontend**
- Hub fetches have no AbortController / no `loading` reset on param change → A→B navigation clobber (`HubDetailLayout.jsx:35-44`, `HubOverviewPage.jsx:203-217`).
- `EventsPanel.jsx:142-196` defines components inside render → remount + focus loss while typing.
- `TeamHub.jsx` duplicates all hub CRUD against the same endpoints as the live `HubListPage.jsx` (two parallel implementations); its `regenerateInviteCode` is a "not implemented" stub though the endpoint exists.
- `DeckViewModal.jsx` — entirely dead (zero importers), ships debug logs + unguarded `.user.email`.
- `DeckPresentationView.jsx` — broken custom pie legend (HTML div inside SVG PieChart, 1199-1226); NaN on empty deck (500, 1078-1082).

**Monolith (other)**
- `applyFilters` mutates reducer state in place (`App.jsx:6849-6873`, etc.).
- Duplicate hoisted handlers inside AppInner (`5611-5657` dead, `6218-6263` wins).
- Biased `sort(()=>Math.random()-0.5)` shuffle in `DrawSimulator` (`3146`) vs correct Fisher-Yates elsewhere → skewed consistency stats.
- Core Constructed legality hardcoded `new Set([9,10,11,12,13])` (`7152`) → excludes future sets; needs a code edit every release.
- ImportModal reads `savedLorcanaDecks`, a key nothing writes → dead "Saved Decks" section.

**Build / config**
- 3 env vars used but undocumented: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (`auth/forgot-password.js`), `DISCORD_PUBLIC_KEY` (`discord/interactions.js`). **✓ Verified** forgot-password guards only `RESEND_API_KEY` (line 11) but uses `RESEND_FROM_EMAIL` unguarded (line 40) → 500 with a reset token already written if only the key is set.
- Host-header injection in the reset link when `RESEND_FROM_EMAIL` unset (`forgot-password.js:33-36`). **✓ Verified.**
- Schema is `db push`-managed: 1 migration + 6 loose hand-applied `.sql` files; `build` runs `prisma generate` only. Fresh DB via `migrate deploy` is missing ~6 tables.
- No CI; `build` doesn't run tests; `npm test` is watch mode (`test:run` is the non-watch entry).

---

## 4. Security hardening backlog (MEDIUM/LOW, verified where noted)
- **No rate limiting anywhere in `/api`.** **✓ Verified** (grep). Enables login brute-force, open registration, reset-email spam, invite-code guessing.
- Register returns enumerable "Email already in use" 409. **✓ Verified** (`register.js:21`).
- Password reset tokens stored plaintext (`PasswordResetToken.token`) → DB read = account takeover.
- Password reset doesn't invalidate existing sessions (stateless 7-day JWT, no `tokenVersion`).
- `digest.js:97` non-constant-time secret compare; Discord interaction has no timestamp-freshness check (replayable).
- Invite-code case mismatch: web `join.js` is case-sensitive, Discord path uppercases → lowercase codes fail on web.

---

## 5. Missing integrations / dead code (delete or wire)
- `/api/results` + `TournamentResult` (no UI) — wire to StandingsImageImport or remove.
- `TeamHub.jsx` vs `HubListPage.jsx` — collapse to one.
- `DeckViewModal.jsx` — delete.
- ImportModal `savedLorcanaDecks` section — remove.
- `apiSearchCards` reads `json.data`; Lorcast returns `{results:[]}` (`cardsApi.js:147`) — fix or delete (confirm caller).
- Dead image endpoints + defunct CORS proxies HEAD-probed on every miss (`images.js`, `deckImage.js`).

---

## 6. Complexity map (where changes are riskiest)
- **`AppInner` (App.jsx 5167–6814)** — ~30 state values, ~20 nested handlers (several defined twice), ~15 effects with hand-tuned deps and empty-dep closures. Highest blast radius.
- **Import pipeline (App.jsx 1290–1795)** — depends on the `window.getCurrentCards` side-channel, holds the C3 defect, threads `_raw` card-shape assumptions.
- **Replay pipeline** — unbounded list + double-parse + uncapped decompression of member archives.
- **LLM plumbing** — hand-patched per-file; a budget bump on one path re-breaks another.

---

## 7. Test coverage gaps
Covered: pure normalizers (cardsApi), export generators, image URL helpers, storage round-trip, one component regression (myDecksEdit), server `_lib` (deckContext, replayParse, reviewContext, hubJoin schemas). **Untested and high-risk:** all fetch/CRUD plumbing, AuthContext (the `refreshUser` bug), cardsApi network paths (the `json.data` bug), `parseStandingsText` (pure, testable), DeckPresentationView (NaN/legend bugs a single render test would catch).

---

## 8. Unverified items to confirm before relying on them
- **`claude-sonnet-5` + `adaptive` thinking valid for installed `@anthropic-ai/sdk`?** If not, every coach call 400s. Confirm SDK version + one live call. *(Highest-leverage unknown.)*
- `memberId` identity across rsvp/attendance/pods/profile endpoints — User id vs HubMembership id (breaks self-highlight + members DELETE/transfer if mismatched).
- Vercel `req.body` population for handlers reading `req.body` directly.
- DrawProbabilityTool partial-mulligan math (App.jsx 2806-2849) may overcount vs Monte Carlo.
