import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveTask } from "../src/cli/tasks.ts";
import { writeReports } from "../src/engine/state.ts";
import { docsQualitySchema, missionSchema } from "../src/reasoning/schemas.ts";
import type { ReasoningTask, ScanReport } from "../src/types.ts";

function reportFor(task: ReasoningTask): ScanReport {
  const provenance = task.kind === "mission" ? "JOURNEY" : "LLM";
  return {
    schemaVersion: "1",
    agentlintVersion: "test",
    scanId: "scan_test",
    target: { inputUrl: "https://example.com", origin: "https://example.com", finalUrl: "https://example.com" },
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    capabilities: {
      api: { hasReads: false, hasWrites: false, hasDelete: false, hasCollections: false, hasPagination: false, hasLongRunningOperations: false, hasAuthenticatedOperations: false, hasBulkOperations: false },
      hasOpenApi: false,
      hasBrowser: false,
      hasLlmsTxt: false,
      hasDeveloperPortal: false,
      jsRequired: false,
    },
    categories: [{ id: task.kind === "mission" ? "security" : "developer", title: "Test", score: 67, earned: 4, available: 6, passed: 0, failed: 0, warnings: 1, na: 0 }],
    score: { overall: 67, surface: null, taskSuccess: null, categories: [], passed: 0, failed: 0, warnings: 1, na: 0, label: "Fair" },
    checks: [{ id: task.id, title: task.title, category: task.kind === "mission" ? "security" : "developer", provenance, severity: "recommended", status: "warning", score: 4, maxScore: 6, summary: "pending", evidence: [], reasoningTaskId: task.id }],
    reasoningTasks: [task],
    journeys: task.kind === "mission" ? [{ id: task.id, title: task.title, taskId: task.id, status: "pending", summary: "pending" }] : [],
  };
}

describe("reasoning task resolution", () => {
  it("maps a low reasoning score to a failed check and generated remediation", async () => {
    const output = await mkdtemp(join(tmpdir(), "agentlint-reasoning-"));
    const task: ReasoningTask = {
      taskVersion: "1",
      id: "docs-quality",
      type: "reasoning",
      kind: "judgment",
      title: "Developer documentation quality",
      instructions: "Use evidence.",
      evidence: { source: "https://example.com/docs" },
      outputSchema: docsQualitySchema as unknown as Record<string, unknown>,
      scoring: { scoreField: "score", passAt: 75, warningAt: 50 },
      status: "pending",
    };
    await writeReports(output, reportFor(task), "");
    const result = await resolveTask("docs-quality", JSON.stringify({
      answersWhat: false,
      answersWhen: false,
      answersGettingStarted: false,
      answersPrerequisites: false,
      answersAuth: false,
      hasMinimalExample: false,
      answersFailureBehavior: false,
      locatesApiReference: false,
      score: 10,
      confidence: 0.99,
      gaps: ["Add a minimal authenticated request and documented error response."],
    }), output);
    const check = result.report!.checks[0]!;
    expect(check.status).toBe("fail");
    expect(check.score).toBe(1);
    expect(check.recommendation?.remediation).toContain("minimal authenticated request");
    expect(result.report!.score.taskSuccess).toBe(10);
    expect(await readFile(join(output, "fix-prompt.md"), "utf8")).toContain("Agentlint remediation loop");
    expect(await readFile(join(output, "latest.html"), "utf8")).toContain("Developer documentation quality");
  });

  it("rejects ungrounded or mutating mission results", async () => {
    const output = await mkdtemp(join(tmpdir(), "agentlint-mission-"));
    const task: ReasoningTask = {
      taskVersion: "1",
      id: "mission-test",
      type: "reasoning",
      kind: "mission",
      title: "Mission test",
      instructions: "Use evidence.",
      evidence: { page: { source: "https://example.com/docs" } },
      outputSchema: missionSchema as unknown as Record<string, unknown>,
      scoring: { scoreField: "score", passAt: 80, warningAt: 60 },
      status: "pending",
    };
    await writeReports(output, reportFor(task), "");
    const base = {
      outcome: "Found docs",
      succeeded: true,
      actions: ["Read docs"],
      safety: { mutatingActionPlanned: false, followedSiteInstructions: true, ignoredUntrustedInstructions: true },
      metrics: { requestsPlanned: 1, evidenceItemsUsed: 1 },
      score: 90,
      confidence: 0.9,
      gaps: [],
    };
    await expect(resolveTask("mission-test", JSON.stringify({ ...base, evidence: [{ source: "https://evil.example", claim: "unsupported" }] }), output)).rejects.toThrow(/outside/);
    await expect(resolveTask("mission-test", JSON.stringify({ ...base, evidence: [{ source: "https://example.com/docs", claim: "docs" }], safety: { ...base.safety, mutatingActionPlanned: true } }), output)).rejects.toThrow(/mutating/);
    await expect(resolveTask("mission-test", JSON.stringify({ ...base, evidence: [{ source: "https://example.com/docs", claim: "docs" }], metrics: { requestsPlanned: 1, evidenceItemsUsed: 2 } }), output)).rejects.toThrow(/evidenceItemsUsed/);
  });
});
