import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { useAuth } from "../contexts/AuthContext";

/**
 * InsightsWidget — "Recurring leaks" dashboard widget.
 *
 * Consumes GET /api/insights?hubId=&player= and renders a themed horizontal
 * bar chart of the most frequent leak tags across a hub's reviews, with an
 * optional per-matchup breakdown.
 *
 * Props:
 *   hubId  (string, required) — the hub to aggregate insights for
 *   player (string, optional) — filter aggregation to a single player
 */
const TOP_N = 8;

const BAR_COLORS = [
  "var(--sapphire)",
  "color-mix(in srgb, var(--sapphire) 88%, var(--panel))",
  "color-mix(in srgb, var(--sapphire) 76%, var(--panel))",
  "color-mix(in srgb, var(--sapphire) 66%, var(--panel))",
  "color-mix(in srgb, var(--sapphire) 58%, var(--panel))",
];

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const { tag, count } = payload[0].payload;
  return (
    <div
      className="rounded-md border px-3 py-2 text-xs shadow-lg"
      style={{ borderColor: "var(--line)", background: "var(--panel)" }}
    >
      <div className="font-medium" style={{ color: "var(--text)" }}>{tag}</div>
      <div style={{ color: "var(--sapphire)" }}>
        {count} {count === 1 ? "occurrence" : "occurrences"}
      </div>
    </div>
  );
}

export default function InsightsWidget({ hubId, player }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hubId) return;
    let cancelled = false;

    const fetchInsights = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ hubId });
        if (player) params.set("player", player);
        const res = await fetch(`/api/insights?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError("Failed to load insights.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchInsights();
    return () => {
      cancelled = true;
    };
  }, [hubId, player, user]);

  const topLeaks = useMemo(() => {
    const leaks = data?.leaks ?? [];
    return leaks.slice(0, TOP_N);
  }, [data]);

  const chartHeight = Math.max(120, topLeaks.length * 38 + 16);

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-sm" style={{ fontWeight: 560, color: "var(--text)" }}>Recurring leaks</h3>
          <p className="text-xs" style={{ color: "var(--faint)" }}>
            {player ? `Top mistakes for ${player}` : "Top mistakes across this hub"}
          </p>
        </div>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]"
          style={{ background: "var(--sapphire)", color: "#0b1620" }}
        >
          Insights
        </span>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-sm" style={{ color: "var(--muted)" }}>
          Loading insights…
        </div>
      ) : error ? (
        <div className="flex h-32 items-center justify-center text-sm" style={{ color: "var(--ruby)" }}>
          {error}
        </div>
      ) : topLeaks.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center gap-1 text-center">
          <span className="text-sm" style={{ color: "var(--muted)" }}>No leaks tagged yet</span>
          <span className="text-xs" style={{ color: "var(--faint)" }}>
            Leak tags from match reviews will surface here.
          </span>
        </div>
      ) : (
        <>
          <div style={{ width: "100%", height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={topLeaks}
                margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
              >
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fill: "var(--faint)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--line)" }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="tag"
                  width={140}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "color-mix(in srgb, var(--text) 5%, transparent)" }}
                  content={<CustomTooltip />}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
                  {topLeaks.map((entry, i) => (
                    <Cell key={entry.tag} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {data?.byMatchup?.length > 0 && (
            <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--line)" }}>
              <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--faint)" }}>
                By matchup
              </h4>
              <div className="space-y-2">
                {data.byMatchup.slice(0, 4).map((m) => (
                  <div
                    key={m.vsArchetype}
                    className="rounded-lg border px-3 py-2"
                    style={{ borderColor: "var(--line)", background: "var(--panel-2)" }}
                  >
                    <div className="mb-1.5 text-xs font-medium" style={{ color: "var(--sapphire)" }}>
                      vs {m.vsArchetype}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {m.leaks.slice(0, 4).map((l) => (
                        <span
                          key={l.tag}
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
                          style={{ borderColor: "var(--line-2)", background: "var(--panel-2)", color: "var(--muted)" }}
                        >
                          {l.tag}
                          <span className="tabular-nums" style={{ color: "var(--faint)" }}>{l.count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
