import { cp, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import type { EvalSandbox, EvalSandboxProvider } from "./types.ts";

export class TemporaryDirectorySandbox implements EvalSandboxProvider {
  readonly name = "temporary-directory";

  async create(source?: string): Promise<EvalSandbox> {
    const path = await mkdtemp(join(tmpdir(), "agentlint-eval-"));
    try {
      if (source) {
        const sourcePath = resolve(source);
        const entries = await readdir(sourcePath, { withFileTypes: true });
        for (const entry of entries) {
          await cp(join(sourcePath, entry.name), join(path, entry.name), { recursive: true, preserveTimestamps: true });
        }
      } else {
        await mkdir(path, { recursive: true });
      }
    } catch (error) {
      await rm(path, { recursive: true, force: true });
      throw error;
    }
    return {
      path,
      cleanup: async () => {
        if (!basename(path).startsWith("agentlint-eval-")) throw new Error(`Refusing to remove unexpected sandbox path: ${path}`);
        await rm(path, { recursive: true, force: true });
      },
    };
  }
}
