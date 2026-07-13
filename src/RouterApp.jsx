import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, NavLink, Outlet, Navigate } from 'react-router-dom'
import AuthButton from './components/AuthButton'
import DeckBuilderApp from './App.jsx'
import { ToastProvider } from './contexts/ToastContext.jsx'
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
import LandingPage from './pages/LandingPage'
import ToolsHubPage from './pages/tools/ToolsHubPage'
import { useAuth } from './contexts/AuthContext'

const HypergeometricPage = lazy(() => import('./pages/tools/HypergeometricPage'))
const SwissPage = lazy(() => import('./pages/tools/SwissPage'))
const DeckChangePage = lazy(() => import('./pages/tools/DeckChangePage'))
const ProxyPage = lazy(() => import('./pages/tools/ProxyPage'))
const PerformancePage = lazy(() => import('./pages/tools/PerformancePage'))

function LazyTool({ children }) {
  return <Suspense fallback={<div className="py-20 text-center text-[color:var(--muted)]">Loading tool…</div>}>{children}</Suspense>
}

function TopNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Comp chrome (design/comps): quiet text links, panel hover, and an inked
  // underline on the active route — no boxed buttons.
  const linkClass = ({ isActive }) =>
    `px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${
      isActive
        ? 'text-[color:var(--text)] shadow-[inset_0_-2px_0_var(--sapphire)] rounded-b-none'
        : 'text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-bg-overlay'
    }`

  const NAV_ITEMS = [
    { to: '/team-hub', label: 'Team Hub' },
    { to: '/builder', label: 'Deck Lab' },
    { to: '/my-decks', label: 'My Decks' },
    { to: '/tools', label: 'Tools' },
    { to: '/ask', label: 'Ask AI' },
  ]

  const renderNavLinks = () =>
    NAV_ITEMS.map((item) => (
      <NavLink key={item.to} to={item.to} className={linkClass} onClick={() => setMobileMenuOpen(false)}>
        {item.label}
      </NavLink>
    ))

  return (
    <div
      className="sticky top-0 z-50 border-b backdrop-blur"
      style={{ borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--canvas) 92%, black)' }}
    >
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            to="/team-hub"
            className="flex items-center gap-2.5 shrink-0 font-display"
            style={{ fontSize: 19, fontWeight: 560, color: 'var(--text)' }}
          >
            {/* hexmark: two-ink gradient hex ring (comp .hexmark) */}
            <span
              className="relative inline-block"
              aria-hidden="true"
              style={{
                width: 18,
                height: 20,
                clipPath: 'var(--hex)',
                background: 'linear-gradient(135deg, var(--ink-a), var(--ink-b))',
              }}
            >
              <span className="absolute" style={{ inset: 3, clipPath: 'var(--hex)', background: 'var(--canvas)' }} />
            </span>
            <span className="hidden sm:inline">Uninkable</span>
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
            className="md:hidden w-9 h-9 shrink-0 rounded-md border border-line text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-bg-overlay transition-colors flex items-center justify-center"
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
        <div className="md:hidden px-4 pb-3 flex flex-col gap-2 border-t border-line pt-3">
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
      <div className="min-h-screen overflow-x-clip text-[color:var(--text)]">
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
    return <LandingPage />
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
          <Route path="/tools" element={<ToolsHubPage />} />
          <Route path="/tools/hypergeometric" element={<LazyTool><HypergeometricPage /></LazyTool>} />
          <Route path="/tools/swiss" element={<LazyTool><SwissPage /></LazyTool>} />
          <Route path="/tools/deck-change" element={<LazyTool><DeckChangePage /></LazyTool>} />
          <Route path="/tools/proxy" element={<LazyTool><ProxyPage /></LazyTool>} />
          <Route path="/tools/performance" element={<LazyTool><PerformancePage /></LazyTool>} />
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
