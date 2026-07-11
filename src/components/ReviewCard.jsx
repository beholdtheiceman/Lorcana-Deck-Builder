import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * ReviewCard
 * Renders a single Review: recap, decision points (lines), leak tags, linked
 * primer, plus Regenerate / Edit actions.
 *
 * Props:
 *   review          - the Review record (with optional `primer` relation)
 *   onUpdated(rev)  - optional callback fired with the updated review
 *   onEdit(rev)     - optional callback to open an editor for this review
 *   onOpenPrimer(p) - optional callback to open the linked primer
 */
const LEAK_INKS = ['--amethyst', '--sapphire', '--amber'];

function resultBadge(result) {
  if (!result) return null;
  const win = result === 'W';
  const v = win ? '--emerald' : '--ruby';
  return (
    <span
      className="rounded px-1.5 py-0.5 text-xs font-semibold"
      style={{ color: `var(${v})`, background: `color-mix(in srgb, var(${v}) 16%, transparent)` }}
    >
      {win ? 'Win' : 'Loss'}
    </span>
  );
}

const ReviewCard = ({ review, onUpdated, onDeleted, onEdit, onOpenPrimer }) => {
  const { user } = useAuth();
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editRecap, setEditRecap] = useState('');
  const [editTags, setEditTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!review) return null;

  const lines = Array.isArray(review.lines) ? review.lines : [];
  const leakTags = Array.isArray(review.leakTags) ? review.leakTags : [];
  const primer = review.primer;

  const regenerate = async () => {
    setError('');
    try {
      setRegenerating(true);
      const res = await fetch(`/api/reviews/${review.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Regenerate failed (${res.status})`);
      }
      const updated = await res.json();
      onUpdated?.(updated);
    } catch (e) {
      setError(e.message || 'Regenerate failed.');
    } finally {
      setRegenerating(false);
    }
  };

  const startEdit = () => {
    setEditRecap(review.recap || '');
    setEditTags((Array.isArray(review.leakTags) ? review.leakTags : []).join(', '));
    setEditing(true);
    setError('');
  };

  const saveEdit = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/reviews/${review.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recap: editRecap,
          leakTags: editTags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Save failed');
      }
      const updated = await res.json();
      onUpdated?.(updated);
      setEditing(false);
    } catch (e) {
      setError(e.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const deleteReview = async () => {
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/reviews/${review.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Delete failed');
      }
      onDeleted?.(review.id);
    } catch (e) {
      setError(e.message || 'Delete failed.');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="truncate font-display text-base" style={{ fontWeight: 560, color: 'var(--text)' }}>
              {review.deckArchetype || 'Your deck'}{' '}
              <span style={{ color: 'var(--faint)' }}>vs</span>{' '}
              {review.vsArchetype || 'Opponent'}
            </h4>
            {resultBadge(review.result)}
          </div>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--faint)' }}>
            {review.player ? `${review.player} • ` : ''}
            {review.gameNumber ? `Game ${review.gameNumber} • ` : ''}
            {review.generatedBy ? `via ${review.generatedBy}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <>
              <button
                onClick={regenerate}
                disabled={regenerating}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:brightness-110 disabled:opacity-50"
                style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--muted)' }}
              >
                {regenerating ? 'Regenerating…' : 'Regenerate'}
              </button>
              <button
                onClick={startEdit}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium hover:brightness-110"
                style={{ background: 'var(--sapphire)', color: '#0b1620' }}
              >
                Edit
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:brightness-110"
                style={{ borderColor: 'color-mix(in srgb, var(--ruby) 40%, transparent)', background: 'color-mix(in srgb, var(--ruby) 10%, transparent)', color: 'var(--ruby)' }}
              >
                Delete
              </button>
            </>
          )}
          {editing && (
            <>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium hover:brightness-110 disabled:opacity-50"
                style={{ background: 'var(--emerald)', color: '#0b1620' }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:brightness-110"
                style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--muted)' }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'color-mix(in srgb, var(--ruby) 30%, transparent)', background: 'color-mix(in srgb, var(--ruby) 10%, transparent)', color: 'var(--ruby)' }}>
          {error}
        </div>
      )}

      {/* Recap */}
      {editing ? (
        <div className="mb-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--faint)' }}>Recap</p>
          <textarea
            value={editRecap}
            onChange={e => setEditRecap(e.target.value)}
            rows={5}
            className="w-full rounded-lg border p-3 text-sm focus:outline-none resize-y"
            style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--text)' }}
          />
        </div>
      ) : review.recap ? (
        <div className="mb-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--faint)' }}>
            Recap
          </p>
          <p className="whitespace-pre-line text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
            {review.recap}
          </p>
        </div>
      ) : null}

      {/* Decision points */}
      {lines.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--faint)' }}>
            Decision points
          </p>
          <ul className="space-y-2">
            {lines.map((line, i) => (
              <li
                key={i}
                className="rounded-lg border p-3"
                style={{ borderColor: 'var(--line)', background: 'var(--panel-2)' }}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded px-1.5 py-0.5 text-xs font-semibold" style={{ color: 'var(--sapphire)', border: '1px solid color-mix(in srgb, var(--sapphire) 40%, transparent)' }}>
                    Turn {line.turn ?? '?'}
                  </span>
                </div>
                {line.whatHappened && (
                  <p className="text-sm" style={{ color: 'var(--text)' }}>
                    <span style={{ color: 'var(--faint)' }}>What happened: </span>
                    {line.whatHappened}
                  </p>
                )}
                {line.betterLine && (
                  <p className="mt-1 text-sm" style={{ color: 'var(--sapphire)' }}>
                    <span style={{ color: 'var(--faint)' }}>Better line: </span>
                    {line.betterLine}
                  </p>
                )}
                {line.why && (
                  <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                    <span style={{ color: 'var(--faint)' }}>Why: </span>
                    {line.why}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Leak tags */}
      {editing ? (
        <div className="mb-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--faint)' }}>
            Leaks <span className="font-normal normal-case tracking-normal" style={{ color: 'var(--faint)' }}>(comma-separated)</span>
          </p>
          <input
            type="text"
            value={editTags}
            onChange={e => setEditTags(e.target.value)}
            placeholder="over-traded, target selection, …"
            className="w-full rounded-lg border p-2.5 text-sm focus:outline-none"
            style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--text)' }}
          />
        </div>
      ) : leakTags.length > 0 ? (
        <div className="mb-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--faint)' }}>
            Leaks
          </p>
          <div className="flex flex-wrap gap-2">
            {leakTags.map((tag, i) => {
              const v = LEAK_INKS[i % LEAK_INKS.length];
              return (
                <span
                  key={`${tag}-${i}`}
                  className="rounded-full border px-2.5 py-0.5 text-xs font-medium"
                  style={{ color: `var(${v})`, borderColor: `color-mix(in srgb, var(${v}) 40%, transparent)`, background: `color-mix(in srgb, var(${v}) 12%, transparent)` }}
                >
                  {tag}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="mb-4 rounded-lg border p-4" style={{ borderColor: 'color-mix(in srgb, var(--ruby) 30%, transparent)', background: 'color-mix(in srgb, var(--ruby) 8%, transparent)' }}>
          <p className="mb-3 text-sm" style={{ color: 'var(--ruby)' }}>Delete this review? This cannot be undone.</p>
          <div className="flex gap-2">
            <button
              onClick={deleteReview}
              disabled={deleting}
              className="rounded-lg px-3 py-1.5 text-sm font-medium hover:brightness-110 disabled:opacity-50"
              style={{ background: 'var(--ruby)', color: '#0b1620' }}
            >
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="rounded-lg border px-3 py-1.5 text-sm hover:brightness-110"
              style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--muted)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Linked primer */}
      {primer && (
        <button
          onClick={() => onOpenPrimer?.(primer)}
          className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors"
          style={{ borderColor: 'color-mix(in srgb, var(--sapphire) 25%, transparent)', background: 'color-mix(in srgb, var(--sapphire) 6%, transparent)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'color-mix(in srgb, var(--sapphire) 12%, transparent)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'color-mix(in srgb, var(--sapphire) 6%, transparent)')}
        >
          <span className="text-sm" style={{ color: 'var(--sapphire)' }}>
            Primer:{' '}
            <span className="font-medium">
              {primer.deckArchetype} vs {primer.vsArchetype}
            </span>
            {primer.verdict ? (
              <span className="ml-2 text-xs" style={{ color: 'var(--faint)' }}>({primer.verdict})</span>
            ) : null}
          </span>
          <svg className="h-4 w-4" style={{ color: 'var(--sapphire)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default ReviewCard;
