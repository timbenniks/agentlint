import { defineCheck, fail, pass, warn } from "./helpers.ts";
import { AI_CRAWLERS } from "../constants.ts";
import { contentTypeIs, evidence } from "../engine/util.ts";

export const rawHtmlCheck = defineCheck({
  id: "raw-html-content",
  title: "available without JavaScript",
  category: "access",
  provenance: "HTTP",
  severity: "required",
  applicability: () => ({ applicable: true }),
  run(ctx) {
    const page = ctx.homepage;
    if (!page) return fail("Homepage could not be fetched.", []);
    const ev = [evidence("html", page.finalUrl, {
      textLength: page.textLength,
      contentRatio: Number(page.contentRatio.toFixed(3)),
      headings: page.headings.length,
      links: page.links.length,
      hasMain: page.hasMain,
      scriptBytes: page.scriptBytes,
    })];
    if (page.status >= 400) {
      return fail(`Homepage returned HTTP ${page.status}.`, ev);
    }
    if (page.textLength < 80 && page.scriptBytes > 800) {
      return fail("Homepage looks like a JavaScript-only shell.", ev, {
        priority: "P0",
        problem: "Little meaningful content in raw HTML",
        impact: "Agents that do not execute JavaScript cannot understand the page.",
        remediation: "Server-render primary content and keep a visible heading hierarchy.",
      });
    }
    if (page.textLength < 200) {
      return warn("Raw HTML has limited textual content.", ev, {
        priority: "P1",
        problem: "Sparse HTML content",
        impact: "Agents may miss the offering without executing JavaScript.",
        remediation: "Include key copy, headings, and links in the initial HTML.",
      });
    }
    return pass("Homepage exposes meaningful content without JavaScript.", ev);
  },
});

export const aiCrawlerCheck = defineCheck({
  id: "ai-crawler-access",
  title: "AI crawler access",
  category: "access",
  provenance: "HTTP",
  severity: "required",
  applicability: () => ({ applicable: true }),
  run(ctx) {
    const results = ctx.discovered.crawlerAccess;
    const ev = [evidence("http", ctx.target.finalUrl, results)];
    const blocked = results.filter((r) => r.blocked);
    const allowed = results.filter((r) => !r.blocked);
    if (blocked.length === results.length) {
      return fail("All tested AI crawlers appear blocked.", ev, {
        priority: "P0",
        problem: "AI crawlers are blocked",
        impact: "Training and retrieval bots cannot access the site.",
        remediation: "Allow major AI crawler user agents in robots.txt and edge/WAF rules unless that is intentional.",
      });
    }
    if (blocked.length > 0) {
      return warn(
        `Blocked: ${blocked.map((b) => b.userAgent).join(", ")}. Allowed: ${allowed.map((a) => a.userAgent).join(", ")}.`,
        ev,
        {
          priority: "P1",
          problem: "Some AI crawlers are blocked",
          impact: "Coverage across agent ecosystems is uneven.",
          remediation: "Review robots.txt and bot-management rules for the blocked user agents.",
        },
      );
    }
    return pass(`${AI_CRAWLERS.join(", ")} can retrieve the homepage.`, ev);
  },
});

export const robotsPolicyCheck = defineCheck({
  id: "robots-policy",
  title: "robots policy",
  category: "access",
  provenance: "HTTP",
  severity: "required",
  applicability: (ctx) =>
    ctx.discovered.robots?.valid
      ? { applicable: true }
      : { applicable: false, reason: "No valid robots.txt to evaluate." },
  run(ctx) {
    const results = ctx.discovered.crawlerAccess;
    const ev = [evidence("http", ctx.discovered.robots?.url ?? "", {
      groups: ctx.discovered.robots?.groups,
      perCrawler: results.map((r) => ({ ua: r.userAgent, robotsAllowed: r.robotsAllowed })),
    })];
    const denied = results.filter((r) => r.robotsAllowed === false);
    if (denied.length === results.length) {
      return fail("robots.txt disallows all tested AI crawlers.", ev, {
        priority: "P0",
        problem: "robots.txt blocks AI crawlers",
        impact: "Compliant crawlers will not index the site.",
        remediation: "Add explicit User-agent rules for GPTBot, ClaudeBot, and similar crawlers if access is intended.",
      });
    }
    if (denied.length > 0) {
      return warn(`robots.txt disallows ${denied.map((d) => d.userAgent).join(", ")}.`, ev);
    }
    return pass("robots.txt allows the tested AI crawlers.", ev);
  },
});

