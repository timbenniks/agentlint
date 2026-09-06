import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runEval } from "../src/evals/evaluator.ts";
import { CommandRunner } from "../src/evals/runners/command.ts";
import { evalPaths, readLatestEvalResult } from "../src/evals/state.ts";
import { loadEvalTask } from "../src/evals/task.ts";

describe("behavioral evals", () => {
  it("runs an external adapter in a copied workspace and writes a separate result", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentlint-eval-test-"));
    const fixture = join(root, "fixture");
    const output = join(root, "reports");
    await mkdir(fixture);
    await writeFile(join(fixture, "input.txt"), "starter");
    const taskFile = join(root, "task.yaml");
    await writeFile(taskFile, `
schemaVersion: "1"
id: create-result
title: Create a validated result
target: https://example.com/docs
prompt: Create result.json with an ok property set to true.
workspace:
  source: ./fixture
successThreshold: 100
validators:
  - id: result-exists
    type: file-exists
    path: result.json
  - id: result-shape
    type: json-schema
    path: result.json
    schema:
      type: object
      required: [ok]
      properties:
        ok:
          const: true
`);
    const script = `
      let prompt = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", chunk => prompt += chunk);
      process.stdin.on("end", async () => {
        const fs = await import("node:fs/promises");
        if (!prompt.includes("result.json") || !prompt.includes("https://example.com/docs")) process.exit(3);
        await fs.writeFile("result.json", JSON.stringify({ ok: true }));
      });
    `;

    const result = await runEval({
      taskFile,
      runner: new CommandRunner(process.execPath, ["-e", script]),
      output,
    });

    expect(result.status).toBe("pass");
    expect(result.score).toBe(100);
    expect(result.runner.exitCode).toBe(0);
    expect(result.validators.every((validator) => validator.passed)).toBe(true);
    expect(result.trace.map((event) => event.type)).toContain("sandbox.removed");
    expect(result.sandbox.path).toBeUndefined();
    await expect(readFile(join(fixture, "result.json"), "utf8")).rejects.toThrow();
    expect((await readLatestEvalResult(output))?.evalId).toBe(result.evalId);
    expect(JSON.parse(await readFile(evalPaths(output).latest, "utf8")).status).toBe("pass");
  });

  it("requires explicit permission for task-authored validator commands", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentlint-eval-test-"));
    const taskFile = join(root, "task.json");
    await writeFile(taskFile, JSON.stringify({
      schemaVersion: "1",
      id: "command-gate",
      title: "Command gate",
      prompt: "Do nothing.",
      validators: [{
        id: "command",
        type: "command",
        command: process.execPath,
        args: ["-e", "process.exit(0)"],
      }],
    }));

    const blocked = await runEval({
      taskFile,
      runner: new CommandRunner(process.execPath, ["-e", "process.stdin.resume()"]),
      output: join(root, "blocked"),
    });
    expect(blocked.status).toBe("fail");
    expect(blocked.validators[0]?.summary).toMatch(/--allow-validator-commands/);

    const allowed = await runEval({
      taskFile,
      runner: new CommandRunner(process.execPath, ["-e", "process.stdin.resume()"]),
      output: join(root, "allowed"),
      allowValidatorCommands: true,
    });
    expect(allowed.status).toBe("pass");
  });

  it("rejects duplicate validator ids", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentlint-eval-test-"));
    const taskFile = join(root, "bad.json");
    await writeFile(taskFile, JSON.stringify({
      schemaVersion: "1",
      id: "duplicate",
      title: "Duplicate validators",
      prompt: "Do work.",
      validators: [
        { id: "same", type: "file-exists", path: "a" },
        { id: "same", type: "file-exists", path: "b" },
      ],
    }));
    await expect(loadEvalTask(taskFile)).rejects.toThrow(/duplicate validator id/);
  });
});
