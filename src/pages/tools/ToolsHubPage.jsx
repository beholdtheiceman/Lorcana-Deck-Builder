import { Link } from 'react-router-dom'

const TOOLS = [
  { to: '/tools/hypergeometric', icon: '◉', title: 'Hypergeometric Calculator', tag: 'Probability', body: 'Calculate opening-hand, mulligan, and by-turn draw odds.' },
  { to: '/tools/swiss', icon: '♜', title: 'Swiss Tournament Simulator', tag: 'Tournament', body: 'Estimate records, cut chances, and intentional-draw safety.' },
  { to: '/tools/deck-change', icon: '⇄', title: 'Deck Change Calculator', tag: 'Deckbuilding', body: 'Compare two lists and see exactly what to cut and add.' },
  { to: '/tools/proxy', icon: '▦', title: 'Proxy Card Creator', tag: 'Print', body: 'Turn a decklist into print-ready playtest proxy sheets.' },
  { to: '/tools/performance', icon: '↗', title: 'Performance Analyzer', tag: 'Analytics', body: 'Explore win rates, matchups, trends, and play/draw splits.' },
]

export default function ToolsHubPage() {
  return (
    <div className="mx-auto max-w-5xl py-6 sm:py-10">
      <div className="max-w-2xl">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--muted)' }}>
          Competitive toolkit
        </div>
        <h1 className="font-display mt-3 text-4xl" style={{ fontWeight: 560, color: 'var(--text)' }}>Tools</h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          Practical calculators and utilities for building, testing, and competing with your decks.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <Link
            key={tool.to}
            to={tool.to}
            className="group rounded-xl border p-5 transition hover:-translate-y-0.5 hover:border-[color:var(--line-2)]"
            style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg text-xl" style={{ background: 'color-mix(in srgb, var(--sapphire) 14%, transparent)', color: 'var(--sapphire)' }} aria-hidden="true">
                {tool.icon}
              </span>
              <span className="rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ borderColor: 'var(--line-2)', color: 'var(--muted)' }}>
                {tool.tag}
              </span>
            </div>
            <h2 className="font-display mt-5 text-lg" style={{ fontWeight: 560, color: 'var(--text)' }}>{tool.title}</h2>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>{tool.body}</p>
            <div className="mt-5 text-sm font-medium" style={{ color: 'var(--sapphire)' }}>Open tool →</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
