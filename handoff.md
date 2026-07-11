# HANDOFF — Uninkable overhaul (2026-07-11, session 2)

**Branch:** `feature/uninkable-overhaul`

## Status
- **Step 1 (post-mortem):** ✅ `POSTMORTEM.md`. 6 Opus readers; every CRITICAL/HIGH re-verified against real code.
- **Step 2 (plans):** ✅ `PLANS.md` — P0–P4, each task tiered OPUS_SAFE vs FABLE_SUPERVISED.
- **Step 3 (execute):** 🔶 ALL CRITICAL + HIGH done. P2.9 dead code done. P3.2 (H9) done. P3.3 tokens done. P4.1 primitives done. P4.2 chrome done; **three comp surfaces remain** (hub overview, deck detail hero, Deck Lab). Tests 159/159.

## Completed & committed on `feature/uninkable-overhaul` (tests green each step)
Session 1 (security/correctness):
- `6360d9f` — **C1** deck-deletion IDOR scoped; **H1** owner-delete cascade `Cascade→Restrict`.
- `26aba17` — **C2** dead `user` key; **H8** post-reset login; **H2** digest typo; **H3** Discord review write DISABLED.
- `e8abb80` — **C3** text-import crash; **H4** imports resolve against full catalog.
- `b276901` — **H6** duplicate ImageCacheProvider removed.
- `cf70136` — **H7** replay bounds, deck POST validation, hashed reset tokens, env docs.
- `8f16288` — **H5** ref-routed keyboard shortcuts; pod delete authz (`Pod.createdById`, creator-or-owner; **needs `db push`**).

Session 2 (architecture + redesign start, all browser-verified via `vite preview`):
- `27d196f` — **P2.9** dead code deleted: `TeamHub.jsx` overlay (unreachable — TopBar never rendered its button; routed `HubListPage` is canonical), `DeckViewModal.jsx` (no importers), ImportModal saved-decks section (read a LS key nothing writes). `/api/results` intentionally KEPT — sole write path for `TournamentResult`, which agent tool `search_tournament_results` reads.
- `f5579b0` — **P3.2 / H9** circular import broken. Extracted verbatim from App.jsx: `src/lib/cardUtils.js` (pure helpers, merged into existing M5 slice), `src/components/ui/{Section,Pill,WinRateBar,Modal}.jsx`, `src/components/deckCharts.jsx` (curve/draw-prob/simulator/hover-stats), `src/components/TournamentResults.jsx`, `src/contexts/ToastContext.jsx`. App.jsx has ZERO named exports now; 9.4k → 5.6k lines. ⚠️ Gotcha hit: `src/lib/cardUtils.js` and `src/components/ui/` **already existed** — merged, not clobbered (a scripted write briefly clobbered cardUtils; restored from git).
- `40104be` — **P3.3** `src/tokens.css` single token source (comps' values verbatim: `--canvas #101114`, panels, six inks, Fraunces/Instrument Sans, radii, `--hex`). index.css/styles.css drop their duplicate `:root`s + purple gradients; tailwind.config consumes the vars. **Visible change:** app background is now the flat quiet canvas, headings are Fraunces.
- `f66d5f5` — **P4.1** primitives in `src/components/ui/`: HexGlyph, CostHex, InkLedger, Panel, InkCurve, InkSplitBar (+ `inks.js` ink→var map); Button primary violet→sapphire. Approved comps copied INTO the repo at `design/comps/` (were only in a temp scratchpad). 7 new tests.
- `a3691f8` — **P4.2a** shared topbar chrome per comps: Fraunces "Uninkable" wordmark + two-ink hexmark, quiet nav with sapphire active underline. (Wordmark renamed from "Team Lorcana" — matches comps + domain; flag if unwanted.)

## Still open (NOT done)
- **P4.2 remainder — the three comp surfaces**, in rough order of leverage:
  1. **Hub overview** (`HubOverviewPage` + `HubDetailLayout`) per `design/comps/uninkable-team-hub-comp.html` — crest hex, roster pills, events, activity feed, gauntlet coverage, digest panel.
  2. **Deck detail** per `uninkable-deck-detail-comp.html` — hero (serif title, stat row, InkLedger, actions), grouped card-list rows with CostHex, side rail (InkCurve/InkSplitBar/coach panel). Applies to `DeckPresentationView` and/or a hub deck page.
  3. **Deck Lab** (App.jsx builder) per `uninkable-deck-lab-comp.html` — biggest; monolith.
  The new ui/ primitives cover the shared pieces; each surface is FABLE layout judgment + browser verification. Old Tailwind gray/violet classNames remain on unrestyled surfaces (they read fine on the new canvas, just not comp-styled yet).
- **Rate limiting (P2.6)** — still BLOCKED on Upstash creds (prior handoff §1).
- **JSZip zip-member decompression** unbounded in `replayParse.js` — follow-up.
- **P3.1 LLM gateway** — tech debt only (coach works in prod; SDK 0.30.1 vs 0.111.0; 5 scattered call sites). If touched, verify against prod (local `.env` has no `ANTHROPIC_API_KEY`).
- **P3.4 card-DB + deck versioning** — large; spec separately.
- MEDIUM/LOW backlog in `POSTMORTEM.md §3-5`.
- `ui/Toast*.jsx` + `ui/useToast.js` are an UNUSED parallel toast system (live one is `src/contexts/ToastContext.jsx`) — candidates for deletion or convergence during P4.

## Open questions / judgment calls
- **Deploy:** nothing deployed. Two schema changes now pending a `db push` (H1 Restrict + `Pod.createdById`). No prod deploy without Larry's explicit "deploy".
- **Design direction check:** the token swap (quiet #101114 canvas, Fraunces headings, no purple) is now app-wide. Worth Larry eyeballing `npx vite preview` before the three big surface restyles proceed.
- **Verify tooling note:** `.claude/launch.json` gained a "vite preview" config (port 4173). Browser screenshots timed out in this session's pane; verification used computed-style/JS/page-text checks instead.

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
