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
const keyForDeck = (deckId: string) => `ldb:results:${deckId}`;
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
  
  const bulkAdd = (rows: Omit<MatchRecord, "id" | "dateISO" | "deckId">[]) => {
    const stamped = rows.map(r => ({
      ...r, 
      id: uid(), 
      dateISO: new Date().toISOString(), 
      deckId
    }));
    persist([...stamped, ...records]);
    return stamped.length;
  };
  
  return { bulkAdd, count: records.length };
}

/** ===== Minimal image preprocessor (canvas) =====
 * Scales to target width, applies grayscale + simple threshold.
 * Optional crop via percentage sliders for better OCR signal.
 */
function preprocess(
  img: HTMLImageElement, 
  cropPct: CropSettings, 
  targetW: number = 1600
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

  // grayscale + threshold (simple, fast)
  // You can tweak THRESH if your screenshots are lighter/darker.
  const THRESH = 180;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const gray = (r * 0.299 + g * 0.587 + b * 0.114) | 0;
    const v = gray > THRESH ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = v; // binarize
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
      const record = cells[idx.record] ? String(cells[idx.record]).match(/\b\d+-\d+(?:-\d+)?\b/)?.[0] : undefined;
      return { rank, player, points, record };
    }).filter(r => r.rank && r.player);
  }

  // Case B: block text (e.g., "1st. Name\nPoints: 6\nRECORD 2-0-0")
  const blocks = t.split(/\n(?=\d+(?:st|nd|rd|th)\b)/i).filter(b => /\d+(?:st|nd|rd|th)\b/i.test(b));
  if (blocks.length) {
    return blocks.map(b => {
      const rank = Number((b.match(/(\d+)(?:st|nd|rd|th)\b/i)?.[1]) || 0;
      const lines = b.split("\n").map(s => s.trim()).filter(Boolean);
      const rankIdx = lines.findIndex(l => /(\d+)(?:st|nd|rd|th)\b/i.test(l));
      const player = (lines.slice(rankIdx + 1).find(l => !/points?:|record|status/i.test(l)) || "").replace(/\.$/, "");
      const points = b.match(/points?\s*:\s*([0-9]+)/i)?.[1];
      const record = b.match(/\b([0-9]+-[0-9]+(?:-[0-9]+)?)\b/)?.[1];
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
    const rank = Number(L.match(/^\s*(\d+)\b/)?.[1] || 0);
    const record = L.match(/\b(\d+-\d+(?:-\d+)?)\b/)?.[1];
    const points = L.match(/points?\s*:?\s*([0-9]+)/i)?.[1] ?? L.match(/\b([0-9]+)\s*pts?\b/i)?.[1];
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
}

export default function StandingsImageImport({
  deckId,
  deckName,
}: StandingsImageImportProps) {
  const { bulkAdd, count } = useDeckResults(deckId);

  const [file, setFile] = useState<File | undefined>();
  const [imgUrl, setImgUrl] = useState<string>("");
  const [crop, setCrop] = useState<CropSettings>({ top: 0, right: 0, bottom: 0, left: 0 });
  const [progress, setProgress] = useState<number>(0);
  const [ocrText, setOcrText] = useState<string>("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load preview URL
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Render preprocessed crop into canvas for visual feedback and auto-run OCR
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !img.complete) return;
    const c = preprocess(img, crop, 1600);
    const ctx = (canvasRef.current || (canvasRef.current = document.createElement("canvas"))).getContext("2d")!;
    const canvas = canvasRef.current!;
    canvas.width = c.width;
    canvas.height = c.height;
    ctx.drawImage(c, 0, 0);
    
    // Auto-run OCR when image is loaded and processed
    if (imgUrl && !ocrText) {
      doOCR();
    }
  }, [imgUrl, crop]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("image/")) setFile(f);
  };

  const doOCR = async () => {
    const img = imgRef.current;
    if (!img) return;
    setProgress(0);
    setOcrText("");
    setRows([]);

    // get preprocessed canvas
    const processed = preprocess(img, crop, 1600);
    // IMPORTANT: to keep everything local, consider self-hosting these paths:
    // Tesseract.recognize(processed, 'eng', { corePath:'/tess/core/tesseract-core.wasm.js', langPath:'/tess/lang' ... })
    const { data } = await Tesseract.recognize(processed, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text" && m.progress != null) {
          setProgress(Math.round(m.progress * 100));
        }
      },
    });
    const text = data.text || "";
    setOcrText(text);
    setRows(parseStandingsText(text));
  };

  const importRows = () => {
    if (!rows.length) return;
    const mapped: Omit<MatchRecord, "id" | "dateISO" | "deckId">[] = rows.map(r => ({
      result: "W", // unknown per-row; set default, user can edit later if needed
      round: r.rank, // treat 'rank' as round when importing player list? If your screenshot is a STANDINGS table, we can't infer W/L/D per match.
      opponent: r.player,
      notes: r.record ? `Record: ${r.record}${r.points != null ? `, Points: ${r.points}` : ""}` : (r.points != null ? `Points: ${r.points}` : undefined),
    }));
    // You can also open a confirm modal that maps standing rows to matches; here we just save notes.
    const added = bulkAdd(mapped);
    alert(`Imported ${added} rows into deck "${deckName || deckId}". You can edit/adjust inside Logged Matches.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Import Standings from Image{deckName ? ` — ${deckName}` : ""}</h3>
          <p className="text-sm text-gray-600">Upload a screenshot/photo of the STANDINGS table. OCR will run automatically when the image loads.</p>
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
          type="file"
          accept="image/*"
          onChange={e => setFile(e.target.files?.[0])}
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
              <button
                onClick={importRows}
                disabled={!rows.length}
                className={`px-3 py-1.5 rounded border ${rows.length ? "bg-black text-white" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
              >
                Import {rows.length} row(s) to deck
              </button>
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
    </div>
  );
}