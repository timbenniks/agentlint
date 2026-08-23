import { defineCheck, fail, na, pass, warn } from "./helpers.ts";
import { evidence } from "../engine/util.ts";
import { isStableOperationId, schemaComplexityIssues } from "../protocols/openapi.ts";
import { docsQualityTask } from "../reasoning/tasks.ts";

export const openApiDiscoveryCheck = defineCheck({
  id: "openapi-discovery",
  title: "OpenAPI",
  category: "developer",
  provenance: "HTTP",
  severity: "recommended",
  applicability: () => ({ applicable: true }),
  run(ctx) {
    const spec = ctx.discovered.openApi;
    const ev = [evidence("openapi", spec?.url ?? ctx.target.origin, {
      found: Boolean(spec),
      version: spec?.specVersion,
      valid: spec?.valid,
      operations: spec?.operations.length,
    })];
    if (!spec) {
      if (!ctx.capabilities.hasDeveloperPortal) {
        return na("No product API surface detected.");
      }
      return fail("No OpenAPI document was discovered.", ev, {
        priority: "P1",
        problem: "Missing OpenAPI",
        impact: "Agents cannot convert HTTP APIs into tools reliably.",
        remediation: "Publish /openapi.json (OpenAPI 3.1) and link it from developer docs.",
      });
    }
    if (!spec.valid) {
      return fail(`OpenAPI found but invalid: ${spec.parseError ?? "unparseable"}.`, ev);
    }
    return pass(`OpenAPI ${spec.specVersion} with ${spec.operations.length} operation(s).`, ev);
  },
});

export const operationIdCheck = defineCheck({
  id: "operation-ids",
  title: "function-call compatible operationIds",
  category: "developer",
  provenance: "PROTOCOL",
  severity: "recommended",
  applicability: (ctx) =>
    ctx.discovered.openApi?.valid
      ? { applicable: true }
      : { applicable: false, reason: "No OpenAPI document detected." },
  run(ctx) {
    const ops = ctx.discovered.openApi?.operations ?? [];
    const withId = ops.filter((o) => isStableOperationId(o.operationId));
    const ev = [evidence("openapi", ctx.discovered.openApi?.url ?? "", {
      total: ops.length,
      withOperationId: withId.length,
    })];
    if (ops.length === 0) return warn("OpenAPI has no operations.", ev);
    if (withId.length === ops.length) {
      return pass(`${withId.length}/${ops.length} operations have a stable operationId.`, ev);
    }
    if (withId.length === 0) {
      return fail("No operations declare a stable operationId.", ev, {
        priority: "P1",
        problem: "Missing operationId",
        impact: "Tool-calling adapters invent unstable function names.",
        remediation: "Add unique camelCase operationId values to every operation.",
      });
    }
    return warn(`${withId.length}/${ops.length} operations have a stable operationId.`, ev);
  },
});

export const typedInputsCheck = defineCheck({
  id: "typed-inputs",
  title: "typed request schemas",
  category: "developer",
  provenance: "PROTOCOL",
  severity: "recommended",
  applicability: (ctx) =>
    ctx.discovered.openApi?.valid
      ? { applicable: true }
      : { applicable: false, reason: "No OpenAPI document detected." },
  run(ctx) {
    const ops = ctx.discovered.openApi?.operations ?? [];
    const typed = ops.filter((o) => o.hasRequestSchema || o.method === "get" || o.method === "delete");
    const ev = [evidence("openapi", ctx.discovered.openApi?.url ?? "", {
      total: ops.length,
      typed: typed.length,
    })];
    if (typed.length === ops.length) return pass(`${typed.length}/${ops.length} operations have typed inputs.`, ev);
    return warn(`${typed.length}/${ops.length} operations have typed inputs.`, ev);
  },
});

export const typedResponsesCheck = defineCheck({
  id: "typed-responses",
  title: "typed responses",
  category: "developer",
  provenance: "PROTOCOL",
  severity: "recommended",
  applicability: (ctx) =>
    ctx.discovered.openApi?.valid
      ? { applicable: true }
      : { applicable: false, reason: "No OpenAPI document detected." },
  run(ctx) {
    const ops = ctx.discovered.openApi?.operations ?? [];
    const typed = ops.filter((o) => o.hasResponseSchema);
    const ev = [evidence("openapi", ctx.discovered.openApi?.url ?? "", {
      total: ops.length,
      typed: typed.length,
    })];
    if (typed.length === ops.length) return pass(`${typed.length}/${ops.length} operations have typed responses.`, ev);
    if (typed.length === 0) return fail("No operations declare typed success responses.", ev);
    return warn(`${typed.length}/${ops.length} operations have typed responses.`, ev);
  },
});

export const functionCallingCheck = defineCheck({
  id: "function-calling",
  title: "function-call compatible",
  category: "developer",
  provenance: "PROTOCOL",
  severity: "recommended",
  applicability: (ctx) =>
    ctx.discovered.openApi?.valid
      ? { applicable: true }
      : { applicable: false, reason: "No OpenAPI document detected." },
  run(ctx) {
    const spec = ctx.discovered.openApi!;
    const ops = spec.operations;
    const withId = ops.filter((o) => isStableOperationId(o.operationId)).length;
    const typedIn = ops.filter((o) => o.hasRequestSchema || o.method === "get").length;
    const typedOut = ops.filter((o) => o.hasResponseSchema).length;
    const issues = schemaComplexityIssues(spec.document);
    const ev = [evidence("openapi", spec.url, { withId, typedIn, typedOut, total: ops.length, issues })];
    const ok = withId === ops.length && typedOut === ops.length && issues.length === 0;
    const summary = `${withId}/${ops.length} operationId, ${typedIn}/${ops.length} typed inputs, ${typedOut}/${ops.length} typed outputs. Compatible with common OpenAI, Anthropic and Gemini tool-schema constraints.`;
    if (ok) return pass(summary, ev);
    if (withId === 0 || typedOut === 0) return fail(summary, ev);
    return warn(`${summary}${issues.length ? ` Issues: ${issues.join("; ")}` : ""}`, ev);
  },
});

export const docsQualityCheck = defineCheck({
  id: "docs-quality",
  title: "developer docs quality",
  category: "developer",
  provenance: "LLM",
  severity: "recommended",
  applicability: (ctx) =>
    ctx.capabilities.hasDeveloperPortal || ctx.capabilities.hasOpenApi
      ? { applicable: true }
      : { applicable: false, reason: "No developer documentation surface detected." },
  run(ctx) {
    const task = docsQualityTask(ctx);
    return warn("Developer documentation quality requires reasoning.", [
      evidence("html", ctx.target.finalUrl, task.evidence),
    ], undefined, { reasoningTask: task });
  },
});

export const developerChecks = [
  openApiDiscoveryCheck,
  operationIdCheck,
  typedInputsCheck,
  typedResponsesCheck,
  functionCallingCheck,
  docsQualityCheck,
];
