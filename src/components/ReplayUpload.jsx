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
import { Button, EmptyState } from './ui';

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
const ACCENT = 'var(--sapphire)'; // "you" series
const ACCENT_2 = 'var(--amethyst)'; // "opponent" series

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
  // Guard against a truthy non-array (the parser may emit an object) so .map
  // never throws and takes the whole panel down.
  const raw = game?.loreCurve || game?.lore || game?.turns || [];
  const rows = Array.isArray(raw) ? raw : [];
  return rows.map((r, i) => ({
    turn: r.turn ?? r.t ?? i + 1,
    you: r.you ?? r.player ?? r.self ?? r.me ?? 0,
    opp: r.opp ?? r.opponent ?? r.them ?? 0,
  }));
}

const ReplayUpload = ({ hubId, primers = [], onReviewCreated, onReplayUploaded }) => {
  const { user } = useAuth();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [replay, setReplay] = useState(null);
  const [generatingFor, setGeneratingFor] = useState(null); // gameNumber
  const [doneFor, setDoneFor] = useState(new Set()); // gameNumbers with completed reviews
  const [selectedPrimerId, setSelectedPrimerId] = useState('');
  const inputRef = useRef(null);

  const games = normalizeGames(replay?.parsed);

  const upload = useCallback(
    async (file) => {
      setError('');
      if (!file) return;
      const name = (file.name || '').toLowerCase();
      const allowed = ['.zip', '.gz', '.json'];
      if (!allowed.some((ext) => name.endsWith(ext))) {
        setError('Please drop a .zip, .gz, or .json replay file.');
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
      const payload = { replayId: replay?.id, gameNumber };
      if (selectedPrimerId) payload.primerId = selectedPrimerId;
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Could not generate review (${res.status})`);
      }
      const review = await res.json();
      setDoneFor((prev) => new Set([...prev, gameNumber]));
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
        className="cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors"
        style={{
          borderColor: dragging ? 'var(--sapphire)' : 'var(--line-2)',
          background: dragging
            ? 'color-mix(in srgb, var(--sapphire) 10%, transparent)'
            : 'var(--panel-2)',
        }}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip,.gz,.json,application/zip,application/gzip,application/json"
          className="hidden"
          onChange={(e) => upload(e.target.files?.[0])}
        />
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'var(--sapphire)' }}>
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#0b1620' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
        </div>
        {uploading ? (
          <p className="text-sm" style={{ color: 'var(--sapphire)' }}>Parsing replay…</p>
        ) : (
          <>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              Drag a <span style={{ color: 'var(--sapphire)' }}>.zip · .gz · .json</span> replay here
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--faint)' }}>or click to browse</p>
          </>
        )}
      </div>

      {error && <p className="text-sm" style={{ color: 'var(--ruby)' }}>{error}</p>}

      {/* Optional primer selector — if skipped the agent auto-generates matchup context */}
      {primers.length > 0 && (
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--faint)' }}>
            Primer{' '}
            <span className="font-normal normal-case tracking-normal" style={{ color: 'var(--faint)' }}>
              — optional, auto-generated if skipped
            </span>
          </label>
          <select
            value={selectedPrimerId}
            onChange={(e) => setSelectedPrimerId(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
            style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--text)' }}
          >
            <option value="">— auto-generate from matchup —</option>
            {primers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.deckArchetype} vs {p.vsArchetype}
                {p.verdict ? ` (${p.verdict})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Parsed games */}
      {replay && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--faint)' }}>
              Parsed games
            </h3>
            <span className="text-xs" style={{ color: 'var(--faint)' }}>
              {replay.source ? `${replay.source} • ` : ''}
              {replay.matchScore || ''}
            </span>
          </div>

          {games.length === 0 ? (
            <EmptyState
              title="No games parsed"
              description="No individual games were parsed from this replay"
            />
          ) : (
            games.map((game, idx) => {
              const gameNumber = game.gameNumber ?? game.game ?? game.number ?? idx + 1;
              const series = loreSeries(game);
              const key = gameNumber ?? idx;
              const busy = generatingFor === gameNumber || generatingFor === game;
              const done = doneFor.has(gameNumber);
              return (
                <div
                  key={key}
                  className="rounded-xl border p-4"
                  style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        Game {gameNumber}
                        {game.result ? (
                          <span
                            className="ml-2 rounded px-1.5 py-0.5 text-xs font-medium"
                            style={{
                              color: game.result === 'W' ? 'var(--emerald)' : 'var(--ruby)',
                              background: game.result === 'W'
                                ? 'color-mix(in srgb, var(--emerald) 15%, transparent)'
                                : 'color-mix(in srgb, var(--ruby) 15%, transparent)',
                            }}
                          >
                            {game.result}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>
                        {(game.deckArchetype || game.deck || 'You')} vs{' '}
                        {game.vsArchetype || game.opponentDeck || 'Opponent'}
                      </p>
                    </div>
                    {done ? (
                      <span className="rounded-lg px-3 py-1.5 text-sm font-medium" style={{ color: 'var(--emerald)', background: 'color-mix(in srgb, var(--emerald) 15%, transparent)' }}>
                        Review created ✓
                      </span>
                    ) : (
                      <Button
                        variant="primary"
                        onClick={() => generateReview({ ...game, gameNumber })}
                        disabled={busy}
                      >
                        {busy ? 'Generating…' : 'Generate review'}
                      </Button>
                    )}
                  </div>

                  {series.length > 0 ? (
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                          <XAxis
                            dataKey="turn"
                            stroke="var(--faint)"
                            tick={{ fontSize: 11 }}
                            label={{ value: 'Turn', position: 'insideBottom', offset: -2, fill: 'var(--faint)', fontSize: 11 }}
                          />
                          <YAxis stroke="var(--faint)" tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{
                              background: 'var(--panel)',
                              border: '1px solid var(--line-2)',
                              borderRadius: 8,
                              color: 'var(--text)',
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
                    <p className="text-xs" style={{ color: 'var(--faint)' }}>No lore curve data for this game.</p>
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
