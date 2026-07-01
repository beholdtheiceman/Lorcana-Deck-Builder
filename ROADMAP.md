# Team Hub — Roadmap & Implementation Plan

The app's center of gravity is shifting from the deck builder to the Team Hub. Everything in
this plan serves that goal: make the hub the first thing teammates see, make it useful on day
one, and make the AI features impossible to miss.

---

## Phase 0 — Reorientation (1–2 days)
*Low effort, high signal. Do this first so every subsequent change lands in the right frame.*

### 0.1 — Default route
**File:** `src/RouterApp.jsx`

Change the root route from the deck builder to the hub list:
```jsx
// Before
<Route path="/" element={<BuilderPage />} />

// After
<Route path="/" element={<Navigate to="/team-hub" replace />} />
<Route path="/builder" element={<BuilderPage />} />
```

Returning users land in their hub. New users hit the sign-in/join flow. The deck builder is
still fully accessible from the nav — it just isn't the homepage anymore.

### 0.2 — Branding & nav
**File:** `src/RouterApp.jsx` (TopNav component)

- Rename the app from "Lorcana Deck Builder" to something hub-first (e.g. **"Team Lorcana"**
  or just your team's name if this is a single-team tool)
- Reorder nav links: Team Hub first, Deck Builder second
- Consider renaming the "Deck Builder" nav link to "Deck Lab" or "Theory Craft" to frame it
  as a supporting tool, not the main event

### 0.3 — Simplify to single-hub UX
**Files:** `src/pages/HubListPage.jsx`, `src/pages/HubDetailLayout.jsx`

The multi-hub model (HubListPage → pick a hub → enter) adds friction for players who will
only ever be on one team. Options:

- **Simple path:** If a user belongs to exactly one hub, skip the list and redirect straight
  to `/team-hub/:id`. Only show the list if they're in zero hubs (join/create prompt) or
  multiple.
- **Aggressive path:** Enforce one active hub per user. Keep the schema flexible but limit
  the UI to one hub.

The simple path is lower risk and handles edge cases gracefully.

---

## Phase 1 — Finish the Hub (1–2 weeks)
*Several tab pages are 7-line stubs. Fill them in so the hub feels complete.*

### 1.1 — Roster page
**File:** `src/pages/hub/RosterPage.jsx`, `src/components/team/RosterTab.jsx`

The `RosterTab` component exists but may be incomplete. A full roster page needs:
- Member list with display name, role (captain/member), join date
- "Pet decks" / pilot history — what archetypes does each person play?
- Notes field (visible to hub owner, optionally public)
- Edit-own-profile flow (display name, decks, notes)
- Owner can edit any member's entry

Schema already supports this via `HubMember` — check if `displayName`, `petDecks`,
`pilotHistory`, `notes` fields exist; add via migration if not.

### 1.2 — Practices page
**File:** `src/pages/hub/PracticesPage.jsx`, `src/components/team/PracticesTab.jsx`

The `PracticesTab` component exists. Verify and polish:
- Post a session: date, time, format (Standard / Constructed / Draft), notes
- RSVP: Yes / Maybe / No — visible to all hub members
- Edit/delete by creator or owner
- Past practices archived below upcoming ones
- After practice: prompt to log match results (links to Playtest tab)

### 1.3 — Playtest / Win-Rate page
**File:** `src/pages/hub/PlaytestPage.jsx`, `src/components/PlaytestLog.jsx`

`PlaytestLog` exists and is wired in. Focus on the *viewing* side:
- Per-matchup win rates: your deck vs opponent deck, filterable by date range
- Per-member breakdown (who's piloting what, how are they doing)
- Hub-wide aggregate stats
- Export to CSV for external analysis

The `PlaytestGame` schema already supports this data — this is mostly a display/charting
problem. Recharts is already in the project.

### 1.4 — Events page
**File:** `src/pages/hub/EventsPage.jsx`, `src/components/EventsPanel.jsx`

`EventsPanel` is wired in. Verify:
- Post upcoming tournaments with name, date, location, format, link
- RSVP / attendance tracking per member
- Discord webhook fires when a new event is posted
- Past events visible with attendance records (useful for tracking who shows up)

### 1.5 — Primers page
**File:** `src/pages/hub/PrimersPage.jsx`, `src/components/PrimerEditor.jsx`

`PrimerEditor` exists. A primer is a structured deck write-up:
- Deck name + archetype, ink colors, author
- Card choices section (why these cards?)
- Matchup notes section (vs major archetypes)
- Sideboard / tech card notes
- Filterable by archetype or ink color
- Link from the Playtest tab ("you've been playing Steel/Amber — read the primer")

### 1.6 — Meta Reports page
**File:** `src/pages/hub/ReportsPage.jsx`, `src/components/team/MetaReportsTab.jsx`

`MetaReportsTab` exists. Verify:
- Post markdown write-ups
- Tags: meta, matchup, event-report, or custom
- Tag-based filtering
- AI-assisted draft (see Phase 2)

### 1.7 — Cut or simplify Pods
**File:** `src/pages/hub/PodsPage.jsx`, `src/components/team/PodsTab.jsx`

Pods (sub-groups within a hub) add organizational overhead that doesn't pay off at typical
team sizes (5–15 people). Recommended action:

- **If the team is small (< 10):** Remove the Pods tab from the nav for now. The schema can
  stay; hide the feature behind a flag or owner setting.
- **If you want to keep it:** Limit it to one use: pairing people into practice groups for a
  specific session. Don't try to make Pods a persistent org structure.

---

## Phase 2 — AI Features Front and Center (1–2 weeks)
*These are the things no Discord+Sheets setup can do. They should be prominent, not buried.*

### 2.1 — Elevate the Ask page
**File:** `src/pages/hub/AskPage.jsx`

The Ask page (AI Q&A over your team's data) is the most novel feature in the app. Currently
it's a sidebar tab. Make it more visible:

- Surface a persistent "Ask" input on the hub overview/home page — like a search bar
- Pre-populate example questions so new users understand what's possible:
  - "What's our win rate against Amber/Steel this month?"
  - "Who has the most games logged?"
  - "What's the best deck to bring to a Tier 1 meta right now?"
- Make sure the AI has access to hub-specific data (playtest games, roster, reports) not just
  general Lorcana knowledge
- Show LLM budget usage somewhere visible (the `LlmUsage` model exists — surface it)

### 2.2 — Polish Replay Review
**Files:** `src/components/ReplayUpload.jsx`, `src/components/ReplayReviewPanel.jsx`,
`src/pages/hub/ReviewsPage.jsx`

The replay review flow (upload duels.ink replay → AI analyzes → annotated feedback) is the
second major differentiator. Make the submission and output experience clean:

- Clear upload prompt with format explanation (what is a duels.ink replay file?)
- Loading state that sets expectations ("Analysis takes ~30 seconds")
- Output format: turn-by-turn with flagged decision points, not a wall of text
- Reviewer can add their own annotations before sharing with the hub
- Share to hub posts the review to the Reviews tab for teammates to read

Ensure LLM budget enforcement is working (cap per hub per month, show remaining budget).

### 2.3 — AI-assisted Meta Report drafting
**File:** `src/components/team/MetaReportsTab.jsx` or `ReportsPage.jsx`

When a member clicks "New Report", offer:
1. **Blank report** — just the markdown editor
2. **AI draft** — prompts the user for context (what meta are you analyzing? what events?),
   then generates a structured draft they can edit before posting

The AI draft should pull from the hub's playtest data where possible ("based on 47 games
logged this month, Amber/Steel has a 62% win rate in your hub").

### 2.4 — Standings image import (surface this feature)
**File:** `src/components/StandingsImageImport.tsx`

Tesseract.js OCR is already in the project. If a player can snap a photo of tournament
standings and have results auto-populated into the hub, that's a killer feature for post-event
data collection. Make sure this is:

- Accessible from the Events tab (after an event ends, "Import Standings")
- Results flow into `TournamentResult` records linked to the event
- Visible in the playtest/win-rate aggregate data

---

## Phase 3 — Onboarding & Retention (1 week)
*The hub only works if teammates actually use it. Make joining and returning frictionless.*

### 3.1 — Fix invite code flow
The PRD flagged invite code regeneration as broken. Before pushing teammates to join:
- Test the full join flow end-to-end (receive code → create account → land in hub)
- Fix invite code regeneration (owner should be able to refresh the code)
- Make the invite code copy-to-clipboard prominent in the hub settings
- Add a shareable invite link (`/join?code=XXXXXXXX`) so teammates don't have to manually
  enter the code

### 3.2 — New member onboarding
When a user joins a hub for the first time:
- Welcome screen: "You've joined [Hub Name]. Here's how to get started."
- Step 1: Fill out your profile (display name, what decks you play)
- Step 2: RSVP to the next practice
- Step 3: Log your first match result

Don't make this a modal wizard — a simple prompt banner at the top of the hub overview that
disappears once each step is completed is enough.

### 3.3 — Discord webhook expansion
**Files:** `api/discord/`, hub settings

Webhooks are already set up for events. Extend to:
- New practice posted → Discord notification with RSVP link
- New meta report posted → Discord notification with preview
- Weekly digest (cron): win rates, upcoming practices, recent reports

The weekly digest is the highest-leverage item — it keeps the hub alive in Discord even when
teammates forget to log in.

---

## Phase 4 — Mobile Polish (1 week)
*Players at locals log results on their phones. The hub needs to work there.*

Priority screens to audit and fix for mobile:
1. **Playtest logging** — the core action after a game. Must be one-thumb operable.
2. **RSVP to practice** — should be a single tap
3. **Hub overview** — the first thing a player sees; must orient them quickly on a small screen
4. **Ask page** — typing a question on mobile should work well

Lower priority (can be desktop-only for now):
- Primer editor (writing-heavy, desktop is fine)
- Meta report editor
- Hub settings / member management

General approach: test each screen at 390px width (iPhone 14 size). Look for horizontal
overflow, tiny tap targets, and modals that break on small screens.

---

## Phase 5 — Tech Debt (ongoing, background)
*Won't ship features on its own but makes everything else faster and safer.*

### 5.1 — Break up App.jsx
`src/App.jsx` is ~11,000 lines. This isn't urgent but it compounds every time someone touches
it. Target breakdown:
- Extract deck builder UI into `src/features/deckbuilder/`
- Extract state management into custom hooks (`useDeckState`, `useCardSearch`, etc.)
- Extract utility functions into `src/utils/`
- Don't try to do this all at once — pull out one section per sprint until it's manageable

### 5.2 — API consistency
The `api/` directory has grown organically. Before adding more endpoints:
- Standardize error response shapes (`{ error: string }` everywhere)
- Standardize auth checks (middleware vs inline — pick one)
- Add basic request validation (Zod is already in the project)

### 5.3 — Test coverage for critical paths
The `src/test/` directory exists. Priority paths to cover:
- Auth (sign up, sign in, reset password)
- Hub join flow (invite code validation)
- Playtest game logging and win-rate calculation
- LLM budget enforcement

---

## Summary: Phased Priority Order

| Phase | What | Why first |
|-------|------|-----------|
| 0 | Reorientation (routing, branding, single-hub UX) | Sets the frame for everything else |
| 1 | Finish stub pages (Roster, Practices, Playtest, Events, Primers, Reports) | Hub must feel complete before you recruit teammates |
| 2 | AI features front and center (Ask, Replay Review, AI reports, Standings OCR) | The actual differentiator vs Discord+Sheets |
| 3 | Onboarding & retention (invite flow, welcome UX, Discord webhooks) | No point in a great hub if people can't get in or forget to come back |
| 4 | Mobile polish | Players log results in the wild |
| 5 | Tech debt (App.jsx refactor, API consistency, tests) | Background, ongoing |

---

## Phase 6 — UI / UX Polish (ongoing)
*End-to-end experience pass — login through deck export.*

### 6.1 — Auth modals
**Files:** `src/components/LoginModal.jsx`, `src/components/RegisterModal.jsx`, `src/components/AuthButton.jsx`

Small changes, big feel difference:
- Replace "Login" / "Register" copy with "Sign in" / "Create account"
- Add the app logo to the modal header so it feels on-brand, not generic
- Unify button colors — the auth modals should use violet, not whatever color was closest at the time
- Ensure all inputs use the same focus style (currently `focus:border-emerald-400` in login — should match the rest of the app)

### 6.2 — Hub List Page redesign
**File:** `src/pages/HubListPage.jsx`

This is the roughest screen in the app — built fast and never styled to match the rest:
- The hub card uses raw `bg-gray-800` and hard-coded `bg-blue-600` for the owner row — restyle to match the dark glass aesthetic used in `HubDetailLayout` (`bg-white/[0.03]`, `border-white/10`, etc.)
- Show display names instead of raw email addresses for hub members
- Scope visible actions by role: non-owners shouldn't see Regenerate/Delete/Transfer; owners shouldn't see Leave
- For users in exactly one hub, skip this page and redirect straight to their hub (see Phase 0.3)

### 6.3 — Hub tab strip
**File:** `src/pages/HubDetailLayout.jsx`

10 tabs is too many, especially on mobile where they scroll off-screen:
- Rename tabs to be communicative, not just labels:
  - "Playtest" → "Match Log"
  - "Reports" → "Meta"
  - "Reviews" → "Replays"
  - "Ask" → "Ask AI"
- If Pods is hidden (per Phase 1.7), that's already one gone
- Consider grouping lower-priority tabs behind a "More ▾" dropdown, keeping the main strip to 6–7 items max

### 6.4 — Hub Overview layout
**File:** `src/pages/hub/HubOverviewPage.jsx`

The overview is well-built but underutilizes the space:
- Move the 4 stat cards into a 2×2 grid (they're currently stacked or in a single row)
- Add an activity feed column on the right: last 5 actions across the hub (match logged, report posted, practice RSVP'd)
- Surface the Ask AI input directly on this page — a single text field above the stat cards with placeholder "Ask about your team's data..."
- Tighten vertical spacing between sections — there's too much whitespace between the stat band and the section cards

### 6.5 — Kill the double navigation
**Files:** `src/App.jsx`, `src/RouterApp.jsx`

The deck builder has its own internal topbar, which coexists awkwardly with the global nav in `RouterApp.jsx`. When the deck builder is a secondary feature (accessed from the nav), its internal topbar should be simplified — the logo, auth buttons, and Team Hub toggle it currently shows are redundant with the global nav. Strip the deck builder's topbar down to just deck-management controls (save, export, deck name), or remove it entirely and rely on the global nav.

### 6.6 — Deck image export UX
**File:** `src/App.jsx` (`generateDeckImage` function, ~line 8214)

The image generation works but the UX has rough edges:
- The user gets no progress feedback during what can be a 15–30 second wait — add a progress indicator: "Loading card images... 28/60"
- Failure mode is a raw `alert()` — replace with an inline error state on the button/panel
- The function tries 5–6 image sources per card sequentially; consider parallelizing or pre-checking which URLs are live before generation starts
- Consolidate the export actions (JSON download, image download) into a single "Export ▾" button with a small dropdown menu — currently they're scattered

### 6.7 — Design system consistency pass
**Files:** `src/index.css`, all component files

The app is mostly consistent but has pockets of off-brand styling from quick fixes:
- Audit and eliminate hardcoded `bg-blue-600`, `bg-green-600` button colors — everything interactive should use violet (primary) or a neutral (secondary/destructive)
- Standardize input styles across all forms — pick one focus ring color and use it everywhere
- Replace all `alert()` and `confirm()` calls with inline error states and confirmation modals (there are several in HubListPage and the deck builder)
- Audit `bg-gray-800` vs `bg-white/[0.03]` — the hub uses the latter (glass-style), but the hub list page and modals use the former. Pick one and apply it consistently to card/modal surfaces.

---

## What to cut

- **Pods** — hide until team size justifies it
- **Multi-hub UI** — auto-redirect single-hub users, don't make them pick
- **"Lorcana Deck Builder" as the product name** — if this is a team tool, name it like one
