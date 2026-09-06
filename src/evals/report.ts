import pc from "picocolors";
import type { EvalResult } from "./types.ts";

export function renderEvalTerminal(result: EvalResult): string {
  const status = result.status === "pass" ? pc.green("PASS") : result.status === "fail" ? pc.red("FAIL") : pc.red("ERROR");
  const lines = [
    "",
    `${pc.bold("Agentlint behavioral eval")}  ${status}`,
    `${result.task.title} (${result.task.id})`,
    `Score ${result.score}/100  Threshold ${result.threshold}  Duration ${formatDuration(result.durationMs)}`,
    `Runner ${result.runner.adapter}  Exit ${result.runner.exitCode ?? "none"}${result.runner.timedOut ? "  timed out" : ""}`,
    "",
  ];
  for (const validator of result.validators) {
    lines.push(`${validator.passed ? pc.green("✓") : pc.red("✗")} ${validator.title}: ${validator.summary}`);
  }
  if (result.error) lines.push("", pc.red(result.error));
  if (result.sandbox.preserved && result.sandbox.path) lines.push("", `Sandbox preserved at ${result.sandbox.path}`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}
