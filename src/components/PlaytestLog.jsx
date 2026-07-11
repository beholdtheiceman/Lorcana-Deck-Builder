import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { Button, Skeleton, EmptyState } from './ui';

/**
 * Pure rollup helper (exported for testing): groups games by
 * "deckArchetype vs vsArchetype" into win/loss totals, win %, and an
 * on-the-play / on-the-draw split.
 */
export function computeMatchupStats(games) {
  const map = new Map();
  for (const g of games) {
    const key = `${g.deckArchetype} ${g.vsArchetype}`;
    let row = map.get(key);
    if (!row) {
      row = {
        deckArchetype: g.deckArchetype,
        vsArchetype: g.vsArchetype,
        wins: 0, losses: 0,
        onPlayWins: 0, onPlayGames: 0,
        onDrawWins: 0, onDrawGames: 0,
      };
      map.set(key, row);
    }
    const win = g.result === 'W';
    if (win) row.wins++; else row.losses++;
    if (g.onPlay === true) { row.onPlayGames++; if (win) row.onPlayWins++; }
    else if (g.onPlay === false) { row.onDrawGames++; if (win) row.onDrawWins++; }
  }
  const rows = [...map.values()].map((r) => {
    const total = r.wins + r.losses;
    return { ...r, total, winPct: total ? Math.round((r.wins / total) * 100) : 0 };
  });
  rows.sort((a, b) => b.total - a.total || b.winPct - a.winPct);
  return rows;
}

/**
 * Pure rollup helper (exported for testing): win/loss totals and win % per
 * player, keyed by the logger's email (falling back to their id).
 */
export function computePlayerStats(games) {
  const map = new Map();
  for (const g of games) {
    const key = g.loggedBy?.email || g.loggedById || 'Unknown';
    let row = map.get(key);
    if (!row) { row = { player: key, wins: 0, losses: 0 }; map.set(key, row); }
    if (g.result === 'W') row.wins++; else row.losses++;
  }
  const rows = [...map.values()].map((r) => {
    const total = r.wins + r.losses;
    return { ...r, total, winPct: total ? Math.round((r.wins / total) * 100) : 0 };
  });
  rows.sort((a, b) => b.total - a.total || b.winPct - a.winPct);
  return rows;
}

const EMPTY_FORM = {
  deckId: '', deckArchetype: '', vsArchetype: '',
  result: 'W', onPlay: '', format: '', lesson: '',
};

