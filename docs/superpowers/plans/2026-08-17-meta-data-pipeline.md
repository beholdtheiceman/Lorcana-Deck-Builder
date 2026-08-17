# Meta-Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pull duels.ink platform-wide meta stats weekly into Postgres, show them at `/meta`, and give the Ask AI agent a `get_current_meta` tool so it stops reasoning in a Set-12 meta.

**Architecture:** A pure adapter (`parseDuelsMeta`) turns the raw duels.ink payload into normalized rows; a cron handler persists snapshots idempotently; the `/meta` page and the agent both read **approved** snapshots only. The adapter is pure and fixture-tested so no test ever hits the network — which also means the suite keeps passing if duels.ink revokes access.

**Tech Stack:** Node (Vercel serverless), Prisma + Postgres (Neon), React 18 + Vite, Vitest, Anthropic tool-use.

**Spec:** `docs/superpowers/specs/2026-08-17-meta-data-pipeline-design.md`

---

## Context the engineer needs

**Read the spec first.** In particular the three binding requirements (R1 persist-everything / R2 validate-before-write / R3 one-request-per-week). They are not optional polish; two tasks below exist solely to satisfy them.

**Source reality:** `GET https://duels.ink/api/stats/meta?queue=<queue>&period=<period>&era=<era>` is duels.ink's *internal* endpoint. No CORS, no docs, no stability contract. It can change shape or vanish without notice. Never call it from the browser (CORS blocks it) and never call it from a test.

**Fixture:** `src/test/fixtures/duelsink-stats-meta.json` is a real response captured 2026-08-17 with arrays truncated. All adapter tests run against it.

**Two grains of matchup data — this is the easiest thing to get wrong:**
- `matchups[]` — **color-pair** grain, keyed by `colorsA`/`colorsB` arrays.
- `archetypeMatchups[]` — **archetype** grain, keyed by `archetypeIdA`/`archetypeIdB` UUIDs that join to `profiles[].archetypeId`.

They are not interchangeable. `MetaMatchup.grain` discriminates them.

**`profiles[]` are deck shapes, not archetypes.** Many profiles share one `archetypeId` (e.g. several Amber/Amethyst shapes all map to "Midrange"). `archetypeName` and `archetypeId` are frequently `null` for small unnamed clusters. Never assume they're set.

**Existing patterns to follow:**
- Cron handler: `api/cards/ingest.js` — thin handler, auth via `DIGEST_SECRET || CRON_SECRET`, fails closed. Logic lives in `api/_lib/`.
- Cron registration: the `crons` array in `vercel.json`.
- Tests: `src/test/*.test.js`, run with `npx vitest run`.
- Agent tools: `TOOL_SPECS` + `HANDLERS` in `api/_lib/agentTools.js`.
- Routes: `src/RouterApp.jsx`. Tool pages use `<LazyTool>`.

**Commit as `sportlarry@gmail.com`. Use explicit pathspecs — never `git add -A`.**

---

## File Structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` (modify) | `MetaSnapshot`, `MetaArchetype`, `MetaMatchup` models |
| `api/_lib/metaAdapters/duelsPlatform.js` (create) | **Pure.** Validate + normalize raw payload → rows. No I/O. |
| `api/_lib/metaSync.js` (create) | Fetch + persist. The only file that touches the network and the DB. |
| `api/cron/meta-sync.js` (create) | Thin authed handler wrapping `metaSync.js` |
| `api/meta/current.js` (create) | Public read endpoint for the `/meta` page |
| `api/meta/approve.js` (create) | Admin approve/reject a snapshot |
| `src/pages/MetaPage.jsx` (create) | The `/meta` view |
| `api/_lib/agentTools.js` (modify) | `get_current_meta` spec + handler |
| `src/data/agent-knowledge/{meta-archetypes,matchup-guide,tech-cards}.md` (modify) | Staleness banners |
| `src/test/metaAdapter.test.js` (create) | Adapter unit tests against the fixture |
| `src/test/metaTools.test.js` (create) | Agent tool tests |

Keeping `duelsPlatform.js` pure is the load-bearing decision: it makes R2 testable without a network, and it means a future adapter (first-party, or the sanctioned per-user feed) is a sibling file rather than a rewrite.

