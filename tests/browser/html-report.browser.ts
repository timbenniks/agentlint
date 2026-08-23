import { createServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { renderHtml } from "../../src/reporters/html.ts";
import type { ScanReport } from "../../src/types.ts";

const longToken = "operation_" + "agent_safe_read_only_".repeat(20);
const prompt = `# Agentlint remediation loop

Use this deliberately long unbroken value to verify containment:
${longToken}

1. Make the smallest evidence-backed change.
2. Rescan the target.
`.repeat(8);

describe("standalone HTML report in a browser", () => {
  let browser: Browser;
  let closeServer: () => Promise<void>;
  let reportUrl: string;

  beforeAll(async () => {
    const html = renderHtml(fixtureReport(), prompt);
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(html);
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("HTML report server did not bind");
    reportUrl = `http://127.0.0.1:${address.port}/report`;
    closeServer = () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser?.close();
    await closeServer?.();
  });

  it("contains expanded prompts and long content at desktop width", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(reportUrl).origin });
    const page = await context.newPage();
    await page.goto(reportUrl);

    expect(await page.locator("h1").allTextContents()).toEqual(["Evidence trace"]);
    expect(await page.locator(".target-link b").innerText()).toBe("release-fixture.example");
    expect(await page.locator(".mark path[stroke-linecap=square]").count()).toBe(2);
    await expectNoDocumentOverflow(page);

    await page.getByText("Preview complete fix prompt", { exact: true }).click();
    const bounds = await page.evaluate(() => {
      const section = document.querySelector(".prompt-section")!.getBoundingClientRect();
      const details = document.querySelector(".prompt-details")!.getBoundingClientRect();
      const preview = document.querySelector(".prompt-details pre")!;
      const pre = preview.getBoundingClientRect();
      return {
        sectionRight: section.right,
        detailsRight: details.right,
        preRight: pre.right,
        previewClientHeight: preview.clientHeight,
        previewScrollHeight: preview.scrollHeight,
        bodyWidth: document.body.scrollWidth,
        viewportWidth: innerWidth,
      };
    });
    expect(bounds.detailsRight).toBeLessThanOrEqual(bounds.sectionRight + 1);
    expect(bounds.preRight).toBeLessThanOrEqual(bounds.sectionRight + 1);
    expect(bounds.bodyWidth).toBeLessThanOrEqual(bounds.viewportWidth);
    expect(bounds.previewScrollHeight).toBeGreaterThan(bounds.previewClientHeight);

    await page.getByRole("button", { name: /Copy fix prompt/ }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(prompt.trim());
    expect(await page.getByRole("button", { name: /Fix prompt copied/ }).isVisible()).toBe(true);
    await context.close();
  });

  it("filters checks and preserves keyboard-visible structure", async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(reportUrl);

    await page.keyboard.press("Tab");
    expect(await page.locator(":focus").getAttribute("class")).toBe("skip-link");
    expect(await page.locator("h1").count()).toBe(1);
    expect(await page.getByRole("button", { name: /Action needed/ }).getAttribute("aria-pressed")).toBe("false");

    await page.getByRole("button", { name: /Action needed/ }).click();
    expect(await page.getByRole("button", { name: /Action needed/ }).getAttribute("aria-pressed")).toBe("true");
    expect(await page.locator("[data-check]:visible").count()).toBe(2);
    expect(await page.locator("[data-check][data-status=pass]:visible").count()).toBe(0);
    expect(await page.locator("[data-check][data-status=na]:visible").count()).toBe(0);
    await context.close();
  });

  it("stays contained on mobile in light and dark modes", async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "light" });
    const page = await context.newPage();
    await page.goto(reportUrl);
    const lightBackground = await page.locator("body").evaluate((element) => getComputedStyle(element).backgroundColor);
    await expectNoDocumentOverflow(page);

    await page.getByText("Preview complete fix prompt", { exact: true }).click();
    await expectNoDocumentOverflow(page);
    const promptFits = await page.evaluate(() => {
      const section = document.querySelector(".prompt-section")!.getBoundingClientRect();
      const preview = document.querySelector(".prompt-details pre")!.getBoundingClientRect();
      return preview.left >= section.left - 1 && preview.right <= section.right + 1;
    });
    expect(promptFits).toBe(true);

    await page.emulateMedia({ colorScheme: "dark" });
    const darkBackground = await page.locator("body").evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(darkBackground).not.toBe(lightBackground);
    await context.close();
  });
});

