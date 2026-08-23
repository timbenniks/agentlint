import type { BrowserEvidence, ControlEvidence, HeadingNode } from "../types.ts";

function shortenBrowserError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Playwright failed";
  if (message.includes("Executable doesn't exist")) {
    return "Playwright Chromium is not installed. Run: npx playwright install chromium";
  }
  return message.split("\n")[0] ?? message;
}

export async function collectBrowserEvidence(
  url: string,
  _allowPrivate: boolean,
): Promise<BrowserEvidence> {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        javaScriptEnabled: true,
        ignoreHTTPSErrors: false,
      });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForTimeout(800);

      const snapshot = await page.evaluate(collectInPage);
      await context.close();
      return { url, ...snapshot };
    } finally {
      await browser.close();
    }
  } catch (error) {
    return {
      url,
      modelContext: { present: false, tools: [], detection: "unavailable" },
      landmarks: { main: 0, nav: 0, header: 0, footer: 0 },
      headings: [],
      controls: [],
      namedControls: 0,
      unnamedControls: 0,
      clickableDivs: 0,
      error: shortenBrowserError(error),
    };
  }
}

interface InPageSnapshot {
  title?: string;
  modelContext: BrowserEvidence["modelContext"];
  landmarks: BrowserEvidence["landmarks"];
  headings: HeadingNode[];
  controls: ControlEvidence[];
  namedControls: number;
  unnamedControls: number;
  clickableDivs: number;
}

function collectInPage(): InPageSnapshot {
  const doc = document as Document & { modelContext?: unknown };
  const nav = navigator as Navigator & { modelContext?: unknown };
  const win = window as Window & { modelContext?: unknown };

  const model = doc.modelContext ?? nav.modelContext ?? win.modelContext;
  const tools: string[] = [];
  let present = model !== undefined && model !== null;

  if (model && typeof model === "object") {
    const rec = model as Record<string, unknown>;
    const list =
      rec.tools ??
      (rec.listTools && typeof rec.listTools === "function" ? undefined : undefined);
    if (Array.isArray(list)) {
      for (const tool of list) {
        if (typeof tool === "string") tools.push(tool);
        else if (tool && typeof tool === "object" && "name" in tool) {
          const name = (tool as { name?: unknown }).name;
          if (typeof name === "string") tools.push(name);
        }
      }
    }
    if (typeof rec.getTools === "function") {
      try {
        const got = rec.getTools();
        if (Array.isArray(got)) {
          for (const tool of got) {
            if (tool && typeof tool === "object" && "name" in tool) {
              const name = (tool as { name?: unknown }).name;
              if (typeof name === "string") tools.push(name);
            }
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  const native = "button, a, input, select, textarea, summary";
  const controls: ControlEvidence[] = [];
  document.querySelectorAll(native).forEach((el, index) => {
    const tag = el.tagName.toLowerCase();
    const name = accessibleName(el);
    controls.push({
      tag,
      role: el.getAttribute("role") ?? undefined,
      name,
      native: true,
      selector: `${tag}:nth(${index})`,
    });
  });

  let clickableDivs = 0;
  document.querySelectorAll("div[onclick], span[onclick], div[role='button'], span[role='button']").forEach((el) => {
    clickableDivs += 1;
    const name = accessibleName(el);
    controls.push({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role") ?? undefined,
      name,
      native: false,
      selector: el.tagName.toLowerCase(),
    });
  });

  const namedControls = controls.filter((c) => c.name.trim()).length;
  const headings: HeadingNode[] = [];
  document.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((el) => {
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text) headings.push({ level: Number(el.tagName.slice(1)), text });
  });

  return {
    title: document.title || undefined,
    modelContext: {
      present,
      tools: [...new Set(tools)],
      detection: present ? "Playwright runtime inspection" : "Playwright runtime inspection (not found)",
    },
    landmarks: {
      main: document.querySelectorAll("main, [role='main']").length,
      nav: document.querySelectorAll("nav, [role='navigation']").length,
      header: document.querySelectorAll("header, [role='banner']").length,
      footer: document.querySelectorAll("footer, [role='contentinfo']").length,
    },
    headings,
    controls,
    namedControls,
    unnamedControls: controls.length - namedControls,
    clickableDivs,
  };

  function accessibleName(el: Element): string {
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const parts = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ");
      const text = parts.replace(/\s+/g, " ").trim();
      if (text) return text;
    }
    const aria = el.getAttribute("aria-label");
    if (aria?.trim()) return aria.trim();
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      if (el.labels && el.labels[0]) {
        const t = (el.labels[0].textContent ?? "").replace(/\s+/g, " ").trim();
        if (t) return t;
      }
      if (el.getAttribute("placeholder")) return el.getAttribute("placeholder") ?? "";
      if (el instanceof HTMLInputElement && el.value && el.type === "submit") return el.value;
    }
    if (el instanceof HTMLImageElement && el.alt) return el.alt;
    return (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  }
}
