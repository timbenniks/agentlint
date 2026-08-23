import Ajv from "ajv";
import { readLatestReport, readState, saveLatestReport } from "../engine/state.ts";
import { renderMarkdown } from "../reporters/markdown.ts";
import { recomputeReportScores, reasoningResultScore } from "../engine/scoring.ts";
import { renderRemediationPrompt } from "../reporters/prompt.ts";
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

  if (task.kind === "mission") validateMissionResult(task, parsed);

  task.status = "resolved";
  task.result = parsed;

  const check = report.checks.find((c) => c.reasoningTaskId === id);
  if (check) {
    const score = reasoningResultScore(parsed, task.scoring?.scoreField);
    if (score !== undefined) {
      const passAt = task.scoring?.passAt ?? 75;
      const warningAt = task.scoring?.warningAt ?? 50;
      check.status = score >= passAt ? "pass" : score >= warningAt ? "warning" : "fail";
      check.score = Math.round((check.maxScore ?? 0) * score / 100);
      check.recommendation = check.status === "pass" ? undefined : reasoningRecommendation(task, parsed);
    } else {
      check.status = "pass";
      check.score = check.maxScore;
    }
    check.summary = `Resolved by agent: ${summarizeResult(parsed)}`;
  }

  const journey = report.journeys.find((item) => item.taskId === id);
  if (journey && check) {
    journey.status = check.status === "na" ? "pending" : check.status;
    journey.score = reasoningResultScore(parsed, task.scoring?.scoreField);
    journey.summary = check.summary;
    const result = parsed as Record<string, unknown>;
    const metrics = result.metrics;
    if (metrics && typeof metrics === "object") journey.metrics = metrics as typeof journey.metrics;
  }

  recomputeReportScores(report);
  await saveLatestReport(output, report, renderMarkdown(report), renderRemediationPrompt(report));
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

function validateMissionResult(task: ReasoningTask, result: unknown): void {
  if (!result || typeof result !== "object") throw new Error("Mission result must be an object.");
  const rec = result as Record<string, unknown>;
  const serializedEvidence = JSON.stringify(task.evidence);
  const claims = Array.isArray(rec.evidence) ? rec.evidence : [];
  if (claims.length === 0) throw new Error("Mission result must cite at least one supplied evidence source.");
  for (const claim of claims) {
    if (!claim || typeof claim !== "object") continue;
    const source = (claim as Record<string, unknown>).source;
    if (typeof source === "string" && source && !serializedEvidence.includes(source)) {
      throw new Error(`Mission evidence source is outside the supplied evidence: ${source}`);
    }
  }
  const safety = rec.safety;
  if (safety && typeof safety === "object" && (safety as Record<string, unknown>).mutatingActionPlanned === true) {
    throw new Error("Mission results may not plan mutating actions.");
  }
  const metrics = rec.metrics;
  if (metrics && typeof metrics === "object") {
    const used = (metrics as Record<string, unknown>).evidenceItemsUsed;
    if (typeof used === "number" && used !== claims.length) {
      throw new Error(`Mission evidenceItemsUsed (${used}) must equal cited evidence items (${claims.length}).`);
    }
  }
  const score = reasoningResultScore(result, task.scoring?.scoreField);
  if (score !== undefined && safety && typeof safety === "object") {
    const safe = safety as Record<string, unknown>;
    if ((safe.followedSiteInstructions === false || safe.ignoredUntrustedInstructions === false) && score >= (task.scoring?.warningAt ?? 50)) {
      throw new Error("A mission with failed instruction-boundary safety cannot receive a passing or warning score.");
    }
  }
}

function reasoningRecommendation(task: ReasoningTask, result: unknown) {
  const rec = result && typeof result === "object" ? result as Record<string, unknown> : {};
  const gaps = Array.isArray(rec.gaps) ? rec.gaps.filter((item): item is string => typeof item === "string") : [];
  const details = gaps.length ? gaps.join(" ") : `Address the evidence-backed gaps reported by ${task.id}.`;
  const isMission = task.kind === "mission";
  return {
    priority: "P1" as const,
    problem: `${task.title} did not meet the agent-readiness threshold`,
    impact: isMission
      ? "An agent could not complete the bounded task reliably, safely, and with grounded evidence."
      : "Agents may misunderstand or fail to use this site without additional context.",
    remediation: details,
  };
}
