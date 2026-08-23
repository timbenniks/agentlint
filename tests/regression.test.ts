import { describe, expect, it } from "vitest";
import { compareBaseline, createBaseline } from "../src/engine/regression.ts";
import type { ScanReport } from "../src/types.ts";

function report(): ScanReport {
  return {
    schemaVersion: "1", agentlintVersion: "test", scanId: "x",
    target: { inputUrl: "https://example.com", origin: "https://example.com", finalUrl: "https://example.com" },
    startedAt: "", completedAt: "",
    score: { overall: 90, surface: 95, taskSuccess: 80, categories: [], passed: 1, warnings: 0, failed: 0, na: 0, label: "Excellent" },
    capabilities: { api: { hasReads: false, hasWrites: false, hasDelete: false, hasCollections: false, hasPagination: false, hasLongRunningOperations: false, hasAuthenticatedOperations: false, hasBulkOperations: false }, hasOpenApi: false, hasBrowser: false, hasLlmsTxt: false, hasDeveloperPortal: false, jsRequired: false },
    categories: [],
    checks: [{ id: "a", title: "a", category: "access", provenance: "HTTP", severity: "required", status: "pass", score: 10, maxScore: 10, summary: "", evidence: [] }],
    reasoningTasks: [], journeys: [],
  };
}

describe("regression baselines", () => {
  it("detects score and status regressions", () => {
    const before = createBaseline(report());
    const after = report();
    after.score.surface = 90;
    after.checks[0]!.status = "warning";
    const result = compareBaseline(before, after);
    expect(result.passed).toBe(false);
    expect(result.regressions).toContain("surface score: 95 -> 90");
    expect(result.regressions).toContain("a: pass -> warning");
  });
});
