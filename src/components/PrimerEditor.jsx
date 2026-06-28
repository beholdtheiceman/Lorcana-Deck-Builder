import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { load as loadOracle, getByName } from "../utils/cardOracle";

/**
 * PrimerEditor
 * Themed modal form for creating / editing a hub Strategy Primer.
 *
 * Props:
 *   primer  - existing primer (with id) OR a seed/partial (deckArchetype,
 *             vsArchetype, gameplan...) for a new one. May be null.
 *   hubId   - hub the primer is scoped to (required)
 *   onSaved(primer) - called with the saved primer after POST/PATCH
 *   onClose()       - dismiss the modal
 */

const VERDICTS = ["Favored", "Even", "Behind"];
const CONFIDENCES = ["Draft", "Tentative", "Solid"];
const STALE_DAYS = 45;

const VERDICT_STYLE = {
  Favored: "from-emerald-500 to-green-600",
  Even: "from-slate-500 to-slate-600",
  Behind: "from-rose-500 to-red-600",
};

function daysSince(date) {
  if (!date) return null;
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          {label}
        </span>
        {hint ? <span className="text-[11px] text-gray-500">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-violet-400/60 focus:ring-1 focus:ring-violet-400/40";

function Segmented({ options, value, onChange, styleMap }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt;
        const grad = styleMap?.[opt] || "from-violet-500 to-indigo-500";
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(active ? "" : opt)}
            className={[
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? `bg-gradient-to-b ${grad} text-white shadow`
                : "border border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/20",
            ].join(" ")}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

const PrimerEditor = ({ primer, hubId, onSaved, onClose }) => {
  const { user } = useAuth();
  const isEdit = Boolean(primer?.id);

  const [deckArchetype, setDeckArchetype] = useState(primer?.deckArchetype || "");
  const [vsArchetype, setVsArchetype] = useState(primer?.vsArchetype || "");
  const [verdict, setVerdict] = useState(primer?.verdict || "");
  const [confidence, setConfidence] = useState(primer?.confidence || "Draft");
  const [gameplan, setGameplan] = useState(primer?.gameplan || "");
  const [mustKill, setMustKill] = useState(primer?.mustKill || "");
  const [mistakes, setMistakes] = useState(primer?.mistakes || "");
  const [keyCards, setKeyCards] = useState(
    Array.isArray(primer?.keyCards) ? primer.keyCards : []
  );

  const [cardQuery, setCardQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [oracleReady, setOracleReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const oracleMapRef = useRef(null);

  const ownerLabel = primer?.owner?.email || user?.email || "you";
  const reviewedDays = daysSince(primer?.lastReviewedAt);
  const isStale = reviewedDays != null && reviewedDays > STALE_DAYS;

  // Warm the oracle so card-name search works.
  useEffect(() => {
    let alive = true;
    loadOracle()
      .then((map) => {
        if (!alive) return;
        oracleMapRef.current = map;
        setOracleReady(true);
      })
      .catch(() => {
        if (alive) setOracleReady(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Name search over the loaded oracle map (id -> card).
  useEffect(() => {
    const q = cardQuery.trim().toLowerCase();
    if (!q || !oracleMapRef.current) {
      setSuggestions([]);
      return;
    }
    const map = oracleMapRef.current;
    const out = [];
    for (const id of Object.keys(map)) {
      const name = String(map[id]?.name || "");
      if (name.toLowerCase().includes(q)) {
        out.push({ id, name, cost: map[id]?.cost ?? null, color: map[id]?.color ?? null });
        if (out.length >= 40) break;
      }
    }
    out.sort((a, b) => {
      const ap = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bp = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return ap - bp || a.name.localeCompare(b.name);
    });
    setSuggestions(out.slice(0, 8));
  }, [cardQuery]);

  const existingNames = useMemo(
    () => new Set(keyCards.map((c) => String(c.name).toLowerCase())),
    [keyCards]
  );

  const addCard = (card) => {
    if (!card?.name) return;
    if (existingNames.has(String(card.name).toLowerCase())) return;
    setKeyCards((prev) => [...prev, { id: card.id ?? null, name: card.name, note: "" }]);
    setCardQuery("");
    setSuggestions([]);
  };

  // Add a free-typed name, resolving against the oracle when possible.
  const addTypedCard = async () => {
    const q = cardQuery.trim();
    if (!q) return;
    let resolved = null;
    try {
      resolved = await getByName(q);
    } catch {
      resolved = null;
    }
    addCard(resolved ? { id: resolved.id, name: resolved.name } : { id: null, name: q });
  };

  const removeCard = (idx) => setKeyCards((prev) => prev.filter((_, i) => i !== idx));
  const setCardNote = (idx, note) =>
    setKeyCards((prev) => prev.map((c, i) => (i === idx ? { ...c, note } : c)));

  const handleSave = async () => {
    setError("");
    if (!deckArchetype.trim() || !vsArchetype.trim()) {
      setError("Both archetypes are required.");
      return;
    }
    const payload = {
      deckArchetype: deckArchetype.trim(),
      vsArchetype: vsArchetype.trim(),
      verdict: verdict || null,
      confidence,
      gameplan,
      mustKill,
      mistakes,
      keyCards,
    };
    setSaving(true);
    try {
      const res = isEdit
        ? await fetch(`/api/primers/${primer.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/primers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hubId, ...payload }),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Save failed (${res.status})`);
      }
      const saved = await res.json();
      onSaved?.(saved);
    } catch (e) {
      setError(e.message || "Could not save primer.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-white/10 bg-[#11151f] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-white">
              {isEdit ? "Edit primer" : "New primer"}
            </h2>
            <p className="mt-0.5 truncate text-sm text-gray-400">
              {deckArchetype || "Your deck"} <span className="text-violet-300">vs</span>{" "}
              {vsArchetype || "Opponent"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isStale ? (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                Stale · {reviewedDays}d
              </span>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Your archetype">
              <input
                className={inputCls}
                value={deckArchetype}
                onChange={(e) => setDeckArchetype(e.target.value)}
                placeholder="Blurple Control"
              />
            </Field>
            <Field label="Opponent archetype">
              <input
                className={inputCls}
                value={vsArchetype}
                onChange={(e) => setVsArchetype(e.target.value)}
                placeholder="Go-Wide Dogs"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Verdict">
              <Segmented
                options={VERDICTS}
                value={verdict}
                onChange={setVerdict}
                styleMap={VERDICT_STYLE}
              />
            </Field>
            <Field label="Confidence">
              <Segmented
                options={CONFIDENCES}
                value={confidence}
                onChange={(v) => setConfidence(v || "Draft")}
              />
            </Field>
          </div>

          <Field label="Gameplan">
            <textarea
              className={`${inputCls} min-h-[88px] resize-y`}
              value={gameplan}
              onChange={(e) => setGameplan(e.target.value)}
              placeholder="How you win the matchup…"
            />
          </Field>

          <Field label="Must kill" hint="Threats you cannot let stick">
            <textarea
              className={`${inputCls} min-h-[72px] resize-y`}
              value={mustKill}
              onChange={(e) => setMustKill(e.target.value)}
              placeholder="Priority removal targets…"
            />
          </Field>

          <Field label="Common mistakes">
            <textarea
              className={`${inputCls} min-h-[72px] resize-y`}
              value={mistakes}
              onChange={(e) => setMistakes(e.target.value)}
              placeholder="Misplays to avoid…"
            />
          </Field>

          {/* Key cards (oracle-linked) */}
          <Field label="Key cards" hint={oracleReady ? "Oracle-linked" : "Oracle loading…"}>
            <div className="relative">
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={cardQuery}
                  onChange={(e) => setCardQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (suggestions[0]) addCard(suggestions[0]);
                      else addTypedCard();
                    }
                  }}
                  placeholder="Add a card by name…"
                />
                <button
                  type="button"
                  onClick={addTypedCard}
                  className="shrink-0 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-gray-200 hover:border-white/20"
                >
                  Add
                </button>
              </div>

              {suggestions.length > 0 ? (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-[#161b27] shadow-xl">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => addCard(s)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-200 hover:bg-violet-500/15"
                    >
                      <span className="truncate">{s.name}</span>
                      <span className="shrink-0 text-xs text-gray-500">
                        {s.color || ""}
                        {s.cost != null ? ` · ${s.cost}⬢` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {keyCards.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {keyCards.map((c, idx) => (
                  <li
                    key={`${c.id ?? c.name}-${idx}`}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-violet-200">{c.name}</span>
                      <button
                        type="button"
                        onClick={() => removeCard(idx)}
                        className="shrink-0 text-xs text-gray-500 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      className="mt-1.5 w-full rounded-md border border-white/5 bg-transparent px-2 py-1 text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-violet-400/40"
                      value={c.note || ""}
                      onChange={(e) => setCardNote(idx, e.target.value)}
                      placeholder="note (e.g. lore scaling, recursion)…"
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </Field>

          {/* Meta: owner + last reviewed / stale */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 text-xs text-gray-500">
            <span>
              Owner: <span className="text-gray-300">{ownerLabel}</span>
            </span>
            <span className="flex items-center gap-2">
              {primer?.lastReviewedAt ? (
                <>
                  Last reviewed{" "}
                  <span className="text-gray-300">
                    {new Date(primer.lastReviewedAt).toLocaleDateString()}
                  </span>
                  {isStale ? (
                    <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-300">
                      Stale
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-gray-500">New — not yet reviewed</span>
              )}
            </span>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-gray-200 hover:border-white/20"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-violet-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create primer"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrimerEditor;
