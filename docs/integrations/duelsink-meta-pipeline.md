# Duels.ink Integration & Meta-Data Pipeline — Design Notes

_Captured 2026-07-14. Status: design / not yet built. Companion to the agent-knowledge
grounding work shipped 2026-07-14 (commits `8afd516`, `7bc0d82`, `5810f00`)._

## Why this exists

The Ask AI + review agents ground their **strategy** answers in static knowledge files
(`src/data/agent-knowledge/*.md`), which are pinned to **Set 12 (Wilds Unknown)** while the
card oracle already carries **Set 13**. So the agent looks up current cards but reasons in a
stale meta. The fix is a **fresh meta signal** the agent can read — and the only *legitimate*
sources are duels.ink (sanctioned API) and **our own first-party game data**. This doc captures
the duels.ink integration plan and the pipeline it feeds.

## Data-source decisions (do not relitigate)

| Source | Verdict | Notes |
|---|---|---|
| **Our own first-party data** | ✅ The real moat | Already captured via `POST /api/results`, practice games, hub play. Ours to use, permission-free, and data competitors don't have. |
| **duels.ink API** | ✅ Sanctioned | Official token program (`/api/me/match-history`). Subject to their ToS. This doc. |
| **inkdecks.com** | ❌ License-only | ToS (v1.65) **explicitly** prohibits automated access, scraping, AND "AI model training," names indirectly-competing products for **liquidated + punitive damages**, and calls even non-commercial republication copyright infringement. Governed by Spain/EU law, Córdoba courts. Only route = written permission (`admin@inkdecks.com`). No technical workaround. |
| **lorcanito.com** | ⚠️ No public API | Deck/play-data analytics; access unclear (likely scrape). Treat as license-only until confirmed. |
| **last30days skill** | ✅ Supplement | Public Reddit/YouTube/X community *sentiment*, not hard results. Local Claude Code skill (can't be called from a Vercel cron). Good for "what's the community hyped/salty about." |
| **Lorcast / lorcana-api.com** | ✅ Free/open | Card text only, not meta. Already used. |

## Current state

The app **already ingests duels.ink** — via **manual replay upload** (`.zip/.gz/.json`),
parsed by `api/_lib/replayParse.js` (frames → events, lore curve; `source: "duels.ink"`) and
fed into the review pipeline. "Linking it up" = going from manual upload → **automatic API sync**.

Reference implementation: **databorn.ink** (a.k.a. ma-allen.com/lorcana) already does this exact
integration — copy its patterns.

## The duels.ink API (as of 2026-07-14)

- **Endpoint:** `GET /api/me/match-history` — the requesting user's match history.
- **Formats:** JSON, JSONL, CSV.
- **Auth:** an API token created at duels.ink → **Account → API Tokens**. Exact mechanism
  (header vs query param) is **not publicly documented** — confirm with a real token at build time.
- **Two ingest modes:** direct API pull (paste token) **or** CSV upload (Account → Game History → download).
- **Rate limit:** **30 replay reads/min/user** across replay endpoints (added after a May 2026
  security disclosure). Match-history export rate limit unspecified.
- **Privacy pattern (databorn's, worth copying):** token + history *"relayed through our server
  in memory only… never written to disk, never logged, discarded the moment the request finishes,"*
  games stored in the user's browser.

### ⚠️ The two-granularity gotcha (most important design fact)

`match-history` and full replays are **different data at different granularity**:

| Source | Contains | Feeds |
|---|---|---|
| `/api/me/match-history` | Aggregate match records: **your** decklist, opponent **colors**, result | Meta / win-rate / first-party data |
| Replay files/endpoints (current upload path) | Turn-by-turn frames/events | AI **game review** (needs play-by-play) |

Consequences:
1. **match-history ≠ full replay.** It gives win/loss + decklists (perfect for meta aggregation),
   NOT the frames `replayParse.js` needs for a review. Reviews still require the replay files
   (rate-limited 30/min path).
2. **Opponent decklists are gone.** The May 2026 patch removed the `opp_decklist` field — you now
   get your own list + opponent *colors* only. Cannot reconstruct opponents' full lists from the API.

## Build plan

1. **Relay endpoint** `api/integrations/duelsink/sync.js` (POST `{ token }`): calls
   `GET /api/me/match-history?format=json` server-side.
2. **Storage decision (the key call):**
   - **In-memory relay** (databorn's posture): don't persist the token; user pastes it each sync. Max privacy, no auto-sync.
   - **Encrypted persisted token** (new field on User or a `linked_accounts` table): enables a **Vercel cron** for auto-sync (we already run one for card ingest). Better for the meta-data goal.
3. **Normalize** match-history rows → existing `PlaytestGame` shape → instant first-party win-rate data.
4. **Reviews stay on the replay path.** Optionally add replay auto-fetch later, respecting the 30/min cap.
5. **UI:** "Connect duels.ink → paste token," reusing databorn's token instructions.

### Open questions to resolve at build time (need a real token, not more research)
- Exact auth mechanism (header name vs query param).
- Exact match-history field names / JSON shape.
- duels.ink API ToS specifics for programmatic/commercial use.

## The meta pipeline this feeds

```
first-party PlaytestGames + duels.ink match-history  →  AI synthesis (weight last 7d,
   30d as trend context)  →  MetaReport row (source: auto, dated, status: pending)
                                     ↓
        production agent already reads it via search_meta_reports
```

Guardrails (from the agent-grounding work):
- Recency weighting is a **synthesis + prompt** concern, not a retrieval filter: structure the
  report as "Current (last 7d)" primary + "Trend (8–30d)" context; instruct the agent to prefer
  recent reports over the static Set-12 files and surface the date.
- **Human-in-the-loop:** auto reports land `pending` for approval before the agent treats them as
  truth — a bad scrape/hallucination must not silently become ground truth and compound weekly.
- Timeless theory files (`role-theory.md`, `synergy-theory.md`) stay hand-authored; only the volatile
  meta/tech/matchup layer refreshes.
- Prove changes with the eval harness (`scripts/eval-agent.mjs`, `evals/agent/gold-questions.json`).

## Sources
- Duels.ink — Release Notes: https://duels.ink/release-notes
- Duels.ink — My Stats: https://duels.ink/my-stats
- databorn.ink / ma-allen Duels.ink Analyzer: https://ma-allen.com/lorcana/analysis/
- inkdecks ToS v1.65 (captured in-session): personal/non-commercial only; scraping + AI use prohibited.