---

## Task 1: Prisma models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the three models**

Append to `prisma/schema.prisma`:

```prisma
// ---------------------------------------------------------------------------
// Meta snapshots — weekly aggregate meta data from external sources.
// Never deleted: if a source revokes access we keep everything already pulled.
// See docs/superpowers/specs/2026-08-17-meta-data-pipeline-design.md
// ---------------------------------------------------------------------------

model MetaSnapshot {
  id            String   @id @default(uuid())
  source        String                        // "duels.ink" | "first-party"
  queue         String                        // "core-bo1" | "core-bo3" | ...
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
  id                 String   @id @default(uuid())
  snapshotId         String
  externalId         String                   // profiles[].id, or "pair:amber/emerald"
  archetypeId        String?                  // profiles[].archetypeId — often null
  name               String                   // archetypeName, else colors label
  colors             String[]
  games              Int
  winRate            Float
  playRate           Float?
  firstPlayerWinRate Float?
  centroidCards      Json?
  cardLift           Json?

  snapshot MetaSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)

  @@unique([snapshotId, externalId])
  @@index([snapshotId])
}

model MetaMatchup {
  id                 String   @id @default(uuid())
  snapshotId         String
  grain              String                   // "color-pair" | "archetype"
  keyA               String                   // "amber/emerald" or an archetypeId
  keyB               String
  games              Int
  winRate            Float                    // A's win rate vs B
  firstPlayerWinRate Float?

  snapshot MetaSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)

  @@unique([snapshotId, grain, keyA, keyB])
  @@index([snapshotId, grain])
}
```

- [ ] **Step 2: Generate the client and push the schema**

```bash
npx prisma generate && npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(meta): add MetaSnapshot/MetaArchetype/MetaMatchup models"
```

---

## Task 2: The adapter (pure, fixture-tested)

**Files:**
- Create: `api/_lib/metaAdapters/duelsPlatform.js`
- Test: `src/test/metaAdapter.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/test/metaAdapter.test.js`:

```js
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseDuelsMeta, DuelsMetaShapeError } from "../../api/_lib/metaAdapters/duelsPlatform.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures/duelsink-stats-meta.json", import.meta.url)), "utf8"),
);

describe("parseDuelsMeta", () => {
  it("extracts snapshot identity from the payload", () => {
    const { snapshot } = parseDuelsMeta(fixture, { queue: "core-bo1" });
    expect(snapshot.source).toBe("duels.ink");
    expect(snapshot.queue).toBe("core-bo1");
    expect(snapshot.era).toBe("set-13");
    expect(snapshot.totalGames).toBe(680300);
    expect(snapshot.uniquePlayers).toBe(14995);
    expect(snapshot.periodStart).toEqual(new Date("2026-08-16T00:00:00.000Z"));
    expect(snapshot.periodEnd).toEqual(new Date("2026-08-22T00:00:00.000Z"));
  });

  it("maps colorPairs to archetype rows with a pair: externalId", () => {
    const { archetypes } = parseDuelsMeta(fixture, { queue: "core-bo1" });
    const pair = archetypes.find((a) => a.externalId === "pair:amber/emerald");
    expect(pair).toMatchObject({
      name: "Amber/Emerald",
      colors: ["amber", "emerald"],
      games: 322638,
      winRate: 52.15,
      playRate: 23.71,
      firstPlayerWinRate: 59.5,
    });
  });

  it("maps profiles, preferring archetypeName and tolerating nulls", () => {
    const { archetypes } = parseDuelsMeta(fixture, { queue: "core-bo1" });
    const named = archetypes.find((a) => a.externalId === "019fa58f-e88a-741e-ac6d-f363121e2d76");
    expect(named.name).toBe("Midrange");
    expect(named.archetypeId).toBe("01a00f2a-d70a-75a2-bd15-60ccda218ae9");
    expect(named.centroidCards["10-55"]).toBe(4);

    const unnamed = archetypes.find((a) => a.externalId === "019fb352-efd5-79ee-a400-f8a85d87781f");
    expect(unnamed.name).toBe("Emerald");
    expect(unnamed.archetypeId).toBeNull();
  });

  it("keeps the two matchup grains separate", () => {
    const { matchups } = parseDuelsMeta(fixture, { queue: "core-bo1" });
    const pairGrain = matchups.filter((m) => m.grain === "color-pair");
    const archGrain = matchups.filter((m) => m.grain === "archetype");
    expect(pairGrain).toHaveLength(3);
    expect(archGrain).toHaveLength(3);
    expect(pairGrain[0]).toMatchObject({
      keyA: "amber/emerald",
      keyB: "amber/emerald",
      games: 40745,
      winRate: 49.42,
    });
    expect(archGrain[0]).toMatchObject({
      keyA: "019fc019-e6de-7e00-83aa-01fc2b16a367",
      keyB: "019fc541-78dc-7fe5-903b-3ef383c898ac",
      winRate: 38.84,
    });
  });

  // R2: fail loudly, write nothing.
  it("throws DuelsMetaShapeError when a required key is missing", () => {
    const broken = structuredClone(fixture);
    delete broken.colorPairs;
    expect(() => parseDuelsMeta(broken, { queue: "core-bo1" })).toThrow(DuelsMetaShapeError);
  });

  it("throws DuelsMetaShapeError when currentWeek is missing", () => {
    const broken = structuredClone(fixture);
    delete broken.meta.currentWeek;
    expect(() => parseDuelsMeta(broken, { queue: "core-bo1" })).toThrow(DuelsMetaShapeError);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/test/metaAdapter.test.js
```

