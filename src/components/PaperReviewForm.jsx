import React, { useState } from 'react';

/**
 * Files a review for a paper or video game that has no uploaded replay file.
 * Posts to /api/reviews/import (Stage A — no LLM), generatedBy "human".
 */
const EMPTY = { deckArchetype: '', vsArchetype: '', result: 'W', player: '', recap: '', leakTags: '' };
const EMPTY_LINE = { turn: '', whatHappened: '', betterLine: '', why: '' };

export default function PaperReviewForm({ hubId, onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [lines, setLines] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setLine = (i, k, v) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const addLine = () => setLines((ls) => [...ls, { ...EMPTY_LINE }]);
  const removeLine = (i) => setLines((ls) => ls.filter((_, j) => j !== i));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.recap.trim()) {
      setError('A recap is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        hubId,
        generatedBy: 'human',
        player: form.player.trim() || undefined,
        deckArchetype: form.deckArchetype.trim() || undefined,
        vsArchetype: form.vsArchetype.trim() || undefined,
        result: form.result || undefined,
        recap: form.recap.trim(),
        lines: lines
          .filter((l) => l.whatHappened.trim() || l.betterLine.trim())
          .map((l) => ({
            turn: l.turn.trim() || undefined,
            whatHappened: l.whatHappened.trim() || undefined,
            betterLine: l.betterLine.trim() || undefined,
            why: l.why.trim() || undefined,
          })),
        leakTags: form.leakTags.split(',').map((t) => t.trim()).filter(Boolean),
      };
      const r = await fetch('/api/reviews/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `Could not file review (${r.status})`);
      }
      const created = await r.json();
      setForm(EMPTY);
      setLines([]);
      setOpen(false);
      onCreated?.(created);
    } catch (err) {
      setError(err.message || 'Could not file review.');
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm';
  const label = 'block text-xs font-medium text-gray-400 mb-1';

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="mb-4 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">
        + File a paper / video game review
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mb-4 bg-gray-800/60 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-violet-300">Paper / video game review</h4>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-sm">✕</button>
      </div>
      {error && <div className="p-2 bg-red-600/90 text-white rounded text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={label}>Your deck archetype</label>
          <input className={input} value={form.deckArchetype} onChange={(e) => setField('deckArchetype', e.target.value)} placeholder="e.g. Blurple Control" />
        </div>
        <div>
          <label className={label}>Opponent archetype</label>
          <input className={input} value={form.vsArchetype} onChange={(e) => setField('vsArchetype', e.target.value)} placeholder="e.g. Go-Wide Dogs" />
        </div>
        <div>
          <label className={label}>Result</label>
          <select className={input} value={form.result} onChange={(e) => setField('result', e.target.value)}>
            <option value="W">Win</option>
            <option value="L">Loss</option>
          </select>
        </div>
        <div>
          <label className={label}>Player (optional)</label>
          <input className={input} value={form.player} onChange={(e) => setField('player', e.target.value)} placeholder="Who played it" />
        </div>
      </div>

      <div>
        <label className={label}>Recap *</label>
        <textarea className={input} rows={3} value={form.recap} onChange={(e) => setField('recap', e.target.value)}
          placeholder="How the game flowed and the key turning points" required />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={label}>Decision points (optional)</label>
          <button type="button" onClick={addLine} className="text-xs text-violet-300 hover:text-violet-200">+ add</button>
        </div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-2">
            <input className={`${input} sm:col-span-2`} value={l.turn} onChange={(e) => setLine(i, 'turn', e.target.value)} placeholder="Turn" />
            <input className={`${input} sm:col-span-3`} value={l.whatHappened} onChange={(e) => setLine(i, 'whatHappened', e.target.value)} placeholder="What happened" />
            <input className={`${input} sm:col-span-3`} value={l.betterLine} onChange={(e) => setLine(i, 'betterLine', e.target.value)} placeholder="Better line" />
            <input className={`${input} sm:col-span-3`} value={l.why} onChange={(e) => setLine(i, 'why', e.target.value)} placeholder="Why" />
            <button type="button" onClick={() => removeLine(i)} className="sm:col-span-1 text-gray-500 hover:text-red-400 text-sm">✕</button>
          </div>
        ))}
      </div>

      <div>
        <label className={label}>Leak tags (comma-separated)</label>
        <input className={input} value={form.leakTags} onChange={(e) => setField('leakTags', e.target.value)}
          placeholder="over-traded, target selection, tempo" />
      </div>

      <button type="submit" disabled={saving}
        className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded text-sm font-medium">
        {saving ? 'Filing…' : 'File review'}
      </button>
    </form>
  );
}
