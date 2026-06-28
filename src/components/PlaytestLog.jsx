import React, { useState, useEffect, useMemo } from 'react';

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
    if (!window.confirm('Delete this logged game?')) return;
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

  const input = 'w-full p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm';
  const label = 'block text-xs font-medium text-gray-400 mb-1';

  return (
    <div className="space-y-6">
      {error && <div className="p-3 bg-red-600/90 text-white rounded text-sm">{error}</div>}

      {/* Log a game */}
      <form onSubmit={submit} className="bg-gray-800/60 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-semibold text-violet-300">Log a practice game</h4>
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
          <div className="grid grid-cols-3 gap-2">
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
        <button type="submit" disabled={saving}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded text-sm font-medium">
          {saving ? 'Logging…' : 'Log game'}
        </button>
      </form>

      {/* Win-rate by matchup */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h4 className="text-sm font-semibold text-violet-300">Win rate by matchup</h4>
          <span className="text-xs text-gray-400">
            Overall: {overall.wins}–{overall.losses}
            {overall.total ? ` (${Math.round((overall.wins / overall.total) * 100)}%)` : ''}
          </span>
        </div>
        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : stats.length === 0 ? (
          <p className="text-gray-500 text-sm">No games logged yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-gray-400">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Deck</th>
                  <th className="text-left px-3 py-2 font-medium">vs</th>
                  <th className="text-right px-3 py-2 font-medium">W–L</th>
                  <th className="text-right px-3 py-2 font-medium">Win %</th>
                  <th className="text-right px-3 py-2 font-medium">On play</th>
                  <th className="text-right px-3 py-2 font-medium">On draw</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((r) => (
                  <tr key={`${r.deckArchetype} ${r.vsArchetype}`} className="border-t border-gray-700/60">
                    <td className="px-3 py-2 text-gray-200">{r.deckArchetype}</td>
                    <td className="px-3 py-2 text-gray-200">{r.vsArchetype}</td>
                    <td className="px-3 py-2 text-right text-gray-200">{r.wins}–{r.losses}</td>
                    <td className={`px-3 py-2 text-right font-medium ${r.winPct >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {r.winPct}%
                    </td>
                    <td className="px-3 py-2 text-right text-gray-400">
                      {r.onPlayGames ? `${r.onPlayWins}/${r.onPlayGames}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-400">
                      {r.onDrawGames ? `${r.onDrawWins}/${r.onDrawGames}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent games */}
      {games.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-violet-300 mb-2">Recent games</h4>
          <ul className="space-y-2">
            {games.slice(0, 25).map((g) => (
              <li key={g.id} className="flex items-start gap-3 bg-gray-800/60 rounded px-3 py-2 text-sm">
                <span className={`mt-0.5 font-bold ${g.result === 'W' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {g.result}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-gray-200">
                    {g.deckArchetype} <span className="text-gray-500">vs</span> {g.vsArchetype}
                    {g.onPlay != null && <span className="text-gray-500"> · {g.onPlay ? 'on play' : 'on draw'}</span>}
                    {g.format && <span className="text-gray-500"> · {g.format}</span>}
                  </div>
                  {g.lesson && <div className="text-gray-400 text-xs mt-0.5">{g.lesson}</div>}
                  <div className="text-gray-600 text-xs mt-0.5">
                    {new Date(g.playedAt).toLocaleDateString()}
                  </div>
                </div>
                <button onClick={() => remove(g.id)}
                  className="text-gray-500 hover:text-red-400 text-xs shrink-0" title="Delete game">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
