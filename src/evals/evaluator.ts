import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { AGENTLINT_VERSION } from "../constants.ts";
import { TemporaryDirectorySandbox } from "./sandbox.ts";
import { writeEvalResult } from "./state.ts";
import { loadEvalTask } from "./task.ts";
import { EvalTrace } from "./trace.ts";
import { runValidators } from "./validators.ts";
import type { EvalResult, EvalRunOptions, EvalRunnerResult } from "./types.ts";

export async function runEval(options: EvalRunOptions): Promise<EvalResult> {
  const started = new Date();
  const evalId = `eval_${started.toISOString().replaceAll(/[:.]/g, "-")}_${randomUUID().slice(0, 8)}`;
  const trace = new EvalTrace();
  const { task, path: taskPath } = await loadEvalTask(options.taskFile);
  const target = options.target ?? task.target;
  const sandboxProvider = options.sandbox ?? new TemporaryDirectorySandbox();
  const workspaceSource = task.workspace?.source
    ? resolve(dirname(taskPath), task.workspace.source)
    : undefined;
  const timeoutMs = options.timeoutMs ?? task.timeoutMs ?? 10 * 60_000;
  const threshold = task.successThreshold ?? 100;
  trace.add("eval.started", { evalId, taskId: task.id, target });

  const sandbox = await sandboxProvider.create(workspaceSource);
  trace.add("sandbox.created", { provider: sandboxProvider.name, path: sandbox.path, source: workspaceSource });
  let runner: EvalRunnerResult;
  let error: string | undefined;
  let validators: EvalResult["validators"] = [];

  try {
    trace.add("runner.started", { adapter: options.runner.name, timeoutMs });
    runner = await options.runner.run({
      task,
      prompt: renderEvalPrompt(task.prompt, target),
      workspacePath: sandbox.path,
      target,
      timeoutMs,
      onOutput: (stream, chunk) => trace.add("runner.output", { stream, bytes: Buffer.byteLength(chunk) }),
      onTrace: (name, data) => trace.add("runner.trace", { ...data, name }),
    });
    trace.add("runner.completed", {
      exitCode: runner.exitCode,
      durationMs: runner.durationMs,
      timedOut: runner.timedOut,
    });
    validators = await runValidators(task.validators, {
      workspacePath: sandbox.path,
      allowCommands: options.allowValidatorCommands ?? false,
      onStart: (validator) => trace.add("validator.started", { id: validator.id, type: validator.type }),
      onComplete: (result) => trace.add("validator.completed", { id: result.id, passed: result.passed }),
    });
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
    trace.add("runner.completed", { error });
    const now = new Date().toISOString();
    runner = {
      adapter: options.runner.name,
      startedAt: now,
      completedAt: now,
      durationMs: 0,
      exitCode: null,
      timedOut: false,
      stdout: "",
      stderr: "",
    };
  }

  const totalWeight = validators.reduce((sum, item) => sum + item.weight, 0);
  const passedWeight = validators.filter((item) => item.passed).reduce((sum, item) => sum + item.weight, 0);
  const score = totalWeight === 0 ? 0 : Math.round((passedWeight / totalWeight) * 100);
  const runnerPassed = runner.exitCode === 0 && !runner.timedOut;
  const status: EvalResult["status"] = error ? "error" : runnerPassed && score >= threshold ? "pass" : "fail";

  if (!options.keepSandbox) {
    await sandbox.cleanup();
    trace.add("sandbox.removed", { provider: sandboxProvider.name });
  }
  const completed = new Date();
  trace.add("eval.completed", { status, score });
  const result: EvalResult = {
    schemaVersion: "1",
    agentlintVersion: AGENTLINT_VERSION,
    evalId,
    task: { id: task.id, title: task.title, source: taskPath, target },
    status,
    score,
    threshold,
    startedAt: started.toISOString(),
    completedAt: completed.toISOString(),
    durationMs: completed.getTime() - started.getTime(),
    sandbox: {
      provider: sandboxProvider.name,
      path: options.keepSandbox ? sandbox.path : undefined,
      preserved: options.keepSandbox ?? false,
    },
    runner,
    validators,
    trace: trace.events,
    error,
  };
  await writeEvalResult(options.output, result);
  return result;
}

export function renderEvalPrompt(prompt: string, target?: string): string {
  const targetLine = target ? `Target product documentation: ${target}\n\n` : "";
  return `# Agentlint behavioral eval\n\n${targetLine}${prompt.trim()}\n`;
}
