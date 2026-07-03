# HANDOFF — items that need Larry (2026-07-02)

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
  (Storage tab) — say the word and Claude can walk that flow with you.

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
