import { describe, it, expect } from "vitest";
import { summarizeSync } from "../../api/_lib/metaSync.js";

describe("summarizeSync", () => {
  it("reports ok when every queue synced", () => {
    const s = summarizeSync([
      { queue: "core-bo1", ok: true },
      { queue: "core-bo3", ok: true },
    ]);
    expect(s).toEqual({ ok: true, failedQueues: [], syncedCount: 2 });
  });

  it("reports not-ok and names the queue when one fails", () => {
    const s = summarizeSync([
      { queue: "core-bo1", ok: true },
      { queue: "core-bo3", ok: false, error: "duels.ink returned 503" },
    ]);
    expect(s.ok).toBe(false);
    expect(s.failedQueues).toEqual(["core-bo3"]);
    expect(s.syncedCount).toBe(1);
  });

  it("reports not-ok when every queue fails", () => {
    const s = summarizeSync([
      { queue: "core-bo1", ok: false },
      { queue: "core-bo3", ok: false },
    ]);
    expect(s.ok).toBe(false);
    expect(s.failedQueues).toEqual(["core-bo1", "core-bo3"]);
    expect(s.syncedCount).toBe(0);
  });

  // A skipped queue (already-approved snapshot) is a success, not a failure.
  it("treats a skipped queue as synced", () => {
    const s = summarizeSync([{ queue: "core-bo1", ok: true, skipped: true }]);
    expect(s.ok).toBe(true);
    expect(s.syncedCount).toBe(1);
  });
});
