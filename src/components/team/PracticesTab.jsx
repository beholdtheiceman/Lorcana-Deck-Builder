import React, { useState, useEffect, useMemo } from 'react';

const input = 'w-full p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm';
const label = 'block text-xs font-medium text-gray-400 mb-1';
const EMPTY_FORM = { id: null, title: '', startsAt: '', focus: '' };
const STATUSES = [['yes', 'Yes'], ['maybe', 'Maybe'], ['no', 'No']];

/** Human "in 3 days" / "2 hours ago" countdown from an ISO timestamp. */
function countdown(iso) {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  const past = diff < 0;
  const mins = Math.round(Math.abs(diff) / 60000);
  const hrs = Math.round(mins / 60);
  const days = Math.round(hrs / 24);
  let s;
  if (mins < 60) s = `${mins} min`;
  else if (hrs < 24) s = `${hrs} hr`;
  else s = `${days} day${days === 1 ? '' : 's'}`;
  return past ? `${s} ago` : `in ${s}`;
}

const fmt = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'TBD';

/**
 * Team practices: scrim/testing sessions anyone can post and RSVP to. Any
 * member can post and edit; the creator or hub owner can delete.
 */
export default function PracticesTab({ hubId, currentUser, isOwner = false }) {
  const [practices, setPractices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const r = await fetch(`/api/hubs/${encodeURIComponent(hubId)}/practices`);
        if (!r.ok) throw new Error('load');
        const data = await r.json();
        if (!cancelled) setPractices(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setError('Failed to load practices.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hubId]);

  const now = Date.now();
  const { upcoming, past } = useMemo(() => {
    const up = [], pa = [];
    for (const p of practices) {
      // Sessions with no date are treated as upcoming.
      (!p.startsAt || new Date(p.startsAt).getTime() >= now ? up : pa).push(p);
    }
    pa.reverse();
    return { upcoming: up, past: pa };
  }, [practices, now]);

  const canModify = (p) => p.createdById === currentUser?.id || isOwner;

  const openNew = () => { setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (p) => {
    setForm({
      id: p.id,
      title: p.title,
      // datetime-local wants "YYYY-MM-DDTHH:mm" in local time
      startsAt: p.startsAt ? new Date(p.startsAt).toISOString().slice(0, 16) : '',
      focus: p.focus || '',
    });
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError('');
    const payload = {
      title: form.title.trim(),
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      focus: form.focus.trim() || null,
    };
    try {
      const editing = Boolean(form.id);
      const r = await fetch(
        editing ? `/api/practices/${form.id}` : `/api/hubs/${encodeURIComponent(hubId)}/practices`,
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!r.ok) throw new Error('save');
      const saved = await r.json();
      setPractices((prev) =>
        editing ? prev.map((x) => (x.id === saved.id ? saved : x)) : [...prev, saved]
      );
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch {
      setError('Failed to save the practice.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this practice?')) return;
    const prev = practices;
    setPractices((list) => list.filter((x) => x.id !== id));
    try {
      const r = await fetch(`/api/practices/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('delete');
    } catch {
      setPractices(prev);
      setError('Failed to delete the practice.');
    }
  };

  const setRsvp = async (practiceId, status) => {
    try {
      const r = await fetch(`/api/practices/${practiceId}/rsvp`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error('rsvp');
      const mine = await r.json();
      setPractices((prev) =>
        prev.map((p) => {
          if (p.id !== practiceId) return p;
          const others = (p.rsvps || []).filter((x) => x.memberId !== mine.memberId);
          return { ...p, rsvps: [...others, mine] };
        })
      );
    } catch {
      setError('Failed to save your RSVP.');
    }
  };

  const Card = ({ p, dim }) => {
    const myStatus = (p.rsvps || []).find((r) => r.memberId === currentUser?.id)?.status || null;
    const yes = (p.rsvps || []).filter((r) => r.status === 'yes');
    const maybe = (p.rsvps || []).filter((r) => r.status === 'maybe');
    return (
      <li className={`bg-gray-800/60 rounded-lg p-4 space-y-2 ${dim ? 'opacity-60' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-gray-100 font-medium">{p.title}</div>
            <div className="text-gray-400 text-xs mt-0.5">
              {fmt(p.startsAt)}
              {p.startsAt && <span className="text-violet-300"> · {countdown(p.startsAt)}</span>}
            </div>
            {p.focus && <div className="text-gray-400 text-xs mt-1">{p.focus}</div>}
          </div>
          {canModify(p) && (
            <div className="flex gap-2 shrink-0">
              <button onClick={() => openEdit(p)} className="text-gray-500 hover:text-violet-300 text-xs">Edit</button>
              <button onClick={() => remove(p.id)} className="text-gray-500 hover:text-red-400 text-xs">Delete</button>
            </div>
          )}
        </div>

        {/* RSVP controls */}
        <div className="flex items-center gap-1.5">
          {STATUSES.map(([val, lbl]) => (
            <button key={val} onClick={() => setRsvp(p.id, val)}
              className={`px-2.5 py-1 rounded text-xs font-medium ${myStatus === val ? 'bg-violet-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
              {lbl}
            </button>
          ))}
          <span className="text-xs text-gray-500 ml-1">
            {yes.length} going{maybe.length ? ` · ${maybe.length} maybe` : ''}
          </span>
        </div>
        {yes.length > 0 && (
          <div className="text-xs text-gray-400">
            Going: {yes.map((r) => r.email || 'Unknown').join(', ')}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-red-600/90 text-white rounded text-sm">{error}</div>}

      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-violet-300">Practices ({practices.length})</h4>
        {!showForm && (
          <button onClick={openNew}
            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded text-xs font-medium">
            New practice
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-gray-800/60 rounded-lg p-4 space-y-3">
          <h5 className="text-sm font-semibold text-violet-300">{form.id ? 'Edit practice' : 'New practice'}</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={label}>Title *</label>
              <input className={input} value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Thursday scrim block" required />
            </div>
            <div>
              <label className={label}>Date &amp; time</label>
              <input type="datetime-local" className={input} value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={label}>Focus (what are we testing?)</label>
            <textarea className={input} rows={2} value={form.focus}
              onChange={(e) => setForm((f) => ({ ...f, focus: e.target.value }))}
              placeholder="e.g. Blurple mirror, new sideboard tech" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded text-sm font-medium">
              {saving ? 'Saving…' : form.id ? 'Save changes' : 'Post practice'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div>
        <h4 className="text-sm font-semibold text-violet-300 mb-2">Upcoming</h4>
        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : upcoming.length === 0 ? (
          <p className="text-gray-500 text-sm">No upcoming practices.</p>
        ) : (
          <ul className="space-y-2">{upcoming.map((p) => <Card key={p.id} p={p} />)}</ul>
        )}
      </div>

      {past.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-400 mb-2">Past</h4>
          <ul className="space-y-2">{past.slice(0, 15).map((p) => <Card key={p.id} p={p} dim />)}</ul>
        </div>
      )}
    </div>
  );
}
