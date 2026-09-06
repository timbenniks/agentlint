import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { EvalResult } from "./types.ts";

export function evalPaths(output: string) {
  const root = join(output, "evals");
  return {
    root,
    latest: join(root, "latest.json"),
    runs: join(root, "runs"),
  };
}

export async function writeEvalResult(output: string, result: EvalResult): Promise<void> {
  const paths = evalPaths(output);
  await mkdir(paths.runs, { recursive: true });
  const serialized = JSON.stringify(result, null, 2);
  await writeFile(paths.latest, serialized);
  await writeFile(join(paths.runs, `${result.evalId}.json`), serialized);
}

export async function readLatestEvalResult(output = ".agentlint"): Promise<EvalResult | undefined> {
  try {
    return JSON.parse(await readFile(evalPaths(output).latest, "utf8")) as EvalResult;
  } catch {
    return undefined;
  }
}
