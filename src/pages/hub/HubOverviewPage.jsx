import React, { useState, useEffect } from 'react';
import { useOutletContext, Link, useParams } from 'react-router-dom';

const EXAMPLE_QUESTIONS = [
  "What's our best-performing deck right now?",
  "What are our biggest weak matchups?",
  "Which decks should we focus on testing this week?",
];

function MarkdownText({ text }) {
  return (
    <div className="space-y-1.5 text-sm text-gray-200 leading-relaxed">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('## ')) return <p key={i} className="font-semibold text-violet-300">{line.slice(3)}</p>;
        if (line.startsWith('- ') || line.startsWith('* ')) return <p key={i} className="pl-3 border-l-2 border-violet-500/30">{line.slice(2)}</p>;
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionCard({ title, linkTo, linkLabel, children }) {
  const { id } = useParams();
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-200">{title}</h4>
        {linkTo && (
          <Link to={`/team-hub/${id}/${linkTo}`} className="text-xs text-violet-400 hover:text-violet-300">
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

function ActivityBadge({ type, result }) {
  if (type === 'game') {
    const cls = result === 'W' ? 'bg-emerald-500/20 text-emerald-400' : result === 'L' ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-400';
    return <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold shrink-0 ${cls}`}>{result || '?'}</span>;
  }
  const map = {
    report:   'bg-violet-500/15 text-violet-400',
    practice: 'bg-blue-500/15 text-blue-400',
    event:    'bg-amber-500/15 text-amber-400',
  };
  const label = { report: 'R', practice: 'P', event: 'E' };
  return <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold shrink-0 ${map[type] || 'bg-gray-700 text-gray-400'}`}>{label[type] || '?'}</span>;
}

function ActivityFeed({ games, reports, practices, events }) {
  const items = [
    ...games.slice(-30).map(g => ({
      key: `g-${g.id}`,
      type: 'game',
      result: g.result,
      primary: `${g.deckArchetype || '?'} vs ${g.vsArchetype || '?'}`,
      secondary: g.result === 'W' ? 'Win' : g.result === 'L' ? 'Loss' : 'Draw',
      time: g.playedAt,
    })),
    ...reports.slice(0, 15).map(r => ({
      key: `r-${r.id}`,
      type: 'report',
      primary: r.title,
      secondary: `by ${r.authorEmail || 'someone'}`,
      time: r.createdAt,
    })),
    ...practices.slice(0, 15).map(p => ({
      key: `p-${p.id}`,
      type: 'practice',
      primary: p.title || 'Practice session',
      secondary: p.startsAt ? formatDate(p.startsAt) : 'TBD',
      time: p.createdAt || p.startsAt,
    })),
    ...events.slice(0, 15).map(e => ({
      key: `e-${e.id}`,
      type: 'event',
      primary: e.title,
      secondary: formatDate(e.startsAt),
      time: e.createdAt || e.startsAt,
    })),
  ]
    .filter(item => item.time)
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 15);

  if (items.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Recent activity</h4>
      <ul className="divide-y divide-white/[0.04]">
        {items.map(item => (
          <li key={item.key} className="flex items-center gap-3 py-2">
            <ActivityBadge type={item.type} result={item.result} />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-gray-200 truncate">{item.primary}</span>
              <span className="text-xs text-gray-500 ml-1.5">{item.secondary}</span>
            </div>
            <span className="text-xs text-gray-600 shrink-0">{relTime(item.time)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const ONBOARDING_KEY = (hubId) => `hub_welcomed_${hubId}`

function useOnboarding(hub, user) {
  const isOwner = hub?.ownerId === user?.id || hub?.ownerId === user?.uid
  const key = hub ? ONBOARDING_KEY(hub.id) : null
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!key || isOwner) return
    if (!localStorage.getItem(key)) setShow(true)
  }, [key, isOwner])

  const dismiss = () => {
    if (key) localStorage.setItem(key, '1')
    setShow(false)
  }

  return { show, dismiss }
}

export default function HubOverviewPage() {
  const { hub, user } = useOutletContext();
  const [practices, setPractices] = useState([]);
  const [events, setEvents] = useState([]);
  const [reports, setReports] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const { id } = useParams();
  const { show: showBanner, dismiss: dismissBanner } = useOnboarding(hub, user);

  // Ask AI widget state
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

  const now = new Date();

  const nextPractice = practices
    .filter(p => new Date(p.startsAt) > now)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0];

  const nextEvent = events
    .filter(e => new Date(e.date || e.startsAt) > now)
    .sort((a, b) => new Date(a.date || a.startsAt) - new Date(b.date || b.startsAt))[0];

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
          <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* New-member onboarding banner */}
      {showBanner && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/[0.06] p-4 relative">
          <button
            onClick={dismissBanner}
            className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 text-sm"
          >
            ✕
          </button>
          <p className="text-sm font-semibold text-violet-300 mb-3">Welcome to {hub.name}! 👋</p>
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <span className="text-xs font-bold text-violet-400 mt-0.5 shrink-0">1</span>
              <div>
                <p className="text-sm text-gray-200">Fill out your profile</p>
                <p className="text-xs text-gray-500">Add your display name and the decks you play on the <Link to={`/team-hub/${id}/roster`} className="text-violet-400 hover:underline">Roster</Link> tab.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xs font-bold text-violet-400 mt-0.5 shrink-0">2</span>
              <div>
                <p className="text-sm text-gray-200">RSVP to the next practice</p>
                <p className="text-xs text-gray-500">Let the team know you're coming on the <Link to={`/team-hub/${id}/practices`} className="text-violet-400 hover:underline">Practices</Link> tab.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xs font-bold text-violet-400 mt-0.5 shrink-0">3</span>
              <div>
                <p className="text-sm text-gray-200">Log your first match</p>
                <p className="text-xs text-gray-500">Track wins and losses on the <Link to={`/team-hub/${id}/playtest`} className="text-violet-400 hover:underline">Playtest</Link> tab.</p>
              </div>
            </div>
          </div>
          <button
            onClick={dismissBanner}
            className="mt-3 text-xs text-gray-500 hover:text-gray-300"
          >
            Got it, dismiss
          </button>
        </div>
      )}

      {/* Ask AI widget */}
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-4 space-y-3">
        <form
          onSubmit={(e) => { e.preventDefault(); ask(); }}
          className="flex gap-2"
        >
          <input
            value={askQ}
            onChange={(e) => setAskQ(e.target.value)}
            placeholder="Ask about your team's data…"
            disabled={askLoading}
            className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-sm text-white placeholder-gray-500 focus:border-violet-400/60 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={askLoading || !askQ.trim()}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-40 transition-colors shrink-0"
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
                className="text-xs px-3 py-1 rounded-full border border-violet-500/30 bg-violet-500/[0.06] text-violet-300 hover:bg-violet-500/[0.14] transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {askLoading && (
          <p className="text-sm text-gray-400 animate-pulse">Consulting your team's data…</p>
        )}

        {askError && <p className="text-sm text-red-400">{askError}</p>}

        {askAnswer && (
          <div className="space-y-2">
            <MarkdownText text={askAnswer} />
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setAskAnswer('')}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Clear
              </button>
              <Link
                to={`/team-hub/${hub.id}/ask`}
                className="text-xs text-violet-400 hover:text-violet-300"
              >
                Open Ask AI for full history →
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Members" value={memberCount} />
        <StatCard label="Games logged" value={totalGames} />
        <StatCard
          label="Win rate"
          value={winRate !== null ? `${winRate}%` : '—'}
          sub={totalGames > 0 ? `${overallWins}W / ${totalGames - overallWins}L` : 'No games yet'}
        />
        <StatCard label="Reports" value={reports.length} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <SectionCard title="Next Practice" linkTo="practices" linkLabel="All practices →">
          {nextPractice ? (
            <div>
              <p className="text-sm font-medium text-white">{nextPractice.title || 'Practice session'}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatDate(nextPractice.startsAt)} at {formatTime(nextPractice.startsAt)}</p>
              {nextPractice.focus && <p className="text-xs text-gray-500 mt-1 italic">Focus: {nextPractice.focus}</p>}
              {nextPractice.rsvps?.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">{nextPractice.rsvps.filter(r => r.status === 'yes').length} going</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No upcoming practices scheduled.</p>
          )}
        </SectionCard>

        <SectionCard title="Next Event" linkTo="events" linkLabel="All events →">
          {nextEvent ? (
            <div>
              <p className="text-sm font-medium text-white">{nextEvent.name || nextEvent.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatDate(nextEvent.date || nextEvent.startsAt)}</p>
              {nextEvent.location && <p className="text-xs text-gray-500 mt-1">{nextEvent.location}</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No upcoming events posted.</p>
          )}
        </SectionCard>

        <SectionCard title="Top Matchups" linkTo="playtest" linkLabel="Playtest log →">
          {topMatchups.length > 0 ? (
            <ul className="space-y-2">
              {topMatchups.map(m => (
                <li key={m.matchup} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-gray-300 truncate">{m.matchup}</span>
                  <span className={`shrink-0 font-semibold ${m.pct >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {m.pct}%{' '}
                    <span className="text-gray-500 font-normal">({m.wins}W-{m.losses}L)</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">
              {totalGames === 0 ? 'No games logged yet.' : 'Need at least 2 games per matchup to show stats.'}
            </p>
          )}
        </SectionCard>

        <SectionCard title="Latest Report" linkTo="reports" linkLabel="All reports →">
          {latestReport ? (
            <div>
              <p className="text-sm font-medium text-white">{latestReport.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {latestReport.authorEmail} · {formatDate(latestReport.createdAt)}
              </p>
              {latestReport.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {latestReport.tags.map(t => (
                    <span key={t} className="px-1.5 py-0.5 rounded-full text-xs bg-gray-700 text-gray-400">{t}</span>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                {latestReport.body?.slice(0, 120)}{latestReport.body?.length > 120 ? '…' : ''}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No reports yet.</p>
          )}
        </SectionCard>
      </div>

      <ActivityFeed games={games} reports={reports} practices={practices} events={events} />
    </div>
  );
}
