# Meta-Data Pipeline — Design Spec

_Written 2026-08-17. Supersedes the pipeline half of
`docs/integrations/duelsink-meta-pipeline.md` (2026-07-14), whose premise — that only
per-user `match-history` was available — is now known to be incomplete._

## Problem

The Ask AI and review agents ground strategy answers in `src/data/agent-knowledge/*.md`,
which are pinned to **Set 12**. The card oracle is on **Set 13**. So the agent looks up
current cards and reasons in a stale meta, and nothing in the system tells it that the
strategy files are out of date.

Goal: a **weekly-refreshed meta signal** that (a) the agent reads at question time and
(b) users can view directly in the app.

**Not** fine-tuning. The numbers live in Postgres and the agent looks them up, so figures
are exact, citeable, dated, and current the moment the cron runs. Fine-tuning weekly-changing
win rates would be stale on arrival and would hallucinate the numbers.

## Data source

`GET https://duels.ink/api/stats/meta?queue=<queue>&period=<period>&era=<era>`

Verified live 2026-08-17: 680,300 games / 14,995 unique players, `updatedAt` fresh.

### Source status — read this before touching the adapter

This endpoint is **not an open API**. Established by inspection:

- **No CORS headers** — cross-origin browser fetch fails. Wired for duels.ink's own SPA only.
- **`robots.txt: Disallow: /api/`** — all user-agents.
- **No public documentation**, and unmentioned in release notes (which *do* announce
  partnerships, e.g. Metafy).
- Internal-shaped contract: season UUIDs, `era=current`, undocumented field names.

Unauthenticated ≠ public. **Owner decision (Larry, 2026-08-17): build it anyway**, accepting
that access may be revoked without notice. A permission email to duels.ink is drafted and may
be sent in parallel; approval would convert this to a sanctioned feed with a stability
contract, but the build does not wait on it.

Three consequences that are **binding design requirements**, not preferences:

1. **R1 — Assume revocation.** Access can disappear at any time. Every pull is persisted
   permanently; the app must degrade to last-known-good, never to blank.
2. **R2 — Assume breakage.** No stability contract exists. Field renames and shape changes
   ship without notice. The adapter must fail loudly and safely, never write partial garbage.
3. **R3 — Be a good citizen anyway.** One request per queue per week. Identifying
   `User-Agent` (`UninkableDeckBuilder/1.0 (+https://uninkabledeckbuilder.com)`) so duels.ink
   can throttle or block cleanly rather than being deceived. No player-level, replay, or
   `match-history` endpoints touched by this pipeline.

### Out of scope, permanently

**InkDecks.** Its ToS (v1.65) explicitly prohibits automated access, scraping, and AI training,
and names indirectly-competing products for liquidated + punitive damages under Spain/EU
jurisdiction. That is a contractual risk of a different category from this one. databorn.ink
pulls from InkDecks; do not copy that leg.

## Architecture

```
  ADAPTERS                 STORE                SYNTHESIS           CONSUMERS
┌───────────────┐    ┌───────────────┐    ┌──────────────┐    ┌────────────────┐
│ duelsPlatform │───▶│               │    │ weekly job:  │    │ get_current_   │
│  (primary)    │    │ MetaSnapshot  │───▶│ snapshot →   │───▶│   meta (agent) │
├───────────────┤    │ MetaArchetype │    │ AI summary → │    ├────────────────┤
│ firstParty    │───▶│ MetaMatchup   │    │ pending      │    │ /meta page (UI)│
│ (PlaytestGame)│    │               │    └──────────────┘    └────────────────┘
└───────────────┘    └───────────────┘            │
                                                   ▼
                                          human approval (admin)
```

All adapters emit the same normalized rows. Which feed is live is configuration, not a rewrite —
this is what makes R1 survivable: if duels.ink closes, `firstParty` keeps the pipeline running
on your own `PlaytestGame` data at lower resolution.

## Data model

`MetaReport` is **not** the carrier. It is `hubId`-required, hand-authored markdown,
cascade-deleted with its hub, and has no period/source/status fields. A global meta signal has
no hub to belong to. New models:

