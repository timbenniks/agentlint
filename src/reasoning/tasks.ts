import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReasoningTask, ScanContext } from "../types.ts";
import {
  docsQualitySchema,
  entityIdentificationSchema,
  offeringClaritySchema,
} from "./schemas.ts";

function prompt(name: string): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    return readFileSync(join(here, "prompts", name), "utf8").trim();
  } catch {
    return fallbackPrompts[name] ?? "Use only the supplied evidence. Return JSON.";
  }
}

const fallbackPrompts: Record<string, string> = {
  "entity-identification-v1.md":
    "Identify the primary entity represented by this website using only the supplied evidence. Never identify hosting providers, CDNs, analytics platforms, JavaScript frameworks, infrastructure vendors, or dependencies as the website's primary entity unless the website explicitly represents that entity.",
  "offering-clarity-v1.md":
    "Evaluate whether an AI agent can understand what this website offers. Use ONLY the supplied evidence. Do not use external knowledge.",
  "docs-quality-v1.md":
    "Evaluate whether docs answer what this is, when to use it, how to get started, prerequisites, authentication, a minimal example, failure behavior, and where the API lives.",
};

function task(
  id: string,
  title: string,
  instructions: string,
  evidence: Record<string, unknown>,
  outputSchema: Record<string, unknown>,
): ReasoningTask {
  return {
    taskVersion: "1",
    id,
    type: "reasoning",
    title,
    instructions,
    evidence,
    outputSchema,
    status: "pending",
  };
}

export function entityIdentificationTask(ctx: ScanContext): ReasoningTask {
  const page = ctx.homepage;
  return task(
    "entity-identification",
    "Entity identification",
    prompt("entity-identification-v1.md"),
    {
      title: page?.title,
      h1: page?.headings.find((h) => h.level === 1)?.text,
      canonical: page?.canonical ?? ctx.target.canonicalUrl,
      jsonLd: ctx.discovered.jsonLd.map((i) => ({ types: i.types, name: i.data.name, description: i.data.description })),
      openGraph: page?.openGraph,
      description: page?.description,
      origin: ctx.target.origin,
    },
    entityIdentificationSchema as unknown as Record<string, unknown>,
  );
}

export function offeringClarityTask(ctx: ScanContext): ReasoningTask {
  const page = ctx.homepage;
  return task(
    "offering-clarity",
    "Offering clarity",
    prompt("offering-clarity-v1.md"),
    {
      title: page?.title,
      description: page?.description,
      h1: page?.headings.find((h) => h.level === 1)?.text,
      headings: page?.headings.slice(0, 12),
      textSample: page?.text?.slice(0, 2500),
      jsonLd: ctx.discovered.jsonLd.map((i) => ({ types: i.types, name: i.data.name, description: i.data.description })),
      llmsTxt: ctx.discovered.llmsTxt?.body.slice(0, 2000),
      entity: ctx.entity,
    },
    offeringClaritySchema as unknown as Record<string, unknown>,
  );
}

export function docsQualityTask(ctx: ScanContext): ReasoningTask {
  const portal = ctx.discovered.developerPortals.find((p) => p.status >= 200 && p.status < 400);
  const docsPage = ctx.pages.find((p) => /docs|developer|api/i.test(p.finalUrl));
  return task(
    "docs-quality",
    "Developer documentation quality",
    prompt("docs-quality-v1.md"),
    {
      portal,
      openApi: ctx.discovered.openApi
        ? {
            url: ctx.discovered.openApi.url,
            version: ctx.discovered.openApi.specVersion,
            operations: ctx.discovered.openApi.operations.length,
          }
        : undefined,
      docsTitle: docsPage?.title,
      docsSample: docsPage?.text?.slice(0, 3000),
      headings: docsPage?.headings.slice(0, 20),
    },
    docsQualitySchema as unknown as Record<string, unknown>,
  );
}
