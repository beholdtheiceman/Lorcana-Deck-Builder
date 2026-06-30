# UX Overhaul Design Spec
**Date:** 2026-06-29  
**Scope:** Option B — Design tokens + primitive components + Team Hub routing + consistency pass

---

## Overview

Polish the Lorcana Deck Builder app to feel finished. Three-part plan: (1) build a shared design token system and primitive component library so all polish compounds automatically, (2) convert the Team Hub from modal-in-modal to real routed pages, (3) sweep every screen for loading/empty/error states using the new primitives.

Phases 4–5 from the audit (a11y, responsive, App.jsx split) are out of scope for this cycle and handled as follow-up.

---

## Section 1 — Design Tokens

Drop into `tailwind.config.js` under `theme.extend`:

```js
colors: {
  ink: {
    amber: '#f4b223', amethyst: '#9b59d0', emerald: '#2ecc71',
    ruby: '#e74c5e', sapphire: '#3aa0e0', steel: '#9aa7b8',
  },
  bg: { base: '#0e1116', raised: '#161b24', overlay: '#1d2430' },
  line: '#2a3340',
  brand: { DEFAULT: '#8b5cf6', fg: '#0e1116' },
  good: '#2ecc71', warn: '#f4c542', bad: '#e74c5e',
},
borderRadius: { sm: '8px', md: '12px', lg: '16px', xl: '20px' },
boxShadow: { card: '0 6px 24px rgba(0,0,0,.35)' },
fontSize: {
  xs: '12px', sm: '13px', base: '14px', lg: '17px', xl: '22px', '2xl': '30px',
},
transitionDuration: { fast: '120ms', base: '180ms' },
```

Spacing stays on Tailwind's 4px base scale. Ink colors serve as the brand system throughout (charts, badges, deck color indicators).

---

## Section 2 — Primitive Component Library

All components live in `src/components/ui/`. Each is a focused, single-purpose component with no internal data fetching.

### Button
- Variants: `primary` (brand fill) | `ghost` (outline) | `danger` (red) | `subtle` (low-contrast)
- Sizes: `sm` | `md`
- Props: `loading` (shows Spinner + disables), `icon` slot (left of label)
- Never use raw `<button>` tags in feature code after this exists

### Card
- Consistent surface: `bg-bg-raised border border-line rounded-md shadow-card p-4`
- Used for hub cards, deck cards, session rows, pod cards

### Badge
- Tone variants: `default` | `good` | `warn` | `bad` | per-ink (`amber`, `amethyst`, `emerald`, `ruby`, `sapphire`, `steel`)
- Used for: legality status, ink color tags, RSVP status, match results

### Input / Select / Textarea
- Shared height (`h-9` for Input/Select), consistent focus ring (`ring-brand`), error state (red border + helper text below)
- Always paired with a `<label>` — never bare inputs

### Tabs
- Props: `tabs` array of `{ label, value }`, `value`, `onChange`
- Active tab: underline + brand color text
- Keyboard: arrow keys navigate, Enter/Space selects
- Used for in-page tab groups — routed tabs use `NavLink` directly

### EmptyState
- Props: `icon`, `title`, `description`, `action` (`{ label, onClick }`)
- Centered layout, subtle icon, muted description, primary Button CTA

### Skeleton
- Variants: `line` (text placeholder) | `block` (image/card placeholder) | `card` (full card shimmer)
- Replaces every bare "Loading…" string in the codebase

### Toast
- Variants: `success` | `error` | `info`
- Auto-dismisses after 4s, manually dismissible
- Single `<ToastProvider>` at app root in `main.jsx`
- Hook: `useToast()` returns `{ toast }` — call `toast.success('Saved!')` etc.

### Spinner
- Small animated spinner for inline use (inside Button loading state, etc.)

---

## Section 3 — Team Hub Routing

### Route Structure

```
/team-hub                           HubListPage     — browse/join hubs
/team-hub/:id                       → redirect to /team-hub/:id/roster
/team-hub/:id/*                     HubDetailLayout — persistent header + sub-nav
  /team-hub/:id/roster              RosterTab
  /team-hub/:id/pods                PodsTab
  /team-hub/:id/practices           PracticesTab
  /team-hub/:id/events              EventsPanel
  /team-hub/:id/reports             MetaReportsTab
  /team-hub/:id/reviews             ReviewArchive
  /team-hub/:id/primers             PrimerEditor
  /team-hub/:id/playtest            PlaytestTab (PlaytestLog + ReplayUpload)
```

### New Files

- `src/pages/HubListPage.jsx` — extracts the hub browser from `TeamHub.jsx`
- `src/pages/HubDetailLayout.jsx` — hub header (name, description, member count, leave/settings) + horizontal sub-nav using `NavLink` + `<Outlet />`
- Each tab moved to `src/pages/hub/` (e.g., `RosterPage.jsx` wrapping `RosterTab.jsx`)

### Files Deleted
- `src/components/HubDetailModal.jsx` — fully replaced by the routed layout

### RouterApp.jsx changes

```jsx
<Route path="/team-hub" element={<HubListPage />} />
<Route path="/team-hub/:id" element={<HubDetailLayout />}>
  <Route index element={<Navigate to="roster" replace />} />
  <Route path="roster" element={<RosterPage />} />
  <Route path="pods" element={<PodsPage />} />
  <Route path="practices" element={<PracticesPage />} />
  <Route path="events" element={<EventsPage />} />
  <Route path="reports" element={<ReportsPage />} />
  <Route path="reviews" element={<ReviewsPage />} />
  <Route path="primers" element={<PrimersPage />} />
  <Route path="playtest" element={<PlaytestPage />} />
</Route>
```

### Hub context

`hubId` is read from `useParams()` in each page. Hub metadata (name, role, members) fetched once in `HubDetailLayout` and passed via context or props to sub-pages. The existing `hubAuth` API middleware is unchanged.

---

## Section 4 — Consistency Pass

Applied to every screen after primitives + routing are in place:

| Pattern | Replaces |
|---|---|
| `<Skeleton />` | Every bare "Loading…" string |
| `<EmptyState />` | Every empty list with no CTA |
| `<Toast />` | Silent failures, bare `alert()`, unacknowledged saves |
| `<Button loading>` | Submit buttons that don't disable during async ops |

Screens in scope: all Team Hub tabs, deck builder, playtest log, replay upload, events panel, auth modals.

---

## Out of Scope (this cycle)

- Accessibility sweep (focus rings, aria, keyboard nav)
- Responsive / mobile layouts
- App.jsx split into feature modules + code splitting
- Persistent left sidebar (naurcana-style nav)
- Home command-center screen
- Debug log cleanup (`console.log` removal)
