// components/DeckStats.jsx
import React, { useMemo } from "react";
import { getInks } from "../lib/cardUtils";

/**
 * @typedef {Object} Entry
 * @property {{ id:string, name:string, subname?:string, type?:string|string[], cost?:number, inkable?:boolean, _raw?:any }} card
 * @property {number} count
 */

/** The six inks, in the comp's ledger order. Each maps to a --token color. */
const INK_ORDER = ["amber", "amethyst", "emerald", "ruby", "sapphire", "steel"];

/**
 * A card's primary ink as a known token key, or null when unclassified.
 * Mirrors App.jsx `cardInkVar` (uses the first ink), but returns the bare key.
 * @param {Entry} e
 * @returns {"amber"|"amethyst"|"emerald"|"ruby"|"sapphire"|"steel"|null}
 */
function primaryInk(e) {
  const inks = (getInks(e?.card) || []).map((s) => String(s).toLowerCase());
  return inks.find((k) => INK_ORDER.includes(k)) || null;
}

/**
 * Safe getter for inkable status, honoring multiple possible shapes.
 * @param {Entry} e
 * @returns {boolean}
 */
function getInkable(e) {
  const c = e?.card ?? {};
  if (typeof c.inkable === "boolean") return c.inkable;
  if (c._raw && typeof c._raw.inkwell === "boolean") return !!c._raw.inkwell;
  return false;
}

/**
 * Normalize type(s) -> a single top-level bucket for simple stats UI.
 * @param {Entry} e
 * @returns {"Character"|"Action"|"Item"|"Location"|"Song"|"Unknown"}
 */
function getTopType(e) {
  const c = e?.card ?? {};
  const t = c?.type;
  const pick = (Array.isArray(t) ? t[0] : t) || "";
  const s = String(pick).toLowerCase();

  if (s.includes("character")) return "Character";
  if (s.includes("action")) return "Action";
  if (s.includes("item")) return "Item";
  if (s.includes("location") || s.includes("realm")) return "Location";
  if (s.includes("song")) return "Song";
  return "Unknown";
}

/**
 * Key used for identifying "focused" cards
 * @param {Entry} e
 */
function getDisplayName(e) {
  const c = e?.card ?? {};
  // Prefer "Name — Subname" if present
  if (c?.subname) return `${c.name} — ${c.subname}`;
  return c?.name || "";
}

/**
 * Build cost curve: cost 0..9+ (9 == '9+')
 * @param {Entry[]} entries
 * @returns {number[]} length 10
 */
function buildCostCurve(entries) {
  const bins = Array(10).fill(0);
  for (const e of entries) {
    const cost = Number.isFinite(e?.card?.cost) ? e.card.cost : 0;
    const idx = Math.max(0, Math.min(9, cost));
    bins[idx] += e.count || 0;
  }
  return bins;
}

/**
 * Same binning as buildCostCurve, but split by primary ink so each bar can be
 * stacked in ink-token colors (the comp's ".curve .seg" idea). Unclassified
 * cards go to a neutral segment so each bar's total still equals buildCostCurve.
 * @param {Entry[]} entries
 * @returns {Array<Array<{ink:string,count:number}>>} length 10; segments per bin
 */
function buildCostCurveByInk(entries) {
  const bins = Array.from({ length: 10 }, () => new Map());
  for (const e of entries) {
    const cost = Number.isFinite(e?.card?.cost) ? e.card.cost : 0;
    const idx = Math.max(0, Math.min(9, cost));
    const key = primaryInk(e) || "_neutral";
    const m = bins[idx];
    m.set(key, (m.get(key) || 0) + (e.count || 0));
  }
  const ordered = [...INK_ORDER, "_neutral"];
  return bins.map((m) =>
    ordered.filter((k) => m.has(k)).map((k) => ({ ink: k, count: m.get(k) }))
  );
}

/**
 * Count simple types
 * @param {Entry[]} entries
 * @returns {Record<string, number>}
 */
function buildTypeCounts(entries) {
  const map = new Map();
  for (const e of entries) {
    const t = getTopType(e);
    map.set(t, (map.get(t) || 0) + (e.count || 0));
  }
  return Object.fromEntries(map);
}

