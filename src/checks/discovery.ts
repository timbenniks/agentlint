import { defineCheck, fail, pass, warn } from "./helpers.ts";
import { evidence, extractMarkdownLinks, looksLikeMarkdown } from "../engine/util.ts";
import { sameOrigin } from "../engine/url.ts";

export const robotsTxtCheck = defineCheck({
  id: "robots-txt",
  title: "robots.txt",
  category: "discovery",
  provenance: "HTTP",
  severity: "required",
  applicability: () => ({ applicable: true }),
  run(ctx) {
    const robots = ctx.discovered.robots;
    const ev = [evidence("http", robots?.url ?? `${ctx.target.origin}/robots.txt`, {
      status: robots?.status,
      valid: robots?.valid,
      sitemaps: robots?.sitemaps,
    })];
    if (!robots || robots.status === 404 || robots.status === 0) {
      return fail("robots.txt was not found.", ev, {
        priority: "P0",
        problem: "Missing robots.txt",
        impact: "AI crawlers cannot discover crawl policy or sitemap hints.",
        remediation: "Publish a robots.txt at the site origin, including Sitemap directives where appropriate.",
      });
    }
    if (robots.status === 401 || robots.status === 403) {
      return fail(`robots.txt returned HTTP ${robots.status}.`, ev, {
        priority: "P0",
        problem: "robots.txt is blocked",
        impact: "Crawlers cannot read crawl policy.",
        remediation: "Allow public GET access to /robots.txt.",
      });
    }
    if (!robots.valid) {
      return warn("robots.txt exists but does not look like a valid robots file.", ev, {
        priority: "P1",
        problem: "robots.txt syntax is unclear",
        impact: "Crawlers may ignore or misinterpret the policy.",
        remediation: "Use standard User-agent / Allow / Disallow / Sitemap directives.",
      });
    }
    return pass("robots.txt exists and is parseable.", ev);
  },
});

export const sitemapCheck = defineCheck({
  id: "sitemap",
  title: "sitemap.xml",
  category: "discovery",
  provenance: "HTTP",
  severity: "recommended",
  applicability: () => ({ applicable: true }),
  run(ctx) {
    const sitemap = ctx.discovered.sitemap;
    const ev = [evidence("http", sitemap?.url ?? `${ctx.target.origin}/sitemap.xml`, {
      status: sitemap?.status,
      kind: sitemap?.kind,
      urlCount: sitemap?.urls.length,
      valid: sitemap?.valid,
    })];
    if (!sitemap?.valid) {
      return fail("No valid sitemap was discovered.", ev, {
        priority: "P1",
        problem: "Missing or invalid sitemap",
        impact: "Agents and crawlers cannot enumerate important URLs.",
        remediation: "Publish /sitemap.xml or reference one from robots.txt.",
      });
    }
    return pass(`Sitemap found with ${sitemap.urls.length} URL(s).`, ev);
  },
});

export const canonicalHostCheck = defineCheck({
  id: "canonical-host-consistency",
  title: "canonical host consistency",
  category: "discovery",
  provenance: "STATIC",
  severity: "recommended",
  applicability: (ctx) => ctx.target.canonicalUrl
    ? { applicable: true }
    : { applicable: false, reason: "No canonical URL was found." },
  run(ctx) {
    const finalHost = new URL(ctx.target.finalUrl).host;
    const canonicalHost = new URL(ctx.target.canonicalUrl!).host;
    const sitemapHosts = [...new Set((ctx.discovered.sitemap?.urls ?? []).map((url) => {
      try { return new URL(url).host; } catch { return "invalid"; }
    }))];
    const ev = [evidence("html", ctx.target.finalUrl, { finalHost, canonicalHost, sitemapHosts })];
    if (finalHost === canonicalHost && sitemapHosts.every((host) => host === finalHost)) {
      return pass("Canonical, final, and sitemap hosts are consistent.", ev);
    }
    return warn(`Final host ${finalHost} differs from canonical or sitemap host signals.`, ev, {
      priority: "P2",
      problem: "Mixed canonical host signals",
      impact: "Agents may split identity, citations, and discovery across preview and production hosts.",
      remediation: "Use one public canonical host in canonical tags, sitemaps, robots.txt, llms.txt, and agent guidance, or clearly document that the scanned host is a preview alias.",
    });
  },
});

