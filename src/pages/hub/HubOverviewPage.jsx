import React, { useState, useEffect } from 'react';
import { useOutletContext, Link, useParams } from 'react-router-dom';
import HexGlyph from '../../components/ui/HexGlyph';
import InkLedger from '../../components/ui/InkLedger';
import Panel from '../../components/ui/Panel';
import { getInks } from '../../lib/cardUtils';

const EXAMPLE_QUESTIONS = [
  "What's our best-performing deck right now?",
  "What are our biggest weak matchups?",
  "Which decks should we focus on testing this week?",
];

// ---- small comp-styled helpers -------------------------------------------

function MarkdownText({ text }) {
  return (
    <div className="space-y-1.5 text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
      {text.split('\n').map((line, i) => {
        if (line.startsWith('## '))
          return <p key={i} className="font-display" style={{ fontWeight: 560, color: 'var(--text)' }}>{line.slice(3)}</p>;
        if (line.startsWith('- ') || line.startsWith('* '))
          return <p key={i} className="pl-3" style={{ borderLeft: '2px solid var(--line-2)', color: 'var(--muted)' }}>{line.slice(2)}</p>;
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
      <p className="text-[11px] uppercase tracking-[0.1em] font-semibold mb-1" style={{ color: 'var(--faint)' }}>{label}</p>
      <p className="font-display text-2xl tabular-nums" style={{ fontWeight: 560, color: 'var(--text)' }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--faint)' }}>{sub}</p>}
    </div>
  );
}

function SectionCard({ title, linkTo, linkLabel, accent, children }) {
  const { id } = useParams();
  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: 'var(--line)', background: 'var(--panel)', boxShadow: accent ? `inset 3px 0 0 var(${accent})` : undefined }}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-display text-base" style={{ fontWeight: 560, color: 'var(--text)' }}>{title}</h4>
        {linkTo && (
          <Link
            to={`/team-hub/${id}/${linkTo}`}
            className="text-xs transition-colors"
            style={{ color: 'var(--faint)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--faint)')}
          >
            {linkLabel || 'View all →'}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function relTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

// ---- team-deck ink derivation ---------------------------------------------
// Decks come back from /api/hubs/:id/decks with an opaque `.data` blob. The
// canonical shape is { entries: { key: { card, count } } } (see DeckStats), but
// we read everything defensively and DEGRADE (skip / show "—") rather than throw
// when a deck's shape or ink data can't be resolved.

const INK_LIST = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'];
const INK_SET = new Set(INK_LIST.map((s) => s.toLowerCase()));

// Real card entries (count > 0) out of a deck blob, whatever its shape.
function liveEntriesOf(deck) {
  const entries = deck?.data?.entries;
  if (!entries || typeof entries !== 'object') return [];
  return Object.values(entries).filter((e) => e && e.card && (e.count ?? 0) > 0);
}

// A card's primary ink, normalized to one of the six names, or null.
function primaryInkOf(card) {
  const inks = getInks(card) || [];
  for (const raw of inks) {
    const k = String(raw).toLowerCase();
    if (INK_SET.has(k)) return k.charAt(0).toUpperCase() + k.slice(1);
  }
  return null;
}

// Inkable status honoring every shape we've seen in the wild.
function inkableOf(card) {
  return (
    card?.inkable ??
    card?._raw?.inkwell ??
    card?._raw?.inkable ??
    card?._raw?.can_be_ink ??
    card?._raw?.Inkable ??
    false
  );
}

// The 1–2 inks that actually define a deck (most-played primary inks). Empty
// array when we can't derive any (unknown blob shape / no ink data).
function deckInkIdentity(deck) {
  const tally = new Map();
  for (const e of liveEntriesOf(deck)) {
    const ink = primaryInkOf(e.card);
    if (!ink) continue;
    tally.set(ink, (tally.get(ink) || 0) + (e.count || 0));
  }
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([ink]) => ink);
}

// One { ink, inkable } per card copy, for the InkLedger strip. Empty when the
// deck's cards yield no resolvable inks.
function ledgerEntriesOf(deck) {
  const out = [];
  for (const e of liveEntriesOf(deck)) {
    const ink = primaryInkOf(e.card);
    if (!ink) continue;
    const inkable = !!inkableOf(e.card);
    for (let i = 0; i < (e.count || 0); i++) out.push({ ink, inkable });
  }
  return out;
}

// Big ink hex with the deck-count overlaid — the gauntlet-coverage glyph.
function CoverageHex({ ink, count }) {
  const zero = count === 0;
  return (
    <div className="text-center flex-1">
      <div className="relative mx-auto" style={{ width: 40, height: 47, lineHeight: 0 }}>
        <HexGlyph ink={ink} hollow={zero} size={40} cutout="var(--panel)" />
        <span
          className="absolute inset-0 flex items-center justify-center tabular-nums font-semibold"
          style={{ fontSize: 13, lineHeight: 1, zIndex: 1, color: zero ? 'var(--faint)' : '#0b0c0f' }}
        >
          {count}
        </span>
      </div>
      <div className="mt-1.5 uppercase" style={{ fontSize: '10.5px', color: 'var(--faint)', letterSpacing: '.06em' }}>
        {ink}
      </div>
    </div>
  );
}

// Ink-colored type pill (the comp's activity vocabulary).
const PILL = {
  report:   { v: '--amber',    label: 'Report' },
  practice: { v: '--emerald',  label: 'Practice' },
  event:    { v: '--sapphire', label: 'Event' },
};

function ActivityBadge({ type, result }) {
  if (type === 'game') {
    const v = result === 'W' ? '--emerald' : result === 'L' ? '--ruby' : '--steel';
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold shrink-0 tabular-nums"
        style={{ color: `var(${v})`, background: `color-mix(in srgb, var(${v}) 16%, transparent)` }}
      >
        {result || '?'}
      </span>
    );
  }
  const p = PILL[type];
  return (
    <span
      className="inline-flex items-center justify-center px-1.5 h-5 rounded text-[10px] font-semibold uppercase tracking-wide shrink-0"
      style={{ color: p ? `var(${p.v})` : 'var(--faint)', border: `1px solid ${p ? `color-mix(in srgb, var(${p.v}) 40%, transparent)` : 'var(--line-2)'}` }}
    >
      {p ? p.label : '?'}
    </span>
  );
}

function ActivityFeed({ games, reports, practices, events }) {
  const items = [
    ...games.slice(-30).map(g => ({ key: `g-${g.id}`, type: 'game', result: g.result, primary: `${g.deckArchetype || '?'} vs ${g.vsArchetype || '?'}`, secondary: g.result === 'W' ? 'Win' : g.result === 'L' ? 'Loss' : 'Draw', time: g.playedAt })),
    ...reports.slice(0, 15).map(r => ({ key: `r-${r.id}`, type: 'report', primary: r.title, secondary: `by ${r.authorEmail || 'someone'}`, time: r.createdAt })),
    ...practices.slice(0, 15).map(p => ({ key: `p-${p.id}`, type: 'practice', primary: p.title || 'Practice session', secondary: p.startsAt ? formatDate(p.startsAt) : 'TBD', time: p.createdAt || p.startsAt })),
    ...events.slice(0, 15).map(e => ({ key: `e-${e.id}`, type: 'event', primary: e.title, secondary: formatDate(e.startsAt), time: e.createdAt || e.startsAt })),
  ]
    .filter(item => item.time)
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 15);

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: 'var(--muted)' }}>This week</h4>
      <ul>
        {items.map((item, i) => (
          <li key={item.key} className="flex items-center gap-3 py-2.5" style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
            <ActivityBadge type={item.type} result={item.result} />
            <div className="flex-1 min-w-0">
              <span className="text-sm truncate" style={{ color: 'var(--text)' }}>{item.primary}</span>
              <span className="text-xs ml-1.5" style={{ color: 'var(--faint)' }}>{item.secondary}</span>
            </div>
            <span className="text-xs shrink-0 tabular-nums" style={{ color: 'var(--faint)' }}>{relTime(item.time)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const ONBOARDING_KEY = (hubId) => `hub_welcomed_${hubId}`;

function useOnboarding(hub, user) {
  const isOwner = hub?.ownerId === user?.id || hub?.ownerId === user?.uid;
  const key = hub ? ONBOARDING_KEY(hub.id) : null;
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!key || isOwner) return;
    if (!localStorage.getItem(key)) setShow(true);
  }, [key, isOwner]);

  const dismiss = () => {
    if (key) localStorage.setItem(key, '1');
    setShow(false);
  };

  return { show, dismiss };
}

export default function HubOverviewPage() {
  const { hub, user } = useOutletContext();
  const [practices, setPractices] = useState([]);
  const [events, setEvents] = useState([]);
  const [reports, setReports] = useState([]);
  const [games, setGames] = useState([]);
  const [decks, setDecks] = useState([]);
  const [decksLoading, setDecksLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const { id } = useParams();
  const { show: showBanner, dismiss: dismissBanner } = useOnboarding(hub, user);

  const [askQ, setAskQ] = useState('');
  const [askAnswer, setAskAnswer] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState('');

  const ask = async (q) => {
    const text = (q || askQ).trim();
    if (!text || askLoading) return;
    setAskLoading(true);
    setAskError('');
    setAskAnswer('');
    try {
      const res = await fetch(`/api/hubs/${hub.id}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setAskAnswer(data.answer);
      setAskQ('');
    } catch (e) {
      setAskError(e.message || 'Something went wrong.');
    } finally {
      setAskLoading(false);
    }
  };

  useEffect(() => {
    if (!hub?.id) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/hubs/${hub.id}/practices`).then(r => r.ok ? r.json() : []),
      fetch(`/api/events?hubId=${encodeURIComponent(hub.id)}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/hubs/${hub.id}/reports`).then(r => r.ok ? r.json() : []),
      fetch(`/api/playtest?hubId=${encodeURIComponent(hub.id)}`).then(r => r.ok ? r.json() : []),
    ]).then(([p, e, r, g]) => {
      setPractices(Array.isArray(p) ? p : []);
      setEvents(Array.isArray(e) ? e : []);
      setReports(Array.isArray(r) ? r : []);
      setGames(Array.isArray(g) ? g : []);
    }).finally(() => setLoading(false));
  }, [hub?.id]);

  // Hub members' decks — feeds the gauntlet-coverage and team-decks panels.
  useEffect(() => {
    if (!hub?.id) return;
    setDecksLoading(true);
    fetch(`/api/hubs/${hub.id}/decks`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setDecks(Array.isArray(d) ? d : []))
      .catch(() => setDecks([]))
      .finally(() => setDecksLoading(false));
  }, [hub?.id]);

  // Decks-per-ink coverage across the hub (a deck counts toward each of its
  // 1–2 identity inks). Decks whose inks can't be derived contribute nothing.
  const coverage = Object.fromEntries(INK_LIST.map((ink) => [ink, 0]));
  for (const deck of decks) {
    for (const ink of deckInkIdentity(deck)) {
      if (ink in coverage) coverage[ink] += 1;
    }
  }
  const zeroInks = INK_LIST.filter((ink) => coverage[ink] === 0);

  const now = new Date();
  const nextPractice = practices.filter(p => new Date(p.startsAt) > now).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0];
  const nextEvent = events.filter(e => new Date(e.date || e.startsAt) > now).sort((a, b) => new Date(a.date || a.startsAt) - new Date(b.date || b.startsAt))[0];
  const latestReport = reports[0];

  const matchupStats = {};
  for (const g of games) {
    const key = `${g.deckArchetype} vs ${g.vsArchetype}`;
    if (!matchupStats[key]) matchupStats[key] = { wins: 0, losses: 0 };
    if (g.result === 'W') matchupStats[key].wins++;
    else matchupStats[key].losses++;
  }
  const topMatchups = Object.entries(matchupStats)
    .map(([matchup, s]) => ({ matchup, ...s, total: s.wins + s.losses, pct: Math.round((s.wins / (s.wins + s.losses)) * 100) }))
    .filter(m => m.total >= 2)
    .sort((a, b) => b.pct - a.pct || b.total - a.total)
    .slice(0, 4);

  const memberCount = (hub.members?.length ?? 0) + 1;
  const totalGames = games.length;
  const overallWins = games.filter(g => g.result === 'W').length;
  const winRate = totalGames > 0 ? Math.round((overallWins / totalGames) * 100) : null;

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border h-20" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* New-member onboarding banner */}
      {showBanner && (
        <div className="rounded-xl border p-4 relative" style={{ borderColor: 'color-mix(in srgb, var(--sapphire) 30%, var(--line))', background: 'color-mix(in srgb, var(--sapphire) 6%, transparent)' }}>
          <button onClick={dismissBanner} className="absolute top-3 right-3 text-sm" style={{ color: 'var(--faint)' }}>✕</button>
          <p className="font-display text-base mb-3" style={{ fontWeight: 560, color: 'var(--text)' }}>Welcome to {hub.name} 👋</p>
          <div className="space-y-2">
            {[
              { n: 1, t: 'Fill out your profile', d: <>Add your display name and the decks you play on the <Link to={`/team-hub/${id}/roster`} className="underline" style={{ color: 'var(--sapphire)' }}>Roster</Link> tab.</> },
              { n: 2, t: 'RSVP to the next practice', d: <>Let the team know you're coming on the <Link to={`/team-hub/${id}/practices`} className="underline" style={{ color: 'var(--sapphire)' }}>Practices</Link> tab.</> },
              { n: 3, t: 'Log your first match', d: <>Track wins and losses on the <Link to={`/team-hub/${id}/playtest`} className="underline" style={{ color: 'var(--sapphire)' }}>Playtest</Link> tab.</> },
            ].map(step => (
              <div key={step.n} className="flex items-start gap-3">
                <span className="text-xs font-bold mt-0.5 shrink-0 tabular-nums" style={{ color: 'var(--sapphire)' }}>{step.n}</span>
                <div>
                  <p className="text-sm" style={{ color: 'var(--text)' }}>{step.t}</p>
                  <p className="text-xs" style={{ color: 'var(--faint)' }}>{step.d}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={dismissBanner} className="mt-3 text-xs" style={{ color: 'var(--faint)' }}>Got it, dismiss</button>
        </div>
      )}

      {/* Ask the coach */}
      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'color-mix(in srgb, var(--sapphire) 30%, var(--line))', background: 'var(--panel)' }}>
        <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="flex gap-2">
          <input
            value={askQ}
            onChange={(e) => setAskQ(e.target.value)}
            placeholder="Ask the coach about your team's data…"
            disabled={askLoading}
            className="flex-1 px-3 py-2 rounded-md border text-sm focus:outline-none disabled:opacity-50"
            style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--text)' }}
          />
          <button
            type="submit"
            disabled={askLoading || !askQ.trim()}
            className="px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-40 transition shrink-0 hover:brightness-110"
            style={{ background: 'var(--sapphire)', color: '#0b1620' }}
          >
            {askLoading ? '…' : 'Ask'}
          </button>
        </form>

        {!askAnswer && !askLoading && !askError && (
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => ask(q)}
                className="text-xs px-3 py-1 rounded-full border transition-colors"
                style={{ borderColor: 'var(--line-2)', color: 'var(--muted)' }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {askLoading && <p className="text-sm animate-pulse" style={{ color: 'var(--muted)' }}>Consulting your team's data…</p>}
        {askError && <p className="text-sm" style={{ color: 'var(--ruby)' }}>{askError}</p>}

        {askAnswer && (
          <div className="space-y-2">
            <MarkdownText text={askAnswer} />
            <div className="flex items-center justify-between pt-1">
              <button onClick={() => setAskAnswer('')} className="text-xs" style={{ color: 'var(--faint)' }}>Clear</button>
              <Link to={`/team-hub/${hub.id}/ask`} className="text-xs" style={{ color: 'var(--sapphire)' }}>Open Ask AI for full history →</Link>
            </div>
          </div>
        )}
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Members" value={memberCount} />
        <StatCard label="Games logged" value={totalGames} />
        <StatCard label="Win rate" value={winRate !== null ? `${winRate}%` : '—'} sub={totalGames > 0 ? `${overallWins}W / ${totalGames - overallWins}L` : 'No games yet'} />
        <StatCard label="Reports" value={reports.length} />
      </div>

      {/* Detail panels */}
      <div className="grid sm:grid-cols-2 gap-4">
        <SectionCard title="Next practice" linkTo="practices" linkLabel="All practices →" accent="--emerald">
          {nextPractice ? (
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{nextPractice.title || 'Practice session'}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{formatDate(nextPractice.startsAt)} at {formatTime(nextPractice.startsAt)}</p>
              {nextPractice.focus && <p className="text-xs mt-1 italic font-display" style={{ color: 'var(--faint)' }}>Focus: {nextPractice.focus}</p>}
              {nextPractice.rsvps?.length > 0 && <p className="text-xs mt-1 tabular-nums" style={{ color: 'var(--faint)' }}>{nextPractice.rsvps.filter(r => r.status === 'yes').length} going</p>}
            </div>
          ) : <p className="text-sm" style={{ color: 'var(--faint)' }}>No upcoming practices scheduled.</p>}
        </SectionCard>

        <SectionCard title="Next event" linkTo="events" linkLabel="All events →" accent="--amber">
          {nextEvent ? (
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{nextEvent.name || nextEvent.title}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{formatDate(nextEvent.date || nextEvent.startsAt)}</p>
              {nextEvent.location && <p className="text-xs mt-1" style={{ color: 'var(--faint)' }}>{nextEvent.location}</p>}
            </div>
          ) : <p className="text-sm" style={{ color: 'var(--faint)' }}>No upcoming events posted.</p>}
        </SectionCard>

        <SectionCard title="Top matchups" linkTo="playtest" linkLabel="Playtest log →" accent="--sapphire">
          {topMatchups.length > 0 ? (
            <ul className="space-y-2">
              {topMatchups.map(m => (
                <li key={m.matchup} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate" style={{ color: 'var(--muted)' }}>{m.matchup}</span>
                  <span className="shrink-0 font-semibold tabular-nums" style={{ color: m.pct >= 50 ? 'var(--emerald)' : 'var(--ruby)' }}>
                    {m.pct}% <span className="font-normal" style={{ color: 'var(--faint)' }}>({m.wins}W-{m.losses}L)</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm" style={{ color: 'var(--faint)' }}>{totalGames === 0 ? 'No games logged yet.' : 'Need at least 2 games per matchup to show stats.'}</p>
          )}
        </SectionCard>

        <SectionCard title="Latest report" linkTo="reports" linkLabel="All reports →" accent="--amethyst">
          {latestReport ? (
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{latestReport.title}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--faint)' }}>{latestReport.authorEmail} · {formatDate(latestReport.createdAt)}</p>
              {latestReport.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {latestReport.tags.map(t => (
                    <span key={t} className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide" style={{ color: 'var(--faint)', border: '1px solid var(--line-2)' }}>{t}</span>
                  ))}
                </div>
              )}
              <p className="text-xs mt-2 line-clamp-2" style={{ color: 'var(--muted)' }}>{latestReport.body?.slice(0, 120)}{latestReport.body?.length > 120 ? '…' : ''}</p>
            </div>
          ) : <p className="text-sm" style={{ color: 'var(--faint)' }}>No reports yet.</p>}
        </SectionCard>
      </div>

      {/* Gauntlet coverage — decks per ink */}
      <Panel title="Gauntlet coverage">
        {decksLoading ? (
          <p className="text-sm animate-pulse" style={{ color: 'var(--muted)' }}>Reading the gauntlet…</p>
        ) : decks.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--faint)' }}>No team decks yet.</p>
        ) : (
          <>
            <div
              className="flex justify-between gap-1.5"
              role="img"
              aria-label={`Decks per ink: ${INK_LIST.map((ink) => `${ink} ${coverage[ink]}`).join(', ')}`}
            >
              {INK_LIST.map((ink) => (
                <CoverageHex key={ink} ink={ink} count={coverage[ink]} />
              ))}
            </div>
            {zeroInks.length > 0 && (
              <p className="mt-3.5 pt-3 text-xs" style={{ color: 'var(--muted)', borderTop: '1px solid var(--line)' }}>
                No decks currently cover{' '}
                <span className="font-display italic" style={{ color: 'var(--text)' }}>
                  {zeroInks.join(', ')}
                </span>
                {zeroInks.length === 1 ? ' — nobody is piloting it yet.' : ' — nobody is piloting them yet.'}
              </p>
            )}
          </>
        )}
      </Panel>

      {/* Team decks — the hub's decks with a per-deck ink-ledger strip */}
      <Panel title="Team decks">
        {decksLoading ? (
          <p className="text-sm animate-pulse" style={{ color: 'var(--muted)' }}>Loading team decks…</p>
        ) : decks.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--faint)' }}>No decks have been built by this team yet.</p>
        ) : (
          <div className="grid gap-3">
            {decks.map((deck) => {
              const inks = deckInkIdentity(deck);
              const ledger = ledgerEntriesOf(deck);
              const owner = deck.user?.email || 'Unknown';
              return (
                <div
                  key={deck.id}
                  className="rounded-md border p-2.5"
                  style={{ borderColor: 'var(--line)', background: 'var(--panel-2)' }}
                >
                  <p className="font-display truncate" style={{ fontWeight: 560, fontSize: '15px', color: 'var(--text)' }}>
                    {deck.name || deck.title || 'Untitled deck'}
                  </p>
                  <p className="truncate" style={{ fontSize: '12px', color: 'var(--faint)' }}>
                    {owner}
                    {inks.length ? ` · ${inks.join(' / ')}` : ' · —'}
                  </p>
                  {ledger.length > 0 && (
                    <InkLedger entries={ledger} hexSize={7} cutout="var(--panel-2)" className="mt-1.5" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <ActivityFeed games={games} reports={reports} practices={practices} events={events} />
    </div>
  );
}
