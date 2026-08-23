import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readAgentlintConfig } from "../src/cli/config.ts";
import { initProject } from "../src/cli/init.ts";

async function project(packageJson: Record<string, unknown> = { name: "site", scripts: {} }) {
  const cwd = await mkdtemp(join(tmpdir(), "agentlint-init-"));
  await writeFile(join(cwd, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);
  return cwd;
}

describe("agentlint init", () => {
  it("creates safe project scaffolding and optional integrations", async () => {
    const cwd = await project();
    const result = await initProject({
      cwd,
      target: "https://example.com",
      ci: true,
      cursorSkill: true,
    });
    expect(result.target).toBe("https://example.com/");
    expect(await readAgentlintConfig(cwd)).toEqual({ schemaVersion: "1", target: "https://example.com/" });
    const pkg = JSON.parse(await readFile(join(cwd, "package.json"), "utf8"));
    expect(pkg.scripts.agentlint).toBe("agentlint scan --agent --missions");
    expect(await readFile(join(cwd, ".gitignore"), "utf8")).toContain(".agentlint/");
    expect(await readFile(join(cwd, "AGENTS.md"), "utf8")).toContain("<!-- agentlint:start -->");
    expect(await readFile(join(cwd, ".cursor/skills/agentlint/SKILL.md"), "utf8")).toContain("https://example.com/");
    expect(await readFile(join(cwd, ".github/workflows/agentlint.yml"), "utf8")).toContain("npx @timbenniks/agentlint scan");
  });

  it("is idempotent and preserves an existing npm script", async () => {
    const cwd = await project({ name: "site", scripts: { agentlint: "custom-command" } });
    await initProject({ cwd, target: "https://example.com" });
    const second = await initProject({ cwd, target: "https://example.com" });
    const pkg = JSON.parse(await readFile(join(cwd, "package.json"), "utf8"));
    expect(pkg.scripts.agentlint).toBe("custom-command");
    expect(second.skipped.some((item) => item.includes("scripts.agentlint"))).toBe(true);
    const agents = await readFile(join(cwd, "AGENTS.md"), "utf8");
    expect(agents.match(/<!-- agentlint:start -->/g)).toHaveLength(1);
  });

  it("infers a valid package homepage and requires force to change a configured target", async () => {
    const cwd = await project({ name: "site", homepage: "https://site.example", scripts: {} });
    await initProject({ cwd });
    await expect(initProject({ cwd, target: "https://other.example" })).rejects.toThrow(/--force/);
    await initProject({ cwd, target: "https://other.example", force: true });
    expect((await readAgentlintConfig(cwd))?.target).toBe("https://other.example/");
  });

  it("requires an explicit target when homepage is unavailable", async () => {
    const cwd = await project();
    await expect(initProject({ cwd })).rejects.toThrow(/target URL/);
  });

  it("uses the declared package manager in generated instructions and CI", async () => {
    const cwd = await project({ name: "site", packageManager: "pnpm@10.15.0", scripts: {} });
    const result = await initProject({ cwd, target: "https://example.com", ci: true });
    expect(result.runCommand).toBe("pnpm agentlint");
    expect(await readFile(join(cwd, "AGENTS.md"), "utf8")).toContain("pnpm exec agentlint task get");
    const workflow = await readFile(join(cwd, ".github/workflows/agentlint.yml"), "utf8");
    expect(workflow).toContain("pnpm install --frozen-lockfile");
    expect(workflow).toContain("pnpm exec agentlint scan --no-browser --json");
    expect(workflow).not.toContain("cache: npm");
  });
});