export const llmsTxtCheck = defineCheck({
  id: "llms-txt",
  title: "llms.txt",
  category: "discovery",
  provenance: "HTTP",
  severity: "recommended",
  applicability: () => ({ applicable: true }),
  async run(ctx) {
    const resource = ctx.discovered.llmsTxt;
    const ev = [evidence("text", resource?.url ?? `${ctx.target.origin}/llms.txt`, {
      status: resource?.status,
      bytes: resource?.body.length,
    })];
    if (!resource || resource.status >= 400 || !resource.body.trim()) {
      return fail("llms.txt was not found.", ev, {
        priority: "P1",
        problem: "No llms.txt",
        impact: "Agents lack a dedicated, concise map of the site.",
        remediation: "Add /llms.txt or /.well-known/llms.txt with Markdown links to key resources.",
      });
    }
    const body = resource.body.trim();
    if (body.length < 40) {
      return warn("llms.txt exists but is too short to be useful.", ev);
    }
    const links = extractMarkdownLinks(body);
    let resolved = 0;
    for (const href of links.slice(0, 8)) {
      const url = new URL(href, resource.url).href;
      if (!sameOrigin(url, ctx.target.origin) && !/^https?:/i.test(href)) continue;
      const res = await ctx.http.get(url);
      if (res.ok) resolved += 1;
    }
    ev.push(evidence("text", resource.url, { markdown: looksLikeMarkdown(body), links: links.length, resolved }));
    if (!looksLikeMarkdown(body)) {
      return warn("llms.txt exists but does not look like Markdown.", ev);
    }
    if (links.length === 0) {
      return warn("llms.txt has no Markdown links.", ev, {
        priority: "P2",
        problem: "llms.txt lacks links",
        impact: "Agents cannot follow through to docs or APIs.",
        remediation: "Add Markdown links to docs, APIs, and important pages.",
      });
    }
    return pass(`llms.txt found with ${links.length} link(s).`, ev);
  },
});

export const agentDiscoveryCheck = defineCheck({
  id: "agent-discovery",
  title: "agent discovery",
  category: "discovery",
  provenance: "HTTP",
  severity: "emerging",
  applicability: () => ({ applicable: true }),
  run(ctx) {
    const resource = ctx.discovered.agentsMd;
    const ev = [evidence("http", resource?.url ?? `${ctx.target.origin}/agents.md`, {
      status: resource?.status,
    })];
    if (resource && resource.status < 400 && resource.body.trim()) {
      return pass(`Agent discovery file found at ${resource.url}.`, ev);
    }
    return fail("No agents.md or related agent discovery file found.", ev);
  },
});

export const developerPortalCheck = defineCheck({
  id: "developer-portal",
  title: "developer portal",
  category: "discovery",
  provenance: "HTTP",
  severity: "recommended",
  applicability: (ctx) =>
    ctx.capabilities.hasOpenApi || ctx.capabilities.hasDeveloperPortal
      ? { applicable: true }
      : { applicable: true },
  run(ctx) {
    const portals = ctx.discovered.developerPortals.filter((p) => p.status >= 200 && p.status < 400);
    const ev = [evidence("http", ctx.target.origin, portals)];
    if (portals.length === 0) {
      if (!ctx.capabilities.api.hasReads && !ctx.capabilities.hasOpenApi) {
        return {
          status: "na",
          summary: "No developer portal needed; no public API surface detected.",
          evidence: ev,
        };
      }
      return fail("Developer documentation is difficult to discover.", ev, {
        priority: "P1",
        problem: "Developer resources difficult to discover",
        impact: "Agents cannot find how to integrate.",
        remediation: "Expose /docs, /developers, or /api and link them from the homepage.",
      });
    }
    return pass(`Developer resources found (${portals.map((p) => p.url).join(", ")}).`, ev);
  },
});

export const discoveryChecks = [
  robotsTxtCheck,
  sitemapCheck,
  canonicalHostCheck,
  llmsTxtCheck,
  agentDiscoveryCheck,
  developerPortalCheck,
];
