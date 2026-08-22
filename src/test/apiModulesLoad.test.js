import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Smoke test: every serverless module must at least PARSE and LOAD.
 *
 * Added after a one-character edit left an unterminated string literal in
 * api/_lib/agent.js. The whole suite stayed green — 238 passing — because no
 * test imported that file, and the break only surfaced in production as
 * "Unexpected token 'A', \"A server e\"... is not valid JSON": Vercel's HTML
 * error page being JSON-parsed by the client after the function failed to boot.
 *
 * Importing a module is not the same as testing its behaviour, but a syntax
 * error should never again reach a deploy with a green suite.
 */

const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(here, "../../api");

function jsFilesUnder(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...jsFilesUnder(full));
    else if (entry.endsWith(".js")) out.push(full);
  }
  return out;
}

const files = jsFilesUnder(apiRoot);

describe("api modules load", () => {
  it("finds the serverless modules", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((f) => [f.slice(apiRoot.length + 1).replace(/\\/g, "/"), f]))(
    "api/%s parses and loads",
    async (_name, full) => {
      await expect(import(pathToFileURL(full).href)).resolves.toBeTruthy();
    },
  );
});