Expected: FAIL — `Failed to resolve import ".../duelsPlatform.js"`.

- [ ] **Step 3: Implement the adapter**

Create `api/_lib/metaAdapters/duelsPlatform.js`:

```js
/**
 * Pure adapter: raw duels.ink /api/stats/meta payload -> normalized rows.
 *
 * No network, no DB. duels.ink offers no stability contract (see the spec), so
 * this validates aggressively and throws rather than emitting partial rows —
 * a partial write is worse than no write.
 */

export class DuelsMetaShapeError extends Error {
  constructor(message) {
    super(message);
    this.name = "DuelsMetaShapeError";
  }
}

const REQUIRED_TOP_LEVEL = ["meta", "activity", "colorPairs", "matchups", "profiles"];

function labelColors(colors) {
  return colors.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join("/");
}

function pairKey(colors) {
  return [...colors].sort().join("/");
}

export function parseDuelsMeta(raw, { queue }) {
  if (!raw || typeof raw !== "object") {
    throw new DuelsMetaShapeError("payload is not an object");
  }
  for (const key of REQUIRED_TOP_LEVEL) {
    if (!raw[key]) throw new DuelsMetaShapeError(`missing required key "${key}"`);
  }
  const week = raw.meta.currentWeek;
  if (!week?.startDate || !week?.endDate) {
    throw new DuelsMetaShapeError("missing meta.currentWeek.startDate/endDate");
  }
  const era = raw.meta.eras?.currentEra?.key;
  if (!era) throw new DuelsMetaShapeError("missing meta.eras.currentEra.key");
  if (typeof raw.activity.totalGames !== "number") {
    throw new DuelsMetaShapeError("missing activity.totalGames");
  }

  const snapshot = {
    source: "duels.ink",
    queue,
    era,
    periodStart: new Date(`${week.startDate}T00:00:00.000Z`),
    periodEnd: new Date(`${week.endDate}T00:00:00.000Z`),
    totalGames: raw.activity.totalGames,
    uniquePlayers: raw.activity.uniquePlayers ?? null,
    payload: raw,
  };

  const archetypes = [
    ...raw.colorPairs.map((p) => ({
      externalId: `pair:${pairKey(p.colors)}`,
      archetypeId: null,
      name: labelColors(p.colors),
      colors: p.colors,
      games: p.games,
      winRate: p.winRate,
      playRate: p.playRate ?? null,
      firstPlayerWinRate: p.firstPlayerWinRate ?? null,
      centroidCards: null,
      cardLift: null,
    })),
    ...raw.profiles.map((p) => ({
      externalId: p.id,
      archetypeId: p.archetypeId ?? null,
      // archetypeName is null for small unnamed clusters — fall back to the shape name.
      name: p.archetypeName ?? p.name ?? labelColors(p.colors ?? []),
      colors: p.colors ?? [],
      games: p.gamesPlayed,
      winRate: p.winRate,
      playRate: null,
      firstPlayerWinRate: null,
      centroidCards: p.centroidCounts ?? null,
      cardLift: p.cardLift ?? null,
    })),
  ];

  const matchups = [
    ...raw.matchups.map((m) => ({
      grain: "color-pair",
      keyA: pairKey(m.colorsA),
      keyB: pairKey(m.colorsB),
      games: m.games,
      winRate: m.winRate,
      firstPlayerWinRate: m.firstPlayerWinRate ?? null,
    })),
    ...(raw.archetypeMatchups ?? []).map((m) => ({
      grain: "archetype",
      keyA: m.archetypeIdA,
      keyB: m.archetypeIdB,
      games: m.games,
      winRate: m.winRate,
      firstPlayerWinRate: m.firstPlayerWinRate ?? null,
    })),
  ];

  return { snapshot, archetypes, matchups };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/test/metaAdapter.test.js
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/metaAdapters/duelsPlatform.js src/test/metaAdapter.test.js src/test/fixtures/duelsink-stats-meta.json
git commit -m "feat(meta): pure duels.ink stats adapter with shape validation"
```

