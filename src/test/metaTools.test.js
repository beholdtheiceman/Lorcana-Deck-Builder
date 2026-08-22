import { describe, it, expect } from "vitest";
import { TOOL_SPECS } from "../../api/_lib/agentTools.js";

describe("get_current_meta tool spec", () => {
  const spec = TOOL_SPECS.find((t) => t.name === "get_current_meta");

  it("is registered", () => {
    expect(spec).toBeDefined();
  });

  it("is not hub-scoped", () => {
    expect(spec.input_schema.required ?? []).not.toContain("hubId");
  });

  it("tells the agent to prefer it over the static knowledge files", () => {
    expect(spec.description).toMatch(/agent-knowledge|knowledge file/i);
    expect(spec.description).toMatch(/date|as of/i);
  });
});

// Regression: the agent answered "top performing deck last week" by asking which
// HUB the user meant, because team_stats' description claimed the phrase "top
// performing decks" and nothing routed general questions to the live meta.
describe("meta vs hub-scoped routing", () => {
  const spec = (n) => TOOL_SPECS.find((t) => t.name === n);

  it("team_stats does not claim general 'top performing' questions", () => {
    expect(spec("team_stats").description).not.toMatch(/top performing decks'/i);
  });

  it("team_stats points general meta questions at get_current_meta", () => {
    expect(spec("team_stats").description).toMatch(/get_current_meta/);
  });

  it("list_my_hubs tells the agent not to ask which hub for general questions", () => {
    expect(spec("list_my_hubs").description).toMatch(/get_current_meta/);
  });

  it("get_current_meta claims the phrasings users actually type", () => {
    const d = spec("get_current_meta").description;
    expect(d).toMatch(/top performing/i);
    expect(d).toMatch(/last week/i);
  });
});