```prisma
model MetaSnapshot {
  id            String   @id @default(uuid())
  source        String                        // "duels.ink" | "first-party"
  queue         String                        // "core-bo1", "core-bo3", "infinity-bo1", ...
  format        String                        // "CoreConstructed" | "InfinityConstructed"
  era           String                        // "set-13"
  periodStart   DateTime
  periodEnd     DateTime
  totalGames    Int
  uniquePlayers Int?
  status        String   @default("pending")  // "pending" | "approved" | "rejected"
  payload       Json                          // raw response, verbatim
  capturedAt    DateTime @default(now())

  archetypes MetaArchetype[]
  matchups   MetaMatchup[]

  @@unique([source, queue, era, periodStart])
  @@index([status, periodStart])
}

model MetaArchetype {
  id                 String  @id @default(uuid())
  snapshotId         String
  name               String                  // "Midrange", or colors when unnamed
  colors             String[]
  games              Int
  winRate            Float
  playRate           Float?
  firstPlayerWinRate Float?
  centroidCards      Json?                   // { "11-86": 4, ... }
  cardLift           Json?

  snapshot MetaSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  @@index([snapshotId])
}

model MetaMatchup {
  id          String @id @default(uuid())
  snapshotId  String
  archetypeA  String
  archetypeB  String
  colorsA     String[]
  colorsB     String[]
  games       Int
  winRate     Float

  snapshot MetaSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  @@index([snapshotId])
}
```

The `@@unique` makes re-running the cron idempotent. Snapshots are **never deleted** — that is
the R1 guarantee.

## Adapter mapping

From the verified payload:

| Response path | Destination |
|---|---|
| `activity.totalGames`, `activity.uniquePlayers` | `MetaSnapshot` |
| `meta.currentWeek.startDate` / `.endDate` | `periodStart` / `periodEnd` |
| `meta.eras.currentEra.key` | `era` |
| `colorPairs[]` (21) | `MetaArchetype` — colors, winRate, playRate, firstPlayerWinRate |
| `profiles[]` (88) | `MetaArchetype` — archetypeName, centroidCounts, cardLift |
| `matchups[]` (150) + `archetypeMatchups[]` (3120) | `MetaMatchup` |
| whole body | `payload` |

`meta.availableWeeks` drives backfill: on first run, pull each available week (6 at time of
writing) to seed history immediately rather than accumulating one week at a time.

**R2 handling:** validate the response against expected shape before any write. Missing or
renamed top-level keys (`activity`, `colorPairs`, `matchups`, `meta.currentWeek`) →
abort the run, write nothing, log loudly. A partial write is worse than no write.

## Agent surface

One new tool in `api/_lib/agentTools.js`, deliberately **not** hub-scoped:

**`get_current_meta`** — returns the most recent `approved` snapshot: top archetypes by play
rate with win rates, notable matchup skews, sample size, period, era, and source.

Description instructs the agent to prefer this over `agent-knowledge/*.md` for anything
meta-dependent, and to state the date and sample size when citing figures.

Beyond the tool, the agent needs to *know* the static files are stale. Add a dated staleness
banner to the three volatile files — `meta-archetypes.md`, `matchup-guide.md`, `tech-cards.md` —
so the model can see the conflict and resolve it toward the live snapshot. The timeless files
(`role-theory.md`, `synergy-theory.md`, `game-state-evaluation.md`) are untouched.

## UI

A `/meta` page, following the `/tools` hub patterns from the tools-suite milestones:

- Archetype table: colors, play rate, win rate, first-player win rate, sample size
- Matchup matrix as a heatmap
- Week selector and era badge
- Prominent "as of <date> · source: duels.ink · N games" line
- Visible attribution and link back to duels.ink (an R3 commitment, and correct regardless)
- **Staleness state (R1):** when the newest snapshot is older than 10 days, the page renders
  the last-known-good data with an explicit "data as of <date>, not currently refreshing"
  banner rather than an error or an empty state.

## Guardrails

- Auto snapshots land `pending`; `get_current_meta` and `/meta` read **approved only**. A bad
  pull cannot silently become the agent's ground truth and compound weekly. Admin toggle to approve.
- New gold questions in `evals/agent/gold-questions.json` proving meta answers changed —
  the agent should cite a date and sample size where it previously asserted Set 12 facts.
- Existing suite (`npx vitest run`) stays green.

## Milestones

| # | Scope | Est. |
|---|---|---|
| **N1** | Prisma models + migration; `duelsPlatform` adapter with shape validation; unit tests against a captured fixture | ~0.5d |
| **N2** | `api/cron/meta-sync.js` weekly cron + backfill of `availableWeeks`; idempotency; admin approve endpoint | ~0.5d |
| **N3** | `/meta` page — archetype table, matchup heatmap, week selector, staleness state | ~1.5d |
| **N4** | `get_current_meta` tool + staleness banners on 3 knowledge files + eval questions | ~0.5d |

~3 days. N1 and N4 are independent of N3 and can run in parallel.

## Open questions

- **Which queues to ingest.** `core-bo1` is the flagship. `core-bo3` matters for tournament
  prep; Infinity and JA queues likely not worth the rows initially. Recommend starting with
  `core-bo1` + `core-bo3`.
- **Approval friction.** Weekly manual approval may become a chore. If it does, consider
  auto-approving snapshots that pass a sanity check (sample size within expected band, no
  archetype win rate outside 30–70%) and only flagging outliers.
