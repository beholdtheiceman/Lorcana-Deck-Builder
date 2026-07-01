import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReviewCard from './ReviewCard';
import Skeleton from './ui/Skeleton';

/**
 * ReviewArchive
 * Fetches /api/reviews?hubId=, exposes filter controls (deck / matchup /
 * player / result), and renders a ReviewCard list.
 *
 * Props:
 *   hubId           - Hub scope (required)
 *   refreshKey      - bump to force a re-fetch (e.g. after a new review)
 *   onEditReview(r) - forwarded to each card's Edit button
 *   onOpenPrimer(p) - forwarded to each card's linked primer
 */
const ALL = '__all__';

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

const Select = ({ label, value, onChange, options }) => (
  <label className="flex flex-col gap-1 text-xs text-gray-400">
    <span className="uppercase tracking-wide">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-sm text-gray-100 focus:border-violet-400 focus:outline-none"
    >
      <option value={ALL}>All</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  </label>
);

const ReviewArchive = ({ hubId, refreshKey, onEditReview, onOpenPrimer }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [deck, setDeck] = useState(ALL);
  const [matchup, setMatchup] = useState(ALL);
  const [player, setPlayer] = useState(ALL);
  const [result, setResult] = useState(ALL);

  const fetchReviews = useCallback(async () => {
    if (!hubId) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews?hubId=${encodeURIComponent(hubId)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to load reviews (${res.status})`);
      }
      const data = await res.json();
      setReviews(Array.isArray(data) ? data : data.reviews || []);
    } catch (e) {
      setError(e.message || 'Failed to load reviews.');
    } finally {
      setLoading(false);
    }
  }, [hubId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews, refreshKey]);

  const deckOptions = useMemo(
    () => uniqueSorted(reviews.map((r) => r.deckArchetype)),
    [reviews]
  );
  const matchupOptions = useMemo(
    () => uniqueSorted(reviews.map((r) => r.vsArchetype)),
    [reviews]
  );
  const playerOptions = useMemo(
    () => uniqueSorted(reviews.map((r) => r.player)),
    [reviews]
  );

  const filtered = useMemo(
    () =>
      reviews.filter((r) => {
        if (deck !== ALL && r.deckArchetype !== deck) return false;
        if (matchup !== ALL && r.vsArchetype !== matchup) return false;
        if (player !== ALL && r.player !== player) return false;
        if (result !== ALL && r.result !== result) return false;
        return true;
      }),
    [reviews, deck, matchup, player, result]
  );

  const handleUpdated = (updated) => {
    setReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  const handleDeleted = (id) => {
    setReviews((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <Select label="Deck" value={deck} onChange={setDeck} options={deckOptions} />
        <Select label="Matchup" value={matchup} onChange={setMatchup} options={matchupOptions} />
        <Select label="Player" value={player} onChange={setPlayer} options={playerOptions} />
        <Select label="Result" value={result} onChange={setResult} options={['W', 'L']} />
        <button
          onClick={() => {
            setDeck(ALL);
            setMatchup(ALL);
            setPlayer(ALL);
            setResult(ALL);
          }}
          className="ml-auto rounded-lg border border-white/10 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/[0.06]"
        >
          Clear
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton variant="block" className="h-28" />
          <Skeleton variant="block" className="h-28" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-gray-400">
          {reviews.length === 0
            ? 'No reviews yet. Upload a replay and generate one.'
            : 'No reviews match these filters.'}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
              onEdit={onEditReview}
              onOpenPrimer={onOpenPrimer}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ReviewArchive;
