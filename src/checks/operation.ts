import { defineCheck, fail, na, pass, warn } from "./helpers.ts";
import { evidence } from "../engine/util.ts";

export const semanticStructureCheck = defineCheck({
  id: "semantic-html",
  title: "semantic HTML",
  category: "operation",
  provenance: "BROWSER",
  severity: "required",
  applicability: () => ({ applicable: true }),
  run(ctx) {
    const browser = ctx.browser;
    if (!browser || browser.error) {
      const page = ctx.homepage;
      const ev = [evidence("html", ctx.target.finalUrl, {
        hasMain: page?.hasMain,
        headings: page?.headings.length,
        error: browser?.error,
      })];
      if (page?.hasMain && (page.headings.length ?? 0) > 0) {
        return pass("Static HTML exposes main content and headings.", ev);
      }
      if ((page?.headings.length ?? 0) > 0) {
        return warn("Headings exist, but no <main> landmark was found.", ev);
      }
      return fail("No semantic structure detected in HTML.", ev, {
        priority: "P1",
        problem: "Weak semantic structure",
        impact: "Agents struggle to find primary content.",
        remediation: "Use main, nav, header, footer, and a heading hierarchy.",
      });
    }
    const ev = [evidence("browser", browser.url, browser.landmarks)];
    const ok = browser.landmarks.main > 0 && browser.headings.length > 0;
    if (ok) {
      return pass(
        `Landmarks: main=${browser.landmarks.main}, nav=${browser.landmarks.nav}, header=${browser.landmarks.header}, footer=${browser.landmarks.footer}.`,
        ev,
      );
    }
    return fail("Missing main landmark or headings at runtime.", ev, {
      priority: "P1",
      problem: "Weak semantic structure",
      impact: "Browser agents struggle to find primary content.",
      remediation: "Use main, nav, header, footer, and a heading hierarchy.",
    });
  },
});

export const nativeControlsCheck = defineCheck({
  id: "native-controls",
  title: "native controls",
  category: "operation",
  provenance: "BROWSER",
  severity: "required",
  applicability: (ctx) =>
    ctx.browser && !ctx.browser.error
      ? { applicable: true }
      : { applicable: false, reason: "Browser evidence not available." },
  run(ctx) {
    const browser = ctx.browser!;
    const total = browser.controls.length;
    const native = browser.controls.filter((c) => c.native).length;
    const ev = [evidence("accessibility", browser.url, {
      total,
      native,
      clickableDivs: browser.clickableDivs,
    })];
    if (total === 0) return warn("No interactive controls were found.", ev);
    if (browser.clickableDivs > 0 && native / total < 0.85) {
      return warn(`${native}/${total} controls use native semantic elements (${browser.clickableDivs} clickable non-native).`, ev);
    }
    return pass(`${native}/${total} controls use native semantic elements.`, ev);
  },
});

export const accessibleNamesCheck = defineCheck({
  id: "accessible-names",
  title: "accessible names",
  category: "operation",
  provenance: "BROWSER",
  severity: "required",
  applicability: (ctx) =>
    ctx.browser && !ctx.browser.error
      ? { applicable: true }
      : { applicable: false, reason: "Browser evidence not available." },
  run(ctx) {
    const browser = ctx.browser!;
    const total = browser.controls.length;
    const named = browser.namedControls;
    const ev = [evidence("accessibility", browser.url, {
      total,
      named,
      unnamed: browser.unnamedControls,
    })];
    if (total === 0) return na("No interactive controls were found.");
    if (named === total) return pass(`${named}/${total} controls expose a computable name.`, ev);
    if (named / total >= 0.8) return warn(`${named}/${total} controls expose a computable name.`, ev);
    return fail(`${named}/${total} controls expose a computable name.`, ev, {
      priority: "P1",
      problem: "Controls lack accessible names",
      impact: "Agents cannot identify buttons, links, and inputs.",
      remediation: "Use visible text, labels, or aria-label on every control.",
    });
  },
});

export const webmcpCheck = defineCheck({
  id: "webmcp",
  title: "WebMCP",
  category: "operation",
  provenance: "BROWSER",
  severity: "emerging",
  applicability: (ctx) =>
    ctx.options.browser
      ? { applicable: true }
      : { applicable: false, reason: "Browser scanning disabled." },
  run(ctx) {
    const browser = ctx.browser;
    const ev = [evidence("browser", ctx.target.finalUrl, browser?.modelContext)];
    if (!browser || browser.error) {
      return fail(`WebMCP runtime inspection unavailable${browser?.error ? `: ${browser.error}` : "."}`, ev);
    }
    if (browser.modelContext.present) {
      const tools = browser.modelContext.tools;
      return pass(
        tools.length
          ? `Runtime API detected. Tools: ${tools.join(", ")}.`
          : "document.modelContext detected at runtime.",
        ev,
      );
    }
    return fail("document.modelContext was not detected at runtime.", ev);
  },
});

export const operationChecks = [
  semanticStructureCheck,
  nativeControlsCheck,
  accessibleNamesCheck,
  webmcpCheck,
];
