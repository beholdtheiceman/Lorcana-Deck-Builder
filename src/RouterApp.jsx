import { BrowserRouter, Routes, Route, Link, NavLink, Outlet } from 'react-router-dom'
import AuthButton from './components/AuthButton'
import TeamHub from './components/TeamHub'
import DeckBuilderApp from './App.jsx'
import { useAuth } from './contexts/AuthContext'

import { StandingsTab } from './components/playhub/StandingsTab.jsx'
import { ThisWeekTab } from './components/playhub/ThisWeekTab.jsx'
import { TeamsTab } from './components/playhub/TeamsTab.jsx'
import { AdminTab } from './components/playhub/AdminTab.jsx'

function TopNav() {
  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
      isActive ? 'bg-gray-800 border-gray-600 text-white' : 'bg-gray-900/40 border-gray-800 text-gray-200 hover:bg-gray-800'
    }`

  const ddLinkClass = ({ isActive }) =>
    `block px-3 py-2 rounded-md text-sm ${isActive ? 'bg-gray-800 text-white' : 'text-gray-200 hover:bg-gray-800'}`

  return (
    <div className="sticky top-0 z-50 border-b border-gray-800 bg-black/70 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="font-semibold text-emerald-400">
            Lorcana League
          </Link>
          <NavLink to="/builder" className={linkClass}>
            Deck Builder
          </NavLink>
          <NavLink to="/team-hub" className={linkClass}>
            Team Hub
          </NavLink>

          {/* THL-style dropdowns */}
          <details className="relative">
            <summary className="list-none cursor-pointer select-none">
              <span className="px-3 py-2 rounded-lg border text-sm font-medium bg-gray-900/40 border-gray-800 text-gray-200 hover:bg-gray-800">
                Current Season
              </span>
            </summary>
            <div className="absolute mt-2 w-56 rounded-xl border border-gray-800 bg-gray-950 shadow-xl p-2">
              <NavLink to="/league/standings" className={ddLinkClass}>
                Standings
              </NavLink>
              <NavLink to="/league/this-week" className={ddLinkClass}>
                This Week
              </NavLink>
              <NavLink to="/league/teams" className={ddLinkClass}>
                Teams / Rosters
              </NavLink>
              <NavLink to="/league/weeks" className={ddLinkClass}>
                Weeks / Schedule
              </NavLink>
              <NavLink to="/league/stats" className={ddLinkClass}>
                Stats
              </NavLink>
              <NavLink to="/league/scouting" className={ddLinkClass}>
                Scouting
              </NavLink>
            </div>
          </details>

          <details className="relative">
            <summary className="list-none cursor-pointer select-none">
              <span className="px-3 py-2 rounded-lg border text-sm font-medium bg-gray-900/40 border-gray-800 text-gray-200 hover:bg-gray-800">
                Resources
              </span>
            </summary>
            <div className="absolute mt-2 w-56 rounded-xl border border-gray-800 bg-gray-950 shadow-xl p-2">
              <NavLink to="/resources/rules" className={ddLinkClass}>
                Rules
              </NavLink>
              <NavLink to="/resources/captains" className={ddLinkClass}>
                Captain guide
              </NavLink>
              <NavLink to="/resources/utilities" className={ddLinkClass}>
                Utilities
              </NavLink>
            </div>
          </details>

          <NavLink to="/archives" className={linkClass}>
            Archives
          </NavLink>
        </div>

        <div className="flex items-center gap-3">
          <AuthButton />
        </div>
      </div>
    </div>
  )
}

function AppLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-black text-gray-100">
      <TopNav />
      <div className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </div>
    </div>
  )
}

function PageShell({ title, subtitle, children }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
        <div className="text-xl font-semibold text-white">{title}</div>
        {subtitle ? <div className="text-sm text-gray-300 mt-1">{subtitle}</div> : null}
      </div>
      {children}
    </div>
  )
}

function HomePage() {
  return (
    <PageShell
      title="League Home"
      subtitle="THL-style navigation: use the top bar to jump to standings, weeks, teams, resources, and archives."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
          <div className="font-semibold">Current Season</div>
          <div className="text-sm text-gray-300 mt-1">Standings, weekly pairings, rosters, stats.</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link className="btn" to="/league/standings">
              Standings
            </Link>
            <Link className="btn" to="/league/this-week">
              This Week
            </Link>
            <Link className="btn" to="/league/teams">
              Teams
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
          <div className="font-semibold">Deck Builder</div>
          <div className="text-sm text-gray-300 mt-1">Keep using the builder — it’s now its own page.</div>
          <div className="mt-3">
            <Link className="btn primary" to="/builder">
              Open builder
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  )
}

function TeamHubPage() {
  return (
    <PageShell title="Team Hub" subtitle="Team collaboration + shared deck access.">
      <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-2">
        <TeamHub />
      </div>
    </PageShell>
  )
}

function BuilderPage() {
  // The existing builder already manages its own layout/modals/topbar.
  // We keep it as-is and just mount it as a route.
  return <DeckBuilderApp />
}

function LeagueStandingsPage() {
  return (
    <PageShell title="Standings" subtitle="Team standings + player standings (ledger-backed soon).">
      <div className="card">
        <StandingsTab />
      </div>
    </PageShell>
  )
}

function LeagueThisWeekPage() {
  const { user } = useAuth()
  return (
    <PageShell title="This Week" subtitle="Your current week matches and reporting workflow.">
      <div className="card">
        <ThisWeekTab me={user} />
      </div>
    </PageShell>
  )
}

function LeagueTeamsPage() {
  const { user } = useAuth()
  return (
    <PageShell title="Teams / Rosters" subtitle="Team list, rosters, captain tools (coming soon).">
      <div className="card">
        <TeamsTab me={user} />
      </div>
    </PageShell>
  )
}

function PlaceholderPage({ title, subtitle }) {
  return (
    <PageShell title={title} subtitle={subtitle}>
      <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5 text-gray-300">
        Coming soon.
      </div>
    </PageShell>
  )
}

function LeagueAdminPage() {
  const { user } = useAuth()
  return (
    <PageShell title="Admin" subtitle="League/season management tools.">
      <div className="card">
        <AdminTab me={user} />
      </div>
    </PageShell>
  )
}

export default function RouterApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/builder" element={<BuilderPage />} />
          <Route path="/team-hub" element={<TeamHubPage />} />

          {/* League pages (THL-like) */}
          <Route path="/league/standings" element={<LeagueStandingsPage />} />
          <Route path="/league/this-week" element={<LeagueThisWeekPage />} />
          <Route path="/league/teams" element={<LeagueTeamsPage />} />
          <Route path="/league/weeks" element={<PlaceholderPage title="Weeks / Schedule" subtitle="Week list + pairings per week." />} />
          <Route path="/league/stats" element={<PlaceholderPage title="Stats" subtitle="Player stats, lineup stats, and cross-season views." />} />
          <Route path="/league/scouting" element={<PlaceholderPage title="Scouting" subtitle="Matchup prep, archetypes, and history." />} />
          <Route path="/league/admin" element={<LeagueAdminPage />} />

          {/* Resources */}
          <Route path="/resources/rules" element={<PlaceholderPage title="Rules" subtitle="League ruleset and match procedures." />} />
          <Route path="/resources/captains" element={<PlaceholderPage title="Captain guide" subtitle="Roster rules, substitutions, and weekly responsibilities." />} />
          <Route path="/resources/utilities" element={<PlaceholderPage title="Utilities" subtitle="Timezone converter, timestamp generator, etc." />} />

          {/* Archives */}
          <Route path="/archives" element={<PlaceholderPage title="Archives" subtitle="Past seasons, standings, and hall of fame." />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