---

## Task 3: Sync + persistence

**Files:**
- Create: `api/_lib/metaSync.js`
- Create: `api/cron/meta-sync.js`
- Modify: `vercel.json`

- [ ] **Step 1: Implement the sync module**

Create `api/_lib/metaSync.js`:

```js
import { PrismaClient } from "@prisma/client";
import { parseDuelsMeta } from "./metaAdapters/duelsPlatform.js";

const prisma = globalThis.__prisma ?? new PrismaClient();
if (!globalThis.__prisma) globalThis.__prisma = prisma;

const BASE = "https://duels.ink/api/stats/meta";

// R3: identify ourselves so duels.ink can throttle or block cleanly.
const USER_AGENT = "UninkableDeckBuilder/1.0 (+https://uninkabledeckbuilder.com)";

export const QUEUES = ["core-bo1", "core-bo3"];

export async function fetchDuelsMeta({ queue, period = "all_time", era = "current" }) {
  const url = `${BASE}?queue=${encodeURIComponent(queue)}&period=${period}&era=${era}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!res.ok) throw new Error(`duels.ink returned ${res.status} for ${queue}`);
  return res.json();
}

/** Persist one parsed snapshot. Idempotent on (source, queue, era, periodStart). */
export async function persistSnapshot({ snapshot, archetypes, matchups }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.metaSnapshot.findUnique({
      where: {
        source_queue_era_periodStart: {
          source: snapshot.source,
          queue: snapshot.queue,
          era: snapshot.era,
          periodStart: snapshot.periodStart,
        },
      },
    });

    // Never clobber an approved snapshot with a fresh pending pull.
    if (existing?.status === "approved") return { id: existing.id, skipped: true };

    if (existing) {
      await tx.metaArchetype.deleteMany({ where: { snapshotId: existing.id } });
      await tx.metaMatchup.deleteMany({ where: { snapshotId: existing.id } });
      await tx.metaSnapshot.update({ where: { id: existing.id }, data: { ...snapshot, capturedAt: new Date() } });
    }

    const row = existing ?? (await tx.metaSnapshot.create({ data: snapshot }));
    await tx.metaArchetype.createMany({ data: archetypes.map((a) => ({ ...a, snapshotId: row.id })) });
    await tx.metaMatchup.createMany({ data: matchups.map((m) => ({ ...m, snapshotId: row.id })) });
    return { id: row.id, skipped: false };
  });
}

/** Pull every configured queue. One request per queue (R3). */
export async function syncAllQueues() {
  const results = [];
  for (const queue of QUEUES) {
    try {
      const raw = await fetchDuelsMeta({ queue });
      // Throws DuelsMetaShapeError before any write if the shape drifted (R2).
      const parsed = parseDuelsMeta(raw, { queue });
      const { id, skipped } = await persistSnapshot(parsed);
      results.push({ queue, ok: true, snapshotId: id, skipped });
    } catch (err) {
      // R1: one queue failing must not abort the others or delete anything.
      console.error(`[meta-sync] ${queue} failed:`, err?.message ?? err);
      results.push({ queue, ok: false, error: String(err?.message ?? err) });
    }
  }
  return { syncedAt: new Date().toISOString(), results };
}
```

- [ ] **Step 2: Implement the cron handler**

Create `api/cron/meta-sync.js`, mirroring `api/cards/ingest.js`:

```js
import { syncAllQueues } from "../_lib/metaSync.js";

