import React, { useState, useEffect, useMemo } from 'react';

/** Parse a comma/newline separated list into a trimmed, de-duped string array. */
function parseList(text) {
  return [...new Set(
    text
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
  )];
}

const input = 'w-full p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm';
const label = 'block text-xs font-medium text-gray-400 mb-1';

function Chips({ items, empty }) {
  if (!items || items.length === 0) return <span className="text-gray-600 text-xs">{empty}</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <span key={it} className="px-2 py-0.5 rounded-full text-xs bg-gray-700 text-gray-200">{it}</span>
      ))}
    </div>
  );
}

/**
 * Team roster: who's on the team and what they play. Any member can read the
 * roster; each member can edit their own profile (display name, pet decks,
 * pilots, notes). The hub owner appears but has no editable profile row.
 */
export default function RosterTab({ hubId, currentUser }) {
  const [owner, setOwner] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ displayName: '', petDecks: '', pilots: '', notes: '' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const r = await fetch(`/api/hubs/${encodeURIComponent(hubId)}/members`);
        if (!r.ok) throw new Error('load');
        const data = await r.json();
        if (!cancelled) {
          setOwner(data.owner ?? null);
          setMembers(Array.isArray(data.members) ? data.members : []);
        }
      } catch {
        if (!cancelled) setError('Failed to load the roster.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hubId]);

  // The caller's own membership row (owners have none → no self-edit).
  const me = useMemo(
    () => members.find((m) => m.userId === currentUser?.id) || null,
    [members, currentUser]
  );

  const startEdit = () => {
    if (!me) return;
    setForm({
      displayName: me.displayName || '',
      petDecks: (me.petDecks || []).join(', '),
      pilots: (me.pilots || []).join(', '),
      notes: me.notes || '',
    });
    setEditing(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        displayName: form.displayName.trim() || null,
        petDecks: parseList(form.petDecks),
        pilots: parseList(form.pilots),
        notes: form.notes.trim() || null,
      };
      const r = await fetch(`/api/hubs/${encodeURIComponent(hubId)}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error('save');
      const updated = await r.json();
      setMembers((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
      setEditing(false);
    } catch {
      setError('Failed to save your profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gray-400 text-sm">Loading roster…</p>;

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-red-600/90 text-white rounded text-sm">{error}</div>}

      <div className="flex items-baseline justify-between">
        <h4 className="text-sm font-semibold text-violet-300">
          Roster ({members.length + (owner ? 1 : 0)})
        </h4>
        {me && !editing && (
          <button onClick={startEdit}
            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded text-xs font-medium">
            Edit my profile
          </button>
        )}
      </div>

      {/* Self-edit form */}
      {editing && (
        <form onSubmit={save} className="bg-gray-800/60 rounded-lg p-4 space-y-3">
          <h5 className="text-sm font-semibold text-violet-300">Your profile</h5>
          <div>
            <label className={label}>Display name</label>
            <input className={input} value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              placeholder="How teammates see you" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={label}>Pet decks (comma separated)</label>
              <input className={input} value={form.petDecks}
                onChange={(e) => setForm((f) => ({ ...f, petDecks: e.target.value }))}
                placeholder="e.g. Blurple Control, Ruby/Amethyst" />
            </div>
            <div>
              <label className={label}>Strong pilots (comma separated)</label>
              <input className={input} value={form.pilots}
                onChange={(e) => setForm((f) => ({ ...f, pilots: e.target.value }))}
                placeholder="Archetypes you pilot well" />
            </div>
          </div>
          <div>
            <label className={label}>Notes</label>
            <textarea className={input} rows={2} value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Anything teammates should know" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded text-sm font-medium">
              {saving ? 'Saving…' : 'Save profile'}
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Owner card */}
      {owner && (
        <div className="bg-gray-800/60 rounded-lg p-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-gray-100 font-medium">{owner.email}</div>
            <div className="text-xs text-gray-500 mt-0.5">Hub owner</div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-xs bg-purple-600 text-white shrink-0">Owner</span>
        </div>
      )}

      {/* Member cards */}
      {members.length === 0 ? (
        <p className="text-gray-500 text-sm">No other members yet.</p>
      ) : (
        <ul className="space-y-3">
          {members.map((m) => {
            const isMe = m.userId === currentUser?.id;
            return (
              <li key={m.id} className="bg-gray-800/60 rounded-lg p-4 space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-gray-100 font-medium">{m.displayName || m.email}</span>
                  {m.displayName && <span className="text-gray-500 text-xs">{m.email}</span>}
                  {isMe && <span className="px-2 py-0.5 rounded-full text-[10px] bg-violet-600/70 text-white">You</span>}
                </div>
                <div>
                  <div className={label}>Pet decks</div>
                  <Chips items={m.petDecks} empty="—" />
                </div>
                <div>
                  <div className={label}>Strong pilots</div>
                  <Chips items={m.pilots} empty="—" />
                </div>
                {m.notes && <div className="text-gray-400 text-xs">{m.notes}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
