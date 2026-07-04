// api/_lib/deckTextParse.js
// Permissive parser for pasted deck lists ("4 Card Name" / "4x Card Name",
// one card per line — the common Dreamborn/inktable export shape). Pure
// text → {name, count} pairs; resolving names against the card oracle is
// deckContext.summarizeNamedCards' job. Count-less lines are passed through
// flagged `implicit` so the resolver can drop them (section headers) unless
// they happen to be a real card name.

export const MAX_DECK_TEXT_CHARS = 5000;
export const MAX_DECK_TEXT_LINES = 120;
const MAX_COPIES = 60; // sanity bound per line, not a legality check

const LINE_RE = /^(\d{1,2})\s*[xX]?\s+(.+)$/;

/**
 * @param {string} text
 * @returns {{pairs: Array<{name:string, count:number, implicit?:boolean}>, error?: string}}
 */
export function parseDeckText(text) {
  const raw = String(text ?? "");
  if (raw.length > MAX_DECK_TEXT_CHARS) {
    return { pairs: [], error: `Deck list is too long (max ${MAX_DECK_TEXT_CHARS} characters).` };
  }
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { pairs: [], error: "Deck list is empty." };
  if (lines.length > MAX_DECK_TEXT_LINES) {
    return { pairs: [], error: `Deck list has too many lines (max ${MAX_DECK_TEXT_LINES}).` };
  }

  const pairs = [];
  for (const line of lines) {
    const m = line.match(LINE_RE);
    const count = m ? parseInt(m[1], 10) : NaN;
    if (m && count >= 1 && count <= MAX_COPIES) {
      pairs.push({ name: m[2].trim(), count });
    } else {
      // No leading count (or a nonsense one): could be a section header or a
      // bare card name — let the resolver decide, at count 1.
      pairs.push({ name: line, count: 1, implicit: true });
    }
  }
  return { pairs };
}
