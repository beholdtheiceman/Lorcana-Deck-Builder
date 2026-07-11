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

  const input = 'w-full p-2 border rounded text-sm';
  const inputStyle = { background: 'var(--panel-2)', borderColor: 'var(--line-2)', color: 'var(--text)' };
  const label = 'block text-xs font-medium mb-1';
  const labelStyle = { color: 'var(--muted)' };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="mb-4 px-3 py-2 rounded border text-sm transition-colors hover:brightness-110"
        style={{ background: 'var(--panel-2)', borderColor: 'var(--line-2)', color: 'var(--text)' }}>
        + File a paper / video game review
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mb-4 rounded-lg border p-4 space-y-3" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
      <div className="flex items-center justify-between">
        <h4 className="font-display text-sm" style={{ fontWeight: 560, color: 'var(--text)' }}>Paper / video game review</h4>
        <button type="button" onClick={() => setOpen(false)} className="text-sm transition-colors"
          style={{ color: 'var(--faint)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--faint)')}>✕</button>
      </div>
      {error && <div className="p-2 rounded text-sm" style={{ background: 'color-mix(in srgb, var(--ruby) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--ruby) 40%, transparent)', color: 'var(--ruby)' }}>{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={label} style={labelStyle}>Your deck archetype</label>
          <input className={input} style={inputStyle} value={form.deckArchetype} onChange={(e) => setField('deckArchetype', e.target.value)} placeholder="e.g. Blurple Control" />
        </div>
        <div>
          <label className={label} style={labelStyle}>Opponent archetype</label>
          <input className={input} style={inputStyle} value={form.vsArchetype} onChange={(e) => setField('vsArchetype', e.target.value)} placeholder="e.g. Go-Wide Dogs" />
        </div>
        <div>
          <label className={label} style={labelStyle}>Result</label>
          <select className={input} style={inputStyle} value={form.result} onChange={(e) => setField('result', e.target.value)}>
            <option value="W">Win</option>
            <option value="L">Loss</option>
          </select>
        </div>
        <div>
          <label className={label} style={labelStyle}>Player (optional)</label>
          <input className={input} style={inputStyle} value={form.player} onChange={(e) => setField('player', e.target.value)} placeholder="Who played it" />
        </div>
      </div>

      <div>
        <label className={label} style={labelStyle}>Recap *</label>
        <textarea className={input} style={inputStyle} rows={3} value={form.recap} onChange={(e) => setField('recap', e.target.value)}
          placeholder="How the game flowed and the key turning points" required />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={label} style={labelStyle}>Decision points (optional)</label>
          <button type="button" onClick={addLine} className="text-xs transition-colors"
            style={{ color: 'var(--sapphire)' }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.15)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}>+ add</button>
        </div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-2">
            <input className={`${input} sm:col-span-2`} style={inputStyle} value={l.turn} onChange={(e) => setLine(i, 'turn', e.target.value)} placeholder="Turn" />
            <input className={`${input} sm:col-span-3`} style={inputStyle} value={l.whatHappened} onChange={(e) => setLine(i, 'whatHappened', e.target.value)} placeholder="What happened" />
            <input className={`${input} sm:col-span-3`} style={inputStyle} value={l.betterLine} onChange={(e) => setLine(i, 'betterLine', e.target.value)} placeholder="Better line" />
            <input className={`${input} sm:col-span-3`} style={inputStyle} value={l.why} onChange={(e) => setLine(i, 'why', e.target.value)} placeholder="Why" />
            <button type="button" onClick={() => removeLine(i)} className="sm:col-span-1 text-sm transition-colors"
              style={{ color: 'var(--faint)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ruby)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--faint)')}>✕</button>
          </div>
        ))}
      </div>

      <div>
        <label className={label} style={labelStyle}>Leak tags (comma-separated)</label>
        <input className={input} style={inputStyle} value={form.leakTags} onChange={(e) => setField('leakTags', e.target.value)}
          placeholder="over-traded, target selection, tempo" />
      </div>

      <button type="submit" disabled={saving}
        className="px-4 py-2 rounded text-sm font-semibold disabled:opacity-50 hover:brightness-110"
        style={{ background: 'var(--sapphire)', color: '#0b1620' }}>
        {saving ? 'Filing…' : 'File review'}
      </button>
    </form>
  );
}
