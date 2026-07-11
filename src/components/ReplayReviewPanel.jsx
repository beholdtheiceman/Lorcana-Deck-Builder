import React, { useState, useEffect, useCallback } from 'react';
import ReplayUpload from './ReplayUpload';
import ReviewArchive from './ReviewArchive';
import PrimerEditor from './PrimerEditor';

/**
 * ReplayReviewPanel
 * The single component the Hub view mounts. Composes:
 *   - ReplayUpload (drop a replay, generate reviews)
 *   - ReviewArchive (filterable list of ReviewCards)
 *   - Primers section (lists /api/primers?hubId= and opens PrimerEditor)
 *
 * Props: { hubId }
 */
const TABS = [
  { id: 'upload', label: 'Upload' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'primers', label: 'Primers' },
];

function verdictColor(verdict) {
  if (verdict === 'Favored') return 'var(--emerald)';
  if (verdict === 'Behind') return 'var(--ruby)';
  return 'var(--muted)';
}

const ReplayReviewPanel = ({ hubId }) => {
  const [tab, setTab] = useState('upload');
  const [reviewRefresh, setReviewRefresh] = useState(0);

  const [primers, setPrimers] = useState([]);
  const [primersLoading, setPrimersLoading] = useState(true);
  const [primersError, setPrimersError] = useState('');
  const [editingPrimer, setEditingPrimer] = useState(null); // primer object or {} for new

  const bumpReviews = () => setReviewRefresh((n) => n + 1);

  const fetchPrimers = useCallback(async () => {
    if (!hubId) return;
    setPrimersError('');
    setPrimersLoading(true);
    try {
      const res = await fetch(`/api/primers?hubId=${encodeURIComponent(hubId)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to load primers (${res.status})`);
      }
      const data = await res.json();
      setPrimers(Array.isArray(data) ? data : data.primers || []);
    } catch (e) {
      setPrimersError(e.message || 'Failed to load primers.');
    } finally {
      setPrimersLoading(false);
    }
  }, [hubId]);

  useEffect(() => {
    fetchPrimers();
  }, [fetchPrimers]);

  const handlePrimerSaved = (saved) => {
    setPrimers((prev) => {
      const exists = prev.some((p) => p.id === saved.id);
      return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev];
    });
    setEditingPrimer(null);
  };

  const openPrimer = (primer) => {
    setTab('primers');
    setEditingPrimer(primer);
  };

  return (
    <div style={{ color: 'var(--text)' }}>
      {/* Sub-tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border p-1" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              style={active
                ? { background: 'var(--sapphire)', color: '#0b1620' }
                : { color: 'var(--muted)' }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'upload' && (
        <ReplayUpload
          hubId={hubId}
          primers={primers}
          onReviewCreated={bumpReviews}
        />
      )}

      {tab === 'reviews' && (
        <ReviewArchive
          hubId={hubId}
          refreshKey={reviewRefresh}
          onOpenPrimer={openPrimer}
          onEditReview={() => {}}
        />
      )}

      {tab === 'primers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--muted)' }}>
              Strategy primers
            </h3>
            <button
              onClick={() => setEditingPrimer({})}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold transition hover:brightness-110"
              style={{ background: 'var(--sapphire)', color: '#0b1620' }}
            >
              New primer
            </button>
          </div>

          {primersLoading ? (
            <div className="rounded-lg border px-4 py-8 text-center text-sm" style={{ borderColor: 'var(--line)', background: 'var(--panel)', color: 'var(--muted)' }}>
              Loading primers…
            </div>
          ) : primersError ? (
            <div className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: 'color-mix(in srgb, var(--ruby) 30%, transparent)', background: 'color-mix(in srgb, var(--ruby) 10%, transparent)', color: 'var(--ruby)' }}>
              {primersError}
            </div>
          ) : primers.length === 0 ? (
            <div className="rounded-lg border px-4 py-8 text-center text-sm" style={{ borderColor: 'var(--line)', background: 'var(--panel)', color: 'var(--faint)' }}>
              No primers yet. Create one to capture a matchup gameplan.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {primers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setEditingPrimer(p)}
                  className="rounded-xl border p-4 text-left transition-colors"
                  style={{ borderColor: 'var(--line)', background: 'var(--panel-2)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--sapphire) 40%, var(--line))')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display" style={{ fontWeight: 560, color: 'var(--text)' }}>
                      {p.deckArchetype} <span style={{ color: 'var(--faint)' }}>vs</span> {p.vsArchetype}
                    </span>
                    <span className="rounded px-1.5 py-0.5 text-xs" style={{ border: '1px solid var(--line-2)', color: 'var(--faint)' }}>
                      {p.confidence}
                    </span>
                  </div>
                  {p.verdict && (
                    <p className="mt-1 text-sm font-medium" style={{ color: verdictColor(p.verdict) }}>
                      {p.verdict}
                    </p>
                  )}
                  {p.gameplan && (
                    <p className="mt-2 line-clamp-2 text-sm" style={{ color: 'var(--muted)' }}>{p.gameplan}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {editingPrimer && (
        <PrimerEditor
          hubId={hubId}
          primer={editingPrimer.id ? editingPrimer : editingPrimer}
          onClose={() => setEditingPrimer(null)}
          onSaved={handlePrimerSaved}
        />
      )}
    </div>
  );
};

export default ReplayReviewPanel;
