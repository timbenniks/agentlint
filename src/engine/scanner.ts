import { AGENTLINT_VERSION } from "../constants.ts";
import { allChecks } from "../checks/index.ts";
import { collectContext } from "./collector.ts";
import { runChecks, scoreChecks } from "./scoring.ts";
import { writeReports } from "./state.ts";
import { renderMarkdown } from "../reporters/markdown.ts";
import { renderRemediationPrompt } from "../reporters/prompt.ts";
import { missionChecks } from "../checks/missions.ts";
import type { AgentJourney, ReportCheck, ScanOptions, ScanReport, ScoredCheck } from "../types.ts";

export async function runScan(options: ScanOptions): Promise<{ report: ScanReport; scored: ScoredCheck[] }> {
  const context = await collectContext(options);
  const scored = await runChecks(context, options.missions ? [...allChecks, ...missionChecks] : allChecks);
  const score = scoreChecks(scored);

  const reasoningTasks = scored
    .map((s) => s.result.reasoningTask)
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .filter((task, index, all) => all.findIndex((t) => t.id === task.id) === index);

  const checks: ReportCheck[] = scored.map((s) => ({
    id: s.check.id,
    title: s.check.title,
    category: s.check.category,
    provenance: s.check.provenance,
    severity: s.check.severity,
    status: s.applicability.applicable ? s.result.status : "na",
    score: s.result.score,
    maxScore: s.result.maxScore,
    summary: s.result.summary,
    evidence: s.result.evidence,
    recommendation: s.result.recommendation,
    reasoningTaskId: s.result.reasoningTask?.id,
    naReason: s.applicability.applicable ? undefined : s.applicability.reason,
  }));

  const journeys: AgentJourney[] = reasoningTasks
    .filter((task) => task.kind === "mission")
    .map((task) => ({
      id: task.id,
      title: task.title,
      taskId: task.id,
      status: "pending",
      summary: "Awaiting evidence-only mission evaluation.",
    }));

  const report: ScanReport = {
    schemaVersion: "1",
    agentlintVersion: AGENTLINT_VERSION,
    scanId: context.scanId,
    target: context.target,
    startedAt: context.startedAt,
    completedAt: new Date().toISOString(),
    score,
    capabilities: context.capabilities,
    categories: score.categories,
    checks,
    reasoningTasks,
    journeys,
  };

  await writeReports(options.output, report, renderMarkdown(report), renderRemediationPrompt(report));
  return { report, scored };
}
