// scripts/update-cards.test.mjs
// Regression test for a real production bug: Ravensburger's LorcanaJSON feed
// reuses a mainline expansion card's setCode+number for that set's promo /
// reprint cards too (distinguished only by fullIdentifier, e.g. "43/204" vs
// "43/P3"). buildMap() used to key purely by setCode-number with a bare
// overwrite, so whichever card happened to appear later in the source array
// silently dropped the other one from the oracle entirely — not just from
// id lookup, but from name lookup too, since cards.js's byName index is
// built from whatever survives in this map. Saved decks and Ask AI then
// reported the dropped card as "not found" even though it's an ordinary,
// real card (e.g. "Happy - Joyful Adventurer" and "Mrs. Incredible - Super
// Stretchy" both vanished this way in production).
//
// Note: which card keeps the *plain* id on collision is intentionally left
// as "last one seen wins", unchanged from before this fix — other code
// (src/test/deckContext.test.js) already documents/depends on that exact
// behavior for a different collision ("1-1" resolving to the Mickey Mouse
// promo rather than the mainline card sharing that number). This fix only
// ensures the displaced card is no longer dropped outright.
import { describe, it, expect } from "vitest";
import { buildMap } from "./update-cards.mjs";

describe("buildMap", () => {
  it("keeps both cards discoverable by name when a mainline card collides with a promo reprint", () => {
    const mainline = { id: 2758, setCode: "12", number: 43, fullName: "Happy - Joyful Adventurer", cost: 2 };
    const promo = {
      id: 2958,
      setCode: "12",
      number: 43,
      fullName: "Ariel - Curious Traveler",
      cost: 4,
      promoGrouping: "P3",
    };

    for (const order of [[mainline, promo], [promo, mainline]]) {
      const names = Object.values(buildMap(order)).map((c) => c.name);
      expect(names).toContain("Happy - Joyful Adventurer");
      expect(names).toContain("Ariel - Curious Traveler");
    }
  });

  it("keeps the plain id pointing at whichever card was seen last, unchanged from prior behavior", () => {
    const mainline = { id: 2758, setCode: "12", number: 43, fullName: "Happy - Joyful Adventurer", cost: 2 };
    const promo = {
      id: 2958,
      setCode: "12",
      number: 43,
      fullName: "Ariel - Curious Traveler",
      cost: 4,
      promoGrouping: "P3",
    };

    expect(buildMap([mainline, promo])["12-43"].name).toBe("Ariel - Curious Traveler");
    expect(buildMap([promo, mainline])["12-43"].name).toBe("Happy - Joyful Adventurer");
  });
});