async function expectNoDocumentOverflow(page: import("playwright").Page) {
  const widths = await page.evaluate(() => ({ body: document.body.scrollWidth, root: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(widths.body).toBeLessThanOrEqual(widths.viewport);
  expect(widths.root).toBeLessThanOrEqual(widths.viewport);
}

function fixtureReport(): ScanReport {
  const categories = [
    { id: "discovery" as const, title: "Discovery", score: 92, earned: 11, available: 12, passed: 1, warnings: 1, failed: 0, na: 0 },
    { id: "access" as const, title: "Access", score: 50, earned: 5, available: 10, passed: 0, warnings: 0, failed: 1, na: 1 },
  ];
  return {
    schemaVersion: "1",
    agentlintVersion: "0.1.0",
    scanId: "scan_browser_fixture",
    target: {
      inputUrl: `https://release-fixture.example/${"very-long-path/".repeat(20)}`,
      origin: "https://release-fixture.example",
      finalUrl: `https://release-fixture.example/${"very-long-path/".repeat(20)}`,
      canonicalUrl: "https://release-fixture.example/",
    },
    startedAt: "2026-08-23T10:00:00.000Z",
    completedAt: "2026-08-23T10:01:00.000Z",
    score: { overall: 75, surface: 80, taskSuccess: 70, categories, passed: 1, warnings: 1, failed: 1, na: 1, label: "Good" },
    categories,
    capabilities: {
      api: { hasReads: true, hasWrites: false, hasDelete: false, hasCollections: true, hasPagination: false, hasLongRunningOperations: false, hasAuthenticatedOperations: false, hasBulkOperations: false },
      hasOpenApi: true,
      hasMcp: false,
      hasBrowser: true,
      hasLlmsTxt: true,
      hasDeveloperPortal: true,
      jsRequired: false,
    },
    checks: [
      { id: "robots", title: "Crawler policy", category: "discovery", provenance: "HTTP", severity: "required", status: "pass", score: 10, maxScore: 10, summary: "Crawlers are allowed.", evidence: [] },
      { id: "canonical", title: "Canonical host consistency", category: "discovery", provenance: "STATIC", severity: "recommended", status: "warning", score: 1, maxScore: 2, summary: "Preview and canonical hosts differ.", evidence: [{ type: "html", source: "https://release-fixture.example/", value: longToken, collectedAt: "2026-08-23T10:00:00.000Z" }] },
      { id: "raw-html", title: "Raw HTML content", category: "access", provenance: "HTTP", severity: "required", status: "fail", score: 0, maxScore: 10, summary: "The response depends on JavaScript.", evidence: [], recommendation: { priority: "P1", problem: "Content is not present in HTML", impact: "Agents cannot read the page.", remediation: "Render the primary content on the server." } },
      { id: "auth", title: "Authentication", category: "access", provenance: "PROTOCOL", severity: "recommended", status: "na", summary: "No authenticated API exists.", evidence: [], naReason: "No API authentication applies." },
    ],
    reasoningTasks: [{ taskVersion: "1", id: "offering-clarity", type: "reasoning", kind: "judgment", title: "Offering clarity", instructions: "Use evidence.", evidence: {}, outputSchema: {}, status: "resolved", result: { score: 70 } }],
    journeys: [{ id: "mission-content", title: "Content discovery", taskId: "mission-content", status: "warning", score: 70, summary: "A safe path exists but is indirect.", metrics: { requestsPlanned: 2, evidenceItemsUsed: 1 } }],
  };
}
