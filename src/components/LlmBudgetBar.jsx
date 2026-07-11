import React, { useState, useEffect } from 'react';

/**
 * Compact month-to-date AI usage bar for a hub's review generation budget.
 * Hub owners get an inline control to change the monthly token cap.
 */
export default function LlmBudgetBar({ hubId }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const r = await fetch(`/api/hubs/llm-budget?hubId=${encodeURIComponent(hubId)}`);
      if (!r.ok) throw new Error('load');
      setStatus(await r.json());
    } catch {
      setError('Could not load AI usage.');
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [hubId]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      // Blank = unlimited (null).
      const trimmed = draft.trim();
      const monthlyTokenBudget = trimmed === '' ? null : Math.max(0, parseInt(trimmed, 10) || 0);
      const r = await fetch('/api/hubs/llm-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hubId, monthlyTokenBudget }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'save');
      setStatus(data);
      setEditing(false);
    } catch (e) {
      setError(e.message || 'Could not save budget.');
    } finally {
      setSaving(false);
    }
  };

  if (error && !status) return <div className="text-xs mb-3" style={{ color: 'var(--faint)' }}>{error}</div>;
  if (!status) return null;

  const { used, budget, unlimited, isOwner } = status;
  const pct = unlimited || !budget ? 0 : Math.min(100, Math.round((used / budget) * 100));
  const barColor = pct >= 100 ? 'var(--ruby)' : pct >= 80 ? 'var(--amber)' : 'var(--sapphire)';

  return (
    <div className="mb-4 rounded-lg border p-3" style={{ background: 'var(--panel-2)', borderColor: 'var(--line)' }}>
      <div className="flex items-center justify-between text-xs mb-1" style={{ color: 'var(--muted)' }}>
        <span>AI reviews · this month</span>
        <span className="tabular-nums">
          {used.toLocaleString()}{unlimited ? '' : ` / ${budget.toLocaleString()}`} tokens
          {unlimited && <span className="ml-1" style={{ color: 'var(--faint)' }}>(no cap)</span>}
        </span>
      </div>
      {!unlimited && (
        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
          <div className="h-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
        </div>
      )}
      {status.exceeded && (
        <div className="mt-1 text-xs" style={{ color: 'var(--ruby)' }}>Budget reached — generation is paused until next month or a higher cap.</div>
      )}

      {isOwner && (
        <div className="mt-2 text-xs">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" value={draft} onChange={(e) => setDraft(e.target.value)}
                placeholder="tokens / month (blank = unlimited)"
                className="flex-1 p-1.5 border rounded"
                style={{ background: 'var(--panel-2)', borderColor: 'var(--line-2)', color: 'var(--text)' }}
              />
              <button onClick={save} disabled={saving}
                className="px-2 py-1 rounded font-semibold disabled:opacity-50 hover:brightness-110"
                style={{ background: 'var(--sapphire)', color: '#0b1620' }}>
                {saving ? '…' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} className="px-2 py-1 transition-colors"
                style={{ color: 'var(--faint)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--faint)')}>Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => { setDraft(unlimited ? '' : String(budget)); setEditing(true); }}
              className="underline transition-colors"
              style={{ color: 'var(--faint)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--faint)')}>
              Set monthly budget
            </button>
          )}
        </div>
      )}
    </div>
  );
}