/**
 * Ink split: total copies per known ink (by each card's primary ink).
 * @param {Entry[]} entries
 * @returns {{ segments: Array<{ink:string,count:number}>, classified:number }}
 */
function buildInkSplit(entries) {
  const map = new Map();
  let classified = 0;
  for (const e of entries) {
    const key = primaryInk(e);
    if (!key) continue;
    const cnt = e.count || 0;
    map.set(key, (map.get(key) || 0) + cnt);
    classified += cnt;
  }
  const segments = INK_ORDER.filter((k) => map.has(k)).map((k) => ({ ink: k, count: map.get(k) }));
  return { segments, classified };
}

/**
 * Average cost weighted by counts
 * @param {Entry[]} entries
 */
function averageCost(entries) {
  let tot = 0, sum = 0;
  for (const e of entries) {
    if (Number.isFinite(e?.card?.cost)) {
      tot += e.card.cost * (e.count || 0);
      sum += (e.count || 0);
    }
  }
  return sum ? (tot / sum) : 0;
}

/**
 * The Deck Statistics panel.
 * NOTE: focusCardName is ONLY read via props. No globals.
 * @param {{ entries: Entry[], focusCardName?: string }} props
 */
export default function DeckStats({ entries = [], focusCardName = "" }) {
  // Normalize once so helpers never touch globals
  const _focus = String(focusCardName || "").trim();

  const totals = useMemo(() => {
    let total = 0, inkable = 0, uninkable = 0;
    for (const e of entries) {
      const cnt = e?.count || 0;
      total += cnt;
      if (getInkable(e)) inkable += cnt; else uninkable += cnt;
    }
    return { total, inkable, uninkable };
  }, [entries]);

  const curve = useMemo(() => buildCostCurve(entries), [entries]);
  const curveByInk = useMemo(() => buildCostCurveByInk(entries), [entries]);
  const typeCounts = useMemo(() => buildTypeCounts(entries), [entries]);
  const inkSplit = useMemo(() => buildInkSplit(entries), [entries]);
  const avgCost = useMemo(() => averageCost(entries), [entries]);

  const curveMax = Math.max(...curve, 1);

  // Spotlight the focused card (by name or name — subname)
  const focused = useMemo(() => {
    if (!_focus) return null;
    const target = _focus.toLowerCase();
    for (const e of entries) {
      const name = getDisplayName(e).toLowerCase();
      if (name === target) return e;
    }
    // Soft match (startsWith) as a convenience
    for (const e of entries) {
      const name = getDisplayName(e).toLowerCase();
      if (name.startsWith(target)) return e;
    }
    return null;
  }, [entries, _focus]);

  return (
    <div className="space-y-3.5">
      {/* Top-line stats */}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <StatBox label="Total Cards" value={totals.total} />
        <StatBox label="Inkable" value={`${totals.inkable} (${pct(totals.inkable, totals.total)})`} />
        <StatBox label="Uninkable" value={`${totals.uninkable} (${pct(totals.uninkable, totals.total)})`} />
        <StatBox label="Avg Cost" value={avgCost.toFixed(2)} />
      </div>

      {/* Cost curve */}
      <Panel title="Curve">
        <div className="flex gap-1.5 items-end" style={{ height: 92 }}>
          {curve.map((v, i) => (
            <CurveColumn
              key={i}
              label={i === 9 ? "9+" : i}
              value={v}
              max={curveMax}
              segments={curveByInk[i]}
            />
          ))}
        </div>
      </Panel>

      {/* Ink split */}
      {inkSplit.classified > 0 ? (
        <Panel title="Ink split">
          <div
            className="flex w-full rounded overflow-hidden"
            style={{ height: 10, border: "1px solid var(--line)" }}
            role="img"
            aria-label={inkSplit.segments.map((s) => `${cap(s.ink)} ${s.count}`).join(", ")}
          >
            {inkSplit.segments.map((s) => (
              <div
                key={s.ink}
                style={{ width: `${(s.count / inkSplit.classified) * 100}%`, background: `var(--${s.ink})` }}
                title={`${cap(s.ink)}: ${s.count}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
            {inkSplit.segments.map((s) => (
              <span key={s.ink} className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
                <span style={{ width: 9, height: 11, clipPath: "var(--hex)", background: `var(--${s.ink})` }} />
                {cap(s.ink)}
                <span className="tabular-nums" style={{ color: "var(--faint)" }}>{s.count}</span>
              </span>
            ))}
          </div>
        </Panel>
      ) : null}

      {/* Type counts */}
      <Panel title="Card types">
        <div className="flex flex-wrap gap-2">
          {Object.entries(typeCounts).map(([k, v]) => (
            <Pill key={k} label={k} value={v} />
          ))}
        </div>
      </Panel>

      {/* Focused card spotlight (if provided) */}
      {_focus ? (
        <Panel title="Focused card" accent={focused ? "var(--sapphire)" : "var(--amber)"}>
          {focused ? (
            <div>
              <div className="text-[11px] uppercase tracking-[0.1em] font-semibold" style={{ color: "var(--faint)" }}>
                Comparing by name
              </div>
              <div className="font-display text-lg mt-0.5" style={{ fontWeight: 560, color: "var(--text)" }}>
                {getDisplayName(focused)}{" "}
                <span className="tabular-nums" style={{ color: "var(--muted)" }}>×{focused.count || 0}</span>
              </div>
              <div className="text-sm mt-1" style={{ color: "var(--muted)" }}>
                Inkable:{" "}
                <span style={{ color: getInkable(focused) ? "var(--emerald)" : "var(--ruby)" }}>
                  {getInkable(focused) ? "Yes" : "No"}
                </span>{" "}
                · Cost:{" "}
                <span className="tabular-nums">
                  {Number.isFinite(focused?.card?.cost) ? focused.card.cost : "—"}
                </span>{" "}
                · Type: {getTopType(focused)}
              </div>
            </div>
          ) : (
            <div className="text-sm" style={{ color: "var(--amber)" }}>
              Couldn't find a card matching "{_focus}" in this deck.
            </div>
          )}
        </Panel>
      ) : null}
    </div>
  );
}

/** Presentational helpers */

// Quiet token panel matching the comp's ".rpanel" (border --line, bg --panel).
function Panel({ title, accent, children }) {
  return (
    <div
      className="rounded-[10px] border p-4"
      style={{
        borderColor: accent ? `color-mix(in srgb, ${accent} 30%, var(--line))` : "var(--line)",
        background: "var(--panel)",
      }}
    >
      <h3 className="font-display text-sm mb-3" style={{ fontWeight: 560, color: "var(--text)" }}>{title}</h3>
      {children}
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-[10px] border px-3 py-2" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
      <div className="text-[11px] uppercase tracking-[0.1em] font-semibold mb-0.5" style={{ color: "var(--faint)" }}>{label}</div>
      <div className="font-display text-base tabular-nums" style={{ fontWeight: 560, color: "var(--text)" }}>{value}</div>
    </div>
  );
}

function Pill({ label, value }) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 border"
      style={{ borderColor: "var(--line-2)", background: "var(--panel-2)" }}
    >
      <span className="text-sm" style={{ color: "var(--muted)" }}>{label}</span>
      <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text)" }}>{value}</span>
    </div>
  );
}

// One cost-curve column: ink-token segments stacked to buildCostCurve's total,
// with the axis label and copy count preserved beneath.
function CurveColumn({ label, value, max, segments }) {
  return (
    <div className="flex-1 flex flex-col items-center" style={{ height: "100%" }}>
      <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: "100%" }} role="img" aria-label={`${label}: ${value}`}>
        {value > 0 ? (
          (segments || []).map((s) => (
            <div
              key={s.ink}
              className="w-full"
              style={{
                height: `${(s.count / max) * 100}%`,
                minHeight: 3,
                borderRadius: 2.5,
                background: s.ink === "_neutral" ? "var(--line-2)" : `var(--${s.ink})`,
              }}
            />
          ))
        ) : null}
      </div>
      <div className="text-[10.5px] tabular-nums mt-1.5" style={{ color: "var(--faint)" }}>{label}</div>
      <div className="text-[10.5px] tabular-nums" style={{ color: "var(--faint)" }}>{value}</div>
    </div>
  );
}

function pct(n, d) {
  if (!d) return "0%";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function cap(s) {
  return String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
}

export { averageCost, buildCostCurve, buildInkSplit };
