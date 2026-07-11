import React, { useState, useEffect, useMemo } from 'react';
import { Button, Skeleton, EmptyState } from '../ui';

/** Parse a comma/newline separated list into a trimmed, de-duped string array. */
function parseList(text) {
  return [...new Set(
    text
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
  )];
}

const input = 'w-full p-2 rounded text-sm bg-[color:var(--panel-2)] border border-[color:var(--line-2)] text-[color:var(--text)] focus:outline-none';
const label = 'block text-[11px] uppercase tracking-[0.1em] font-semibold mb-1 text-[color:var(--faint)]';

function Chips({ items, empty }) {
  if (!items || items.length === 0) return <span className="text-xs text-[color:var(--faint)]">{empty}</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <span key={it} className="px-2 py-0.5 rounded-full text-xs bg-[color:var(--panel-2)] text-[color:var(--muted)] border border-[color:var(--line)]">{it}</span>
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

  if (loading) return <Skeleton variant="block" className="h-24" />;

  return (
    <div className="space-y-4">
      {error && <p className="text-sm" style={{ color: 'var(--ruby)' }}>{error}</p>}

      <div className="flex items-baseline justify-between">
        <h4 className="text-sm font-display" style={{ fontWeight: 560, color: 'var(--text)' }}>
          Roster ({members.length + (owner ? 1 : 0)})
        </h4>
        {me && !editing && (
          <Button onClick={startEdit} size="sm">
            Edit my profile
          </Button>
        )}
      </div>

      {/* Self-edit form */}
      {editing && (
        <form onSubmit={save} className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
          <h5 className="text-sm font-display" style={{ fontWeight: 560, color: 'var(--text)' }}>Your profile</h5>
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
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save profile'}
            </Button>
            <Button type="button" onClick={() => setEditing(false)} variant="ghost">
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Owner card */}
      {owner && (
        <div className="rounded-xl border p-4 flex items-start justify-between gap-3" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
          <div>
            <div className="font-medium" style={{ color: 'var(--text)' }}>{owner.email}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--faint)' }}>Hub owner</div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-xs shrink-0" style={{ color: 'var(--amethyst)', background: 'color-mix(in srgb, var(--amethyst) 16%, transparent)' }}>Owner</span>
        </div>
      )}

      {/* Member cards */}
      {members.length === 0 ? (
        <EmptyState title="No members yet" description="Invite someone with the hub invite code." />
      ) : (
        <ul className="space-y-3">
          {members.map((m) => {
            const isMe = m.userId === currentUser?.id;
            return (
              <li key={m.id} className="rounded-xl border p-4 space-y-2" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
                <div className="flex items-baseline gap-2">
                  <span className="font-medium" style={{ color: 'var(--text)' }}>{m.displayName || m.email}</span>
                  {m.displayName && <span className="text-xs" style={{ color: 'var(--faint)' }}>{m.email}</span>}
                  {isMe && <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ color: 'var(--amethyst)', background: 'color-mix(in srgb, var(--amethyst) 16%, transparent)' }}>You</span>}
                </div>
                <div>
                  <div className={label}>Pet decks</div>
                  <Chips items={m.petDecks} empty="—" />
                </div>
                <div>
                  <div className={label}>Strong pilots</div>
                  <Chips items={m.pilots} empty="—" />
                </div>
                {m.notes && <div className="text-xs" style={{ color: 'var(--muted)' }}>{m.notes}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
