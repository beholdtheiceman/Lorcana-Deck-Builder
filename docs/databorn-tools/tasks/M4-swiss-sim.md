# Task M4 — Swiss Tournament Simulator

Implementing engineer. Milestone 4 from `docs/databorn-tools/PLAN.md`. M0–M3 merged. Implement exactly this scope.

## Build on what exists
- `src/pages/tools/SwissPage.jsx` is a stub — replace it.
- Charts: **Recharts** (already a dep). No new dependencies.
- This tool is deck-agnostic — no `DeckPayload` needed.

## Deliverables
1. **`src/lib/swiss.js`** — pure Monte Carlo core, no React, no DOM:
   - `simulate({ players, rounds, record, winProbability, iterations, seed })` → results:
     - final **points distribution** (map points → probability/frequency),
     - probability of finishing **top-N** and of reaching a **points threshold**,
     - an **approximate OMW%** (opponents' match-win %) band — clearly labeled as an approximation,
     - **intentional-draw safety**: given the current record and remaining rounds, probability of making cut if you draw vs. play out.
   - Use a **seeded PRNG** (e.g. mulberry32/xorshift) so runs are deterministic given `seed` — this is required for testable output. Do NOT use `Math.random()` in the core.
2. **`src/workers/swiss.worker.js`** — runs `swiss.js` off the main thread; receives params via `postMessage`, posts back results. (Standard Vite web-worker module.)
3. **`src/pages/tools/SwissPage.jsx`** — the tool UI:
   - Inputs: player count, number of Swiss rounds, current record (wins-losses), optional per-round win probability (default 50%), iterations (sane default, e.g. 10000).
   - Run button that drives the worker; progress/disabled state while it runs.
   - Results: summary stats + a **histogram** of the points distribution (Recharts), plus the top-N / threshold / intentional-draw readouts.
4. **`src/test/swiss.test.js`** — cover:
   - **Determinism**: same `seed` → identical results; different `seed` → (generally) different.
   - **Sanity**: 50% win probability over R rounds centers the points distribution near R/2 wins (assert the mean/mode is within tolerance).
   - A threshold-probability case with a hand-reasoned expected ballpark.

## Constraints
- No new dependencies.
- Do not touch `src/App.jsx` or other milestones' files.
- Keep the full suite green (`npx vitest run`).
- Match existing Tailwind + CSS-variable styling (see `DeckChangePage.jsx`).

## Done criteria
- `/tools/swiss` renders; running a simulation shows a points histogram and the summary readouts without freezing the UI (worker-driven).
- `swiss.js` is deterministic under a seed and passes the sanity + determinism tests.
- End with a concise summary of files changed and any decisions/uncertainties (especially any simplifying assumptions in the OMW% / pairing model).