export default function PlaytestLog({ hubId, decks = [], currentUser }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const r = await fetch(`/api/playtest?hubId=${encodeURIComponent(hubId)}`);
        if (!r.ok) throw new Error('load');
        const data = await r.json();
        if (!cancelled) setGames(data);
      } catch {
        if (!cancelled) setError('Failed to load playtest games.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hubId]);

  const stats = useMemo(() => computeMatchupStats(games), [games]);
  const playerStats = useMemo(() => computePlayerStats(games), [games]);
  // Top matchups by sample size for the win-rate bar chart.
  const chartData = useMemo(
    () => stats.slice(0, 10).map((r) => ({
      name: `${r.deckArchetype} vs ${r.vsArchetype}`,
      winPct: r.winPct,
      record: `${r.wins}–${r.losses}`,
    })),
    [stats]
  );
  const overall = useMemo(() => {
    const wins = games.filter((g) => g.result === 'W').length;
    return { wins, losses: games.length - wins, total: games.length };
  }, [games]);

  // Opponent archetypes seen before, for the autocomplete datalist.
  const knownOpponents = useMemo(
    () => [...new Set(games.map((g) => g.vsArchetype).filter(Boolean))].sort(),
    [games]
  );

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // When a saved deck is picked, default the archetype label to its title.
  const onDeckChange = (deckId) => {
    const deck = decks.find((d) => d.id === deckId);
    setForm((f) => ({
      ...f,
      deckId,
      deckArchetype: deck && !f.deckArchetype ? deck.title : f.deckArchetype,
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.deckArchetype.trim() || !form.vsArchetype.trim()) {
      setError('Your deck and opponent archetype are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        hubId,
        deckId: form.deckId || null,
        deckArchetype: form.deckArchetype.trim(),
        vsArchetype: form.vsArchetype.trim(),
        result: form.result,
        onPlay: form.onPlay === '' ? null : form.onPlay === 'true',
        format: form.format || null,
        lesson: form.lesson.trim() || null,
      };
      const r = await fetch('/api/playtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error('save');
      const created = await r.json();
      setGames((prev) => [created, ...prev]);
      setForm({ ...EMPTY_FORM });
    } catch {
      setError('Failed to log the game.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    setPendingDelete(null);
    const prev = games;
    setGames((g) => g.filter((x) => x.id !== id)); // optimistic
    try {
      const r = await fetch(`/api/playtest/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('delete');
    } catch {
      setGames(prev); // rollback
      setError('Failed to delete the game.');
    }
  };

  const input = 'w-full p-2 rounded-md text-sm bg-bg-overlay border border-line text-[color:var(--text)] placeholder-[color:var(--faint)] focus:outline-none';
  const label = 'block text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--faint)] mb-1';

  return (
    <div className="space-y-6">
      {error && <p className="text-bad text-sm">{error}</p>}

      {/* Log a game */}
      <form onSubmit={submit} className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
        <h4 className="font-display text-base" style={{ fontWeight: 560, color: 'var(--text)' }}>Log a practice game</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>Your deck</label>
            <select className={input} value={form.deckId} onChange={(e) => onDeckChange(e.target.value)}>
              <option value="">— None / not saved —</option>
              {decks.map((d) => (
                <option key={d.id} value={d.id}>{d.title}{d.user?.email ? ` (${d.user.email})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Deck archetype *</label>
            <input className={input} value={form.deckArchetype}
              onChange={(e) => setField('deckArchetype', e.target.value)}
              placeholder="e.g. Blurple Control" required />
          </div>
          <div>
            <label className={label}>Opponent archetype *</label>
            <input className={input} list="pt-opponents" value={form.vsArchetype}
              onChange={(e) => setField('vsArchetype', e.target.value)}
              placeholder="e.g. Go-Wide Dogs" required />
            <datalist id="pt-opponents">
              {knownOpponents.map((o) => <option key={o} value={o} />)}
            </datalist>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className={label}>Result *</label>
              <select className={input} value={form.result} onChange={(e) => setField('result', e.target.value)}>
                <option value="W">Win</option>
                <option value="L">Loss</option>
              </select>
            </div>
            <div>
              <label className={label}>On the…</label>
              <select className={input} value={form.onPlay} onChange={(e) => setField('onPlay', e.target.value)}>
                <option value="">—</option>
                <option value="true">Play</option>
                <option value="false">Draw</option>
              </select>
            </div>
            <div>
              <label className={label}>Format</label>
              <select className={input} value={form.format} onChange={(e) => setField('format', e.target.value)}>
                <option value="">—</option>
                <option value="Core">Core</option>
                <option value="Infinity">Infinity</option>
              </select>
            </div>
          </div>
        </div>
        <div>
          <label className={label}>Lesson / takeaway (optional)</label>
          <textarea className={input} rows={2} value={form.lesson}
            onChange={(e) => setField('lesson', e.target.value)}
            placeholder="What did you learn? e.g. mulligan more aggressively for early board" />
        </div>
        <Button variant="primary" type="submit" disabled={saving}>
          {saving ? 'Logging…' : 'Log game'}
        </Button>
      </form>

      {/* Win-rate by matchup */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--muted)' }}>Win rate by matchup</h4>
          <span className="text-xs tabular-nums" style={{ color: 'var(--faint)' }}>
            Overall: {overall.wins}–{overall.losses}
            {overall.total ? ` (${Math.round((overall.wins / overall.total) * 100)}%)` : ''}
          </span>
        </div>
        {loading ? (
          <Skeleton variant="block" className="h-24" />
        ) : stats.length === 0 ? (
          <EmptyState
            title="No games logged yet"
            description="Log a practice game to see matchup statistics"
          />
        ) : (
          <div className="overflow-x-auto rounded-md border" style={{ borderColor: 'var(--line)' }}>
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--panel-2)', color: 'var(--faint)' }}>
                <tr>
                  <th className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em]">Deck</th>
                  <th className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em]">vs</th>
                  <th className="text-right px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em]">W–L</th>
                  <th className="text-right px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em]">Win %</th>
                  <th className="text-right px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] hidden md:table-cell">On play</th>
                  <th className="text-right px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] hidden md:table-cell">On draw</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((r) => (
                  <tr key={`${r.deckArchetype} ${r.vsArchetype}`} style={{ borderTop: '1px solid var(--line)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--text)' }}>{r.deckArchetype}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text)' }}>{r.vsArchetype}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: 'var(--text)' }}>{r.wins}–{r.losses}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums" style={{ color: r.winPct >= 50 ? 'var(--emerald)' : 'var(--ruby)' }}>
                      {r.winPct}%
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell" style={{ color: 'var(--muted)' }}>
                      {r.onPlayGames ? `${r.onPlayWins}/${r.onPlayGames}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell" style={{ color: 'var(--muted)' }}>
                      {r.onDrawGames ? `${r.onDrawWins}/${r.onDrawGames}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Win-rate bar chart by matchup */}
      {chartData.length > 0 && (
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: 'var(--muted)' }}>Matchup win % (top {chartData.length})</h4>
          <div className="rounded-md border p-3" style={{ width: '100%', height: Math.max(120, chartData.length * 34), borderColor: 'var(--line)', background: 'var(--panel-2)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--faint)', fontSize: 11 }} unit="%" />
                <YAxis type="category" dataKey="name" width={150} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: 'var(--line)' }}
                  contentStyle={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 6, fontSize: 12, color: 'var(--text)' }}
                  formatter={(value, _n, p) => [`${value}% (${p.payload.record})`, 'Win rate']}
                />
                <Bar dataKey="winPct" radius={[0, 4, 4, 0]}>
                  {chartData.map((d) => (
                    <Cell key={d.name} fill={d.winPct >= 50 ? 'var(--emerald)' : 'var(--ruby)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Win-rate by player */}
      {playerStats.length > 0 && (
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: 'var(--muted)' }}>Win rate by player</h4>
          <div className="overflow-x-auto rounded-md border" style={{ borderColor: 'var(--line)' }}>
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--panel-2)', color: 'var(--faint)' }}>
                <tr>
                  <th className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em]">Player</th>
                  <th className="text-right px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em]">Games</th>
                  <th className="text-right px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em]">W–L</th>
                  <th className="text-right px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em]">Win %</th>
                </tr>
              </thead>
              <tbody>
                {playerStats.map((p) => (
                  <tr key={p.player} style={{ borderTop: '1px solid var(--line)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--text)' }}>{p.player}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: 'var(--muted)' }}>{p.total}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: 'var(--text)' }}>{p.wins}–{p.losses}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums" style={{ color: p.winPct >= 50 ? 'var(--emerald)' : 'var(--ruby)' }}>
                      {p.winPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent games */}
      {games.length > 0 && (
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: 'var(--muted)' }}>Recent games</h4>
          <ul className="space-y-2">
            {games.slice(0, 25).map((g) => (
              <li key={g.id} className="flex items-start gap-3 rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'var(--line)', background: 'var(--panel-2)' }}>
                <span className="mt-0.5 font-bold tabular-nums" style={{ color: g.result === 'W' ? 'var(--emerald)' : 'var(--ruby)' }}>
                  {g.result}
                </span>
                <div className="flex-1 min-w-0">
                  <div style={{ color: 'var(--text)' }}>
                    {g.deckArchetype} <span style={{ color: 'var(--faint)' }}>vs</span> {g.vsArchetype}
                    {g.onPlay != null && <span style={{ color: 'var(--faint)' }}> · {g.onPlay ? 'on play' : 'on draw'}</span>}
                    {g.format && <span style={{ color: 'var(--faint)' }}> · {g.format}</span>}
                  </div>
                  {g.lesson && <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{g.lesson}</div>}
                  <div className="text-xs mt-0.5 tabular-nums" style={{ color: 'var(--faint)' }}>
                    {new Date(g.playedAt).toLocaleDateString()}
                  </div>
                </div>
                {pendingDelete === g.id ? (
                  <>
                    <button onClick={() => remove(g.id)} className="text-xs shrink-0 hover:brightness-125" style={{ color: 'var(--ruby)' }}>Sure?</button>
                    <button onClick={() => setPendingDelete(null)} className="text-xs shrink-0 hover:brightness-125" style={{ color: 'var(--faint)' }}>✕</button>
                  </>
                ) : (
                  <button onClick={() => setPendingDelete(g.id)} className="text-xs shrink-0 hover:brightness-125" style={{ color: 'var(--faint)' }} title="Delete game">✕</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
