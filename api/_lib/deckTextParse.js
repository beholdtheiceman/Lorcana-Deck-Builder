// api/_lib/deckTextParse.js
// Server-side re-export. The canonical, client-safe implementation lives at
// src/lib/deckTextParse.js so browser tools can import it without Vite's dev
// proxy intercepting a request under /api. Server code and tests keep importing
// from this path unchanged.

export { parseDeckText, MAX_DECK_TEXT_CHARS, MAX_DECK_TEXT_LINES } from "../../src/lib/deckTextParse.js";
