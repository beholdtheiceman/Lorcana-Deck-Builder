// api/_lib/anthropic.js
//
// Single source of truth for the Anthropic client and the shared token budgets.
// Previously every LLM entry point (agent loop, review JSON, primer, meta-report
// draft) constructed its own `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })`
// and re-declared its own `max_tokens = 6000` / `1500` literals, so the budgets
// could drift independently. Centralize the client and the magic numbers here.

import Anthropic from "@anthropic-ai/sdk";

let _client = null;

/**
 * Shared, module-memoized Anthropic client. Constructed exactly like every call
 * site used to construct it (`{ apiKey: process.env.ANTHROPIC_API_KEY }`), just
 * once per process instead of per request.
 * @returns {Anthropic}
 */
export function getAnthropicClient() {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

// Coach-quality generations (the "Ask AI" agent loop, the post-game review JSON,
// and meta-report drafts) all share this budget: a 60-card list with role notes
// + strategy + key cards easily runs 2–3k tokens, and adaptive thinking shares
// the same budget, so smaller caps truncated the output.
export const COACH_MAX_TOKENS = 6000;

// The fast, structured matchup-primer step (thinking-off, on the review's
// critical path) needs more than 800 for gameplan + must-kill + 3–6 key cards,
// but far less headroom than a full review.
export const PRIMER_MAX_TOKENS = 1500;
