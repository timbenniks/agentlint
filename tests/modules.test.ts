import { describe, expect, it } from "vitest";
import { buildProgram } from "../src/cli/index.ts";
import { builtinModules } from "../src/modules/index.ts";

describe("module registry", () => {
  it("keeps module ids and commands unique", () => {
    expect(new Set(builtinModules.map((module) => module.id)).size).toBe(builtinModules.length);
    expect(new Set(builtinModules.map((module) => module.command)).size).toBe(builtinModules.length);
  });

  it("registers every module command with the CLI shell", () => {
    const commands = new Set(buildProgram().commands.map((command) => command.name()));
    for (const module of builtinModules) expect(commands.has(module.command)).toBe(true);
  });
});
