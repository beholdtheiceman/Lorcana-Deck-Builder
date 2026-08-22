import { describe, it, expect } from "vitest";
import { normalizePairKey, orientMatchups } from "../../api/meta/pair.js";

describe("normalizePairKey", () => {
  it("lowercases and sorts", () => {
    expect(normalizePairKey("Emerald/Amber")).toBe("amber/emerald");
    expect(normalizePairKey("amber/emerald")).toBe("amber/emerald");
  });
});

describe("orientMatchups", () => {
  // Stored once, keys sorted, winRate is always side A's.
  const rows = [
    { keyA: "amber/amethyst", keyB: "amber/emerald", games: 39096, winRate: 47.94, firstPlayerWinRate: 57.5 },
    { keyA: "amber/emerald", keyB: "amber/ruby", games: 35110, winRate: 58.25, firstPlayerWinRate: 63.02 },
    { keyA: "amber/emerald", keyB: "amber/emerald", games: 41533, winRate: 49.47, firstPlayerWinRate: 57.6 },
    { keyA: "amethyst/ruby", keyB: "ruby/steel", games: 900, winRate: 51, firstPlayerWinRate: 55 },
  ];

  it("keeps win rate as-is when the pair is already side A", () => {
    const m = orientMatchups(rows, "amber/emerald").find((x) => x.opponent === "amber/ruby");
    expect(m.winRate).toBe(58.25);
    expect(m.firstPlayerWinRate).toBe(63.02);
  });

  // The bug this whole function exists to prevent.
  it("inverts win rate when the pair is stored as side B", () => {
    const m = orientMatchups(rows, "amber/emerald").find((x) => x.opponent === "amber/amethyst");
    expect(m.winRate).toBe(52.06); // 100 - 47.94, NOT 47.94
  });

  it("drops firstPlayerWinRate on inverted rows rather than guessing", () => {
    const m = orientMatchups(rows, "amber/emerald").find((x) => x.opponent === "amber/amethyst");
    expect(m.firstPlayerWinRate).toBeNull();
  });

  it("flags the mirror and does not invert it", () => {
    const m = orientMatchups(rows, "amber/emerald").filter((x) => x.mirror);
    expect(m).toHaveLength(1);
    expect(m[0].winRate).toBe(49.47);
  });

  it("excludes rows the pair does not appear in", () => {
    const out = orientMatchups(rows, "amber/emerald");
    expect(out.map((m) => m.opponent)).not.toContain("ruby/steel");
    expect(out).toHaveLength(3);
  });

  it("sorts best matchup first", () => {
    const out = orientMatchups(rows, "amber/emerald");
    expect(out[0].winRate).toBeGreaterThanOrEqual(out[out.length - 1].winRate);
  });
});
