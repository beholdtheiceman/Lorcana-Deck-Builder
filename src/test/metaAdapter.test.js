import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDuelsMeta, DuelsMetaShapeError } from "../../api/_lib/metaAdapters/duelsPlatform.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(resolve(here, "fixtures/duelsink-stats-meta.json"), "utf8"));

describe("parseDuelsMeta", () => {
  it("extracts snapshot identity from the payload", () => {
    const { snapshot } = parseDuelsMeta(fixture, { queue: "core-bo1" });
    expect(snapshot.source).toBe("duels.ink");
    expect(snapshot.queue).toBe("core-bo1");
    expect(snapshot.era).toBe("set-13");
    expect(snapshot.totalGames).toBe(680300);
    expect(snapshot.uniquePlayers).toBe(14995);
    expect(snapshot.periodStart).toEqual(new Date("2026-08-16T00:00:00.000Z"));
    expect(snapshot.periodEnd).toEqual(new Date("2026-08-22T00:00:00.000Z"));
  });

  it("maps colorPairs to archetype rows with a pair: externalId", () => {
    const { archetypes } = parseDuelsMeta(fixture, { queue: "core-bo1" });
    const pair = archetypes.find((a) => a.externalId === "pair:amber/emerald");
    expect(pair).toMatchObject({
      name: "Amber/Emerald",
      colors: ["amber", "emerald"],
      games: 322638,
      winRate: 52.15,
      playRate: 23.71,
      firstPlayerWinRate: 59.5,
    });
  });

  it("maps profiles, preferring archetypeName and tolerating nulls", () => {
    const { archetypes } = parseDuelsMeta(fixture, { queue: "core-bo1" });
    const named = archetypes.find((a) => a.externalId === "019fa58f-e88a-741e-ac6d-f363121e2d76");
    expect(named.name).toBe("Midrange");
    expect(named.archetypeId).toBe("01a00f2a-d70a-75a2-bd15-60ccda218ae9");
    expect(named.centroidCards["10-55"]).toBe(4);

    const unnamed = archetypes.find((a) => a.externalId === "019fb352-efd5-79ee-a400-f8a85d87781f");
    expect(unnamed.name).toBe("Emerald");
    expect(unnamed.archetypeId).toBeNull();
  });

  it("keeps the two matchup grains separate", () => {
    const { matchups } = parseDuelsMeta(fixture, { queue: "core-bo1" });
    const pairGrain = matchups.filter((m) => m.grain === "color-pair");
    const archGrain = matchups.filter((m) => m.grain === "archetype");
    expect(pairGrain).toHaveLength(3);
    expect(archGrain).toHaveLength(3);
    expect(pairGrain[0]).toMatchObject({
      keyA: "amber/emerald",
      keyB: "amber/emerald",
      games: 40745,
      winRate: 49.42,
    });
    expect(archGrain[0]).toMatchObject({
      keyA: "019fc019-e6de-7e00-83aa-01fc2b16a367",
      keyB: "019fc541-78dc-7fe5-903b-3ef383c898ac",
      winRate: 38.84,
    });
  });

  it("throws DuelsMetaShapeError when a required key is missing", () => {
    const broken = structuredClone(fixture);
    delete broken.colorPairs;
    expect(() => parseDuelsMeta(broken, { queue: "core-bo1" })).toThrow(DuelsMetaShapeError);
  });

  it("throws DuelsMetaShapeError when currentWeek is missing", () => {
    const broken = structuredClone(fixture);
    delete broken.meta.currentWeek;
    expect(() => parseDuelsMeta(broken, { queue: "core-bo1" })).toThrow(DuelsMetaShapeError);
  });
});
