import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

const docsRoot = join(import.meta.dirname, "..", "apps", "docs");

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "cache" || entry.name === "dist") return [];
      return sourceFiles(path);
    }
    return [".md", ".vue"].includes(extname(entry.name)) ? [path] : [];
  }));
  return nested.flat();
}

describe("documentation commands", () => {
  it("never invokes the unrelated unscoped npm package", async () => {
    const files = await sourceFiles(docsRoot);
    const offenders: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      if (/\bnpx\s+agentlint\b/.test(source)) offenders.push(file.slice(docsRoot.length + 1));
    }
    expect(offenders).toEqual([]);
  });
});
