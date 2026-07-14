# Task M5 — Performance Analyzer

Implementing engineer. Milestone 5 (final) from `docs/databorn-tools/PLAN.md`. M0–M4 merged. Implement exactly this scope.

## SCOPE FENCE (read first)
Touch **only** the files listed under Deliverables. Do **NOT** modify anything under `api/`, `src/App.jsx`, the AI-agent files (`agent.js`, `agentTools.js`, `agentKnowledge.js`), or any other milestone's files. If you believe another change is needed, **write it in your summary instead of making it**. A previous milestone was rejected for out-of-scope edits.

## Build on what exists
- `src/pages/tools/PerformancePage.jsx` is a stub — replace it.
- Charts: **Recharts** (already a dep).
- PDF snapshot: reuse `src/lib/pdf.js` (from M3) if you add an export-snapshot feature.
- This tool works on a user-uploaded CSV; it is deck-agnostic (optionally link deck names to saved decks, but not required).

## Deliverables
1. **`src/lib/csv.js`** — a small, dependency-free CSV parser (no new npm deps): handles quoted fields, commas/newlines inside quotes, escaped quotes, and a header row → array of row objects. Tolerant of ragged rows.
2. **`src/lib/performanceStats.js`** — pure, no React:
   - From normalized rows (columns for date, my deck, opponent deck, result win/loss, on-play/on-draw), compute: overall win rate; win rate **by my deck** and **by matchup**; **play/draw** split win rates; a **time-series** of win rate with a rolling average; and a simple **tilt heuristic** (e.g. win-rate drop across consecutive losses in a session).
   - Be tolerant of missing/absent columns (compute what's available).
3. **`src/pages/tools/PerformancePage.jsx`** — the tool UI:
   - CSV upload (client-side; no server upload) → a **column-mapping** step (tolerant to schema drift; let the user map detected headers to the known fields) → analytics dashboard with Recharts (win-rate tiles, by-deck/by-matchup tables, play/draw split, trend line).
   - Optional "Export snapshot" via `pdf.js`.
4. **`src/test/performanceStats.test.js`** and **`src/test/csv.test.js`**:
   - `csv.js`: quoted fields, embedded commas/newlines, escaped quotes, empty file, ragged rows.
   - `performanceStats.js`: a fixture with known outcomes → assert overall/by-deck/by-matchup win rates, play/draw split, and a tilt trigger.

## Constraints
- **No new dependencies.**
- Obey the SCOPE FENCE above — only the files listed here.
- Keep the full suite green (`npx vitest run`).
- Match existing Tailwind + CSS-variable styling (see `DeckChangePage.jsx`).

## Done criteria
- `/tools/performance` renders; uploading a CSV and mapping columns shows correct analytics; malformed rows don't crash it.
- `csv` and `performanceStats` have passing unit tests.
- End with a concise summary of files changed and any decisions/uncertainties. List any out-of-scope changes you thought were needed but did NOT make.
