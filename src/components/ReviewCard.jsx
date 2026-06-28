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
const LEAK_COLORS = [
  'bg-violet-500/15 text-violet-300 border-violet-500/30',
  'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
];

function resultBadge(result) {
  if (!result) return null;
  const win = result === 'W';
  return (
    <span
      className={[
        'rounded px-1.5 py-0.5 text-xs font-semibold',
        win ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300',
      ].join(' ')}
    >
      {win ? 'Win' : 'Loss'}
    </span>
  );
}

const ReviewCard = ({ review, onUpdated, onEdit, onOpenPrimer }) => {
  const { user } = useAuth();
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <div className="rounded-xl border border-white/10 bg-[#11151f] p-5">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-base font-semibold text-white">
              {review.deckArchetype || 'Your deck'}{' '}
              <span className="text-gray-500">vs</span>{' '}
              {review.vsArchetype || 'Opponent'}
            </h4>
            {resultBadge(review.result)}
          </div>
          <p className="mt-0.5 text-xs text-gray-400">
            {review.player ? `${review.player} • ` : ''}
            {review.gameNumber ? `Game ${review.gameNumber} • ` : ''}
            {review.generatedBy ? `via ${review.generatedBy}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={regenerate}
            disabled={regenerating}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-gray-200 hover:bg-white/[0.06] disabled:opacity-50"
          >
            {regenerating ? 'Regenerating…' : 'Regenerate'}
          </button>
          <button
            onClick={() => onEdit?.(review)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-violet-500 to-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Edit
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Recap */}
      {review.recap && (
        <div className="mb-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Recap
          </p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-200">
            {review.recap}
          </p>
        </div>
      )}

      {/* Decision points */}
      {lines.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Decision points
          </p>
          <ul className="space-y-2">
            {lines.map((line, i) => (
              <li
                key={i}
                className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-xs font-semibold text-violet-300">
                    Turn {line.turn ?? '?'}
                  </span>
                </div>
                {line.whatHappened && (
                  <p className="text-sm text-gray-200">
                    <span className="text-gray-500">What happened: </span>
                    {line.whatHappened}
                  </p>
                )}
                {line.betterLine && (
                  <p className="mt-1 text-sm text-violet-200">
                    <span className="text-gray-500">Better line: </span>
                    {line.betterLine}
                  </p>
                )}
                {line.why && (
                  <p className="mt-1 text-sm text-gray-400">
                    <span className="text-gray-500">Why: </span>
                    {line.why}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Leak tags */}
      {leakTags.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Leaks
          </p>
          <div className="flex flex-wrap gap-2">
            {leakTags.map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                className={[
                  'rounded-full border px-2.5 py-0.5 text-xs font-medium',
                  LEAK_COLORS[i % LEAK_COLORS.length],
                ].join(' ')}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Linked primer */}
      {primer && (
        <button
          onClick={() => onOpenPrimer?.(primer)}
          className="flex w-full items-center justify-between rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-3 py-2 text-left transition-colors hover:bg-violet-500/[0.12]"
        >
          <span className="text-sm text-violet-200">
            Primer:{' '}
            <span className="font-medium">
              {primer.deckArchetype} vs {primer.vsArchetype}
            </span>
            {primer.verdict ? (
              <span className="ml-2 text-xs text-gray-400">({primer.verdict})</span>
            ) : null}
          </span>
          <svg className="h-4 w-4 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default ReviewCard;
