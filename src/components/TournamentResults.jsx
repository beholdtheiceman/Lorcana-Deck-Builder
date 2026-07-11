// Tournament results: per-deck localStorage result log (useDeckResults) and the
// TournamentResultsSection UI (quick log, paste import, OCR image import,
// win-rate splits). Extracted verbatim from App.jsx (H9).
import React, { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { Section, Pill, WinRateBar } from "./ui";

// OCR (tesseract.js) is heavy; load it on demand only when the image-import tab is opened.
const StandingsImageImportLazy = lazy(() => import("./StandingsImageImport"));
function StandingsImageImport(props) {
  return React.createElement(Suspense, { fallback: React.createElement("div", { className: "p-4 text-sm", style: { color: "var(--muted)" } }, "Loading image importer…") }, React.createElement(StandingsImageImportLazy, props));
}


// --- useDeckResults Hook ---
function useDeckResults(deckId, refreshKey = 0) {
  const [records, setRecords] = useState([]);
  
  useEffect(() => {
    console.log('[useDeckResults] Loading data for deckId:', deckId, 'refreshKey:', refreshKey);
    const stored = localStorage.getItem(`lorcana.deckResults.${deckId}`);
    console.log('[useDeckResults] Raw localStorage data:', stored);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        console.log('[useDeckResults] Parsed records:', parsed);
        setRecords(parsed);
      } catch (e) {
        console.warn('Failed to parse stored deck results:', e);
        setRecords([]);
      }
    } else {
      console.log('[useDeckResults] No stored data found');
      setRecords([]);
    }
  }, [deckId, refreshKey]);

  // Also load data on initial mount if deckId exists
  useEffect(() => {
    console.log('[useDeckResults] Initial mount effect - deckId:', deckId);
    if (deckId) {
      console.log('[useDeckResults] Initial load for deckId:', deckId);
      const stored = localStorage.getItem(`lorcana.deckResults.${deckId}`);
      console.log('[useDeckResults] Initial load - raw data:', stored);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          console.log('[useDeckResults] Initial load - parsed records:', parsed);
          setRecords(parsed);
        } catch (e) {
          console.warn('Failed to parse stored deck results on initial load:', e);
        }
      } else {
        console.log('[useDeckResults] Initial load - no stored data found');
      }
    } else {
      console.log('[useDeckResults] Initial mount - no deckId yet');
    }
  }, []); // Empty dependency array - only run on mount
  
  const persist = (newRecords) => {
    console.log('[useDeckResults] persist called with records:', newRecords);
    setRecords(newRecords);
    localStorage.setItem(`lorcana.deckResults.${deckId}`, JSON.stringify(newRecords));
    console.log('[useDeckResults] Data persisted to localStorage');
  };
  
  const bulkAdd = (newRecords) => {
    console.log('[useDeckResults] bulkAdd called with records:', newRecords);
    const stamped = newRecords.map(record => ({
      ...record,
      id: record.id || `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dateISO: record.dateISO || new Date().toISOString(),
      deckId
    }));
    console.log('[useDeckResults] bulkAdd - new records after stamping:', stamped);
    console.log('[useDeckResults] bulkAdd - all records after adding:', [...stamped, ...records]);
    persist([...stamped, ...records]);
    return stamped.length;
  };
  
  return { bulkAdd, count: records.length, records, persist };
}

// --- Tournament Results Section Component ---
function TournamentResultsSection({ deckId, deckName }) {
  const [tab, setTab] = useState("quick");
  const [event, setEvent] = useState("Set Champs @ Unplugged Games");
  const [round, setRound] = useState("1");
  const [opponent, setOpponent] = useState("");
  const [opponentDeck, setOpponentDeck] = useState("Amber/Steel Brooms");
  const [selectedInks, setSelectedInks] = useState([]);
  const [playDraw, setPlayDraw] = useState("first");
  const [result, setResult] = useState("win");
  const [pasteText, setPasteText] = useState("");
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Force refresh when records change (for OCR updates)
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Get actual match data from localStorage
  const { records, persist } = useDeckResults(deckId, refreshKey);
  
  
  // Calculate stats from actual data
  console.log('[Performance Summary Debug] Records before useMemo:', records);
  const wr = useMemo(() => {
    console.log('[Performance Summary] Calculating stats from records:', records);
    const wins = records.filter(r => r.result === 'W').length;
    const losses = records.filter(r => r.result === 'L').length;
    const draws = records.filter(r => r.result === 'D').length;
    const stats = { played: records.length, W: wins, L: losses, D: draws };
    console.log('[Performance Summary] Calculated stats:', stats);
    return stats;
  }, [records]);

  const byInk = useMemo(() => {
    const inkStats = {};
    records.forEach(record => {
      const inkKey = record.opponentInks || 'Unknown';
      if (!inkStats[inkKey]) {
        inkStats[inkKey] = { W: 0, L: 0, D: 0 };
      }
      if (record.result === 'W') inkStats[inkKey].W++;
      else if (record.result === 'L') inkStats[inkKey].L++;
      else if (record.result === 'D') inkStats[inkKey].D++;
    });
    
    return Object.entries(inkStats)
      .map(([k, stats]) => ({ k, W: stats.W, L: stats.L, D: stats.D }))
      .sort((a, b) => (b.W + b.L + b.D) - (a.W + a.L + a.D)); // Sort by total games
  }, [records]);

  const INK_COLORS = ["Amber", "Amethyst", "Emerald", "Ruby", "Sapphire", "Steel"];

  const toggleInk = (ink) => {
    setSelectedInks(prev => 
      prev.includes(ink) 
        ? prev.filter(i => i !== ink)
        : [...prev, ink]
    );
  };

  // Edit functionality
  const startEdit = (record) => {
    setEditingRecord(record.id);
    setEditForm({
      round: record.round || '',
      result: record.result || '',
      opponentInks: record.opponentInks || '',
      playDraw: record.playDraw || '',
      event: record.event || '',
      notes: record.notes || ''
    });
  };

  const cancelEdit = () => {
    setEditingRecord(null);
    setEditForm({});
  };

  const saveEdit = () => {
    if (!editingRecord) return;
    
    const updatedRecords = records.map(record => 
      record.id === editingRecord 
        ? { ...record, ...editForm }
        : record
    );
    
    persist(updatedRecords);
    setEditingRecord(null);
    setEditForm({});
    setRefreshKey(prev => prev + 1);
  };

  const deleteRecord = (recordId) => {
    if (confirm('Are you sure you want to delete this match record?')) {
      const updatedRecords = records.filter(record => record.id !== recordId);
      persist(updatedRecords);
      setRefreshKey(prev => prev + 1);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-display text-center mb-6" style={{ fontWeight: 560, color: 'var(--text)' }}>🎯 Tournament Results</h3>
      
      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Left column: Import + Logging */}
        <div className="space-y-6 lg:col-span-2">
          <Section
            title="Import Tournament Results"
            subtitle="Add results in seconds: paste text, quick log, or upload a standings screenshot (OCR runs locally)."
          >
            <div className="flex flex-wrap gap-2 mb-4">
              <Pill active={tab === "quick"} onClick={() => setTab("quick")}>Quick Log</Pill>
              <Pill active={tab === "paste"} onClick={() => setTab("paste")}>Paste Text</Pill>
              <Pill active={tab === "image"} onClick={() => setTab("image")}>From Image</Pill>
            </div>

            {tab === "quick" && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm" style={{ color: 'var(--muted)' }}>Event (optional)</label>
                  <input
                    className="w-full border rounded-xl px-3 py-2 placeholder:text-[var(--faint)]"
                    style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--text)' }}
                    placeholder="Set Champs @ Unplugged Games"
                    value={event}
                    onChange={(e) => setEvent(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm" style={{ color: 'var(--muted)' }}>Round (optional)</label>
                  <input
                    className="w-full border rounded-xl px-3 py-2 placeholder:text-[var(--faint)]"
                    style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--text)' }}
                    placeholder="1"
                    value={round}
                    onChange={(e) => setRound(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm" style={{ color: 'var(--muted)' }}>Opponent (optional)</label>
                  <input
                    className="w-full border rounded-xl px-3 py-2 placeholder:text-[var(--faint)]"
                    style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--text)' }}
                    placeholder="Player handle"
                    value={opponent}
                    onChange={(e) => setOpponent(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm" style={{ color: 'var(--muted)' }}>Opponent Deck (optional)</label>
                  <input
                    className="w-full border rounded-xl px-3 py-2 placeholder:text-[var(--faint)]"
                    style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--text)' }}
                    placeholder="Amber/Steel Brooms"
                    value={opponentDeck}
                    onChange={(e) => setOpponentDeck(e.target.value)}
                  />
                </div>

                <div className="col-span-full">
                  <div className="text-sm mb-2" style={{ color: 'var(--muted)' }}>Opponent Inks</div>
                  <div className="flex flex-wrap gap-2">
                    {INK_COLORS.map((ink) => (
                      <button
                        key={ink}
                        onClick={() => toggleInk(ink)}
                        className="px-3 py-1.5 rounded-full border text-sm transition hover:brightness-110"
                        style={
                          selectedInks.includes(ink)
                            ? { background: 'var(--sapphire)', color: '#0b1620', borderColor: 'var(--sapphire)' }
                            : { background: 'var(--panel-2)', color: 'var(--text)', borderColor: 'var(--line-2)' }
                        }
                      >
                        {ink}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="col-span-full flex items-center gap-2">
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>Play/Draw:</span>
                  <button
                    onClick={() => setPlayDraw("first")}
                    className="px-3 py-1.5 rounded-full border text-sm transition hover:brightness-110"
                    style={
                      playDraw === "first"
                        ? { background: 'var(--sapphire)', color: '#0b1620', borderColor: 'var(--sapphire)' }
                        : { background: 'var(--panel-2)', color: 'var(--text)', borderColor: 'var(--line-2)' }
                    }
                  >
                    Went First
                  </button>
                  <button
                    onClick={() => setPlayDraw("second")}
                    className="px-3 py-1.5 rounded-full border text-sm transition hover:brightness-110"
                    style={
                      playDraw === "second"
                        ? { background: 'var(--sapphire)', color: '#0b1620', borderColor: 'var(--sapphire)' }
                        : { background: 'var(--panel-2)', color: 'var(--text)', borderColor: 'var(--line-2)' }
                    }
                  >
                    Went Second
                  </button>
                  <button
                    onClick={() => setPlayDraw("unknown")}
                    className="px-3 py-1.5 rounded-full border text-sm transition hover:brightness-110"
                    style={
                      playDraw === "unknown"
                        ? { background: 'var(--sapphire)', color: '#0b1620', borderColor: 'var(--sapphire)' }
                        : { background: 'var(--panel-2)', color: 'var(--text)', borderColor: 'var(--line-2)' }
                    }
                  >
                    Unknown
                  </button>
                </div>

                <div className="col-span-full flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={() => setResult("win")}
                    className="px-4 py-2 rounded-xl transition hover:brightness-110"
                    style={
                      result === "win"
                        ? { background: 'var(--sapphire)', color: '#0b1620' }
                        : { background: 'var(--panel-2)', color: 'var(--text)' }
                    }
                  >
                    Win
                  </button>
                  <button
                    onClick={() => setResult("loss")}
                    className="px-4 py-2 rounded-xl transition hover:brightness-110"
                    style={
                      result === "loss"
                        ? { background: 'var(--ruby)', color: '#fff' }
                        : { background: 'var(--panel-2)', color: 'var(--text)' }
                    }
                  >
                    Loss
                  </button>
                  <button
                    onClick={() => setResult("draw")}
                    className="px-4 py-2 rounded-xl transition hover:brightness-110"
                    style={
                      result === "draw"
                        ? { background: 'var(--steel)', color: '#0b1620' }
                        : { background: 'var(--panel-2)', color: 'var(--text)' }
                    }
                  >
                    Draw
                  </button>
                </div>
              </div>
            )}

            {tab === "paste" && (
              <div className="space-y-3">
                <textarea
                  className="w-full h-36 border rounded-xl p-3 font-mono placeholder:text-[var(--faint)]"
                  style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--text)' }}
                  placeholder={`Paste lines like:\nR1 W vs Ruby/Sapphire (first)\n2 L vs Amber Steel - flooded\nR3 D vs Amethyst/Emerald, second`}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>
                    {pasteText.split('\n').filter(line => line.trim()).length} line(s) detected
                  </span>
                  <button className="px-3 py-1.5 rounded-xl font-semibold transition hover:brightness-110" style={{ background: 'var(--sapphire)', color: '#0b1620' }}>Import</button>
                </div>
              </div>
            )}

            {tab === "image" && (
              <div className="space-y-4">
                <StandingsImageImport 
                  deckId={deckId} 
                  deckName={deckName}
                  onRecordsUpdated={() => {
                    console.log('[TournamentResultsSection] onRecordsUpdated callback triggered, incrementing refreshKey');
                    setRefreshKey(prev => prev + 1);
                  }}
                />
              </div>
            )}
          </Section>

          <Section title="Logged Matches" subtitle="Recent entries for this deck (local to your browser).">
            <div className="border rounded-2xl overflow-auto" style={{ borderColor: 'var(--line)' }}>
              <table className="min-w-full text-sm">
                <thead style={{ background: 'var(--panel-2)' }}>
                  <tr>
                    <th className="text-left px-3 py-2 text-[11px] uppercase tracking-[0.1em] font-semibold" style={{ color: 'var(--faint)' }}>Date</th>
                    <th className="text-left px-3 py-2 text-[11px] uppercase tracking-[0.1em] font-semibold" style={{ color: 'var(--faint)' }}>Rnd</th>
                    <th className="text-left px-3 py-2 text-[11px] uppercase tracking-[0.1em] font-semibold" style={{ color: 'var(--faint)' }}>Res</th>
                    <th className="text-left px-3 py-2 text-[11px] uppercase tracking-[0.1em] font-semibold" style={{ color: 'var(--faint)' }}>Opp Inks</th>
                    <th className="text-left px-3 py-2 text-[11px] uppercase tracking-[0.1em] font-semibold" style={{ color: 'var(--faint)' }}>Play/Draw</th>
                    <th className="text-left px-3 py-2 text-[11px] uppercase tracking-[0.1em] font-semibold" style={{ color: 'var(--faint)' }}>Event</th>
                    <th className="text-left px-3 py-2 text-[11px] uppercase tracking-[0.1em] font-semibold" style={{ color: 'var(--faint)' }}>Notes</th>
                    <th className="text-left px-3 py-2 text-[11px] uppercase tracking-[0.1em] font-semibold" style={{ color: 'var(--faint)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-3 py-8 text-center" style={{ color: 'var(--muted)' }}>
                        No matches logged yet. Import some results to see them here!
                      </td>
                    </tr>
                  ) : (
                    records.map((record, i) => (
                      <tr key={record.id || i} className="border-t" style={{ borderColor: 'var(--line)' }}>
                        <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>
                          {new Date(record.dateISO).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>
                          {editingRecord === record.id ? (
                            <input
                              type="text"
                              value={editForm.round}
                              onChange={(e) => setEditForm(prev => ({ ...prev, round: e.target.value }))}
                              className="w-full rounded px-2 py-1 text-sm border" style={{ background: 'var(--panel)', borderColor: 'var(--line-2)', color: 'var(--text)' }}
                            />
                          ) : (
                            record.round
                          )}
                        </td>
                        <td className="px-3 py-2 font-semibold" style={{ color: 'var(--text)' }}>
                          {editingRecord === record.id ? (
                            <select
                              value={editForm.result}
                              onChange={(e) => setEditForm(prev => ({ ...prev, result: e.target.value }))}
                              className="w-full rounded px-2 py-1 text-sm border" style={{ background: 'var(--panel)', borderColor: 'var(--line-2)', color: 'var(--text)' }}
                            >
                              <option value="W">W</option>
                              <option value="L">L</option>
                              <option value="D">D</option>
                            </select>
                          ) : (
                            record.result
                          )}
                        </td>
                        <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>
                          {editingRecord === record.id ? (
                            <input
                              type="text"
                              value={editForm.opponentInks}
                              onChange={(e) => setEditForm(prev => ({ ...prev, opponentInks: e.target.value }))}
                              className="w-full rounded px-2 py-1 text-sm border" style={{ background: 'var(--panel)', borderColor: 'var(--line-2)', color: 'var(--text)' }}
                              placeholder="e.g., Amber/Steel"
                            />
                          ) : (
                            record.opponentInks || 'Unknown'
                          )}
                        </td>
                        <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>
                          {editingRecord === record.id ? (
                            <select
                              value={editForm.playDraw}
                              onChange={(e) => setEditForm(prev => ({ ...prev, playDraw: e.target.value }))}
                              className="w-full rounded px-2 py-1 text-sm border" style={{ background: 'var(--panel)', borderColor: 'var(--line-2)', color: 'var(--text)' }}
                            >
                              <option value="first">First</option>
                              <option value="second">Second</option>
                              <option value="unknown">Unknown</option>
                            </select>
                          ) : (
                            record.playDraw || 'Unknown'
                          )}
                        </td>
                        <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>
                          {editingRecord === record.id ? (
                            <input
                              type="text"
                              value={editForm.event}
                              onChange={(e) => setEditForm(prev => ({ ...prev, event: e.target.value }))}
                              className="w-full rounded px-2 py-1 text-sm border" style={{ background: 'var(--panel)', borderColor: 'var(--line-2)', color: 'var(--text)' }}
                            />
                          ) : (
                            record.event || 'Unknown'
                          )}
                        </td>
                        <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>
                          {editingRecord === record.id ? (
                            <input
                              type="text"
                              value={editForm.notes}
                              onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                              className="w-full rounded px-2 py-1 text-sm border" style={{ background: 'var(--panel)', borderColor: 'var(--line-2)', color: 'var(--text)' }}
                            />
                          ) : (
                            record.notes || '-'
                          )}
                        </td>
                        <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>
                          {editingRecord === record.id ? (
                            <div className="flex gap-1">
                              <button
                                onClick={saveEdit}
                                className="px-2 py-1 text-xs rounded transition hover:brightness-110"
                                style={{ background: 'var(--sapphire)', color: '#0b1620' }}
                              >
                                ✓
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-2 py-1 text-xs rounded border transition hover:brightness-110"
                                style={{ background: 'var(--panel-2)', borderColor: 'var(--line-2)', color: 'var(--text)' }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <button
                                onClick={() => startEdit(record)}
                                className="px-2 py-1 text-xs rounded transition hover:brightness-110"
                                style={{ background: 'var(--sapphire)', color: '#0b1620' }}
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => deleteRecord(record.id)}
                                className="px-2 py-1 text-xs rounded transition hover:brightness-110"
                                style={{ background: 'var(--ruby)', color: '#fff' }}
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        {/* Right column: Summary */}
        <div className="space-y-6">
          <Section title="Performance Summary" subtitle="At-a-glance stats for this deck.">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <div className="text-xs text-[color:var(--faint)]">Games Played</div>
                <div className="text-2xl font-bold text-[color:var(--emerald)]">{wr.played}</div>
                <div className="text-xs text-[color:var(--faint)]">W {wr.W} / L {wr.L} / D {wr.D}</div>
              </div>
              <div className="col-span-1">
                <div className="text-xs text-[color:var(--faint)]">WR (excl. draws)</div>
                <div className="text-2xl font-bold text-[color:var(--emerald)]">{Math.round((wr.W / Math.max(1, wr.W + wr.L)) * 100)}%</div>
                <div className="text-xs text-[color:var(--faint)]">Draws count as 0</div>
              </div>
              <div className="col-span-1">
                <div className="text-xs text-[color:var(--faint)]">WR (½ draw)</div>
                <div className="text-2xl font-bold text-[color:var(--emerald)]">{Math.round(((wr.W + wr.D * 0.5) / Math.max(1, wr.played)) * 100)}%</div>
                <div className="text-xs text-[color:var(--faint)]">Draws count as ½</div>
              </div>
            </div>

            <div className="mt-5">
              <div className="font-medium mb-2 text-[color:var(--text)]">By Opponent Inks</div>
              <div className="space-y-2">
                {byInk.map((row) => (
                  <div key={row.k} className="flex items-center justify-between gap-4">
                    <div className="w-40 truncate text-sm text-[color:var(--text)]">{row.k}</div>
                    <WinRateBar win={row.W} loss={row.L} />
                    <div className="text-xs text-[color:var(--faint)]">{row.W + row.L} GP</div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Tips" subtitle="Quick ways to keep your data clean.">
            <ul className="text-sm text-[color:var(--muted)] list-disc pl-5 space-y-2">
              <li>Use <span className="font-medium text-[color:var(--emerald)]">Quick Log</span> for live events; add inks & play/draw for better splits.</li>
              <li>Bulk results? Paste your notes or Discord lines in <span className="font-medium text-[color:var(--emerald)]">Paste Text</span>.</li>
              <li>Event standings screenshot? Try <span className="font-medium text-[color:var(--emerald)]">From Image</span> — OCR runs in your browser.</li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}

export { useDeckResults, TournamentResultsSection };
