// Tournament results: per-deck localStorage result log (useDeckResults) and the
// TournamentResultsSection UI (quick log, paste import, OCR image import,
// win-rate splits). Extracted verbatim from App.jsx (H9).
import React, { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { Section, Pill, WinRateBar } from "./ui";

// OCR (tesseract.js) is heavy; load it on demand only when the image-import tab is opened.
const StandingsImageImportLazy = lazy(() => import("./StandingsImageImport"));
function StandingsImageImport(props) {
  return React.createElement(Suspense, { fallback: React.createElement("div", { className: "p-4 text-sm text-gray-300" }, "Loading image importer…") }, React.createElement(StandingsImageImportLazy, props));
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
      <h3 className="text-2xl font-bold text-center mb-6 text-emerald-400">🎯 Tournament Results</h3>
      
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
                  <label className="text-sm text-gray-300">Event (optional)</label>
                  <input 
                    className="w-full border border-gray-500 bg-gray-600 text-gray-100 rounded-xl px-3 py-2 placeholder-gray-400" 
                    placeholder="Set Champs @ Unplugged Games"
                    value={event}
                    onChange={(e) => setEvent(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-300">Round (optional)</label>
                  <input 
                    className="w-full border border-gray-500 bg-gray-600 text-gray-100 rounded-xl px-3 py-2 placeholder-gray-400" 
                    placeholder="1"
                    value={round}
                    onChange={(e) => setRound(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-300">Opponent (optional)</label>
                  <input 
                    className="w-full border border-gray-500 bg-gray-600 text-gray-100 rounded-xl px-3 py-2 placeholder-gray-400" 
                    placeholder="Player handle"
                    value={opponent}
                    onChange={(e) => setOpponent(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-300">Opponent Deck (optional)</label>
                  <input 
                    className="w-full border border-gray-500 bg-gray-600 text-gray-100 rounded-xl px-3 py-2 placeholder-gray-400" 
                    placeholder="Amber/Steel Brooms"
                    value={opponentDeck}
                    onChange={(e) => setOpponentDeck(e.target.value)}
                  />
                </div>

                <div className="col-span-full">
                  <div className="text-sm text-gray-300 mb-2">Opponent Inks</div>
                  <div className="flex flex-wrap gap-2">
                    {INK_COLORS.map((ink) => (
                      <button 
                        key={ink} 
                        onClick={() => toggleInk(ink)}
                        className={`px-3 py-1.5 rounded-full border text-sm ${
                          selectedInks.includes(ink)
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-gray-600 text-gray-200 border-gray-500 hover:bg-gray-500"
                        }`}
                      >
                        {ink}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="col-span-full flex items-center gap-2">
                  <span className="text-sm text-gray-300">Play/Draw:</span>
                  <button 
                    onClick={() => setPlayDraw("first")}
                    className={`px-3 py-1.5 rounded-full border text-sm ${
                      playDraw === "first"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-gray-600 text-gray-200 border-gray-500 hover:bg-gray-500"
                    }`}
                  >
                    Went First
                  </button>
                  <button 
                    onClick={() => setPlayDraw("second")}
                    className={`px-3 py-1.5 rounded-full border text-sm ${
                      playDraw === "second"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-gray-600 text-gray-200 border-gray-500 hover:bg-gray-500"
                    }`}
                  >
                    Went Second
                  </button>
                  <button 
                    onClick={() => setPlayDraw("unknown")}
                    className={`px-3 py-1.5 rounded-full border text-sm ${
                      playDraw === "unknown"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-gray-600 text-gray-200 border-gray-500 hover:bg-gray-500"
                    }`}
                  >
                    Unknown
                  </button>
                </div>

                <div className="col-span-full flex flex-wrap gap-2 pt-2">
                  <button 
                    onClick={() => setResult("win")}
                    className={`px-4 py-2 rounded-xl ${
                      result === "win" ? "bg-gradient-to-b from-violet-500 to-indigo-500 text-white shadow-[0_2px_10px_-2px_rgba(139,108,255,0.7)]" : "bg-gray-600 text-gray-200 hover:bg-gray-500"
                    }`}
                  >
                    Win
                  </button>
                  <button 
                    onClick={() => setResult("loss")}
                    className={`px-4 py-2 rounded-xl ${
                      result === "loss" ? "bg-red-600 text-white" : "bg-gray-600 text-gray-200 hover:bg-gray-500"
                    }`}
                  >
                    Loss
                  </button>
                  <button 
                    onClick={() => setResult("draw")}
                    className={`px-4 py-2 rounded-xl ${
                      result === "draw" ? "bg-gray-500 text-white" : "bg-gray-600 text-gray-200 hover:bg-gray-500"
                    }`}
                  >
                    Draw
                  </button>
                </div>
              </div>
            )}

            {tab === "paste" && (
              <div className="space-y-3">
                <textarea 
                  className="w-full h-36 border border-gray-500 bg-gray-600 text-gray-100 rounded-xl p-3 font-mono placeholder-gray-400" 
                  placeholder={`Paste lines like:\nR1 W vs Ruby/Sapphire (first)\n2 L vs Amber Steel - flooded\nR3 D vs Amethyst/Emerald, second`}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">
                    {pasteText.split('\n').filter(line => line.trim()).length} line(s) detected
                  </span>
                  <button className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">Import</button>
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
            <div className="border border-gray-600 rounded-2xl overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-600">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-200">Date</th>
                    <th className="text-left px-3 py-2 text-gray-200">Rnd</th>
                    <th className="text-left px-3 py-2 text-gray-200">Res</th>
                    <th className="text-left px-3 py-2 text-gray-200">Opp Inks</th>
                    <th className="text-left px-3 py-2 text-gray-200">Play/Draw</th>
                    <th className="text-left px-3 py-2 text-gray-200">Event</th>
                    <th className="text-left px-3 py-2 text-gray-200">Notes</th>
                    <th className="text-left px-3 py-2 text-gray-200">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-3 py-8 text-center text-gray-400">
                        No matches logged yet. Import some results to see them here!
                      </td>
                    </tr>
                  ) : (
                    records.map((record, i) => (
                      <tr key={record.id || i} className="border-t border-gray-600">
                        <td className="px-3 py-2 text-gray-200">
                          {new Date(record.dateISO).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2 text-gray-200">
                          {editingRecord === record.id ? (
                            <input
                              type="text"
                              value={editForm.round}
                              onChange={(e) => setEditForm(prev => ({ ...prev, round: e.target.value }))}
                              className="w-full bg-gray-700 border border-gray-500 rounded px-2 py-1 text-gray-100 text-sm"
                            />
                          ) : (
                            record.round
                          )}
                        </td>
                        <td className="px-3 py-2 font-semibold text-gray-200">
                          {editingRecord === record.id ? (
                            <select
                              value={editForm.result}
                              onChange={(e) => setEditForm(prev => ({ ...prev, result: e.target.value }))}
                              className="w-full bg-gray-700 border border-gray-500 rounded px-2 py-1 text-gray-100 text-sm"
                            >
                              <option value="W">W</option>
                              <option value="L">L</option>
                              <option value="D">D</option>
                            </select>
                          ) : (
                            record.result
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-200">
                          {editingRecord === record.id ? (
                            <input
                              type="text"
                              value={editForm.opponentInks}
                              onChange={(e) => setEditForm(prev => ({ ...prev, opponentInks: e.target.value }))}
                              className="w-full bg-gray-700 border border-gray-500 rounded px-2 py-1 text-gray-100 text-sm"
                              placeholder="e.g., Amber/Steel"
                            />
                          ) : (
                            record.opponentInks || 'Unknown'
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-200">
                          {editingRecord === record.id ? (
                            <select
                              value={editForm.playDraw}
                              onChange={(e) => setEditForm(prev => ({ ...prev, playDraw: e.target.value }))}
                              className="w-full bg-gray-700 border border-gray-500 rounded px-2 py-1 text-gray-100 text-sm"
                            >
                              <option value="first">First</option>
                              <option value="second">Second</option>
                              <option value="unknown">Unknown</option>
                            </select>
                          ) : (
                            record.playDraw || 'Unknown'
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-200">
                          {editingRecord === record.id ? (
                            <input
                              type="text"
                              value={editForm.event}
                              onChange={(e) => setEditForm(prev => ({ ...prev, event: e.target.value }))}
                              className="w-full bg-gray-700 border border-gray-500 rounded px-2 py-1 text-gray-100 text-sm"
                            />
                          ) : (
                            record.event || 'Unknown'
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-200">
                          {editingRecord === record.id ? (
                            <input
                              type="text"
                              value={editForm.notes}
                              onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                              className="w-full bg-gray-700 border border-gray-500 rounded px-2 py-1 text-gray-100 text-sm"
                            />
                          ) : (
                            record.notes || '-'
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-200">
                          {editingRecord === record.id ? (
                            <div className="flex gap-1">
                              <button
                                onClick={saveEdit}
                                className="px-2 py-1 bg-violet-600 hover:bg-violet-700 text-white text-xs rounded"
                              >
                                ✓
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <button
                                onClick={() => startEdit(record)}
                                className="px-2 py-1 bg-violet-600 hover:bg-violet-700 text-white text-xs rounded"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => deleteRecord(record.id)}
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
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
                <div className="text-xs text-gray-400">Games Played</div>
                <div className="text-2xl font-bold text-emerald-300">{wr.played}</div>
                <div className="text-xs text-gray-400">W {wr.W} / L {wr.L} / D {wr.D}</div>
              </div>
              <div className="col-span-1">
                <div className="text-xs text-gray-400">WR (excl. draws)</div>
                <div className="text-2xl font-bold text-emerald-300">{Math.round((wr.W / Math.max(1, wr.W + wr.L)) * 100)}%</div>
                <div className="text-xs text-gray-400">Draws count as 0</div>
              </div>
              <div className="col-span-1">
                <div className="text-xs text-gray-400">WR (½ draw)</div>
                <div className="text-2xl font-bold text-emerald-300">{Math.round(((wr.W + wr.D * 0.5) / Math.max(1, wr.played)) * 100)}%</div>
                <div className="text-xs text-gray-400">Draws count as ½</div>
              </div>
            </div>

            <div className="mt-5">
              <div className="font-medium mb-2 text-gray-200">By Opponent Inks</div>
              <div className="space-y-2">
                {byInk.map((row) => (
                  <div key={row.k} className="flex items-center justify-between gap-4">
                    <div className="w-40 truncate text-sm text-gray-200">{row.k}</div>
                    <WinRateBar win={row.W} loss={row.L} />
                    <div className="text-xs text-gray-400">{row.W + row.L} GP</div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Tips" subtitle="Quick ways to keep your data clean.">
            <ul className="text-sm text-gray-300 list-disc pl-5 space-y-2">
              <li>Use <span className="font-medium text-emerald-300">Quick Log</span> for live events; add inks & play/draw for better splits.</li>
              <li>Bulk results? Paste your notes or Discord lines in <span className="font-medium text-emerald-300">Paste Text</span>.</li>
              <li>Event standings screenshot? Try <span className="font-medium text-emerald-300">From Image</span> — OCR runs in your browser.</li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}

export { useDeckResults, TournamentResultsSection };
