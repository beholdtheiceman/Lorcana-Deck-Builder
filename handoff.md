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

## 2. Replay parser validation — need one real replay export (plan item 5)

`api/_lib/replayParse.js` has never seen a real duels.ink replay file. Please export a
match replay from duels.ink (any recent game, BO1 or BO3) and drop the file at
`docs/fixtures/` (create the folder) or paste/attach it in chat.

→ Claude (Fable) will validate the parser against it, fix mismatches, and run an
end-to-end AI review on preview before calling the feature production-ready.

## 3. Confirm deletion of the stale `feature/replay-review` branch (plan item 7)

Verified 2026-07-02: `preview/team-hub-polish` (live prod) contains everything that
branch has, plus newer work (hub pages, tests, deckExport). Merging it would delete
newer code. Recommend deleting local + remote `feature/replay-review` to prevent an
accidental merge. **Confirm and Claude will delete it** (kept until you say so, in case
you want anything from its history).

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
