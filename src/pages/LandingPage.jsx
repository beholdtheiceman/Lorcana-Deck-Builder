import { useState } from 'react'
import LoginModal from '../components/LoginModal'
import RegisterModal from '../components/RegisterModal'

// The six inks are the whole palette — the hero's "thesis" per the redesign:
// the most characteristic thing in Lorcana's world, rendered as inkwell hexes.
const INKS = [
  { name: 'Amber', v: '--amber' },
  { name: 'Amethyst', v: '--amethyst' },
  { name: 'Emerald', v: '--emerald' },
  { name: 'Ruby', v: '--ruby' },
  { name: 'Sapphire', v: '--sapphire' },
  { name: 'Steel', v: '--steel' },
]

const FEATURES = [
  {
    ink: '--sapphire',
    title: 'Deck Lab',
    body: 'A fast, keyboard-first workbench. Search the full card pool, tune your list, and watch the curve and ink split update as you build.',
  },
  {
    ink: '--amber',
    title: 'Team Hub',
    body: 'Bring your playtest group into one place — shared decks, practice logs, matchup primers, and a weekly digest of how the team is doing.',
  },
  {
    ink: '--amethyst',
    title: 'The Coach',
    body: 'An AI coach that reads your list, reviews your games, and tells you what to cut and why — grounded in the cards you actually play.',
  },
]

function Hex({ colorVar, size = 40 }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-block"
      style={{ width: size, height: Math.round(size * 1.15), clipPath: 'var(--hex)', background: `var(${colorVar})` }}
    />
  )
}

export default function LandingPage() {
  const [showLogin, setShowLogin] = useState(false)
  const [showRegister, setShowRegister] = useState(false)

  return (
    <div className="mx-auto max-w-5xl px-1 py-10 sm:py-16">
      {/* ---- Hero ---- */}
      <section
        className="relative overflow-hidden rounded-2xl border p-8 sm:p-12"
        style={{
          borderColor: 'var(--line)',
          background:
            'radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--ruby) 9%, transparent), transparent 55%),' +
            'radial-gradient(120% 140% at 100% 100%, color-mix(in srgb, var(--sapphire) 10%, transparent), transparent 55%),' +
            'var(--panel)',
        }}
      >
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: 'var(--muted)' }}
        >
          Disney Lorcana · deck builder &amp; team hub
        </div>

        <h1
          className="font-display mt-4 leading-[1.05]"
          style={{ fontWeight: 560, letterSpacing: '-0.01em', fontSize: 'clamp(2.2rem, 6vw, 3.4rem)', color: 'var(--text)' }}
        >
          Build decks<br />
          <span style={{ fontStyle: 'italic', fontWeight: 400 }}>worth</span> playing.
        </h1>

        <p className="mt-5 max-w-xl text-[15px] leading-relaxed" style={{ color: 'var(--muted)' }}>
          Uninkable is a deck builder for competitive Lorcana teams — a proper workbench,
          a shared home for your playtest group, and an AI coach that actually knows your cards.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowRegister(true)}
            className="rounded-md px-5 py-2.5 text-sm font-semibold transition hover:brightness-110"
            style={{ background: 'var(--sapphire)', color: '#0b1620' }}
          >
            Create your account
          </button>
          <button
            onClick={() => setShowLogin(true)}
            className="rounded-md border px-5 py-2.5 text-sm font-semibold transition hover:bg-white/5"
            style={{ borderColor: 'var(--line-2)', color: 'var(--text)' }}
          >
            Log in
          </button>
        </div>

        {/* Signature: the six inks as inkwell hexes */}
        <div className="mt-10 border-t pt-6" style={{ borderColor: 'var(--line)' }}>
          <div className="text-[11px] uppercase tracking-[0.1em] mb-4" style={{ color: 'var(--faint)' }}>
            Every ink, one system
          </div>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            {INKS.map((ink) => (
              <div key={ink.name} className="flex flex-col items-center gap-2">
                <Hex colorVar={ink.v} />
                <span className="text-[11px] uppercase tracking-[0.06em]" style={{ color: 'var(--faint)' }}>
                  {ink.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Feature panels ---- */}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-xl border p-5"
            style={{ borderColor: 'var(--line)', background: 'var(--panel)', boxShadow: `inset 3px 0 0 var(${f.ink})` }}
          >
            <div className="flex items-center gap-2.5">
              <Hex colorVar={f.ink} size={18} />
              <h3 className="font-display text-lg" style={{ fontWeight: 560, color: 'var(--text)' }}>
                {f.title}
              </h3>
            </div>
            <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
              {f.body}
            </p>
          </div>
        ))}
      </section>

      {/* ---- Closing line ---- */}
      <p className="mt-10 text-center text-[13px]" style={{ color: 'var(--faint)' }}>
        Free to use. Your decks are yours.{' '}
        <button
          onClick={() => setShowRegister(true)}
          className="underline underline-offset-2 hover:text-[color:var(--text)]"
          style={{ color: 'var(--muted)' }}
        >
          Get started
        </button>
        .
      </p>

      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onSwitchToRegister={() => {
          setShowLogin(false)
          setShowRegister(true)
        }}
      />
      <RegisterModal
        isOpen={showRegister}
        onClose={() => setShowRegister(false)}
        onSwitchToLogin={() => {
          setShowRegister(false)
          setShowLogin(true)
        }}
      />
    </div>
  )
}
