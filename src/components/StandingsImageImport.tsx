import React, { useEffect, useRef, useState } from "react";
import Tesseract from "tesseract.js";

/** ===== Types (align with your results pane) ===== */
type Result = "W" | "L" | "D";
type Ink = "Amber" | "Amethyst" | "Emerald" | "Ruby" | "Sapphire" | "Steel";

export interface MatchRecord {
  id: string;
  deckId: string;
  dateISO: string;
  eventName?: string;
  round?: number;
  opponent?: string;
  opponentDeckName?: string;
  opponentInks?: Ink[];
  wentFirst?: boolean;
  result: Result;
  notes?: string;
}

interface ParsedRow {
  rank: number;
  player: string;
  points?: number;
  record?: string;
}

interface CropSettings {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** ===== Storage helpers (local, per deck) ===== */
const keyForDeck = (deckId: string) => `lorcana.deckResults.${deckId}`;
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function useDeckResults(deckId: string) {
  const [records, setRecords] = useState<MatchRecord[]>([]);
  
  useEffect(() => {
    try {
      const raw = localStorage.getItem(keyForDeck(deckId));
      setRecords(raw ? JSON.parse(raw) : []);
    } catch { 
      setRecords([]); 
    }
  }, [deckId]);
  
  const persist = (next: MatchRecord[]) => {
    setRecords(next);
    try { 
      localStorage.setItem(keyForDeck(deckId), JSON.stringify(next)); 
    } catch {} 
  };
  
  const bulkAdd = (newRecords: Omit<MatchRecord, "id" | "dateISO" | "deckId">[]) => {
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

/** ===== Minimal image preprocessor (canvas) =====
 * Scales to target width, applies grayscale + simple threshold.
 * Optional crop via percentage sliders for better OCR signal.
 */
function preprocess(
  img: HTMLImageElement, 
  cropPct: CropSettings, 
  targetW: number = 1600,
  mode: 'auto' | 'high-contrast' | 'colored-text' = 'auto'
): HTMLCanvasElement {
  const scale = targetW / img.naturalWidth;
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);

  // full-size buffer
  const buf = document.createElement("canvas");
  buf.width = w; 
  buf.height = h;
  const bctx = buf.getContext("2d")!;
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
  const ctx = out.getContext("2d")!;
  const imgData = bctx.getImageData(cx, cy, cw, ch);
  const data = imgData.data;

  // Enhanced preprocessing for better OCR accuracy
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    
    let processedValue: number;
    
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
function parseStandingsText(text: string): ParsedRow[] {
  const t = text.replace(/\r/g, "").trim();

  // Case A: it looks like a table with headers
  const firstLine = t.split("\n")[0]?.toLowerCase() || "";
  const sep = firstLine.includes("\t") ? "\t" : (firstLine.includes(",") ? "," : null);
  if (sep && /rank|place/.test(firstLine) && /player|name/.test(firstLine)) {
    const lines = t.split("\n").filter(Boolean);
    const header = lines.shift()!.toLowerCase().split(sep);
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
  const rows: ParsedRow[] = [];
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
interface StandingsImageImportProps {
  deckId: string;
  deckName?: string;
  onRecordsUpdated?: () => void;
}

export default function StandingsImageImport({
  deckId,
  deckName,
  onRecordsUpdated,
}: StandingsImageImportProps) {
  console.log('[StandingsImageImport] Component initialized with deckId:', deckId, 'deckName:', deckName);
  
  const { bulkAdd, count, records, persist } = useDeckResults(deckId);
  console.log('[StandingsImageImport] useDeckResults returned:', { bulkAdd: !!bulkAdd, count, records: records.length, persist: !!persist });
  console.log('[StandingsImageImport] bulkAdd type:', typeof bulkAdd);
  console.log('[StandingsImageImport] bulkAdd function:', bulkAdd);

  const [file, setFile] = useState<File | undefined>();
  const [imgUrl, setImgUrl] = useState<string>("");
  const [crop, setCrop] = useState<CropSettings>({ top: 0, right: 0, bottom: 0, left: 0 });
  const [progress, setProgress] = useState<number>(0);
  const [ocrText, setOcrText] = useState<string>("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [preprocessingMode, setPreprocessingMode] = useState<'auto' | 'high-contrast' | 'colored-text'>('auto');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showImportButton, setShowImportButton] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load preview URL
  useEffect(() => {
    console.log('[StandingsImageImport] File useEffect triggered, file:', file ? { name: file.name, type: file.type, size: file.size } : 'none');
    if (!file) {
      console.log('[StandingsImageImport] No file, returning early');
      setShowImportButton(false);
      return;
    }
    console.log('[StandingsImageImport] Creating object URL for file');
    const url = URL.createObjectURL(file);
    console.log('[StandingsImageImport] Setting imgUrl to:', url);
    setImgUrl(url);
    setShowImportButton(true); // Show import button immediately when file is loaded
    console.log('[StandingsImageImport] showImportButton set to true');
    return () => {
      console.log('[StandingsImageImport] Cleaning up object URL');
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Render preprocessed crop into canvas for visual feedback and auto-run OCR
  useEffect(() => {
    console.log('[StandingsImageImport] Image processing useEffect triggered, imgUrl:', imgUrl, 'crop:', crop);
    const img = imgRef.current;
    console.log('[StandingsImageImport] Image ref:', img ? { complete: img.complete, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight } : 'null');
    if (!img || !img.complete) {
      console.log('[StandingsImageImport] Image not ready, returning early');
      return;
    }
    console.log('[StandingsImageImport] Preprocessing image with mode:', preprocessingMode);
    const c = preprocess(img, crop, 1600, preprocessingMode);
    const ctx = (canvasRef.current || (canvasRef.current = document.createElement("canvas"))).getContext("2d")!;
    const canvas = canvasRef.current!;
    canvas.width = c.width;
    canvas.height = c.height;
    ctx.drawImage(c, 0, 0);
    console.log('[StandingsImageImport] Canvas updated, dimensions:', c.width, 'x', c.height);
    
    // Auto-run OCR when image is loaded and processed
    if (imgUrl && !ocrText && !isProcessing) {
      console.log('[StandingsImageImport] Auto-running OCR, imgUrl exists and no ocrText yet');
      doOCR();
    } else {
      console.log('[StandingsImageImport] Not running OCR - imgUrl:', !!imgUrl, 'ocrText:', !!ocrText, 'isProcessing:', isProcessing);
    }
  }, [imgUrl, crop, preprocessingMode]);

  const onDrop = (e: React.DragEvent) => {
    console.log('[StandingsImageImport] onDrop triggered');
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    console.log('[StandingsImageImport] Dropped file:', f ? { name: f.name, type: f.type, size: f.size } : 'none');
    if (f && f.type.startsWith("image/")) {
      console.log('[StandingsImageImport] Setting file state');
      setFile(f);
      setIsProcessing(false);
      setOcrText("");
      setRows([]);
      setShowImportButton(false); // Will be set to true in useEffect when file is processed
    } else {
      console.log('[StandingsImageImport] File rejected - not an image');
    }
  };

  const doOCR = async () => {
    console.log('[StandingsImageImport] doOCR function called');
    if (isProcessing) {
      console.log('[StandingsImageImport] OCR already processing, skipping');
      return;
    }
    const img = imgRef.current;
    console.log('[StandingsImageImport] Image ref in doOCR:', img ? { complete: img.complete, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight } : 'null');
    if (!img) {
      console.log('[StandingsImageImport] No image ref, returning early');
      return;
    }
    console.log('[StandingsImageImport] Starting OCR process');
    setIsProcessing(true);
    setProgress(0);
    setOcrText("");
    setRows([]);

    // get preprocessed canvas
    console.log('[StandingsImageImport] Preprocessing image for OCR with mode:', preprocessingMode);
    const processed = preprocess(img, crop, 1600, preprocessingMode);
    console.log('[StandingsImageImport] Preprocessed canvas dimensions:', processed.width, 'x', processed.height);
    
    // Enhanced Tesseract configuration for better number recognition
    console.log('[StandingsImageImport] Starting Tesseract recognition');
    const { data } = await Tesseract.recognize(processed, "eng", {
      logger: (m) => {
        console.log('[StandingsImageImport] Tesseract progress:', m.status, m.progress);
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
    console.log('[StandingsImageImport] OCR completed, text length:', text.length);
    console.log('[StandingsImageImport] OCR text:', text);
    setOcrText(text);
    
    console.log('[StandingsImageImport] Parsing standings text');
    const parsed = parseStandingsText(text);
    console.log('[StandingsImageImport] Parsed rows:', parsed);
    setRows(parsed);
    setIsProcessing(false);
  };

  const importRows = () => {
    console.log('[StandingsImageImport] importRows called with rows:', rows);
    if (!rows.length) {
      console.log('[StandingsImageImport] No rows to import, returning early');
      return;
    }
    console.log('[StandingsImageImport] Mapping rows to match records');
    
    const mapped: Omit<MatchRecord, "id" | "dateISO" | "deckId">[] = [];
    
    rows.forEach(r => {
      // Parse record like "2-3-0" into individual matches
      if (r.record) {
        const [wins, losses, draws] = r.record.split('-').map(Number);
        console.log('[StandingsImageImport] Parsing record:', r.record, '->', { wins, losses, draws });
        
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
    
    console.log('[StandingsImageImport] Mapped records:', mapped);
    console.log('[StandingsImageImport] Calling bulkAdd');
    if (typeof bulkAdd !== 'function') {
      console.error('[StandingsImageImport] bulkAdd is not a function:', bulkAdd);
      return;
    }
    const added = bulkAdd(mapped);
    console.log('[StandingsImageImport] bulkAdd completed, added:', added, 'records');
    
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
          <h3 className="text-lg font-semibold">Import Standings from Image{deckName ? ` — ${deckName}` : ""}</h3>
          <p className="text-sm text-gray-600">Upload a screenshot/photo of the STANDINGS table. Enhanced preprocessing handles colored text and numbers better. OCR runs automatically when the image loads.</p>
        </div>
        <div className="text-sm text-gray-500">Current entries: {count}</div>
      </div>

      {/* Drop zone / picker */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-gray-50"
      >
        <input
          key={file ? 'has-file' : 'no-file'}
          type="file"
          accept="image/*"
          onChange={e => {
            console.log('[StandingsImageImport] File input onChange triggered');
            const f = e.target.files?.[0];
            console.log('[StandingsImageImport] Selected file:', f ? { name: f.name, type: f.type, size: f.size } : 'none');
            if (f && f.type.startsWith("image/")) {
              console.log('[StandingsImageImport] Setting file state');
              setFile(f);
              setIsProcessing(false);
              setOcrText("");
              setRows([]);
              setShowImportButton(false); // Will be set to true in useEffect when file is processed
            } else if (f) {
              console.log('[StandingsImageImport] File rejected - not an image:', f.type);
            } else {
              console.log('[StandingsImageImport] No file selected (input cleared)');
            }
          }}
          className="hidden"
          id="standings-file"
        />
        <label htmlFor="standings-file" className="cursor-pointer block">
          {file ? <strong>{file.name}</strong> : "Drag & drop an image here, or click to choose a file"}
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
            />
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="flex flex-col">
                <span className="text-gray-600">Crop top ({crop.top}%)</span>
                <input 
                  type="range" 
                  min={0} 
                  max={40} 
                  value={crop.top}
                  onChange={e => setCrop(c => ({ ...c, top: Number(e.target.value) }))}
                />
              </label>
              <label className="flex flex-col">
                <span className="text-gray-600">Crop bottom ({crop.bottom}%)</span>
                <input 
                  type="range" 
                  min={0} 
                  max={40} 
                  value={crop.bottom}
                  onChange={e => setCrop(c => ({ ...c, bottom: Number(e.target.value) }))}
                />
              </label>
              <label className="flex flex-col">
                <span className="text-gray-600">Crop left ({crop.left}%)</span>
                <input 
                  type="range" 
                  min={0} 
                  max={40} 
                  value={crop.left}
                  onChange={e => setCrop(c => ({ ...c, left: Number(e.target.value) }))}
                />
              </label>
              <label className="flex flex-col">
                <span className="text-gray-600">Crop right ({crop.right}%)</span>
                <input 
                  type="range" 
                  min={0} 
                  max={40} 
                  value={crop.right}
                  onChange={e => setCrop(c => ({ ...c, right: Number(e.target.value) }))}
                />
              </label>
            </div>
            
            {/* Preprocessing Mode Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600">Preprocessing Mode:</label>
              <select
                value={preprocessingMode}
                onChange={e => setPreprocessingMode(e.target.value as 'auto' | 'high-contrast' | 'colored-text')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="auto">Auto (Recommended)</option>
                <option value="colored-text">Colored Text (for colored numbers/backgrounds)</option>
                <option value="high-contrast">High Contrast (for dark text on light backgrounds)</option>
              </select>
              <p className="text-xs text-gray-500">
                {preprocessingMode === 'colored-text' && "Best for colored numbers on colored backgrounds"}
                {preprocessingMode === 'high-contrast' && "Best for dark text on light backgrounds"}
                {preprocessingMode === 'auto' && "Automatically detects and adjusts for different image types"}
              </p>
            </div>
            
            {!!progress && progress < 100 && <div className="text-sm text-gray-600">Recognizing… {progress}%</div>}
          </div>

          <div className="space-y-2">
            <div className="text-sm text-gray-600">Preprocessed Preview</div>
            <canvas ref={canvasRef} className="w-full border rounded" />
          </div>
        </div>
      )}

      {/* OCR text + parsed table */}
      {ocrText && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Recognized Text (editable)</div>
            <textarea
              className="w-full h-48 border rounded p-2 font-mono"
              value={ocrText}
              onChange={e => {
                setOcrText(e.target.value);
                setRows(parseStandingsText(e.target.value));
              }}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Parsed Rows</div>
              {console.log('[StandingsImageImport] Rendering button section - showImportButton:', showImportButton, 'rows.length:', rows.length)}
              {showImportButton && (
                <button
                  onClick={importRows}
                  disabled={!rows.length}
                  className={`px-3 py-1.5 rounded border ${rows.length ? "bg-black text-white" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
                >
                  Import {rows.length} row(s) to deck
                </button>
              )}
            </div>
            <div className="overflow-auto border rounded">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-2 py-1">Rank</th>
                    <th className="text-left px-2 py-1">Player</th>
                    <th className="text-left px-2 py-1">Points</th>
                    <th className="text-left px-2 py-1">Record</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">{r.rank}</td>
                      <td className="px-2 py-1">{r.player}</td>
                      <td className="px-2 py-1">{r.points ?? ""}</td>
                      <td className="px-2 py-1">{r.record ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-600">
              Tip: For best accuracy, upload a crisp screenshot of the standings area (not a zoomed-out full page). Use the crop sliders to isolate the table.
            </p>
          </div>
        </div>
      )}

      {/* Stored Match Records Display */}
      {records.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold">Stored Match Records ({records.length})</h4>
            <button
              onClick={() => {
                if (confirm('Clear all stored match records for this deck?')) {
                  persist([]);
                }
              }}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
            >
              Clear All
            </button>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
            <div className="space-y-2">
              {records.map((record, index) => (
                <div key={record.id} className="bg-white p-3 rounded border">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        Round {record.round}: vs {record.opponent}
                      </div>
                      <div className="text-sm text-gray-600">
                        Result: {record.result} • {record.notes}
                      </div>
                      <div className="text-xs text-gray-500">
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
                      className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="text-xs text-gray-500">
            💡 Tip: Match records are stored in localStorage and persist between sessions. 
            You can edit the opponent name and notes by clicking on them after importing.
          </div>
        </div>
      )}
    </div>
  );
}