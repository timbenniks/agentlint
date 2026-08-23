import { defineCheck, fail, pass, warn } from "./helpers.ts";
import { estimateTokens, evidence } from "../engine/util.ts";
import { recognizedJsonLd } from "../engine/html.ts";
import { TRUST_PATHS } from "../constants.ts";
import { entityIdentificationTask, offeringClarityTask } from "../reasoning/tasks.ts";

export const jsonLdCheck = defineCheck({
  id: "json-ld",
  title: "structured metadata",
  category: "understanding",
  provenance: "STATIC",
  severity: "recommended",
  applicability: () => ({ applicable: true }),
  run(ctx) {
    const items = ctx.discovered.jsonLd.filter((i) => i.types.length > 0);
    const recognized = items.filter(recognizedJsonLd);
    const ev = [evidence("jsonld", ctx.target.finalUrl, items.map((i) => ({ types: i.types, name: i.data.name })))];
    if (items.length === 0) {
      return fail("No JSON-LD blocks found.", ev, {
        priority: "P1",
        problem: "Missing JSON-LD",
        impact: "Agents cannot deterministically identify the entity.",
        remediation: "Add JSON-LD for Person, Organization, Product, or WebSite with name, url, and description.",
      });
    }
    const named = recognized.filter((i) => typeof i.data.name === "string");
    if (named.length === 0) {
      return warn(`JSON-LD found (${items.map((i) => i.types.join("/")).join(", ")}) but no recognized typed name.`, ev);
    }
    return pass(`JSON-LD present: ${named.map((i) => `${i.types[0]}:${String(i.data.name)}`).join(", ")}.`, ev);
  },
});

export const entityCheck = defineCheck({
  id: "entity-identity",
  title: "clear entity identity",
  category: "understanding",
  provenance: "STATIC",
  severity: "required",
  applicability: () => ({ applicable: true }),
  run(ctx) {
    const entity = ctx.entity;
    const page = ctx.homepage;
    const ev = [
      evidence("html", ctx.target.finalUrl, {
        title: page?.title,
        h1: page?.headings.find((h) => h.level === 1)?.text,
        jsonLd: ctx.discovered.jsonLd.map((i) => i.types),
        entity,
      }),
    ];
    const task = entityIdentificationTask(ctx);
    if (!entity || entity.confidence < 0.75 || entity.entityType === "unknown") {
      return warn("Entity identity is not deterministic; reasoning required.", ev, undefined, {
        reasoningTask: task,
      });
    }
    return pass(`${entity.entity} (${entity.entityType}, confidence ${entity.confidence}).`, ev, {
      reasoningTask: entity.confidence < 0.9 ? task : undefined,
    });
  },
});

export const metadataCheck = defineCheck({
  id: "metadata",
  title: "page metadata",
  category: "understanding",
  provenance: "STATIC",
  severity: "required",
  applicability: () => ({ applicable: true }),
  run(ctx) {
    const page = ctx.homepage;
    if (!page) return fail("Homepage missing.", []);
    const missing: string[] = [];
    if (!page.title) missing.push("title");
    if (!page.description) missing.push("description");
    if (!page.canonical) missing.push("canonical");
    if (!page.language) missing.push("language");
    const ev = [evidence("html", page.finalUrl, {
      title: page.title,
      description: page.description,
      canonical: page.canonical,
      language: page.language,
      openGraph: page.openGraph,
    })];
    if (missing.length >= 3) {
      return fail(`Missing metadata: ${missing.join(", ")}.`, ev, {
        priority: "P1",
        problem: "Incomplete page metadata",
        impact: "Agents get a weak identity signal from the homepage.",
        remediation: "Set title, meta description, canonical URL, and html lang.",
      });
    }
    if (missing.length > 0) {
      return warn(`Incomplete metadata: missing ${missing.join(", ")}.`, ev);
    }
    return pass("Title, description, canonical, and language are present.", ev);
  },
});

export const offeringCheck = defineCheck({
  id: "offering-clarity",
  title: "offering clarity",
  category: "understanding",
  provenance: "LLM",
  severity: "recommended",
  applicability: () => ({ applicable: true }),
  run(ctx) {
    const task = offeringClarityTask(ctx);
    return warn("Offering clarity requires reasoning.", [
      evidence("html", ctx.target.finalUrl, task.evidence),
    ], undefined, { reasoningTask: task });
  },
});

export const trustAnchorsCheck = defineCheck({
  id: "trust-anchors",
  title: "trust anchors",
  category: "understanding",
  provenance: "HTTP",
  severity: "recommended",
  applicability: (ctx) => {
    const type = ctx.entity?.entityType;
    if (type === "person" || type === "project") {
      return { applicable: false, reason: "Trust pages are optional for personal or project sites." };
    }
    return { applicable: true };
  },
  run(ctx) {
    const found: string[] = [];
    const links = ctx.pages.flatMap((p) => p.links);
    for (const group of TRUST_PATHS) {
      const hit = links.some((l) => group.paths.some((path) => l.href.endsWith(path) || l.href.includes(path)))
        || group.paths.some((path) =>
          ctx.pages.some((p) => new URL(p.finalUrl).pathname.replace(/\/$/, "") === path),
        )
        || links.some((l) => new RegExp(group.id, "i").test(l.text));
      if (hit) found.push(group.id);
    }
    const ev = [evidence("html", ctx.target.finalUrl, { found })];
    if (found.length >= 3) return pass(`Found trust pages: ${found.join(", ")}.`, ev);
    if (found.length > 0) return warn(`Only found: ${found.join(", ")}.`, ev);
    return fail("No About, Contact, Privacy, Terms, or Security pages were detected.", ev, {
      priority: "P2",
      problem: "Missing trust anchors",
      impact: "Agents cannot verify who operates the site.",
      remediation: "Link About and Contact from the homepage. Add Privacy/Terms if you process user data.",
    });
  },
});

export const contentSizeCheck = defineCheck({
  id: "content-size",
  title: "content size",
  category: "understanding",
  provenance: "STATIC",
  severity: "bonus",
  applicability: () => ({ applicable: true }),
  run(ctx) {
    const sizes = ctx.pages.map((p) => ({
      url: p.finalUrl,
      tokens: estimateTokens(p.text ?? ""),
    }));
    const huge = sizes.filter((s) => s.tokens > 50_000);
    const ev = [evidence("html", ctx.target.finalUrl, sizes.slice(0, 10))];
    if (huge.length > 0) {
      return warn(
        `${huge.length} page(s) exceed ~50k tokens and may be hard to consume in one pass.`,
        ev,
      );
    }
    return pass("Important pages are a reasonable size for agents to consume.", ev);
  },
});

export const understandingChecks = [
  jsonLdCheck,
  entityCheck,
  metadataCheck,
  offeringCheck,
  trustAnchorsCheck,
  contentSizeCheck,
];
