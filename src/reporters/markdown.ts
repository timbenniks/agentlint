import type { ScanReport } from "../types.ts";
import { CATEGORY_TITLES } from "../constants.ts";

export function renderMarkdown(report: ScanReport): string {
  const lines: string[] = [];
  lines.push(`# Agentlint report`);
  lines.push("");
  lines.push(`- Target: ${report.target.finalUrl}`);
  lines.push(`- Scan ID: \`${report.scanId}\``);
  lines.push(`- Started: ${report.startedAt}`);
  lines.push(`- Completed: ${report.completedAt}`);
  lines.push(`- Overall: **${report.score.overall ?? "N/A"}** (${report.score.label})`);
  lines.push(`- Surface readiness: **${report.score.surface ?? "N/A"}**`);
  lines.push(`- Bounded task success: **${report.score.taskSuccess ?? "Pending"}**`);
  lines.push("");
  lines.push(`## Scores`);
  lines.push("");
  lines.push(`| Category | Score | Passed | Warnings | Failed | N/A |`);
  lines.push(`| --- | --- | --- | --- | --- | --- |`);
  for (const cat of report.score.categories) {
    lines.push(
      `| ${cat.title} | ${cat.score ?? "N/A"} | ${cat.passed} | ${cat.warnings} | ${cat.failed} | ${cat.na} |`,
    );
  }
  lines.push("");

  for (const cat of report.score.categories) {
    lines.push(`## ${cat.title}`);
    lines.push("");
    for (const check of report.checks.filter((c) => c.category === cat.id)) {
      const badge = check.status.toUpperCase();
      lines.push(`### ${check.title}`);
      lines.push("");
      lines.push(`- Status: **${badge}**`);
      lines.push(`- Source: \`${check.provenance}\``);
      if (check.status !== "na") {
        lines.push(`- Score: ${check.score ?? 0} / ${check.maxScore ?? 0}`);
      }
      lines.push(`- ${check.summary}`);
      if (check.recommendation) {
        lines.push(`- Fix (${check.recommendation.priority}): ${check.recommendation.remediation}`);
      }
      if (check.evidence.length > 0) {
        lines.push("");
        lines.push("<details><summary>Evidence</summary>");
        lines.push("");
        lines.push("```json");
        lines.push(JSON.stringify(check.evidence, null, 2));
        lines.push("```");
        lines.push("");
        lines.push("</details>");
      }
      lines.push("");
    }
  }

  if (report.reasoningTasks.length) {
    lines.push(`## Reasoning tasks`);
    lines.push("");
    for (const task of report.reasoningTasks) {
      lines.push(`- \`${task.id}\` (${task.status})`);
    }
    lines.push("");
  }

  if (report.journeys.length) {
    lines.push(`## Bounded agent missions`);
    lines.push("");
    for (const journey of report.journeys) {
      lines.push(`- \`${journey.id}\`: **${journey.status.toUpperCase()}**${journey.score === undefined ? "" : ` (${journey.score}/100)`} — ${journey.summary}`);
    }
    lines.push("");
  }

  lines.push(`## Capabilities`);
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(report.capabilities, null, 2));
  lines.push("```");
  lines.push("");
  void CATEGORY_TITLES;
  return lines.join("\n");
}
