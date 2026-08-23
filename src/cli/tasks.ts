import Ajv from "ajv";
import { readLatestReport, readState, saveLatestReport } from "../engine/state.ts";
import { renderMarkdown } from "../reporters/markdown.ts";
import type { ReasoningTask, ScanReport } from "../types.ts";

const ajv = new Ajv({ allErrors: true, strict: false });

export async function listTasks(output = ".agentlint"): Promise<ReasoningTask[]> {
  const state = await readState(output);
  return state?.tasks ?? [];
}

export async function getTask(id: string, output = ".agentlint"): Promise<ReasoningTask> {
  const tasks = await listTasks(output);
  const task = tasks.find((t) => t.id === id);
  if (!task) throw new Error(`Unknown task: ${id}. Run a scan first.`);
  return task;
}

export async function resolveTask(
  id: string,
  resultRaw: string,
  output = ".agentlint",
): Promise<{ task: ReasoningTask; report?: ScanReport }> {
  const report = await readLatestReport(output);
  if (!report) throw new Error("No scan report found. Run `agentlint scan <url>` first.");

  const task = report.reasoningTasks.find((t) => t.id === id);
  if (!task) throw new Error(`Unknown task: ${id}`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(resultRaw);
  } catch {
    throw new Error("Result must be valid JSON.");
  }

  const validate = ajv.compile(task.outputSchema);
  if (!validate(parsed)) {
    const details = (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}`).join("; ");
    throw new Error(`Result failed schema validation: ${details}`);
  }

  task.status = "resolved";
  task.result = parsed;

  const check = report.checks.find((c) => c.reasoningTaskId === id);
  if (check) {
    check.status = "pass";
    check.summary = `Resolved by agent: ${summarizeResult(parsed)}`;
  }

  recomputeScores(report);
  await saveLatestReport(output, report, renderMarkdown(report));
  return { task, report };
}

function summarizeResult(result: unknown): string {
  if (result && typeof result === "object") {
    const rec = result as Record<string, unknown>;
    if (typeof rec.entity === "string") return rec.entity;
    if (typeof rec.offering === "string") return rec.offering;
    if (typeof rec.score === "number") return `score ${rec.score}`;
  }
  return "accepted";
}

function recomputeScores(report: ScanReport): void {
  for (const cat of report.categories) {
    const items = report.checks.filter((c) => c.category === cat.id);
    cat.passed = items.filter((i) => i.status === "pass").length;
    cat.failed = items.filter((i) => i.status === "fail").length;
    cat.warnings = items.filter((i) => i.status === "warning").length;
    cat.na = items.filter((i) => i.status === "na").length;
    const earned = items.reduce((s, i) => s + (i.status === "na" ? 0 : (i.score ?? 0)), 0);
    const available = items.reduce((s, i) => {
      if (i.status === "na" || i.severity === "emerging" || i.severity === "bonus") return s;
      return s + (i.maxScore ?? 0);
    }, 0);
    cat.earned = earned;
    cat.available = available;
    cat.score = available === 0 ? null : Math.min(100, Math.round((earned / available) * 100));
  }
  report.score.categories = report.categories;
  const available = report.categories.reduce((s, c) => s + c.available, 0);
  const earned = report.categories.reduce((s, c) => s + c.earned, 0);
  report.score.overall = available === 0 ? null : Math.min(100, Math.round((earned / available) * 100));
  report.score.passed = report.checks.filter((c) => c.status === "pass").length;
  report.score.failed = report.checks.filter((c) => c.status === "fail").length;
  report.score.warnings = report.checks.filter((c) => c.status === "warning").length;
  report.score.na = report.checks.filter((c) => c.status === "na").length;
}
