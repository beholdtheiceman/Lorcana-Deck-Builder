import React, { useState, useEffect, useMemo } from 'react';

const EMPTY = { title: '', startsAt: '', location: '', kind: '', notes: '' };

export default function EventsPanel({ hubId, isOwner = false, initialWebhook = '' }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);

  // Discord webhook config (owner only)
  const [webhook, setWebhook] = useState(initialWebhook);
  const [webhookMsg, setWebhookMsg] = useState('');
  const [savingWebhook, setSavingWebhook] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const r = await fetch(`/api/events?hubId=${encodeURIComponent(hubId)}`);
        if (!r.ok) throw new Error('load');
        const data = await r.json();
        if (!cancelled) setEvents(data);
      } catch {
        if (!cancelled) setError('Failed to load events.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hubId]);

  const now = Date.now();
  const { upcoming, past } = useMemo(() => {
    const up = [], pa = [];
    for (const e of events) {
      (new Date(e.startsAt).getTime() >= now ? up : pa).push(e);
    }
    pa.reverse(); // most recent past first
    return { upcoming: up, past: pa };
  }, [events, now]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.startsAt) {
      setError('Title and date/time are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        hubId,
        title: form.title.trim(),
        startsAt: new Date(form.startsAt).toISOString(),
        location: form.location.trim() || null,
        kind: form.kind || null,
        notes: form.notes.trim() || null,
      };
      const r = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error('save');
      const created = await r.json();
      setEvents((prev) => [...prev, created].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)));
      setForm(EMPTY);
    } catch {
      setError('Failed to create the event.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    const prev = events;
    setEvents((list) => list.filter((x) => x.id !== id));
    try {
      const r = await fetch(`/api/events/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('delete');
    } catch {
      setEvents(prev);
      setError('Failed to delete the event.');
    }
  };

  const saveWebhook = async () => {
    setSavingWebhook(true);
    setWebhookMsg('');
    try {
      const r = await fetch('/api/hubs/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hubId, webhookUrl: webhook.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'save');
      setWebhookMsg(data.configured ? 'Webhook saved.' : 'Webhook cleared.');
    } catch (err) {
      setWebhookMsg(err.message || 'Failed to save webhook.');
    } finally {
      setSavingWebhook(false);
    }
  };

  const input = 'w-full p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm';
  const label = 'block text-xs font-medium text-gray-400 mb-1';

  const fmt = (iso) =>
    new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  const Row = ({ e, dim }) => (
    <li className={`flex items-start gap-3 bg-gray-800/60 rounded px-3 py-2 text-sm ${dim ? 'opacity-60' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="text-gray-100 font-medium">
          {e.title}
          {e.kind && <span className="ml-2 text-xs text-violet-300">{e.kind}</span>}
        </div>
        <div className="text-gray-400 text-xs mt-0.5">
          {fmt(e.startsAt)}{e.location ? ` · ${e.location}` : ''}
        </div>
        {e.notes && <div className="text-gray-400 text-xs mt-0.5">{e.notes}</div>}
      </div>
      <button onClick={() => remove(e.id)}
        className="text-gray-500 hover:text-red-400 text-xs shrink-0" title="Delete event">✕</button>
    </li>
  );

  return (
    <div className="space-y-6">
      {error && <div className="p-3 bg-red-600/90 text-white rounded text-sm">{error}</div>}

      {/* Add event */}
      <form onSubmit={submit} className="bg-gray-800/60 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-semibold text-violet-300">Add an event</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>Title *</label>
            <input className={input} value={form.title} onChange={(e) => setField('title', e.target.value)}
              placeholder="e.g. Locals @ Game Haven" required />
          </div>
          <div>
            <label className={label}>Date &amp; time *</label>
            <input type="datetime-local" className={input} value={form.startsAt}
              onChange={(e) => setField('startsAt', e.target.value)} required />
          </div>
          <div>
            <label className={label}>Location</label>
            <input className={input} value={form.location} onChange={(e) => setField('location', e.target.value)}
              placeholder="Store / city / online" />
          </div>
          <div>
            <label className={label}>Type</label>
            <select className={input} value={form.kind} onChange={(e) => setField('kind', e.target.value)}>
              <option value="">—</option>
              <option value="Tournament">Tournament</option>
              <option value="Playtest">Playtest</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        <div>
          <label className={label}>Notes (optional)</label>
          <textarea className={input} rows={2} value={form.notes}
            onChange={(e) => setField('notes', e.target.value)} placeholder="Format, who's going, etc." />
        </div>
        <button type="submit" disabled={saving}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded text-sm font-medium">
          {saving ? 'Adding…' : 'Add event'}
        </button>
      </form>

      {/* Lists */}
      <div>
        <h4 className="text-sm font-semibold text-violet-300 mb-2">Upcoming</h4>
        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : upcoming.length === 0 ? (
          <p className="text-gray-500 text-sm">No upcoming events.</p>
        ) : (
          <ul className="space-y-2">{upcoming.map((e) => <Row key={e.id} e={e} />)}</ul>
        )}
      </div>

      {past.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-400 mb-2">Past</h4>
          <ul className="space-y-2">{past.slice(0, 15).map((e) => <Row key={e.id} e={e} dim />)}</ul>
        </div>
      )}

      {/* Discord webhook config — owner only */}
      {isOwner && (
        <div className="bg-gray-800/60 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-semibold text-violet-300">Discord notifications</h4>
          <p className="text-xs text-gray-400">
            Paste a Discord channel webhook URL to post a message when a new event is added.
          </p>
          <div className="flex gap-2">
            <input className={input} type="url" value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              placeholder="https://discord.com/api/webhooks/…" />
            <button onClick={saveWebhook} disabled={savingWebhook}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded text-sm shrink-0">
              {savingWebhook ? 'Saving…' : 'Save'}
            </button>
          </div>
          {webhookMsg && <p className="text-xs text-gray-400">{webhookMsg}</p>}
        </div>
      )}
    </div>
  );
}
