import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeReports } from "../src/engine/state.ts";
import { renderHtml } from "../src/reporters/html.ts";
import type { ScanReport } from "../src/types.ts";

function report(): ScanReport {
  const category = { id: "access" as const, title: "Access", score: 72, earned: 7, available: 10, passed: 1, warnings: 1, failed: 0, na: 1 };
  return {
    schemaVersion: "1",
    agentlintVersion: "0.1-test",
    scanId: "scan_html_test",
    target: {
      inputUrl: "https://example.com",
      origin: "https://example.com",
      finalUrl: "https://example.com/",
      canonicalUrl: "https://example.com/",
    },
    startedAt: "2026-08-23T10:00:00.000Z",
    completedAt: "2026-08-23T10:01:00.000Z",
    score: { overall: 72, surface: 72, taskSuccess: null, categories: [category], passed: 1, warnings: 1, failed: 0, na: 1, label: "Good" },
    categories: [category],
    capabilities: {
      api: { hasReads: true, hasWrites: false, hasDelete: false, hasCollections: false, hasPagination: false, hasLongRunningOperations: false, hasAuthenticatedOperations: false, hasBulkOperations: false },
      hasOpenApi: true,
      hasMcp: false,
      hasBrowser: true,
      hasLlmsTxt: false,
      hasDeveloperPortal: true,
      jsRequired: false,
    },
    checks: [
      { id: "crawler-access", title: "Crawler access", category: "access", provenance: "HTTP", severity: "required", status: "pass", score: 5, maxScore: 5, summary: "Public content is retrievable.", evidence: [] },
      {
        id: "unsafe-evidence",
        title: "Evidence is <script>alert(1)</script>",
        category: "access",
        provenance: "STATIC",
        severity: "recommended",
        status: "warning",
        score: 2,
        maxScore: 5,
        summary: "A warning needs remediation.",
        evidence: [{ type: "text", source: "https://example.com/?q=</script>", value: "<img src=x onerror=alert(1)>", collectedAt: "2026-08-23T10:00:00.000Z" }],
        recommendation: { priority: "P1", problem: "Evidence is incomplete", impact: "Agents may guess.", remediation: "Add a grounded example." },
      },
      { id: "api-auth", title: "API authentication", category: "access", provenance: "PROTOCOL", severity: "recommended", status: "na", summary: "No authenticated API was observed.", evidence: [], naReason: "Authentication does not apply." },
    ],
    reasoningTasks: [],
    journeys: [],
  };
}

describe("HTML report", () => {
  it("renders a self-contained interactive overview and escapes scanned content", () => {
    const html = renderHtml(report(), "# Fix\n\nDo not run <script>alert(2)</script>.");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("data-copy-prompt");
    expect(html).toContain("data-filter=\"action\"");
    expect(html).toContain('<h1 id="report-title">Evidence trace</h1>');
    expect(html).toContain('<b>example.com</b>');
    expect(html).toContain('stroke-linecap="square"');
    expect(html).toContain("grid-template-columns:minmax(300px,.8fr) minmax(0,1.2fr)");
    expect(html).toContain(".prompt-copy,.prompt-details{min-width:0}");
    expect(html).toContain("white-space:pre-wrap;overflow-wrap:anywhere");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("Do not run &lt;script&gt;alert(2)&lt;/script&gt;.");
    expect(html).not.toContain("Evidence is <script>alert(1)</script>");
    expect(html).not.toContain("<link rel=\"stylesheet\"");
    expect(html).not.toMatch(/<script[^>]+src=/);
  });

  it("writes latest and immutable per-scan HTML beside JSON and Markdown", async () => {
    const output = await mkdtemp(join(tmpdir(), "agentlint-html-"));
    await writeReports(output, report(), "# report", "# fix prompt");
    const latest = await readFile(join(output, "latest.html"), "utf8");
    const historical = await readFile(join(output, "scans", "scan_html_test.html"), "utf8");
    expect(latest).toContain("Copy fix prompt");
    expect(historical).toBe(latest);
  });
});
