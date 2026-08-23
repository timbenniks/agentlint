import { readFile, writeFile } from "node:fs/promises";
import type { ScanReport } from "../types.ts";

export interface ScanBaseline {
  schemaVersion: "1";
  target: string;
  createdAt: string;
  score: { overall: number | null; surface: number | null; taskSuccess: number | null };
  checks: { id: string; status: string; score?: number }[];
}

export interface RegressionResult {
  passed: boolean;
  regressions: string[];
}

export function createBaseline(report: ScanReport): ScanBaseline {
  return {
    schemaVersion: "1",
    target: report.target.finalUrl,
    createdAt: new Date().toISOString(),
    score: {
      overall: report.score.overall,
      surface: report.score.surface,
      taskSuccess: report.score.taskSuccess,
    },
    checks: report.checks.map((check) => ({ id: check.id, status: check.status, score: check.score })),
  };
}

export async function saveBaseline(path: string, report: ScanReport): Promise<void> {
  await writeFile(path, JSON.stringify(createBaseline(report), null, 2));
}

export async function readBaseline(path: string): Promise<ScanBaseline | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as ScanBaseline;
  } catch {
    return undefined;
  }
}

export function compareBaseline(baseline: ScanBaseline, report: ScanReport): RegressionResult {
  const regressions: string[] = [];
  if (baseline.target !== report.target.finalUrl) {
    regressions.push(`target changed: ${baseline.target} -> ${report.target.finalUrl}`);
  }
  const hasPending = report.reasoningTasks.some((task) => task.status === "pending");
  if (!hasPending) compareScore("overall", baseline.score.overall, report.score.overall, regressions);
  compareScore("surface", baseline.score.surface, report.score.surface, regressions);
  if (baseline.score.taskSuccess !== null && report.score.taskSuccess !== null) {
    compareScore("task success", baseline.score.taskSuccess, report.score.taskSuccess, regressions);
  }
  const rank: Record<string, number> = { pass: 3, na: 3, warning: 2, fail: 1 };
  for (const before of baseline.checks) {
    const after = report.checks.find((check) => check.id === before.id);
    if (!after) {
      regressions.push(`check disappeared: ${before.id}`);
      continue;
    }
    if (after.reasoningTaskId && report.reasoningTasks.find((task) => task.id === after.reasoningTaskId)?.status === "pending") {
      continue;
    }
    if ((rank[after.status] ?? 0) < (rank[before.status] ?? 0)) {
      regressions.push(`${before.id}: ${before.status} -> ${after.status}`);
    }
  }
  return { passed: regressions.length === 0, regressions };
}

function compareScore(label: string, before: number | null, after: number | null, regressions: string[]): void {
  if (before !== null && (after === null || after < before)) {
    regressions.push(`${label} score: ${before} -> ${after ?? "N/A"}`);
  }
}
