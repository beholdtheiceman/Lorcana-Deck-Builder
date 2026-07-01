import React, { useState, useEffect, useMemo } from 'react';
import { Button, Skeleton, EmptyState } from '../ui';

const input = 'w-full p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm';
const label = 'block text-xs font-medium text-gray-400 mb-1';
const PRESET_TAGS = ['meta', 'matchup', 'event-report'];
const EMPTY_FORM = { id: null, title: '', body: '', tags: '' };

function parseTags(text) {
  return [...new Set(text.split(/[\n,]/).map((s) => s.trim().toLowerCase()).filter(Boolean))];
}

/**
 * Team meta reports: shareable markdown write-ups (meta reads, tech, event
 * reports). Any member can post and edit; the author or hub owner can delete.
 * Tag filter narrows the list. Bodies are stored as markdown and rendered as
 * plain pre-wrapped text (React-escaped) for now.
 */
export default function MetaReportsTab({ hubId, currentUser, isOwner = false }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [activeTag, setActiveTag] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const r = await fetch(`/api/hubs/${encodeURIComponent(hubId)}/reports`);
        if (!r.ok) throw new Error('load');
        const data = await r.json();
        if (!cancelled) setReports(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setError('Failed to load reports.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hubId]);

  // All tags present across reports, for the filter bar.
  const allTags = useMemo(() => {
    const s = new Set(PRESET_TAGS);
    reports.forEach((r) => (r.tags || []).forEach((t) => s.add(t)));
    return [...s];
  }, [reports]);

  const visible = useMemo(
    () => (activeTag ? reports.filter((r) => (r.tags || []).includes(activeTag)) : reports),
    [reports, activeTag]
  );

  const canModify = (r) => r.authorId === currentUser?.id || isOwner;

  const openNew = () => { setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (r) => {
    setForm({ id: r.id, title: r.title, body: r.body, tags: (r.tags || []).join(', ') });
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      setError('Title and body are required.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = { title: form.title.trim(), body: form.body, tags: parseTags(form.tags) };
    try {
      const editing = Boolean(form.id);
      const r = await fetch(
        editing ? `/api/reports/${form.id}` : `/api/hubs/${encodeURIComponent(hubId)}/reports`,
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!r.ok) throw new Error('save');
      const saved = await r.json();
      setReports((prev) =>
        editing ? prev.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...prev]
      );
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch {
      setError('Failed to save the report.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this report?')) return;
    const prev = reports;
    setReports((rs) => rs.filter((x) => x.id !== id)); // optimistic
    try {
      const r = await fetch(`/api/reports/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('delete');
    } catch {
      setReports(prev);
      setError('Failed to delete the report.');
    }
  };

  return (
    <div className="space-y-4">
      {error && <p className="text-bad text-sm">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-violet-300">Meta reports ({reports.length})</h4>
        {!showForm && (
          <Button variant="primary" onClick={openNew}>
            New report
          </Button>
        )}
      </div>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setActiveTag('')}
            className={`px-2 py-0.5 rounded-full text-xs ${activeTag === '' ? 'bg-violet-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            All
          </button>
          {allTags.map((t) => (
            <button key={t} onClick={() => setActiveTag(t === activeTag ? '' : t)}
              className={`px-2 py-0.5 rounded-full text-xs ${t === activeTag ? 'bg-violet-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Create / edit form */}
      {showForm && (
        <form onSubmit={submit} className="bg-gray-800/60 rounded-lg p-4 space-y-3">
          <h5 className="text-sm font-semibold text-violet-300">{form.id ? 'Edit report' : 'New report'}</h5>
          <div>
            <label className={label}>Title *</label>
            <input className={input} value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Set 6 meta read — week 1" required />
          </div>
          <div>
            <label className={label}>Body (markdown) *</label>
            <textarea className={`${input} font-mono`} rows={8} value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="Write your report…" required />
          </div>
          <div>
            <label className={label}>Tags (comma separated)</label>
            <input className={input} list="report-tags" value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="meta, matchup, event-report" />
            <datalist id="report-tags">
              {PRESET_TAGS.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : form.id ? 'Save changes' : 'Post report'}
            </Button>
            <Button variant="ghost" type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Reports list */}
      {loading ? (
        <Skeleton variant=”block” className=”h-24” />
      ) : visible.length === 0 ? (
        <EmptyState
          title={activeTag ? `No reports tagged “${activeTag}”` : 'No reports yet'}
          description={activeTag ? 'Try a different tag filter' : 'Create a meta report to get started'}
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((r) => (
            <li key={r.id} className="bg-gray-800/60 rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h5 className="text-gray-100 font-semibold">{r.title}</h5>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {r.authorEmail || 'Unknown'} · {new Date(r.createdAt).toLocaleDateString()}
                    {r.updatedAt && r.updatedAt !== r.createdAt ? ' · edited' : ''}
                  </div>
                </div>
                {canModify(r) && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => openEdit(r)}
                      className="text-gray-500 hover:text-violet-300 text-xs">Edit</button>
                    <button onClick={() => remove(r.id)}
                      className="text-gray-500 hover:text-red-400 text-xs">Delete</button>
                  </div>
                )}
              </div>
              {r.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {r.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-gray-700 text-gray-300">{t}</span>
                  ))}
                </div>
              )}
              <div className="text-gray-300 text-sm whitespace-pre-wrap break-words">{r.body}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
