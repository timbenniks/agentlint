import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ReasoningTask, ScanReport } from "../types.ts";
import { safeFilename } from "./util.ts";

export interface ScanState {
  latestScanId?: string;
  tasks: ReasoningTask[];
  reportPath?: string;
}

export function reportDir(output: string): string {
  return output;
}

export function latestPaths(output: string) {
  return {
    json: join(output, "latest.json"),
    md: join(output, "latest.md"),
    state: join(output, "state.json"),
    scans: join(output, "scans"),
  };
}

export async function writeReports(output: string, report: ScanReport, markdown: string): Promise<void> {
  const paths = latestPaths(output);
  const id = safeFilename(report.scanId);
  await mkdir(paths.scans, { recursive: true });
  await writeFile(paths.json, JSON.stringify(report, null, 2));
  await writeFile(paths.md, markdown);
  await writeFile(join(paths.scans, `${id}.json`), JSON.stringify(report, null, 2));
  await writeFile(join(paths.scans, `${id}.md`), markdown);
  await writeState(output, {
    latestScanId: report.scanId,
    tasks: report.reasoningTasks,
    reportPath: paths.json,
  });
}

export async function writeState(output: string, state: ScanState): Promise<void> {
  const paths = latestPaths(output);
  await mkdir(dirname(paths.state), { recursive: true });
  await writeFile(paths.state, JSON.stringify(state, null, 2));
}

export async function readState(output = ".agentlint"): Promise<ScanState | undefined> {
  try {
    const raw = await readFile(latestPaths(output).state, "utf8");
    return JSON.parse(raw) as ScanState;
  } catch {
    return undefined;
  }
}

export async function readLatestReport(output = ".agentlint"): Promise<ScanReport | undefined> {
  try {
    const raw = await readFile(latestPaths(output).json, "utf8");
    return JSON.parse(raw) as ScanReport;
  } catch {
    return undefined;
  }
}

export async function saveLatestReport(output: string, report: ScanReport, markdown: string): Promise<void> {
  await writeReports(output, report, markdown);
}
