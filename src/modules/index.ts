import type { Command } from "commander";
import { registerEvalCommand } from "../evals/cli.ts";
import type { AgentlintModule } from "./types.ts";

export const behavioralEvalsModule: AgentlintModule = {
  id: "behavioral-evals",
  command: "eval",
  description: "Run real implementation tasks with an external agent runner.",
  register: registerEvalCommand,
};

/**
 * Add future independent product modules here. The scanner remains Agentlint's
 * core; modules own their CLI registration and internal runtime boundaries.
 */
export const builtinModules: readonly AgentlintModule[] = [behavioralEvalsModule];

export const builtinModuleCommands = new Set(builtinModules.map((module) => module.command));

export function registerBuiltinModules(program: Command): void {
  for (const module of builtinModules) module.register(program);
}
