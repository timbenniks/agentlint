import pc from "picocolors";
import type { ReportCheck, ScanReport, Scorecard } from "../types.ts";
import { CATEGORY_TITLES } from "../constants.ts";
import { hostLabel } from "../engine/url.ts";

const STATUS: Record<string, string> = {
  pass: pc.green("✓"),
  fail: pc.red("✗"),
  warning: pc.yellow("!"),
  na: pc.dim("N/A"),
};

export function renderTerminal(report: ScanReport, verbose = false): string {
  const host = hostLabel(report.target.finalUrl);
  const lines: string[] = [];
  const width = 24;

  lines.push("");
  lines.push(pc.bold("╭ Agentlint"));
  lines.push(`│ ${host}`);
  lines.push("╰────────────────────────");
  lines.push("");

  for (const category of report.score.categories) {
    const label = category.title.padEnd(width);
    const score = category.score === null ? "N/A" : String(category.score).padStart(3);
    lines.push(` ${label}${pc.bold(score)}`);
  }

  lines.push("");
  const overall = report.score.overall === null ? "N/A" : String(report.score.overall);
  lines.push(` ${pc.bold(overall)}  ${report.score.label}`);
  lines.push("");
  lines.push(` ${pc.green(String(report.score.passed).padStart(3))} passed`);
  lines.push(` ${pc.yellow(String(report.score.warnings).padStart(3))} warnings`);
  lines.push(` ${pc.red(String(report.score.failed).padStart(3))} failed`);
  lines.push(` ${pc.dim(String(report.score.na).padStart(3))} not applicable`);
  lines.push(` ${pc.cyan(String(report.reasoningTasks.filter((t) => t.status === "pending").length).padStart(3))} reasoning tasks`);
  lines.push("");

  if (verbose) {
    lines.push(renderVerboseChecks(report));
  }

  const pending = report.reasoningTasks.filter((t) => t.status === "pending");
  if (pending.length) {
    lines.push(pc.dim("Reasoning"));
    for (const task of pending) {
      lines.push(`  ${pc.cyan("◇")} ${task.id}`);
    }
    lines.push("");
  }

  lines.push(` report → .agentlint/latest.md`);
  lines.push("");
  return lines.join("\n");
}

export function renderProgress(report: ScanReport): string {
  const lines = ["", pc.bold("Agentlint"), "", `Scanning ${hostLabel(report.target.finalUrl)}...`, ""];
  let currentCat = "";
  for (const check of report.checks) {
    if (check.category !== currentCat) {
      currentCat = check.category;
      lines.push(pc.bold(CATEGORY_TITLES[check.category] ?? check.category));
    }
    const mark =
      check.status === "pass"
        ? pc.green("✓")
        : check.status === "fail"
          ? pc.red("✗")
          : check.status === "warning"
            ? pc.yellow("!")
            : pc.dim("N/A");
    const suffix = check.status === "na" ? pc.dim(` ${check.summary}`) : "";
    lines.push(`  ${mark} ${check.title}${suffix}`);
  }
  lines.push("");
  const pending = report.reasoningTasks.filter((t) => t.status === "pending").length;
  if (pending) {
    lines.push(pc.bold("Reasoning"));
    lines.push(`  ${pc.cyan("◇")} ${pending} task${pending === 1 ? "" : "s"} require agent evaluation`);
    lines.push("");
  }
  lines.push(`Agent readiness: ${report.score.overall ?? "N/A"}`);
  lines.push("");
  lines.push("Reports:");
  lines.push("  .agentlint/latest.json");
  lines.push("  .agentlint/latest.md");
  lines.push("");
  return lines.join("\n");
}

export function renderExplain(report: ScanReport, category?: string): string {
  const cats = category
    ? report.score.categories.filter((c) => c.id === category || c.title.toLowerCase().includes(category.toLowerCase()))
    : report.score.categories;

  if (cats.length === 0) return `Unknown category: ${category}`;

  const lines: string[] = [""];
  for (const cat of cats) {
    lines.push(pc.bold(`${cat.title}: ${cat.score ?? "N/A"}`));
    lines.push("");
    for (const check of report.checks.filter((c) => c.category === cat.id)) {
      lines.push(formatExplainLine(check));
      if (check.status === "na" && check.summary) {
        lines.push(pc.dim(`       ${check.summary}`));
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function renderFix(report: ScanReport): string {
  const recs = report.checks
    .filter((c) => c.recommendation && (c.status === "fail" || c.status === "warning"))
    .sort((a, b) => priorityRank(a.recommendation!.priority) - priorityRank(b.recommendation!.priority));

  const lines = ["", pc.bold("Recommended changes"), ""];
  if (recs.length === 0) {
    lines.push("No prioritized remediations from this scan.");
    lines.push("");
    return lines.join("\n");
  }

  let current = "";
  for (const check of recs) {
    const rec = check.recommendation!;
    if (rec.priority !== current) {
      current = rec.priority;
      lines.push(pc.bold(current));
    }
    lines.push(rec.problem);
    lines.push(pc.dim(`  ${rec.remediation}`));
    lines.push(pc.dim(`  check: ${check.id}`));
    lines.push("");
  }
  return lines.join("\n");
}

export function renderAgentProtocol(report: ScanReport): string {
  const pending = report.reasoningTasks.filter((t) => t.status === "pending");
  if (pending.length === 0) return "";
  const first = pending[0]!;
  return [
    "",
    "AGENTLINT_REASONING_REQUIRED",
    "",
    "You are a coding agent. Do not call a model API. Use only task evidence.",
    "N/A checks are not failures. Do not invent pages, APIs, or entities.",
    "",
    `Task ID: ${first.id}`,
    "",
    "Run:",
    "",
    `agentlint task get ${first.id}`,
    "",
    "Evaluate the task using the provided instructions and output schema, then resolve it with:",
    "",
    `agentlint task resolve ${first.id} --result '<JSON>'`,
    "",
    pending.length > 1 ? `Remaining tasks: ${pending.slice(1).map((t) => t.id).join(", ")}` : "",
    "",
  ]
    .filter((l) => l !== undefined)
    .join("\n");
}

function formatExplainLine(check: ReportCheck): string {
  const mark = check.status.toUpperCase().padEnd(6);
  const title = check.title.padEnd(24);
  if (check.status === "na") return `${mark} ${title}`;
  const score = `${check.score ?? 0}`.padStart(2);
  const max = `${check.maxScore ?? 0}`.padStart(2);
  return `${mark} ${title} +${score} / ${max}`;
}

function renderVerboseChecks(report: ScanReport): string {
  const lines: string[] = [];
  for (const check of report.checks) {
    lines.push(`${STATUS[check.status] ?? check.status} ${check.title}`);
    lines.push(pc.dim(`  Source: ${check.provenance}`));
    lines.push(`  ${check.summary}`);
    lines.push("");
  }
  return lines.join("\n");
}

function priorityRank(p: string): number {
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[p] ?? 9;
}

export function renderScoreLine(score: Scorecard): string {
  return `Agent readiness: ${score.overall ?? "N/A"}`;
}
