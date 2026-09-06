import type { Command } from "commander";
import { validateTarget } from "../cli/config.ts";
import { runEval } from "./evaluator.ts";
import { renderEvalTerminal } from "./report.ts";
import { CommandRunner } from "./runners/command.ts";

export function registerEvalCommand(program: Command): void {
  program
    .command("eval")
    .description("Run a behavioral agent evaluation in an isolated temporary workspace")
    .argument("<task-file>", "versioned YAML or JSON eval task definition")
    .requiredOption("--command <executable>", "agent runner executable")
    .option("--arg <value>", "argument passed to the runner (repeatable)", collectOption, [])
    .option("--target <url>", "override the task target URL")
    .option("--timeout <ms>", "override the runner timeout in milliseconds")
    .option("--format <fmt>", "terminal | json", "terminal")
    .option("--output <dir>", "report output directory", ".agentlint")
    .option("--keep-sandbox", "preserve the temporary workspace for inspection", false)
    .option("--allow-validator-commands", "execute command validators declared by the task", false)
    .action(async (taskFile: string, opts: EvalCliOptions) => {
      try {
        if (opts.format !== "terminal" && opts.format !== "json") {
          throw new Error(`Unsupported eval format: ${opts.format}`);
        }
        const timeoutMs = opts.timeout === undefined ? undefined : Number(opts.timeout);
        if (timeoutMs !== undefined && (!Number.isInteger(timeoutMs) || timeoutMs <= 0)) {
          throw new Error("Eval timeout must be a positive integer in milliseconds.");
        }
        const result = await runEval({
          taskFile,
          runner: new CommandRunner(opts.command, opts.arg),
          target: opts.target ? validateTarget(opts.target) : undefined,
          output: opts.output,
          keepSandbox: opts.keepSandbox,
          allowValidatorCommands: opts.allowValidatorCommands,
          timeoutMs,
        });
        if (opts.format === "json") console.log(JSON.stringify(result, null, 2));
        else process.stdout.write(renderEvalTerminal(result));
        if (result.status !== "pass") process.exitCode = result.status === "fail" ? 1 : 2;
      } catch (error) {
        console.error(`agentlint: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 2;
      }
    });
}

interface EvalCliOptions {
  command: string;
  arg: string[];
  target?: string;
  timeout?: string;
  format: string;
  output: string;
  keepSandbox: boolean;
  allowValidatorCommands: boolean;
}

function collectOption(value: string, previous: string[]): string[] {
  return [...previous, value];
}
