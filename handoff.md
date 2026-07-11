# HANDOFF — Uninkable overhaul (2026-07-11)

**Branch:** `feature/uninkable-overhaul`

## Status
- **Step 1 (post-mortem):** ✅ `POSTMORTEM.md`. 6 Opus readers; every CRITICAL/HIGH re-verified against real code.
- **Step 2 (plans):** ✅ `PLANS.md` — P0–P4, each task tiered OPUS_SAFE vs FABLE_SUPERVISED.
- **Step 3 (execute):** 🔶 ALL CRITICAL + HIGH fixed & committed (P0–P2 hardening). Tests 152/152 throughout. P3 (architecture) + P4 (UI redesign) NOT started.

## Completed & committed on `feature/uninkable-overhaul` (tests green each step)
- `6360d9f` — **C1** arbitrary deck deletion (IDOR) scoped to hub members; **H1** owner-delete cascade `Cascade→Restrict`.
- `26aba17` — **C2** dead `user` key → `useAuth()`; **H8** `refreshUser`→`checkAuth`; **H2** digest `playTestGame`→`playtestGame`; **H3** Discord review write DISABLED (per Larry's decision — reject until identity linking exists).
- `e8abb80` — **C3** text-import ReferenceError fixed; **H4** imports resolve against full catalog (`window.getAllCards`).
- `b276901` — **H6** removed duplicate inner `ImageCacheProvider`.
- `cf70136` — **H7** replay list bounded (`take:200`, drops `parsed`) + 64MB gunzip cap; deck POST zod+512KB validation; reset tokens SHA-256 hashed; `RESEND_FROM_EMAIL` guarded; env.example documents 3 vars.

## Still open (NOT done)
- **H5** stale-closure keyboard shortcuts (`App.jsx` keydown effect `deps:[]`) — FABLE, monolith.
- **H9** circular import: `DeckPresentationView.jsx` imports 14 symbols from `App.jsx` — prereq for any monolith split (P3.2).
- **P2 remainder:** pod delete guard (needs `Pod.createdById` schema field), rate limiting (BLOCKED — needs Upstash creds, see prior handoff §1), dead-code removal (`DeckViewModal.jsx`, `TeamHub.jsx` vs `HubListPage`, `savedLorcanaDecks` section, `/api/results` wire-or-delete), MEDIUM/LOW backlog in `POSTMORTEM.md §3-5`.
- **JSZip zip-member decompression** still unbounded in `replayParse.js` (no simple cap API) — follow-up.
- **P3 architecture:** LLM gateway (P3.1). ⚠️ FINDING (verified 2026-07-11): installed `@anthropic-ai/sdk` is `0.30.1` — it has NO `thinking` param support at all (latest is `0.111.0`), yet `api/_lib/agent.js:73` sends `thinking:{type:"adaptive"}` and reviewLlm/reports send `adaptive` too. `"adaptive"` is not a documented thinking type (API wants `{type:"enabled",budget_tokens:N}` or `disabled`). This likely IS the "coach tried but failed" symptom from the prior session. FIX (needs a live API key to verify — not available locally): upgrade the SDK to current, then either use `{type:"enabled",budget_tokens:N}` or drop `thinking`; fold into the P3.1 gateway (one client + params in one module). Do NOT change blind — test with `ANTHROPIC_API_KEY` set.
  - Also in P3: resolve H9 (circular import), single `tokens.css` (⚠️ changes the app's visible background — needs browser verification), card-DB + deck-versioning (large — spec separately).
- **P4 UI redesign:** three approved comps (deck detail, Team Hub, Deck Lab) — build on P3 tokens.

## Open questions / judgment calls
- **Deploy:** everything is on the feature branch; the schema change (H1) isn't live until a DB `db push`/migration. No prod deploy without Larry's explicit "deploy".
- **Cost:** session reached ~$142 (6 Opus post-mortem readers + 2 Opus fix batches were the bulk). Paused before P3/P4 pending Larry's call on how far to push — those are realistically multi-session efforts.

## Notes
- Commit per cluster, explicit pathspecs (never `git add -A`), author `sportlarry@gmail.com`. Keep `.claude/` untracked.
- Live-fire test recommended for text import (parser paths thinly covered) and for the coach LLM path (needs `ANTHROPIC_API_KEY`).

---

# HANDOFF — Review agent deck-context upgrade (2026-07-04)

## Status: implementation complete, all 134 tests green, NOT committed / NOT deployed.

Post-mortem with file/line detail: `docs/review-agent-postmortem.md`.

## What was done (branch `preview/team-hub-polish`, uncommitted working tree)

1. **Card oracle fixed** (was 100% broken — every card rendered "unknown — do not infer").
   Parser now keeps `cardId`/`attackerCardId`/`defenderCardId` on events; context builder
   resolves by id with name fallback. (Opus subagent, verified.)
2. **LLM pipeline deduplicated** into `api/_lib/reviewLlm.js`; both review endpoints import
   it; leftover debug block + dead `replay.playerDeck` fallback removed. (Opus subagent, verified.)
3. **Deck context added — the headline feature.** New `api/_lib/deckContext.js`:
   deck summary (counts, inks, curve, types, inkable ratio), rendered YOUR DECK +
   OPPONENT REVEALED CARDS sections; deck cards merged into the card-text glossary;
   system prompt now tells the coach to infer the deck's game plan and judge lines
   against it, and to name better outs still in the deck.
4. **Cross-source id mismatch discovered & mitigated** (found by running the real fixture):
   duels.ink and `cards.min.json` number some sets differently (e.g. duels `8-33` = Lady -
   Decisive Dog; local `8-33` = Jafar - High Sultan of Lorcana). Resolution policy: replay
   names are authoritative; ids trusted only when they agree. Never-played deck cards from
   misaligned sets, or whose color falls outside the deck's verified 2-ink identity, are
   marked `(unverified)`, excluded from profile stats and glossary, with an explicit
   do-not-infer note to the model.
5. **Auto-primer upgraded**: receives the full deck list + opponent reveals, names both
   archetypes from actual cards (aligned with `meta-archetypes.md` names instead of
   colors-only labels); reads full knowledge files (15k cap) instead of 3×4000-char slices.
   `PRIMER_MAX_TOKENS` 600 → 800 for the two extra fields.
6. **Regenerate drift bug fixed**: auto-primer reviews (primerId=null) were permanently
   un-regenerable (400). `api/reviews/[id].js` now re-runs the shared auto-primer path.
7. **Truncation calibration**: context overflow now elides the EARLIEST log lines (endgame
   preserved) instead of chopping the tail.

## Next / open questions for Larry

- **Deploy**: changes are backend-only (`api/` + tests), no schema migration. Needs the
  usual commit + deploy approval.
- **Token cost**: primer call input grew (~23k chars knowledge + deck list ≈ +6k tokens per
  auto-primer). Review context grew ~8-10k chars (deck + opponent + bigger glossary). Default
  hub budget is 500k tokens/month — consider raising it or trimming the knowledge caps.
- **Root fix for set numbering**: the evidence heuristic is a mitigation. The real fix is
  aligning `cards.min.json` ids with duels.ink numbering (risky: saved decks reference
  current ids). Not attempted.
- **Optional future**: link a saved Deck Lab `Deck` to a review for paper games with no
  replay decklist — schema change (`Review.deckId`), deferred.
- **One live-fire test recommended**: upload a real replay in the UI and generate a review
  with `ANTHROPIC_API_KEY` set — LLM output quality wasn't exercised here (no key locally).

---

# PRIOR HANDOFF (2026-07-02) — items that still need Larry

Everything else is proceeding autonomously per `docs/implementation-plans.md`.
Nothing below blocks Waves 1–3 (withAuth, .tsx→.jsx, App.jsx lib extraction, tests).

## 1. Rate limiting — pick a store and provide credentials (plan item 4)

Serverless functions have no shared memory, so login/register/forgot-password rate
limiting needs an external store. Options:

- **Upstash Redis (recommended):** free tier is plenty. Create a database at
  https://console.upstash.com → copy `UPSTASH_REDIS_REST_URL` and
  `UPSTASH_REDIS_REST_TOKEN` → add both to Vercel env (all environments), or paste them
  in chat and Claude will add them.
- **Vercel KV / Marketplace Redis:** can be provisioned from the Vercel dashboard
  (Storage tab) — sets env vars automatically.
- **Skip for now:** accept the risk on auth endpoints.

→ Once creds exist, implementation is delegated to Opus (no further input needed).

## 2. ✅ DONE (2026-07-02): Replay parser validated against a real duels.ink export

Larry provided a real bo3 `.match-replay.zip`. The parser handled it with **zero code
changes** — match score/winner, per-game results, victory reasons, 60-card decklists,
64-78 events per game, lore curves, and ink-color archetype detection all correct
(cross-checked against the raw logs). A sanitized copy is committed as the test fixture
`src/test/fixtures/duels-match-replay.zip` with a 4-test regression suite
(`src/test/replayParse.test.js`).

## 3. ✅ DONE (2026-07-02): stale `feature/replay-review` remote branch deleted

Remote deleted (accidental-merge risk gone). The LOCAL branch copy remains only because
an old session's worktree pins it and the permission classifier won't let Claude remove
another session's worktree. Optional manual cleanup:
`git worktree remove "C:/Users/Larry/AppData/Local/Temp/claude/C--WINDOWS-system32/682ef509-58a7-40ab-9af0-a05acd2c25e2/scratchpad/wt-redesign"`
then `git branch -D feature/replay-review`. (A June-28 stash `stash@{0}` lives in the
shared repo and is unaffected.)

## 0. ALL THREE My Decks bugs FIXED — just needs a deploy (2026-07-02)

Root-caused against your real synced deck data (read from your logged-in browser):
1. **Edit made the deck disappear** — LS format mismatch (`9cffb2f`).
2. **"0 copies" rows** — decks contain ghost entries at count 0 (e.g. RS DINO has 8);
   the reducer now deletes entries at zero and My Decks hides existing ghosts (`d53eaef`).
3. **Bad generated deck images** — pre-2026 decks carry dead image hosts
   (`cards.lorcast.io/crd_*` 404s); the generator now re-resolves every card against
   the live catalog by set+number first (`d53eaef`).

All regression-tested (114/114) and browser-verified. **Prod still runs the broken
code until you say "deploy"** — the session's permission classifier blocks
`vercel --prod` without your explicit word. Existing decks' ghost data self-heals on
each deck's next save; until then it's hidden by the display fix.

## 4. Approve prod deploy of Wave 1 (quick)

`members.js`→`withAuth` (`5726c53`), `.tsx`→`.jsx` (`16d1b7c`), and the plan docs
(`99d6508`) are committed and pushed, build + all 75 tests green — but the permission
classifier blocked `vercel deploy --prod` this session. Say "deploy" (or run
`vercel deploy --prod --yes` from the repo) and prod picks them up. No urgency: prod
runs fine on the previous deploy; these changes are hygiene, not fixes.

## 5. FYI — no action needed

- All current user sessions were invalidated by the JWT_SECRET rotation (2026-07-02);
  users just log in again.
- Old leaked Neon/JWT credentials are dead; git-history scrubbing is now optional
  hygiene rather than urgent.
- `ANTHROPIC_API_KEY` was already present in Vercel — the AI review feature is live.
