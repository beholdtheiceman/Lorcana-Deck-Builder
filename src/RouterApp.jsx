import { BrowserRouter, Routes, Route, Link, NavLink, Outlet, Navigate } from 'react-router-dom'
import AuthButton from './components/AuthButton'
import DeckBuilderApp from './App.jsx'
import HubListPage from './pages/HubListPage'
import HubDetailLayout from './pages/HubDetailLayout'
import RosterPage from './pages/hub/RosterPage'
import PodsPage from './pages/hub/PodsPage'
import PracticesPage from './pages/hub/PracticesPage'
import EventsPage from './pages/hub/EventsPage'
import ReportsPage from './pages/hub/ReportsPage'
import ReviewsPage from './pages/hub/ReviewsPage'
import PrimersPage from './pages/hub/PrimersPage'
import PlaytestPage from './pages/hub/PlaytestPage'
import AskPage from './pages/hub/AskPage'
import HubOverviewPage from './pages/hub/HubOverviewPage'
import { useAuth } from './contexts/AuthContext'

function TopNav() {
  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
      isActive ? 'bg-gray-800 border-gray-600 text-white' : 'bg-gray-900/40 border-gray-800 text-gray-200 hover:bg-gray-800'
    }`

  return (
    <div className="sticky top-0 z-50 border-b border-gray-800 bg-black/70 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 font-semibold text-violet-400">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 shadow-[0_0_14px_-2px_rgba(139,108,255,0.7)] inline-block" aria-hidden="true"></span>
            Lorcana Deck Builder
          </Link>
          <NavLink to="/builder" className={linkClass}>
            Deck Builder
          </NavLink>
          <NavLink to="/team-hub" className={linkClass}>
            Team Hub
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

function BuilderPage() {
  // The deck builder manages its own layout/modals/topbar; mount it as a route.
  return <DeckBuilderApp />
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        Loading...
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-300 text-lg mb-2">You need to be logged in to access Team Hub.</p>
        <p className="text-gray-500 text-sm">Use the Login button in the top right to sign in or create an account.</p>
      </div>
    )
  }

  return children
}

export default function RouterApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<BuilderPage />} />
          <Route path="/builder" element={<BuilderPage />} />
          <Route path="/team-hub" element={<RequireAuth><HubListPage /></RequireAuth>} />
          <Route path="/team-hub/:id" element={<RequireAuth><HubDetailLayout /></RequireAuth>}>
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home" element={<HubOverviewPage />} />
            <Route path="roster" element={<RosterPage />} />
            <Route path="pods" element={<PodsPage />} />
            <Route path="practices" element={<PracticesPage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="reviews" element={<ReviewsPage />} />
            <Route path="primers" element={<PrimersPage />} />
            <Route path="playtest" element={<PlaytestPage />} />
            <Route path="ask" element={<AskPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
