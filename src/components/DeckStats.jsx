// components/DeckStats.jsx
import React, { useMemo } from "react";

/**
 * @typedef {Object} Entry
 * @property {{ id:string, name:string, subname?:string, type?:string|string[], cost?:number, inkable?:boolean, _raw?:any }} card
 * @property {number} count
 */

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
  const typeCounts = useMemo(() => buildTypeCounts(entries), [entries]);
  const avgCost = useMemo(() => averageCost(entries), [entries]);

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
    <div className="space-y-4">
      {/* Top-line stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="Total Cards" value={totals.total} />
        <StatBox label="Inkable" value={`${totals.inkable} (${pct(totals.inkable, totals.total)})`} />
        <StatBox label="Uninkable" value={`${totals.uninkable} (${pct(totals.uninkable, totals.total)})`} />
        <StatBox label="Avg Cost" value={avgCost.toFixed(2)} />
      </div>

      {/* Cost curve */}
      <Section title="Cost Curve">
        <div className="grid grid-cols-10 gap-1 items-end">
          {curve.map((v, i) => (
            <Bar key={i} label={i === 9 ? "9+" : i} value={v} max={Math.max(...curve, 1)} />
          ))}
        </div>
      </Section>

      {/* Type counts */}
      <Section title="Card Types">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {Object.entries(typeCounts).map(([k, v]) => (
            <Pill key={k} label={k} value={v} />
          ))}
        </div>
      </Section>

      {/* Focused card spotlight (if provided) */}
      {_focus ? (
        <Section title="Focused Card">
          {focused ? (
            <div className="rounded-lg border border-emerald-700 p-3 bg-gray-800">
              <div className="text-sm text-gray-300">Comparing by name:</div>
              <div className="text-lg font-semibold text-emerald-300">
                {getDisplayName(focused)} <span className="text-gray-400">×{focused.count || 0}</span>
              </div>
              <div className="text-gray-300 text-sm mt-1">
                Inkable: {getInkable(focused) ? "Yes" : "No"} · Cost: {Number.isFinite(focused?.card?.cost) ? focused.card.cost : "—"} · Type: {getTopType(focused)}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-700 p-3 bg-gray-800 text-amber-300">
              Couldn't find a card matching "{_focus}" in this deck.
            </div>
          )}
        </Section>
      ) : null}
    </div>
  );
}

/** Presentational helpers */

function Section({ title, children }) {
  return (
    <div>
      <h5 className="text-base font-semibold mb-2 text-emerald-300">{title}</h5>
      {children}
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-lg bg-gray-800 px-3 py-2 border border-gray-700">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-lg font-semibold text-gray-100">{value}</div>
    </div>
  );
}

function Pill({ label, value }) {
  return (
    <div className="inline-flex items-center justify-between rounded-full bg-gray-800 px-3 py-1 border border-gray-700">
      <span className="text-sm text-gray-200">{label}</span>
      <span className="ml-2 text-sm font-semibold text-gray-100">{value}</span>
    </div>
  );
}

function Bar({ label, value, max }) {
  const height = max > 0 ? Math.max(6, Math.round((value / max) * 80)) : 6;
  return (
    <div className="flex flex-col items-center">
      <div className="w-full bg-gray-800 border border-gray-700 rounded-t h-20 flex items-end">
        <div
          className="w-full rounded-t bg-emerald-600"
          style={{ height: `${height}%` }}
          aria-label={`${label}: ${value}`}
          role="img"
        />
      </div>
      <div className="text-xs text-gray-300 mt-1">{label}</div>
      <div className="text-xs text-gray-400">{value}</div>
    </div>
  );
}

function pct(n, d) {
  if (!d) return "0%";
  return `${((n / d) * 100).toFixed(1)}%`;
}