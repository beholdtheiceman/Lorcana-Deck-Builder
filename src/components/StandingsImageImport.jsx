import React, { useEffect, useRef, useState } from "react";
import Tesseract from "tesseract.js";

/** ===== Storage helpers (local, per deck) ===== */
const keyForDeck = (deckId) => `lorcana.deckResults.${deckId}`;
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function useDeckResults(deckId) {
  const [records, setRecords] = useState([]);
  
  useEffect(() => {
    try {
      const raw = localStorage.getItem(keyForDeck(deckId));
      setRecords(raw ? JSON.parse(raw) : []);
    } catch { 
      setRecords([]); 
    }
  }, [deckId]);
  
  const persist = (next) => {
    setRecords(next);
    try { 
      localStorage.setItem(keyForDeck(deckId), JSON.stringify(next)); 
    } catch {} 
  };
  
  const bulkAdd = (newRecords) => {
    const stamped = newRecords.map(record => ({
      ...record,
      id: record.id || `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dateISO: record.dateISO || new Date().toISOString(),
      deckId
    }));
    persist([...stamped, ...records]);
    return stamped.length;
  };
  
  return { bulkAdd, count: records.length, records, persist };
}

/** ===== Minimal image preprocessor (canvas) =====
 * Scales to target width, applies grayscale + simple threshold.
 * Optional crop via percentage sliders for better OCR signal.
 */
function preprocess(
  img,
  cropPct,
  targetW = 1600,
  mode = 'auto'
) {
  const scale = targetW / img.naturalWidth;
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);

  // full-size buffer
  const buf = document.createElement("canvas");
  buf.width = w; 
  buf.height = h;
  const bctx = buf.getContext("2d");
  bctx.imageSmoothingEnabled = true;
  bctx.drawImage(img, 0, 0, w, h);

  // crop box in pixels
  const cx = Math.round((cropPct.left / 100) * w);
  const cy = Math.round((cropPct.top / 100) * h);
  const cw = Math.round(w - ((cropPct.left + cropPct.right) / 100) * w);
  const ch = Math.round(h - ((cropPct.top + cropPct.bottom) / 100) * h);

  const out = document.createElement("canvas");
  out.width = cw; 
  out.height = ch;
  const ctx = out.getContext("2d");
  const imgData = bctx.getImageData(cx, cy, cw, ch);
  const data = imgData.data;

  // Enhanced preprocessing for better OCR accuracy
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    
    let processedValue;
    
    if (mode === 'colored-text') {
      // Special handling for colored text on colored backgrounds
      const gray = (r * 0.299 + g * 0.587 + b * 0.114) | 0;
      const isColored = Math.abs(r - g) > 30 || Math.abs(g - b) > 30 || Math.abs(r - b) > 30;
      
      if (isColored) {
        // For colored areas, use a more aggressive approach
        const maxChannel = Math.max(r, g, b);
        const minChannel = Math.min(r, g, b);
        const contrast = maxChannel - minChannel;
        processedValue = contrast > 50 ? 255 : 0;
      } else {
        // For non-colored areas, use standard thresholding
        processedValue = gray > 150 ? 255 : 0;
      }
    } else if (mode === 'high-contrast') {
      // High contrast mode for dark text on light backgrounds
      const gray = (r * 0.299 + g * 0.587 + b * 0.114) | 0;
      const enhanced = Math.min(255, Math.max(0, (gray - 30) * 2));
      processedValue = enhanced > 200 ? 255 : 0;
    } else {
      // Auto mode - adaptive based on content
      const gray = (r * 0.299 + g * 0.587 + b * 0.114) | 0;
      const enhanced = Math.min(255, Math.max(0, (gray - 50) * 1.5 + 50));
      const isColored = Math.abs(r - g) > 30 || Math.abs(g - b) > 30 || Math.abs(r - b) > 30;
      const THRESH = isColored ? 120 : 180;
      processedValue = enhanced > THRESH ? 255 : 0;
    }
    
    data[i] = data[i + 1] = data[i + 2] = processedValue;
    // keep alpha as is
  }
  ctx.putImageData(imgData, 0, 0);
  return out;
}

/** ===== Parser: text → rows
 * Handles both table-ish and blocky text:
 * Rank, Player, Points, Record (e.g., "2-1-0" or "3-1")
 */
function parseStandingsText(text) {
  const t = text.replace(/\r/g, "").trim();

  // Case A: it looks like a table with headers
  const firstLine = t.split("\n")[0]?.toLowerCase() || "";
  const sep = firstLine.includes("\t") ? "\t" : (firstLine.includes(",") ? "," : null);
  if (sep && /rank|place/.test(firstLine) && /player|name/.test(firstLine)) {
    const lines = t.split("\n").filter(Boolean);
    const header = lines.shift().toLowerCase().split(sep);
    const idx = {
      rank: header.findIndex(h => /rank|place/.test(h)),
      player: header.findIndex(h => /player|name/.test(h)),
      points: header.findIndex(h => /points|pts/.test(h)),
      record: header.findIndex(h => /record|w-?l(?:-?d)?/.test(h)),
    };
    return lines.map(L => {
      const cells = L.split(sep).map(x => x.trim());
      const rank = Number((cells[idx.rank] || "").replace(/\D+/g, "")) || 0;
      const player = cells[idx.player] || "";
      const points = cells[idx.points] ? Number(String(cells[idx.points]).replace(/\D+/g, "")) : undefined;
      const record = cells[idx.record] ? (String(cells[idx.record]).match(/\b\d+-\d+(?:-\d+)?\b/) || [])[0] : undefined;
      return { rank, player, points, record };
    }).filter(r => r.rank && r.player);
  }

  // Case B: block text (e.g., "1st. Name\nPoints: 6\nRECORD 2-0-0")
  const blocks = t.split(/\n(?=\d+(?:st|nd|rd|th)\b)/i).filter(b => /\d+(?:st|nd|rd|th)\b/i.test(b));
  if (blocks.length) {
    return blocks.map(b => {
      const rank = Number((b.match(/(\d+)(?:st|nd|rd|th)\b/i) || [])[1] || 0);
      const lines = b.split("\n").map(s => s.trim()).filter(Boolean);
      const rankIdx = lines.findIndex(l => /(\d+)(?:st|nd|rd|th)\b/i.test(l));
      const player = (lines.slice(rankIdx + 1).find(l => !/points?:|record|status/i.test(l)) || "").replace(/\.$/, "");
      const points = (b.match(/points?\s*:\s*([0-9]+)/i) || [])[1];
      const record = (b.match(/\b([0-9]+-[0-9]+(?:-[0-9]+)?)\b/) || [])[1];
      return { 
        rank, 
        player, 
        points: points ? Number(points) : undefined, 
        record 
      };
    }).filter(r => r.rank && r.player);
  }

  // Case C: loose lines "1 Name 6pts 3-1-0"
  const rows = [];
  for (const L of t.split("\n")) {
    const rank = Number((L.match(/^\s*(\d+)\b/) || [])[1] || 0);
    const record = (L.match(/\b(\d+-\d+(?:-\d+)?)\b/) || [])[1];
    const points = (L.match(/points?\s*:?\s*([0-9]+)/i) || [])[1] ?? (L.match(/\b([0-9]+)\s*pts?\b/i) || [])[1];
    // crude player pick: drop rank/points/record tokens
    let player = L.replace(/^\s*\d+\b\.?\s*/, "")
                  .replace(/\bpoints?\s*:?\s*\d+/i, "")
                  .replace(/\b\d+\s*pts?\b/i, "")
                  .replace(/\b\d+-\d+(?:-\d+)?\b/, "")
                  .replace(/\s{2,}/g, " ")
                  .trim();
    if (rank && player) {
      rows.push({ 
        rank, 
        player, 
        points: points ? Number(points) : undefined, 
        record 
      });
    }
  }
  return rows;
}

/** ===== Main Component ===== */
export default function StandingsImageImport({
  deckId,
  deckName,
  onRecordsUpdated,
}) {
  const { bulkAdd, count, records, persist } = useDeckResults(deckId);

  const [file, setFile] = useState();
  const [imgUrl, setImgUrl] = useState("");
  const [crop, setCrop] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const [progress, setProgress] = useState(0);
  const [ocrText, setOcrText] = useState("");
  const [rows, setRows] = useState([]);
  const [preprocessingMode, setPreprocessingMode] = useState('auto');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showImportButton, setShowImportButton] = useState(false);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  // Load preview URL
  useEffect(() => {
    if (!file) {
      setShowImportButton(false);
      return;
    }
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    setShowImportButton(true); // Show import button immediately when file is loaded
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Render preprocessed crop into canvas for visual feedback and auto-run OCR
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !imgUrl) {
      return;
    }

    // Wait for image to be fully loaded
    if (!img.complete || img.naturalWidth === 0) {
      const handleLoad = () => {
        processImage();
      };
      img.addEventListener('load', handleLoad);
      return () => img.removeEventListener('load', handleLoad);
    }

    processImage();

    function processImage() {
    const c = preprocess(img, crop, 1600, preprocessingMode);
    const ctx = (canvasRef.current || (canvasRef.current = document.createElement("canvas"))).getContext("2d");
    const canvas = canvasRef.current;
    canvas.width = c.width;
    canvas.height = c.height;
    ctx.drawImage(c, 0, 0);

      // Auto-run OCR when image is loaded and processed
      if (imgUrl && !ocrText && !isProcessing) {
        doOCR();
      }
    }
  }, [imgUrl, crop, preprocessingMode]);

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("image/")) {
      setFile(f);
      setIsProcessing(false);
      setOcrText("");
      setRows([]);
      setShowImportButton(false); // Will be set to true in useEffect when file is processed
    }
  };

  const doOCR = async () => {
    if (isProcessing) {
      return;
    }
    const img = imgRef.current;
    if (!img) {
      return;
    }
    setIsProcessing(true);
    setProgress(0);
    setOcrText("");
    setRows([]);

    // get preprocessed canvas
    const processed = preprocess(img, crop, 1600, preprocessingMode);

    // Enhanced Tesseract configuration for better number recognition
    const { data } = await Tesseract.recognize(processed, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text" && m.progress != null) {
          setProgress(Math.round(m.progress * 100));
        }
      },
      // OCR engine options for better accuracy
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,-:()[]{} ',
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK, // Treat as single text block
      tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY, // Use LSTM engine for better accuracy
    });

    const text = data.text || "";
    setOcrText(text);

    const parsed = parseStandingsText(text);
    setRows(parsed);
    setIsProcessing(false);
  };

  const importRows = () => {
    if (!rows.length) {
      return;
    }

    const mapped = [];

    rows.forEach(r => {
      // Parse record like "2-3-0" into individual matches
      if (r.record) {
        const [wins, losses, draws] = r.record.split('-').map(Number);

        // Add wins
        for (let i = 0; i < wins; i++) {
          mapped.push({
            result: "W",
            round: `${r.rank}-${i + 1}`,
            opponent: r.player,
            opponentInks: "Unknown",
            playDraw: "Unknown",
            event: "Tournament",
            notes: `Win ${i + 1}/${wins} vs ${r.player}`
          });
        }
        
        // Add losses
        for (let i = 0; i < losses; i++) {
          mapped.push({
            result: "L",
            round: `${r.rank}-${wins + i + 1}`,
            opponent: r.player,
            opponentInks: "Unknown",
            playDraw: "Unknown",
            event: "Tournament",
            notes: `Loss ${i + 1}/${losses} vs ${r.player}`
          });
        }
        
        // Add draws
        for (let i = 0; i < draws; i++) {
          mapped.push({
            result: "D",
            round: `${r.rank}-${wins + losses + i + 1}`,
            opponent: r.player,
            opponentInks: "Unknown",
            playDraw: "Unknown",
            event: "Tournament",
            notes: `Draw ${i + 1}/${draws} vs ${r.player}`
          });
        }
      } else {
        // Fallback: single match if no record
        mapped.push({
          result: "W",
          round: r.rank?.toString() || "1",
          opponent: r.player,
          opponentInks: "Unknown",
          playDraw: "Unknown",
          event: "Tournament",
          notes: r.points != null ? `Points: ${r.points}` : undefined
        });
      }
    });
    
    if (typeof bulkAdd !== 'function') {
      return;
    }
    const added = bulkAdd(mapped);

    // Notify parent component that records were updated
    if (onRecordsUpdated) {
      onRecordsUpdated();
    }

    // Hide import button after successful import
    setShowImportButton(false);
    
    alert(`Imported ${added} matches into deck "${deckName || deckId}". You can edit/adjust inside Logged Matches.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg" style={{ fontWeight: 560, color: 'var(--text)' }}>Import Standings from Image{deckName ? ` — ${deckName}` : ""}</h3>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Upload a screenshot/photo of the STANDINGS table. Enhanced preprocessing handles colored text and numbers better. OCR runs automatically when the image loads.</p>
        </div>
        <div className="text-sm tabular-nums" style={{ color: 'var(--faint)' }}>Current entries: {count}</div>
      </div>

      {/* Drop zone / picker */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="border-2 border-dashed rounded-lg p-4 text-center"
        style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)' }}
      >
        <input
          key={file ? 'has-file' : 'no-file'}
          type="file"
          accept="image/*"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f && f.type.startsWith("image/")) {
              setFile(f);
              setIsProcessing(false);
              setOcrText("");
              setRows([]);
              setShowImportButton(false); // Will be set to true in useEffect when file is processed
            }
          }}
          className="hidden"
          id="standings-file"
        />
        <label htmlFor="standings-file" className="cursor-pointer block" style={{ color: 'var(--muted)' }}>
          {file ? <strong style={{ color: 'var(--text)' }}>{file.name}</strong> : "Drag & drop an image here, or click to choose a file"}
        </label>
      </div>

      {/* Image + crop controls */}
      {imgUrl && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <img
              ref={imgRef}
              src={imgUrl}
              alt="Uploaded"
              onLoad={() => { /* trigger preprocess render via effect */ }}
              className="w-full border rounded"
              style={{ borderColor: 'var(--line)' }}
            />
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="flex flex-col">
                <span className="tabular-nums" style={{ color: 'var(--muted)' }}>Crop top ({crop.top}%)</span>
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={crop.top}
                  style={{ accentColor: 'var(--sapphire)' }}
                  onChange={e => setCrop(c => ({ ...c, top: Number(e.target.value) }))}
                />
              </label>
              <label className="flex flex-col">
                <span className="tabular-nums" style={{ color: 'var(--muted)' }}>Crop bottom ({crop.bottom}%)</span>
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={crop.bottom}
                  style={{ accentColor: 'var(--sapphire)' }}
                  onChange={e => setCrop(c => ({ ...c, bottom: Number(e.target.value) }))}
                />
              </label>
              <label className="flex flex-col">
                <span className="tabular-nums" style={{ color: 'var(--muted)' }}>Crop left ({crop.left}%)</span>
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={crop.left}
                  style={{ accentColor: 'var(--sapphire)' }}
                  onChange={e => setCrop(c => ({ ...c, left: Number(e.target.value) }))}
                />
              </label>
              <label className="flex flex-col">
                <span className="tabular-nums" style={{ color: 'var(--muted)' }}>Crop right ({crop.right}%)</span>
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={crop.right}
                  style={{ accentColor: 'var(--sapphire)' }}
                  onChange={e => setCrop(c => ({ ...c, right: Number(e.target.value) }))}
                />
              </label>
            </div>
            
            {/* Preprocessing Mode Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Preprocessing Mode:</label>
              <select
                value={preprocessingMode}
                onChange={e => setPreprocessingMode(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none"
                style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--text)' }}
              >
                <option value="auto">Auto (Recommended)</option>
                <option value="colored-text">Colored Text (for colored numbers/backgrounds)</option>
                <option value="high-contrast">High Contrast (for dark text on light backgrounds)</option>
              </select>
              <p className="text-xs" style={{ color: 'var(--faint)' }}>
                {preprocessingMode === 'colored-text' && "Best for colored numbers on colored backgrounds"}
                {preprocessingMode === 'high-contrast' && "Best for dark text on light backgrounds"}
                {preprocessingMode === 'auto' && "Automatically detects and adjusts for different image types"}
              </p>
            </div>

            {!!progress && progress < 100 && <div className="text-sm tabular-nums" style={{ color: 'var(--muted)' }}>Recognizing… {progress}%</div>}
          </div>

          <div className="space-y-2">
            <div className="text-sm" style={{ color: 'var(--muted)' }}>Preprocessed Preview</div>
            <canvas ref={canvasRef} className="w-full border rounded" style={{ borderColor: 'var(--line)' }} />
          </div>
        </div>
      )}

      {/* OCR text + parsed table */}
      {ocrText && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>Recognized Text (editable)</div>
            <textarea
              className="w-full h-48 border rounded p-2 font-mono text-sm focus:outline-none"
              style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--text)' }}
              value={ocrText}
              onChange={e => {
                setOcrText(e.target.value);
                setRows(parseStandingsText(e.target.value));
              }}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>Parsed Rows</div>
              {showImportButton && (
                <button
                  onClick={importRows}
                  disabled={!rows.length}
                  className="px-3 py-1.5 rounded text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition hover:brightness-110"
                  style={{ background: 'var(--sapphire)', color: '#0b1620' }}
                >
                  Import {rows.length} row(s) to deck
                </button>
              )}
            </div>
            <div className="overflow-auto border rounded" style={{ borderColor: 'var(--line)' }}>
              <table className="min-w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--panel-2)' }}>
                    <th className="text-left px-2 py-1 text-[11px] uppercase tracking-[0.1em]" style={{ color: 'var(--faint)' }}>Rank</th>
                    <th className="text-left px-2 py-1 text-[11px] uppercase tracking-[0.1em]" style={{ color: 'var(--faint)' }}>Player</th>
                    <th className="text-left px-2 py-1 text-[11px] uppercase tracking-[0.1em]" style={{ color: 'var(--faint)' }}>Points</th>
                    <th className="text-left px-2 py-1 text-[11px] uppercase tracking-[0.1em]" style={{ color: 'var(--faint)' }}>Record</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                      <td className="px-2 py-1 tabular-nums" style={{ color: 'var(--text)' }}>{r.rank}</td>
                      <td className="px-2 py-1" style={{ color: 'var(--text)' }}>{r.player}</td>
                      <td className="px-2 py-1 tabular-nums" style={{ color: 'var(--muted)' }}>{r.points ?? ""}</td>
                      <td className="px-2 py-1 tabular-nums" style={{ color: 'var(--muted)' }}>{r.record ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs" style={{ color: 'var(--faint)' }}>
              Tip: For best accuracy, upload a crisp screenshot of the standings area (not a zoomed-out full page). Use the crop sliders to isolate the table.
            </p>
          </div>
        </div>
      )}

      {/* Stored Match Records Display */}
      {records.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-lg tabular-nums" style={{ fontWeight: 560, color: 'var(--text)' }}>Stored Match Records ({records.length})</h4>
            <button
              onClick={() => {
                if (confirm('Clear all stored match records for this deck?')) {
                  persist([]);
                }
              }}
              className="px-3 py-1 text-sm rounded font-semibold transition hover:brightness-110"
              style={{ background: 'var(--ruby)', color: '#0b1620' }}
            >
              Clear All
            </button>
          </div>

          <div className="rounded-lg p-4 max-h-64 overflow-y-auto" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
            <div className="space-y-2">
              {records.map((record, index) => (
                <div key={record.id} className="p-3 rounded border" style={{ background: 'var(--panel-2)', borderColor: 'var(--line)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium" style={{ color: 'var(--text)' }}>
                        Round {record.round}: vs {record.opponent}
                      </div>
                      <div className="text-sm" style={{ color: 'var(--muted)' }}>
                        Result: {record.result} • {record.notes}
                      </div>
                      <div className="text-xs tabular-nums" style={{ color: 'var(--faint)' }}>
                        {new Date(record.dateISO).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm('Delete this match record?')) {
                          const updated = records.filter(r => r.id !== record.id);
                          persist(updated);
                        }
                      }}
                      className="ml-2 px-2 py-1 text-xs rounded transition"
                      style={{ color: 'var(--ruby)', background: 'color-mix(in srgb, var(--ruby) 15%, transparent)' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs" style={{ color: 'var(--faint)' }}>
            💡 Tip: Match records are stored in localStorage and persist between sessions.
            You can edit the opponent name and notes by clicking on them after importing.
          </div>
        </div>
      )}
    </div>
  );
}