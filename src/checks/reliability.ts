import { defineCheck, fail, na, pass, warn } from "./helpers.ts";
import { evidence } from "../engine/util.ts";

const noApi = (reason: string) => ({
  applicable: false as const,
  reason,
});

export const reliabilityChecks = [
  defineCheck({
    id: "json-errors",
    title: "JSON error responses",
    category: "reliability",
    provenance: "PROTOCOL",
    severity: "recommended",
    applicability: (ctx) =>
      ctx.capabilities.hasOpenApi
        ? { applicable: true }
        : noApi("No API surface detected."),
    run(ctx) {
      const operations = ctx.discovered.openApi?.operations ?? [];
      const typed = operations.filter((operation) => operation.typedErrorResponseCodes.length > 0);
      const ev = [evidence("openapi", ctx.discovered.openApi?.url ?? "", operations.map((operation) => ({
        operationId: operation.operationId,
        errorCodes: operation.responseCodes.filter((code) => !/^2/.test(code)),
        typedErrorCodes: operation.typedErrorResponseCodes,
      })))];
      if (typed.length === operations.length) return pass(`${typed.length}/${operations.length} operations declare typed error responses.`, ev);
      if (typed.length === 0) return fail("No operations declare typed error responses.", ev, {
        priority: "P1",
        problem: "Untyped API errors",
        impact: "Agents cannot recover from failures deterministically.",
        remediation: "Document typed application/problem+json or equivalent schemas for 4xx, 429, and 5xx responses.",
      });
      return warn(`${typed.length}/${operations.length} operations declare typed error responses.`, ev);
    },
  }),
  defineCheck({
    id: "rate-limit-headers",
    title: "rate-limit headers",
    category: "reliability",
    provenance: "HTTP",
    severity: "recommended",
    applicability: (ctx) =>
      ctx.capabilities.hasOpenApi
        ? { applicable: true }
        : noApi("No API surface detected."),
    run(ctx) {
      const operations = ctx.discovered.openApi?.operations ?? [];
      const documented = operations.filter((operation) => operation.rateLimitHeaders.length > 0);
      const ev = [evidence("openapi", ctx.discovered.openApi?.url ?? "", operations.map((operation) => ({
        operationId: operation.operationId,
        rateLimitHeaders: operation.rateLimitHeaders,
      })))];
      if (documented.length === operations.length) return pass(`${documented.length}/${operations.length} operations document rate-limit headers.`, ev);
      if (documented.length === 0) return warn("OpenAPI does not document rate-limit response headers.", ev, {
        priority: "P2",
        problem: "Rate limits are not machine-readable",
        impact: "Agents cannot pace requests or recover from HTTP 429 reliably.",
        remediation: "Document RateLimit and RateLimit-Policy (or compatible) response headers and the 429 response in OpenAPI.",
      });
      return warn(`${documented.length}/${operations.length} operations document rate-limit headers.`, ev);
    },
  }),
  defineCheck({
    id: "idempotency",
    title: "idempotency support",
    category: "reliability",
    provenance: "PROTOCOL",
    severity: "recommended",
    applicability: (ctx) =>
      ctx.capabilities.api.hasWrites
        ? { applicable: true }
        : noApi("No non-idempotent operations detected."),
    run() {
      return na("Idempotency analysis ships in 0.2.");
    },
  }),
  defineCheck({
    id: "async-jobs",
    title: "async job pattern",
    category: "reliability",
    provenance: "PROTOCOL",
    severity: "recommended",
    applicability: (ctx) =>
      ctx.capabilities.api.hasLongRunningOperations
        ? { applicable: true }
        : noApi("No long-running API operations detected."),
    run() {
      return na("Async job analysis ships in 0.2.");
    },
  }),
  defineCheck({
    id: "pagination",
    title: "cursor pagination",
    category: "reliability",
    provenance: "PROTOCOL",
    severity: "recommended",
    applicability: (ctx) =>
      ctx.capabilities.api.hasPagination
        ? { applicable: true }
        : noApi("No paginated collection operations detected."),
    run() {
      return na("Pagination analysis ships in 0.2.");
    },
  }),
];
