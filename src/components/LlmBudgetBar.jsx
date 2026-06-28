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

  if (error && !status) return <div className="text-xs text-gray-500 mb-3">{error}</div>;
  if (!status) return null;

  const { used, budget, unlimited, isOwner } = status;
  const pct = unlimited || !budget ? 0 : Math.min(100, Math.round((used / budget) * 100));
  const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-violet-500';

  return (
    <div className="mb-4 bg-gray-800/60 rounded-lg p-3">
      <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
        <span>AI reviews · this month</span>
        <span>
          {used.toLocaleString()}{unlimited ? '' : ` / ${budget.toLocaleString()}`} tokens
          {unlimited && <span className="ml-1 text-gray-500">(no cap)</span>}
        </span>
      </div>
      {!unlimited && (
        <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
          <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {status.exceeded && (
        <div className="mt-1 text-xs text-red-400">Budget reached — generation is paused until next month or a higher cap.</div>
      )}

      {isOwner && (
        <div className="mt-2 text-xs">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" value={draft} onChange={(e) => setDraft(e.target.value)}
                placeholder="tokens / month (blank = unlimited)"
                className="flex-1 p-1.5 bg-gray-800 border border-gray-700 rounded text-white"
              />
              <button onClick={save} disabled={saving}
                className="px-2 py-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded">
                {saving ? '…' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} className="px-2 py-1 text-gray-400 hover:text-white">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => { setDraft(unlimited ? '' : String(budget)); setEditing(true); }}
              className="text-gray-400 hover:text-violet-300 underline">
              Set monthly budget
            </button>
          )}
        </div>
      )}
    </div>
  );
}
