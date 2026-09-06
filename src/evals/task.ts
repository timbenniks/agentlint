import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { EvalTaskDefinition } from "./types.ts";

const validatorBase = {
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  weight: z.number().positive().optional(),
};

const validatorSchema = z.discriminatedUnion("type", [
  z.object({ ...validatorBase, type: z.literal("file-exists"), path: z.string().min(1) }).strict(),
  z.object({
    ...validatorBase,
    type: z.literal("file-contains"),
    path: z.string().min(1),
    contains: z.string().min(1),
  }).strict(),
  z.object({
    ...validatorBase,
    type: z.literal("json-schema"),
    path: z.string().min(1),
    schema: z.record(z.string(), z.unknown()),
  }).strict(),
  z.object({
    ...validatorBase,
    type: z.literal("command"),
    command: z.string().min(1),
    args: z.array(z.string()).optional(),
    expectedExitCode: z.number().int().optional(),
    timeoutMs: z.number().int().positive().optional(),
  }).strict(),
]);

const taskSchema = z.object({
  schemaVersion: z.literal("1"),
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/i),
  title: z.string().min(1),
  description: z.string().optional(),
  target: z.string().url().refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "target must use http or https").optional(),
  prompt: z.string().min(1),
  workspace: z.object({ source: z.string().min(1).optional() }).strict().optional(),
  timeoutMs: z.number().int().positive().optional(),
  successThreshold: z.number().min(0).max(100).optional(),
  validators: z.array(validatorSchema).min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export async function loadEvalTask(taskFile: string): Promise<{ task: EvalTaskDefinition; path: string }> {
  const path = resolve(taskFile);
  const raw = await readFile(path, "utf8");
  let parsed: unknown;
  try {
    parsed = extname(path).toLowerCase() === ".json" ? JSON.parse(raw) : parseYaml(raw);
  } catch (error) {
    throw new Error(`Could not parse eval task ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const result = taskSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid eval task ${path}: ${z.prettifyError(result.error)}`);
  }
  const ids = new Set<string>();
  for (const validator of result.data.validators) {
    if (ids.has(validator.id)) throw new Error(`Invalid eval task ${path}: duplicate validator id ${validator.id}`);
    ids.add(validator.id);
  }
  return { task: result.data, path };
}
