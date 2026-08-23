import { describe, expect, it } from "vitest";
import { parseScanOptions, rewriteArgv } from "../src/cli/index.ts";

describe("scan options", () => {
  it("disables the browser when --no-browser is set", () => {
    const options = parseScanOptions("https://example.com", { browser: false });
    expect(options.browser).toBe(false);
  });

  it("defaults to browser scanning", () => {
    const options = parseScanOptions("https://example.com", {});
    expect(options.browser).toBe(true);
    expect(options.missions).toBe(false);
  });

  it("enables bounded missions explicitly", () => {
    const options = parseScanOptions("https://example.com", { missions: true });
    expect(options.missions).toBe(true);
  });

  it("accepts HTML as a report format", () => {
    const options = parseScanOptions("https://example.com", { format: "html" });
    expect(options.format).toBe("html");
  });
});

describe("argv rewrite", () => {
  it("inserts scan when the first argument looks like a URL", () => {
    expect(rewriteArgv(["node", "agentlint", "https://example.com", "--json"])).toEqual([
      "node",
      "agentlint",
      "scan",
      "https://example.com",
      "--json",
    ]);
    expect(rewriteArgv(["node", "agentlint", "tasks"])).toEqual(["node", "agentlint", "tasks"]);
  });
});