const SYNC_SECRET = process.env.DIGEST_SECRET || process.env.CRON_SECRET;

export default async function handler(req, res) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!SYNC_SECRET || token !== SYNC_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const summary = await syncAllQueues();
    return res.status(200).json(summary);
  } catch (err) {
    console.error("[meta-sync] failed:", err?.message ?? err);
    return res.status(500).json({ error: "Sync failed" });
  }
}
```

- [ ] **Step 3: Register the weekly cron**

In `vercel.json`, add to the `crons` array (Mondays 09:00 UTC, after duels.ink's week rolls over on the 16th/Saturday boundary):

```json
{ "path": "/api/cron/meta-sync", "schedule": "0 9 * * 1" }
```

- [ ] **Step 4: Verify auth fails closed**

```bash
npx vercel dev --listen 3001 &
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/cron/meta-sync
```

Expected: `401`

- [ ] **Step 5: Run one real sync and confirm rows land**

```bash
curl -s -H "Authorization: Bearer $DIGEST_SECRET" http://localhost:3001/api/cron/meta-sync | head -40
npx prisma studio
```

Expected: JSON with `ok: true` per queue; `MetaSnapshot` rows with `status: "pending"`, populated `MetaArchetype`/`MetaMatchup` children.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/metaSync.js api/cron/meta-sync.js vercel.json
git commit -m "feat(meta): weekly duels.ink sync cron with idempotent persistence"
```

---

## Task 4: Read + approve endpoints

**Files:**
- Create: `api/meta/current.js`
- Create: `api/meta/approve.js`

- [ ] **Step 1: Implement the read endpoint**

Create `api/meta/current.js`:

```js
import { PrismaClient } from "@prisma/client";

const prisma = globalThis.__prisma ?? new PrismaClient();
if (!globalThis.__prisma) globalThis.__prisma = prisma;

/** Latest APPROVED snapshot for a queue. Approved-only is the guardrail. */
export async function getCurrentMeta({ queue = "core-bo1" } = {}) {
  const snapshot = await prisma.metaSnapshot.findFirst({
    where: { queue, status: "approved" },
    orderBy: { periodStart: "desc" },
    include: {
      archetypes: { orderBy: { games: "desc" } },
      matchups: { where: { grain: "color-pair" }, orderBy: { games: "desc" }, take: 60 },
    },
  });
  if (!snapshot) return null;

  const ageDays = (Date.now() - snapshot.periodEnd.getTime()) / 86_400_000;
  return {
    source: snapshot.source,
    queue: snapshot.queue,
    era: snapshot.era,
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
    totalGames: snapshot.totalGames,
    uniquePlayers: snapshot.uniquePlayers,
    // R1: the page renders last-known-good with a banner rather than an error.
    stale: ageDays > 10,
    archetypes: snapshot.archetypes,
    matchups: snapshot.matchups,
  };
}

export default async function handler(req, res) {
  try {
    const data = await getCurrentMeta({ queue: req.query.queue || "core-bo1" });
    if (!data) return res.status(200).json({ empty: true });
    return res.status(200).json(data);
  } catch (err) {
    console.error("[meta/current] failed:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to load meta" });
  }
}
```

- [ ] **Step 2: Implement the approve endpoint**

Create `api/meta/approve.js`:

