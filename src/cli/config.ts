import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface AgentlintConfig {
  schemaVersion: "1";
  target: string;
}

export const CONFIG_FILENAME = "agentlint.config.json";

export async function readAgentlintConfig(cwd = process.cwd()): Promise<AgentlintConfig | undefined> {
  try {
    const parsed = JSON.parse(await readFile(join(cwd, CONFIG_FILENAME), "utf8")) as Record<string, unknown>;
    if (parsed.schemaVersion !== "1" || typeof parsed.target !== "string") return undefined;
    return { schemaVersion: "1", target: validateTarget(parsed.target) };
  } catch {
    return undefined;
  }
}

export function validateTarget(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid Agentlint target URL: ${value}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Agentlint target must use http or https: ${value}`);
  }
  return url.href;
}
