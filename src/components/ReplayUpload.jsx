import React, { useState, useRef, useCallback } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';

/**
 * ReplayUpload
 * Drag-and-drop a `.match-replay.zip`, POST it to /api/replays, then render the
 * parsed games with a lore-curve chart and a per-game "Generate review" button.
 *
 * Props:
 *   hubId   - the Hub the replay/reviews are scoped to (required)
 *   onReviewCreated(review) - optional callback fired after a review is generated
 *   onReplayUploaded(replay) - optional callback fired after a replay is parsed
 */
const ACCENT = '#8b5cf6'; // violet-500
const ACCENT_2 = '#6366f1'; // indigo-500

function normalizeGames(parsed) {
  if (!parsed) return [];
  // Tolerate a few shapes the parser might emit.
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.games)) return parsed.games;
  if (Array.isArray(parsed.matches)) return parsed.matches;
  return [];
}

function loreSeries(game) {
  // Accept loreCurve / lore / turns, each row may use you/opp, player/opponent, etc.
  const rows = game?.loreCurve || game?.lore || game?.turns || [];
  return rows.map((r, i) => ({
    turn: r.turn ?? r.t ?? i + 1,
    you: r.you ?? r.player ?? r.self ?? r.me ?? 0,
    opp: r.opp ?? r.opponent ?? r.them ?? 0,
  }));
}

const ReplayUpload = ({ hubId, onReviewCreated, onReplayUploaded }) => {
  const { user } = useAuth();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [replay, setReplay] = useState(null);
  const [generatingFor, setGeneratingFor] = useState(null); // gameNumber
  const inputRef = useRef(null);

  const games = normalizeGames(replay?.parsed);

  const upload = useCallback(
    async (file) => {
      setError('');
      if (!file) return;
      const name = (file.name || '').toLowerCase();
      if (!name.endsWith('.zip') && !name.endsWith('.match-replay.zip')) {
        setError('Please drop a .match-replay.zip file.');
        return;
      }
      try {
        setUploading(true);
        // The endpoint expects the raw .zip bytes as the body (bodyParser is
        // disabled) and the hubId in the query string — not multipart FormData.
        const res = await fetch(`/api/replays?hubId=${encodeURIComponent(hubId)}`, {
          method: 'POST',
          body: file,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Upload failed (${res.status})`);
        }
        const data = await res.json();
        setReplay(data);
        onReplayUploaded?.(data);
      } catch (e) {
        setError(e.message || 'Upload failed.');
      } finally {
        setUploading(false);
      }
    },
    [hubId, onReplayUploaded]
  );

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    upload(file);
  };

  const generateReview = async (game) => {
    setError('');
    const gameNumber = game.gameNumber ?? game.game ?? game.number ?? null;
    try {
      setGeneratingFor(gameNumber ?? game);
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hubId,
          replayId: replay?.id,
          gameNumber,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Could not generate review (${res.status})`);
      }
      const review = await res.json();
      onReviewCreated?.(review);
    } catch (e) {
      setError(e.message || 'Could not generate review.');
    } finally {
      setGeneratingFor(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={[
          'cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
          dragging
            ? 'border-violet-400 bg-violet-500/10'
            : 'border-white/10 bg-white/[0.03] hover:border-white/20',
        ].join(' ')}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip,.match-replay.zip,application/zip"
          className="hidden"
          onChange={(e) => upload(e.target.files?.[0])}
        />
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-violet-500 to-indigo-500">
          <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
        </div>
        {uploading ? (
          <p className="text-sm text-violet-300">Parsing replay…</p>
        ) : (
          <>
            <p className="text-sm font-medium text-white">
              Drag a <span className="text-violet-300">.match-replay.zip</span> here
            </p>
            <p className="mt-1 text-xs text-gray-400">or click to browse</p>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Parsed games */}
      {replay && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
              Parsed games
            </h3>
            <span className="text-xs text-gray-500">
              {replay.source ? `${replay.source} • ` : ''}
              {replay.matchScore || ''}
            </span>
          </div>

          {games.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-gray-400">
              No individual games were parsed from this replay.
            </div>
          ) : (
            games.map((game, idx) => {
              const gameNumber = game.gameNumber ?? game.game ?? game.number ?? idx + 1;
              const series = loreSeries(game);
              const key = gameNumber ?? idx;
              const busy = generatingFor === gameNumber || generatingFor === game;
              return (
                <div
                  key={key}
                  className="rounded-xl border border-white/10 bg-[#11151f] p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Game {gameNumber}
                        {game.result ? (
                          <span
                            className={[
                              'ml-2 rounded px-1.5 py-0.5 text-xs font-medium',
                              game.result === 'W'
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-red-500/15 text-red-300',
                            ].join(' ')}
                          >
                            {game.result}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-gray-400">
                        {(game.deckArchetype || game.deck || 'You')} vs{' '}
                        {game.vsArchetype || game.opponentDeck || 'Opponent'}
                      </p>
                    </div>
                    <button
                      onClick={() => generateReview({ ...game, gameNumber })}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-violet-500 to-indigo-500 px-3 py-1.5 text-sm font-medium text-white shadow hover:opacity-90 disabled:opacity-50"
                    >
                      {busy ? 'Generating…' : 'Generate review'}
                    </button>
                  </div>

                  {series.length > 0 ? (
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis
                            dataKey="turn"
                            stroke="rgba(255,255,255,0.4)"
                            tick={{ fontSize: 11 }}
                            label={{ value: 'Turn', position: 'insideBottom', offset: -2, fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                          />
                          <YAxis stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{
                              background: '#11151f',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: 8,
                              color: '#fff',
                              fontSize: 12,
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Line type="monotone" dataKey="you" name="You" stroke={ACCENT} strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="opp" name="Opponent" stroke={ACCENT_2} strokeWidth={2} strokeDasharray="4 3" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No lore curve data for this game.</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default ReplayUpload;
