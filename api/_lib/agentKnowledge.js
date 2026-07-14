// api/_lib/agentKnowledge.js
//
// Read-only accessor for the Lorcana strategy knowledge base under
// src/data/agent-knowledge/. These files mirror the Console "lorcana-knowledge"
// Skill; the app's tool-use loop (agent.js) and the review path (reviewLlm.js)
// both need to open them at runtime, so the whitelist + safe reader live here
// as the single source of truth.
//
// The coach system prompt (coachPrompt.js) repeatedly tells the model to
// "read matchup-guide.md", "read role-theory.md FIRST", etc. Without a tool
// that actually opens these files the model can't follow those instructions and
// silently falls back to stale training memory — this module + the
// list_knowledge/read_knowledge tools in agentTools.js close that gap.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = join(__dirname, "../../src/data/agent-knowledge");

// Per-file cap so a runaway file can't blow up an LLM context. Callers that
// feed a read into the agent loop must keep MAX_TOOL_RESULT_CHARS >= this so a
// single read isn't truncated mid-file.
export const KNOWLEDGE_FILE_CAP = 14000;

// Whitelist + "when to read" routing, mirroring the mode selection in
// SKILL-UPDATE.md. This is the ONLY set of files readable through this module;
// anything else (or a path-traversal attempt) is rejected.
export const KNOWLEDGE_INDEX = [
  {
    file: "meta-archetypes.md",
    title: "Meta Archetypes",
    when: "Meta analysis, 'what's good right now', current Tier 1–3 landscape, key cards per archetype.",
  },
  {
    file: "matchup-guide.md",
    title: "Matchup Guide",
    when: "Matchup breakdowns ('how do I beat X'), Favored/Even/Unfavored reads, primers, mulligan guidance.",
  },
  {
    file: "role-theory.md",
    title: "Role Theory",
    when: "Read FIRST for any gameplay/sequencing question — determines who is the beatdown vs control.",
  },
  {
    file: "synergy-theory.md",
    title: "Synergy Theory",
    when: "Understanding a deck's engine: the five synergy types, core loop, order of operations, reading unknown decks.",
  },
  {
    file: "archetype-playbooks.md",
    title: "Archetype Playbooks",
    when: "Turn-by-turn thinking for each Tier 1 archetype — how a specific deck actually wants to play.",
  },
  {
    file: "game-state-evaluation.md",
    title: "Game State Evaluation",
    when: "Reading a board state: who's ahead and what kind of ahead, types of advantage, threat priority.",
  },
  {
    file: "gameplay-heuristics.md",
    title: "Gameplay Heuristics",
    when: "Specific in-game decisions: quest vs. challenge, ink management, curve principles.",
  },
  {
    file: "tech-cards.md",
    title: "Tech Cards Reference",
    when: "Tech recommendations — situational includes filtered by threat type and ink color.",
  },
  {
    file: "set-changelog.md",
    title: "Set Changelog",
    when: "Meta history by set and format notes — what each set changed.",
  },
];

const ALLOWED = new Set(KNOWLEDGE_INDEX.map((e) => e.file));

/** Return the knowledge index (filenames + when to read each) for the model to choose from. */
export function listKnowledge() {
  return { files: KNOWLEDGE_INDEX.map(({ file, title, when }) => ({ file, title, when })) };
}

/**
 * Concatenate several whitelisted knowledge files into one labeled block,
 * bounded by a combined character cap. Unknown/missing files are skipped (not
 * thrown). Used by the tool-less review path to inject strategy frameworks and
 * the auto-primer to ground its output — the single loader both share.
 * @param {string[]} files   ordered filenames from KNOWLEDGE_INDEX
 * @param {{ totalCap?: number }} [opts]
 * @returns {string}  e.g. "\n\n=== role-theory.md ===\n<content>…"
 */
export function buildKnowledgeBundle(files, { totalCap = 40000 } = {}) {
  let out = "";
  for (const file of files ?? []) {
    if (out.length >= totalCap) break;
    const res = readKnowledge(file);
    if (res.error) continue; // absent / not whitelisted in this environment — skip it
    const remaining = totalCap - out.length;
    out += `\n\n=== ${file} ===\n${res.content.slice(0, remaining)}`;
  }
  return out;
}

/**
 * Read one whitelisted knowledge file. Never throws: unknown files, traversal
 * attempts, and missing files all come back as `{ error }` so the caller can
 * relay it instead of crashing the request.
 * @param {string} file  a bare filename from KNOWLEDGE_INDEX (e.g. "matchup-guide.md")
 * @returns {{ file: string, content: string } | { error: string }}
 */
export function readKnowledge(file) {
  if (!file || typeof file !== "string") return { error: "file is required" };
  // Reject anything that isn't a plain filename in the whitelist — this also
  // defeats "../coachPrompt.js" style traversal since basename strips the path
  // and the result still has to be in ALLOWED.
  const name = basename(file);
  if (name !== file || !ALLOWED.has(name)) {
    const available = KNOWLEDGE_INDEX.map((e) => e.file).join(", ");
    return { error: `Unknown knowledge file "${file}". Available files: ${available}.` };
  }
  try {
    const text = readFileSync(join(KNOWLEDGE_DIR, name), "utf8");
    return { file: name, content: text.slice(0, KNOWLEDGE_FILE_CAP) };
  } catch {
    return { error: `Knowledge file "${name}" is not available in this environment.` };
  }
}
