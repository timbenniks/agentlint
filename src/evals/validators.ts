import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import Ajv from "ajv";
import type { EvalValidatorDefinition, EvalValidatorResult } from "./types.ts";

export interface RunValidatorsOptions {
  workspacePath: string;
  allowCommands: boolean;
  onStart?(validator: EvalValidatorDefinition): void;
  onComplete?(result: EvalValidatorResult): void;
}

export async function runValidators(
  definitions: EvalValidatorDefinition[],
  options: RunValidatorsOptions,
): Promise<EvalValidatorResult[]> {
  const results: EvalValidatorResult[] = [];
  for (const definition of definitions) {
    options.onStart?.(definition);
    const started = Date.now();
    let outcome: Omit<EvalValidatorResult, "id" | "title" | "type" | "weight" | "durationMs">;
    try {
      outcome = await runValidator(definition, options.workspacePath, options.allowCommands);
    } catch (error) {
      outcome = {
        passed: false,
        summary: error instanceof Error ? error.message : String(error),
      };
    }
    const result: EvalValidatorResult = {
      id: definition.id,
      title: definition.title ?? definition.id,
      type: definition.type,
      weight: definition.weight ?? 1,
      durationMs: Date.now() - started,
      ...outcome,
    };
    results.push(result);
    options.onComplete?.(result);
  }
  return results;
}

async function runValidator(
  definition: EvalValidatorDefinition,
  workspacePath: string,
  allowCommands: boolean,
): Promise<Pick<EvalValidatorResult, "passed" | "summary" | "details">> {
  if (definition.type === "file-exists") {
    const path = workspaceFile(workspacePath, definition.path);
    try {
      const info = await stat(path);
      return { passed: info.isFile() || info.isDirectory(), summary: `${definition.path} exists.` };
    } catch {
      return { passed: false, summary: `${definition.path} does not exist.` };
    }
  }

  if (definition.type === "file-contains") {
    const contents = await readFile(workspaceFile(workspacePath, definition.path), "utf8");
    const passed = contents.includes(definition.contains);
    return {
      passed,
      summary: passed
        ? `${definition.path} contains the expected text.`
        : `${definition.path} does not contain the expected text.`,
    };
  }

  if (definition.type === "json-schema") {
    const parsed = JSON.parse(await readFile(workspaceFile(workspacePath, definition.path), "utf8")) as unknown;
    const validate = new Ajv({ allErrors: true, strict: false }).compile(definition.schema);
    const passed = validate(parsed);
    return {
      passed,
      summary: passed ? `${definition.path} matches the JSON Schema.` : `${definition.path} does not match the JSON Schema.`,
      details: passed ? undefined : { errors: validate.errors ?? [] },
    };
  }

  if (!allowCommands) {
    return {
      passed: false,
      summary: "Command validator skipped. Re-run with --allow-validator-commands to execute task-authored commands.",
    };
  }
  const result = await runCommand(
    definition.command,
    definition.args ?? [],
    workspacePath,
    definition.timeoutMs ?? 60_000,
  );
  const expected = definition.expectedExitCode ?? 0;
  return {
    passed: result.exitCode === expected && !result.timedOut,
    summary: result.timedOut
      ? `Command timed out after ${definition.timeoutMs ?? 60_000}ms.`
      : `Command exited ${result.exitCode}; expected ${expected}.`,
    details: { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode },
  };
}

function workspaceFile(workspacePath: string, requestedPath: string): string {
  if (isAbsolute(requestedPath)) throw new Error(`Validator path must be relative: ${requestedPath}`);
  const candidate = resolve(workspacePath, requestedPath);
  const fromRoot = relative(resolve(workspacePath), candidate);
  if (fromRoot === ".." || fromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    throw new Error(`Validator path leaves the eval workspace: ${requestedPath}`);
  }
  return candidate;
}

function runCommand(command: string, args: string[], cwd: string, timeoutMs: number): Promise<{
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, args, { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let forceKillTimer: ReturnType<typeof setTimeout> | undefined;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout = appendOutput(stdout, chunk)));
    child.stderr.on("data", (chunk: string) => (stderr = appendOutput(stderr, chunk)));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 5_000);
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      reject(error);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      resolveResult({ exitCode, timedOut, stdout, stderr });
    });
  });
}

const MAX_VALIDATOR_OUTPUT_BYTES = 1_000_000;

function appendOutput(current: string, chunk: string): string {
  const remaining = MAX_VALIDATOR_OUTPUT_BYTES - Buffer.byteLength(current);
  if (remaining <= 0) return current;
  if (Buffer.byteLength(chunk) <= remaining) return current + chunk;
  return current + Buffer.from(chunk).subarray(0, remaining).toString("utf8");
}
