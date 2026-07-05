import { useState } from 'react'
import { BrowserRouter, Routes, Route, Link, NavLink, Outlet, Navigate } from 'react-router-dom'
import AuthButton from './components/AuthButton'
import DeckBuilderApp, { ToastProvider } from './App.jsx'
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
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import JoinPage from './pages/JoinPage'
import MyDecksPage from './pages/MyDecksPage'
import AskAiPage from './pages/AskAiPage'
import { useAuth } from './contexts/AuthContext'

function TopNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
      isActive ? 'bg-gray-800 border-gray-600 text-white' : 'bg-gray-900/40 border-gray-800 text-gray-200 hover:bg-gray-800'
    }`

  const NAV_ITEMS = [
    { to: '/team-hub', label: 'Team Hub' },
    { to: '/builder', label: 'Deck Lab' },
    { to: '/my-decks', label: 'My Decks' },
    { to: '/ask', label: 'Ask AI' },
  ]

  const renderNavLinks = () =>
    NAV_ITEMS.map((item) => (
      <NavLink key={item.to} to={item.to} className={linkClass} onClick={() => setMobileMenuOpen(false)}>
        {item.label}
      </NavLink>
    ))

  return (
    <div className="sticky top-0 z-50 border-b border-gray-800 bg-black/70 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/team-hub" className="flex items-center gap-2 font-semibold text-violet-400 shrink-0">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 shadow-[0_0_14px_-2px_rgba(139,108,255,0.7)] inline-block" aria-hidden="true"></span>
            <span className="hidden sm:inline">Team Lorcana</span>
          </Link>
          {/* Full nav links — visible from md breakpoint up */}
          <div className="hidden md:flex items-center gap-3">
            {renderNavLinks()}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <AuthButton />
          {/* Hamburger toggle — mobile/tablet only */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="md:hidden w-9 h-9 shrink-0 rounded-lg bg-gray-900/40 border border-gray-800 text-gray-200 hover:bg-gray-800 transition-colors flex items-center justify-center"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile nav drawer — stacked links below the bar */}
      {mobileMenuOpen && (
        <div className="md:hidden px-4 pb-3 flex flex-col gap-2 border-t border-gray-800 pt-3">
          {renderNavLinks()}
        </div>
      )}
    </div>
  )
}

function AppLayout() {
  // Hoisted here (rather than left wrapping only AppInner's own render) so
  // every route sharing this layout — including /my-decks, which now renders
  // DeckPresentationView inline and needs a `toast` prop — shares the same
  // toast context. AppInner's own useToasts() call still resolves against
  // this same provider once it mounts under /builder.
  return (
    <ToastProvider>
      <div className="min-h-screen overflow-x-clip bg-gradient-to-b from-gray-950 to-black text-gray-100">
        <TopNav />
        <div className="mx-auto max-w-7xl px-4 py-6">
          <Outlet />
        </div>
      </div>
    </ToastProvider>
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
          <Route path="/" element={<Navigate to="/team-hub" replace />} />
          <Route path="/builder" element={<BuilderPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/join" element={<JoinPage />} />
          <Route path="/my-decks" element={<MyDecksPage />} />
          <Route path="/ask" element={<RequireAuth><AskAiPage /></RequireAuth>} />
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