```js
import { PrismaClient } from "@prisma/client";

const prisma = globalThis.__prisma ?? new PrismaClient();
if (!globalThis.__prisma) globalThis.__prisma = prisma;

const ADMIN_SECRET = process.env.DIGEST_SECRET || process.env.CRON_SECRET;

// Sanity band from the spec: a plausible pull has a real sample and no absurd rates.
export function passesSanityCheck(snapshot) {
  if (snapshot.totalGames < 1000) return false;
  return snapshot.archetypes
    .filter((a) => a.games >= 500)
    .every((a) => a.winRate >= 30 && a.winRate <= 70);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const token = (req.headers["authorization"] || "").replace(/^Bearer\s+/i, "");
  if (!ADMIN_SECRET || token !== ADMIN_SECRET) return res.status(401).json({ error: "Unauthorized" });

  const { snapshotId, status } = req.body ?? {};
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: 'status must be "approved" or "rejected"' });
  }
  try {
    const snapshot = await prisma.metaSnapshot.findUnique({
      where: { id: snapshotId },
      include: { archetypes: true },
    });
    if (!snapshot) return res.status(404).json({ error: "Snapshot not found" });

    const sane = passesSanityCheck(snapshot);
    await prisma.metaSnapshot.update({ where: { id: snapshotId }, data: { status } });
    return res.status(200).json({ id: snapshotId, status, sanityCheckPassed: sane });
  } catch (err) {
    console.error("[meta/approve] failed:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to update snapshot" });
  }
}
```

- [ ] **Step 3: Approve the snapshot from Task 3 and verify the read**

```bash
curl -s -X POST -H "Authorization: Bearer $DIGEST_SECRET" -H "Content-Type: application/json" \
  -d "{\"snapshotId\":\"<id-from-task-3>\",\"status\":\"approved\"}" \
  http://localhost:3001/api/meta/approve
curl -s "http://localhost:3001/api/meta/current?queue=core-bo1" | head -20
```

Expected: approve returns `sanityCheckPassed: true`; the read returns archetypes with `stale: false`.

- [ ] **Step 4: Commit**

```bash
git add api/meta/current.js api/meta/approve.js
git commit -m "feat(meta): approved-only read endpoint and admin approve/reject"
```

---

## Task 5: The `/meta` page

**Files:**
- Create: `src/pages/MetaPage.jsx`
- Modify: `src/RouterApp.jsx`

- [ ] **Step 1: Build the page**

Create `src/pages/MetaPage.jsx`. Follow the styling of the existing tool pages under `src/pages/` — read `src/pages/ToolsHubPage.jsx` first and match its container, heading, and table conventions rather than inventing new ones.

```jsx
import { useEffect, useState } from 'react'

function pct(n) {
  return typeof n === 'number' ? `${n.toFixed(1)}%` : '—'
}

export default function MetaPage() {
  const [queue, setQueue] = useState('core-bo1')
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading')

  useEffect(() => {
    let cancelled = false
    setState('loading')
    fetch(`/api/meta/current?queue=${queue}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        if (json.empty) { setState('empty'); return }
        setData(json)
        setState('ready')
      })
      .catch(() => { if (!cancelled) setState('error') })
    return () => { cancelled = true }
  }, [queue])

  if (state === 'loading') return <div className="p-6">Loading meta…</div>
  if (state === 'error') return <div className="p-6">Couldn’t load meta data.</div>
  if (state === 'empty') {
    return <div className="p-6">No approved meta snapshot yet. Run the sync and approve a snapshot.</div>
  }

  const pairs = data.archetypes.filter((a) => a.externalId.startsWith('pair:'))

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Meta Overview</h1>
        <div className="flex items-center gap-3">
          <select value={queue} onChange={(e) => setQueue(e.target.value)} className="border rounded px-2 py-1">
            <option value="core-bo1">Core BO1</option>
            <option value="core-bo3">Core BO3</option>
          </select>
          <span className="text-sm opacity-70">
            {data.era} · {new Date(data.periodStart).toLocaleDateString()}–
            {new Date(data.periodEnd).toLocaleDateString()} · {data.totalGames.toLocaleString()} games
            {data.uniquePlayers ? ` · ${data.uniquePlayers.toLocaleString()} players` : ''}
          </span>
        </div>
        {/* R1: last-known-good, never blank. */}
        {data.stale && (
          <p className="rounded bg-amber-100 text-amber-900 px-3 py-2 text-sm">
            Data as of {new Date(data.periodEnd).toLocaleDateString()} — not currently refreshing.
          </p>
        )}
      </header>

      <section>
        <h2 className="text-lg font-medium mb-2">Color pairs</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Pair</th>
                <th className="py-2 pr-4">Play rate</th>
                <th className="py-2 pr-4">Win rate</th>
                <th className="py-2 pr-4">On the play</th>
                <th className="py-2 pr-4">Games</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-2 pr-4">{a.name}</td>
                  <td className="py-2 pr-4">{pct(a.playRate)}</td>
                  <td className="py-2 pr-4">{pct(a.winRate)}</td>
                  <td className="py-2 pr-4">{pct(a.firstPlayerWinRate)}</td>
                  <td className="py-2 pr-4">{a.games.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* R3 commitment, and correct regardless. */}
      <footer className="text-xs opacity-70">
        Meta data from{' '}
        <a className="underline" href="https://duels.ink/stats" target="_blank" rel="noreferrer">duels.ink</a>.
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Register the route**