export const markdownNegotiationCheck = defineCheck({
  id: "markdown-negotiation",
  title: "markdown negotiation",
  category: "access",
  provenance: "HTTP",
  severity: "recommended",
  applicability: () => ({ applicable: true }),
  run(ctx) {
    const negotiated = ctx.discovered.markdown.find((m) => m.via === "negotiation");
    const ev = [evidence("header", negotiated?.url ?? ctx.target.finalUrl, negotiated)];
    if (!negotiated) return fail("Markdown negotiation was not tested.", ev);
    const isMd = /markdown/.test(negotiated.contentType);
    if (isMd && negotiated.status >= 200 && negotiated.status < 300) {
      return pass("Canonical URL serves text/markdown when requested.", ev);
    }
    return fail("Accept: text/markdown does not return Markdown.", ev, {
      priority: "P2",
      problem: "No Markdown content negotiation",
      impact: "Agents must parse HTML even when they asked for Markdown.",
      remediation: "Honor Accept: text/markdown or advertise an alternate Markdown URL.",
    });
  },
});

export const markdownFallbackCheck = defineCheck({
  id: "markdown-fallback",
  title: "markdown URL fallback",
  category: "access",
  provenance: "HTTP",
  severity: "recommended",
  applicability: () => ({ applicable: true }),
  run(ctx) {
    const fallbacks = ctx.discovered.markdown.filter((m) => m.via === "fallback");
    const hit = fallbacks.find((m) => m.status >= 200 && m.status < 300 && /markdown|plain/.test(m.contentType));
    const ev = [evidence("http", ctx.target.origin, fallbacks.map((f) => ({ url: f.url, status: f.status, type: f.contentType })))];
    if (hit) return pass(`Markdown fallback found at ${hit.url}.`, ev);
    const alt = ctx.discovered.markdown.find((m) => m.via === "alternate" && m.status >= 200 && m.status < 300);
    if (alt) return pass(`Markdown alternate link resolves (${alt.url}).`, ev);
    return fail("No /index.md or page.md fallback was found.", ev, {
      priority: "P2",
      problem: "No Markdown URL fallback",
      impact: "Agents cannot fetch a simpler representation by convention.",
      remediation: "Publish .md versions of key pages or link them via rel=alternate.",
    });
  },
});

export const markdownAlternateCheck = defineCheck({
  id: "markdown-alternate",
  title: "markdown alternate link",
  category: "access",
  provenance: "STATIC",
  severity: "emerging",
  applicability: () => ({ applicable: true }),
  run(ctx) {
    const href = ctx.homepage?.alternateMarkdown;
    const ev = [evidence("html", ctx.target.finalUrl, { alternateMarkdown: href })];
    if (href) return pass(`Found rel=alternate type=text/markdown (${href}).`, ev);
    return fail("No Markdown alternate link in the homepage HTML.", ev);
  },
});

export const notFoundCheck = defineCheck({
  id: "agent-friendly-404",
  title: "agent-friendly 404",
  category: "access",
  provenance: "HTTP",
  severity: "recommended",
  applicability: () => ({ applicable: true }),
  run(ctx) {
    const res = ctx.discovered.notFound;
    const ev = [evidence("http", res?.url ?? "", {
      status: res?.status,
      contentType: res?.contentType,
    })];
    if (!res) return fail("404 probe was not run.", ev);
    if (res.status === 200) {
      return fail("Impossible URL returned HTTP 200 instead of 404.", ev, {
        priority: "P1",
        problem: "Soft 404",
        impact: "Agents cannot tell missing resources from real pages.",
        remediation: "Return HTTP 404 for unknown paths. Do not serve the homepage.",
      });
    }
    if (res.status === 404) {
      const useful = contentTypeIs(res.headers, "json") || contentTypeIs(res.headers, "markdown") || res.body.length > 80;
      if (useful) return pass("Unknown URLs return HTTP 404 with a useful body.", ev);
      return pass("Unknown URLs return HTTP 404.", ev);
    }
    if (res.status === 403 || res.status === 401) {
      return warn(`Probe URL returned HTTP ${res.status} instead of 404.`, ev);
    }
    return warn(`Probe URL returned HTTP ${res.status}.`, ev);
  },
});

export const accessChecks = [
  rawHtmlCheck,
  aiCrawlerCheck,
  robotsPolicyCheck,
  markdownNegotiationCheck,
  markdownFallbackCheck,
  markdownAlternateCheck,
  notFoundCheck,
];
