import { defineCheck, na } from "./helpers.ts";
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
      return na("Typed JSON error checks ship in 0.2. OpenAPI was discovered.", [
        evidence("openapi", ctx.discovered.openApi?.url ?? "", {
          operations: ctx.discovered.openApi?.operations.length,
        }),
      ]);
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
    run() {
      return na("Rate-limit header analysis ships in 0.2.");
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