In `src/RouterApp.jsx`, import `MetaPage` alongside the other page imports and add inside the `AppLayout` route block, next to `/tools`:

```jsx
<Route path="/meta" element={<MetaPage />} />
```

- [ ] **Step 3: Verify in the browser**

```bash
npm run build && npx vite preview
```

Navigate to `/meta`. Confirm: the pair table renders with real numbers, the "as of" line shows the period and game count, the queue selector switches data, and the duels.ink attribution link is present.

- [ ] **Step 4: Verify the stale banner actually renders**

Temporarily set an approved snapshot's `periodEnd` back 20 days via `npx prisma studio`, reload `/meta`, confirm the amber banner appears and the table still renders. Restore the date afterwards.

- [ ] **Step 5: Commit**

```bash
git add src/pages/MetaPage.jsx src/RouterApp.jsx
git commit -m "feat(meta): /meta overview page with staleness fallback"
```

---

## Task 6: Agent tool + staleness banners

**Files:**
- Modify: `api/_lib/agentTools.js`
- Modify: `src/data/agent-knowledge/meta-archetypes.md`
- Modify: `src/data/agent-knowledge/matchup-guide.md`
- Modify: `src/data/agent-knowledge/tech-cards.md`
- Test: `src/test/metaTools.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/test/metaTools.test.js`:

```js
import { describe, it, expect } from "vitest";
import { TOOL_SPECS } from "../../api/_lib/agentTools.js";

describe("get_current_meta tool spec", () => {
  const spec = TOOL_SPECS.find((t) => t.name === "get_current_meta");

  it("is registered", () => {
    expect(spec).toBeDefined();
  });

  it("is not hub-scoped", () => {
    expect(spec.input_schema.required ?? []).not.toContain("hubId");
  });

  it("tells the agent to prefer it over the static knowledge files", () => {
    expect(spec.description).toMatch(/agent-knowledge|knowledge file/i);
    expect(spec.description).toMatch(/date|as of/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run src/test/metaTools.test.js
```

Expected: FAIL — `spec` is undefined.

- [ ] **Step 3: Add the tool spec**

In `api/_lib/agentTools.js`, add to the `TOOL_SPECS` array (after `search_meta_reports`):

```js
  {
    name: "get_current_meta",
    description:
      "Get the current competitive meta snapshot: top color pairs and archetypes by play rate with win " +
      "rates, first-player win rates, sample sizes, the period covered, the set era, and the data source. " +
      "This is LIVE data and it OVERRIDES the static knowledge files — meta-archetypes.md, matchup-guide.md " +
      "and tech-cards.md are pinned to an older set and may contradict it. Call this before answering any " +
      "question about what is strong, popular, or winning right now. When you cite a figure from it, state " +
      "the date range and sample size so the user knows how current and how well-supported it is. Not " +
      "hub-scoped — this is global data, no hub id needed.",
    input_schema: {
      type: "object",
      properties: {
        queue: {
          type: "string",
          description: 'Which queue to read: "core-bo1" (default) or "core-bo3".',
        },
      },
    },
  },
```

- [ ] **Step 4: Add the handler**

At the top of `api/_lib/agentTools.js`, add the import:

```js
import { getCurrentMeta } from "../meta/current.js";
```

Add the handler function alongside the other `tool*` functions:

