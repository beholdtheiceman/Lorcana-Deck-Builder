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

function verdictTone(verdict) {
  if (verdict === 'Favored') return 'text-emerald-300';
  if (verdict === 'Behind') return 'text-red-300';
  return 'text-gray-300';
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
    <div className="text-gray-100">
      {/* Sub-tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              tab === t.id
                ? 'bg-gradient-to-b from-violet-500 to-indigo-500 text-white'
                : 'text-gray-300 hover:bg-white/[0.06]',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'upload' && (
        <ReplayUpload
          hubId={hubId}
          onReviewCreated={() => {
            bumpReviews();
            setTab('reviews');
          }}
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
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
              Strategy primers
            </h3>
            <button
              onClick={() => setEditingPrimer({})}
              className="rounded-lg bg-gradient-to-b from-violet-500 to-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              New primer
            </button>
          </div>

          {primersLoading ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-gray-400">
              Loading primers…
            </div>
          ) : primersError ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {primersError}
            </div>
          ) : primers.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-gray-400">
              No primers yet. Create one to capture a matchup gameplan.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {primers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setEditingPrimer(p)}
                  className="rounded-xl border border-white/10 bg-[#11151f] p-4 text-left transition-colors hover:border-violet-500/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white">
                      {p.deckArchetype} <span className="text-gray-500">vs</span> {p.vsArchetype}
                    </span>
                    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-xs text-gray-300">
                      {p.confidence}
                    </span>
                  </div>
                  {p.verdict && (
                    <p className={`mt-1 text-sm font-medium ${verdictTone(p.verdict)}`}>
                      {p.verdict}
                    </p>
                  )}
                  {p.gameplan && (
                    <p className="mt-2 line-clamp-2 text-sm text-gray-400">{p.gameplan}</p>
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
