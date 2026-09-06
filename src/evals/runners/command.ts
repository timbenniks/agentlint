import { spawn } from "node:child_process";
import type { EvalRunnerAdapter, EvalRunnerInput, EvalRunnerResult } from "../types.ts";

export class CommandRunner implements EvalRunnerAdapter {
  readonly name = "command";

  constructor(
    private readonly executable: string,
    private readonly args: string[] = [],
    private readonly environment: Record<string, string> = {},
  ) {}

  run(input: EvalRunnerInput): Promise<EvalRunnerResult> {
    return new Promise((resolve, reject) => {
      const startedAt = new Date();
      const child = spawn(this.executable, this.args, {
        cwd: input.workspacePath,
        env: {
          ...process.env,
          ...this.environment,
          AGENTLINT_EVAL_TASK_ID: input.task.id,
          AGENTLINT_EVAL_TARGET: input.target ?? "",
          AGENTLINT_EVAL_WORKSPACE: input.workspacePath,
        },
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      let outputTruncated = false;
      let timedOut = false;
      let forceKillTimer: ReturnType<typeof setTimeout> | undefined;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 5_000);
      }, input.timeoutMs);

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        const appended = appendOutput(stdout, chunk);
        stdout = appended.value;
        outputTruncated ||= appended.truncated;
        input.onOutput?.("stdout", chunk);
      });
      child.stderr.on("data", (chunk: string) => {
        const appended = appendOutput(stderr, chunk);
        stderr = appended.value;
        outputTruncated ||= appended.truncated;
        input.onOutput?.("stderr", chunk);
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        if (forceKillTimer) clearTimeout(forceKillTimer);
        reject(new Error(`Could not start eval runner ${this.executable}: ${error.message}`));
      });
      child.on("close", (exitCode, signal) => {
        clearTimeout(timer);
        if (forceKillTimer) clearTimeout(forceKillTimer);
        const completedAt = new Date();
        resolve({
          adapter: this.name,
          command: [this.executable, ...this.args].join(" "),
          startedAt: startedAt.toISOString(),
          completedAt: completedAt.toISOString(),
          durationMs: completedAt.getTime() - startedAt.getTime(),
          exitCode,
          signal: signal ?? undefined,
          timedOut,
          stdout,
          stderr,
          outputTruncated,
        });
      });
      child.stdin.end(input.prompt);
    });
  }
}

const MAX_CAPTURE_BYTES = 1_000_000;

function appendOutput(current: string, chunk: string): { value: string; truncated: boolean } {
  const remaining = MAX_CAPTURE_BYTES - Buffer.byteLength(current);
  if (remaining <= 0) return { value: current, truncated: true };
  if (Buffer.byteLength(chunk) <= remaining) return { value: current + chunk, truncated: false };
  return { value: current + Buffer.from(chunk).subarray(0, remaining).toString("utf8"), truncated: true };
}