```js
async function toolGetCurrentMeta(input) {
  const data = await getCurrentMeta({ queue: input.queue || "core-bo1" });
  if (!data) return { error: "No approved meta snapshot is available yet." };
  return {
    source: data.source,
    queue: data.queue,
    era: data.era,
    period: `${data.periodStart.toISOString().slice(0, 10)} to ${data.periodEnd.toISOString().slice(0, 10)}`,
    totalGames: data.totalGames,
    uniquePlayers: data.uniquePlayers,
    stale: data.stale,
    archetypes: data.archetypes.slice(0, 20).map((a) => ({
      name: a.name,
      colors: a.colors,
      games: a.games,
      winRate: a.winRate,
      playRate: a.playRate,
      firstPlayerWinRate: a.firstPlayerWinRate,
    })),
    matchups: data.matchups.slice(0, 30).map((m) => ({
      a: m.keyA,
      b: m.keyB,
      games: m.games,
      winRate: m.winRate,
    })),
  };
}
```

Register it in `HANDLERS`:

```js
  get_current_meta: toolGetCurrentMeta,
```

- [ ] **Step 5: Run to verify it passes**

```bash
npx vitest run src/test/metaTools.test.js
```

Expected: PASS, 3 tests.

- [ ] **Step 6: Add staleness banners to the three volatile knowledge files**

At the very top of each of `src/data/agent-knowledge/meta-archetypes.md`, `matchup-guide.md`, and `tech-cards.md`, insert:

```markdown
> ⚠️ **Possibly stale — written against Set 12.** The live meta may have moved. Call the
> `get_current_meta` tool for current win rates, play rates and matchups, and prefer its
> numbers over anything in this file where they conflict. Use this file for the *reasoning*
> (why an archetype works, what it wants to do), not for current *standings*.
```

Do **not** add this to `role-theory.md`, `synergy-theory.md`, `game-state-evaluation.md`,
`archetype-playbooks.md` or `gameplay-heuristics.md` — those are timeless and stay as-is.

- [ ] **Step 7: Add eval questions**

Append to `evals/agent/gold-questions.json` — match the file's existing entry shape exactly (open it first):

```json
{
  "question": "What's the strongest color pair in Core BO1 right now, and how confident should I be?",
  "expects": ["get_current_meta", "date range", "sample size"],
  "notes": "Must call get_current_meta and cite the period + game count, not assert a Set 12 standing."
}
```

- [ ] **Step 8: Run the full suite**

```bash
npx vitest run
```

Expected: all tests pass (was 190 on this branch; expect 199 with the 9 added here).

- [ ] **Step 9: Verify end-to-end in the browser**

Start the app, go to `/ask`, and ask: *"What's the best deck right now?"* Confirm the agent calls `get_current_meta`, quotes a win rate that matches the `/meta` page, and states the date range.

- [ ] **Step 10: Commit**

```bash
git add api/_lib/agentTools.js src/test/metaTools.test.js src/data/agent-knowledge/meta-archetypes.md src/data/agent-knowledge/matchup-guide.md src/data/agent-knowledge/tech-cards.md evals/agent/gold-questions.json
git commit -m "feat(agent): get_current_meta tool + staleness banners on Set-12 knowledge files"
```

---

## Done when

- `npx vitest run` is green.
- `/meta` renders live numbers, switches queues, and shows the stale banner when data ages out.
- Asking `/ask` "what's the best deck right now" produces a dated, sample-sized answer sourced from `get_current_meta` rather than a Set-12 assertion.
- The weekly cron is registered in `vercel.json` and returns 401 without the secret.

## Deliberately not in this plan

- **Backfill of `meta.availableWeeks`.** The spec calls for seeding 6 weeks of history on first run. It needs a `period` parameter mapping that isn't yet confirmed (the endpoint takes `period=all_time`; the per-week parameter form is unverified). Do it as a follow-up once someone confirms the week-selector's query shape from the browser network tab. Until then the pipeline accumulates forward from first run.
- **The archetype-grain matchup UI.** Rows are captured and stored; only the color-pair grain is rendered. Surfacing 3,120 archetype matchups needs a filter/search design that isn't worth blocking the first ship on.
- **First-party adapter.** The `MetaArchetype`/`MetaMatchup` shape is source-agnostic on purpose, but wiring `PlaytestGame` into it is separate work.
