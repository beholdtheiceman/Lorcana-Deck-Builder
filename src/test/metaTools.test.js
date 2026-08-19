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
