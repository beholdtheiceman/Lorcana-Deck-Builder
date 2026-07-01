import React, { useState, useEffect } from 'react';
import { useOutletContext, Link, useParams } from 'react-router-dom';

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

export default function HubOverviewPage() {
  const { hub, user } = useOutletContext();
  const [practices, setPractices] = useState([]);
  const [events, setEvents] = useState([]);
  const [reports, setReports] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

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
    </div>
  );
}
