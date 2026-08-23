import { describe, expect, it } from "vitest";
import { pointsFor, scoreChecks, scoreLabel } from "../src/engine/scoring.ts";
import type { Check, CheckResult, ScoredCheck } from "../src/types.ts";

function check(partial: Partial<Check> & Pick<Check, "id" | "severity">): Check {
  return {
    title: partial.id,
    category: "reliability",
    provenance: "HTTP",
    applicability: () => ({ applicable: true }),
    run: () => ({ status: "pass", summary: "", evidence: [] }),
    ...partial,
  };
}

function scored(c: Check, result: CheckResult): ScoredCheck {
  const pts = pointsFor(c, result);
  return { check: c, applicability: { applicable: result.status !== "na" }, result, ...pts };
}

describe("scoring", () => {
  it("excludes N/A checks from the denominator", () => {
    const items = [
      scored(check({ id: "a", severity: "required" }), { status: "pass", summary: "", evidence: [] }),
      scored(check({ id: "b", severity: "required" }), { status: "na", summary: "No writes", evidence: [] }),
    ];
    const card = scoreChecks(items);
    expect(card.overall).toBe(100);
    expect(card.na).toBe(1);
  });

  it("does not let emerging failures reduce the score", () => {
    const items = [
      scored(check({ id: "a", severity: "required" }), { status: "pass", summary: "", evidence: [] }),
      scored(check({ id: "b", severity: "emerging" }), { status: "fail", summary: "", evidence: [] }),
    ];
    expect(scoreChecks(items).overall).toBe(100);
  });

  it("caps overall at 100 even with bonus points", () => {
    const items = [
      scored(check({ id: "a", severity: "required" }), { status: "pass", summary: "", evidence: [] }),
      scored(check({ id: "b", severity: "bonus" }), { status: "pass", summary: "", evidence: [] }),
    ];
    expect(scoreChecks(items).overall).toBe(100);
  });

  it("does not let bonus points erase a warning", () => {
    const items = [
      scored(check({ id: "a", severity: "required" }), { status: "warning", summary: "", evidence: [] }),
      scored(check({ id: "b", severity: "bonus" }), { status: "pass", summary: "", evidence: [] }),
    ];
    expect(scoreChecks(items).overall).toBe(60);
  });

  it("gives warnings partial credit", () => {
    const c = check({ id: "a", severity: "required" });
    const pts = pointsFor(c, { status: "warning", summary: "", evidence: [] });
    expect(pts.available).toBe(10);
    expect(pts.earned).toBe(6);
  });

  it("keeps delegated reasoning out of deterministic surface readiness", () => {
    const items = [
      scored(check({ id: "http", severity: "required", provenance: "HTTP" }), { status: "pass", summary: "", evidence: [] }),
      scored(check({ id: "entity", severity: "required", provenance: "STATIC" }), {
        status: "warning",
        summary: "Needs bounded entity reasoning",
        evidence: [],
        reasoningTask: {
          taskVersion: "1",
          id: "entity-identification",
          type: "reasoning",
          title: "Entity identification",
          instructions: "Use evidence.",
          evidence: {},
          outputSchema: {},
          status: "pending",
        },
      }),
    ];
    const card = scoreChecks(items);
    expect(card.overall).toBe(80);
    expect(card.surface).toBe(100);
  });

  it("labels scores", () => {
    expect(scoreLabel(94)).toBe("Excellent");
    expect(scoreLabel(null)).toBe("N/A");
  });
});
