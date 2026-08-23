import { parse as parseYaml } from "yaml";
import type { ApiCapabilities, OpenApiEvidence, OpenApiOperation } from "../types.ts";

const HTTP_METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"] as const;

export function parseOpenApi(body: string, url: string): OpenApiEvidence {
  let document: Record<string, unknown>;
  try {
    const trimmed = body.trim();
    document = trimmed.startsWith("{")
      ? (JSON.parse(trimmed) as Record<string, unknown>)
      : (parseYaml(trimmed) as Record<string, unknown>);
  } catch (error) {
    return {
      url,
      valid: false,
      parseError: error instanceof Error ? error.message : "Parse error",
      document: {},
      operations: [],
    };
  }

  const specVersion =
    (typeof document.openapi === "string" && document.openapi) ||
    (typeof document.swagger === "string" && document.swagger) ||
    undefined;

  if (!specVersion) {
    return {
      url,
      valid: false,
      parseError: "Document is not an OpenAPI or Swagger spec",
      document,
      operations: [],
    };
  }

  const operations = extractOperations(document);
  return {
    url,
    specVersion,
    valid: operations.length > 0 || typeof document.paths === "object",
    document,
    operations,
  };
}

export function extractOperations(document: Record<string, unknown>): OpenApiOperation[] {
  const paths = document.paths;
  if (!paths || typeof paths !== "object") return [];
  const ops: OpenApiOperation[] = [];

  for (const [path, pathItem] of Object.entries(paths as Record<string, unknown>)) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const method of HTTP_METHODS) {
      const op = (pathItem as Record<string, unknown>)[method];
      if (!op || typeof op !== "object") continue;
      const rec = op as Record<string, unknown>;
      const parameters = Array.isArray(rec.parameters) ? rec.parameters : [];
      const responses = rec.responses && typeof rec.responses === "object" ? rec.responses : {};
      ops.push({
        path,
        method,
        operationId: typeof rec.operationId === "string" ? rec.operationId : undefined,
        summary: typeof rec.summary === "string" ? rec.summary : undefined,
        description: typeof rec.description === "string" ? rec.description : undefined,
        tags: Array.isArray(rec.tags) ? rec.tags.filter((t): t is string => typeof t === "string") : [],
        hasRequestSchema: hasTypedRequest(rec),
        hasResponseSchema: hasTypedResponse(responses as Record<string, unknown>),
        parameterCount: parameters.length + countRequestProps(rec),
        deprecated: rec.deprecated === true,
        security: rec.security !== undefined || document.security !== undefined,
      });
    }
  }
  return ops;
}

export function analyzeApiCapabilities(operations: OpenApiOperation[]): ApiCapabilities {
  const methods = new Set(operations.map((o) => o.method));
  return {
    hasReads: methods.has("get") || methods.has("head"),
    hasWrites: methods.has("post") || methods.has("put") || methods.has("patch"),
    hasDelete: methods.has("delete"),
    hasCollections: operations.some((o) => /s$|list|search|collection/i.test(o.path + (o.operationId ?? ""))),
    hasPagination: operations.some((o) =>
      /cursor|page|offset|limit|nextToken|starting_after/i.test(o.path + (o.summary ?? "") + (o.description ?? "")),
    ),
    hasLongRunningOperations: operations.some((o) =>
      /job|async|task|status|batch/i.test(o.path + (o.operationId ?? "")),
    ),
    hasAuthenticatedOperations: operations.some((o) => o.security),
    hasBulkOperations: operations.some((o) => /bulk|batch/i.test(o.path + (o.operationId ?? ""))),
  };
}

export function emptyApiCapabilities(): ApiCapabilities {
  return {
    hasReads: false,
    hasWrites: false,
    hasDelete: false,
    hasCollections: false,
    hasPagination: false,
    hasLongRunningOperations: false,
    hasAuthenticatedOperations: false,
    hasBulkOperations: false,
  };
}

export function isStableOperationId(id: string | undefined): boolean {
  if (!id) return false;
  return /^[A-Za-z][A-Za-z0-9_]{1,64}$/.test(id);
}

function hasTypedRequest(op: Record<string, unknown>): boolean {
  const body = op.requestBody;
  if (body && typeof body === "object") {
    const content = (body as { content?: unknown }).content;
    if (content && typeof content === "object") {
      for (const media of Object.values(content as Record<string, unknown>)) {
        if (media && typeof media === "object" && "schema" in media) return true;
      }
    }
  }
  const params = Array.isArray(op.parameters) ? op.parameters : [];
  return params.some(
    (p) => p && typeof p === "object" && ("schema" in p || "type" in p),
  );
}

function hasTypedResponse(responses: Record<string, unknown>): boolean {
  for (const [code, response] of Object.entries(responses)) {
    if (!/^2/.test(code)) continue;
    if (!response || typeof response !== "object") continue;
    const content = (response as { content?: unknown }).content;
    if (content && typeof content === "object") {
      for (const media of Object.values(content as Record<string, unknown>)) {
        if (media && typeof media === "object" && "schema" in media) return true;
      }
    }
    if ("schema" in response) return true;
  }
  return false;
}

function countRequestProps(op: Record<string, unknown>): number {
  const body = op.requestBody;
  if (!body || typeof body !== "object") return 0;
  const content = (body as { content?: unknown }).content;
  if (!content || typeof content !== "object") return 0;
  const json = (content as Record<string, { schema?: { properties?: object } }>)[
    "application/json"
  ];
  const props = json?.schema?.properties;
  return props ? Object.keys(props).length : 0;
}

export function schemaComplexityIssues(document: Record<string, unknown>): string[] {
  const issues: string[] = [];
  const raw = JSON.stringify(document);
  if (raw.includes('"oneOf"') || raw.includes('"anyOf"')) {
    issues.push("Spec contains oneOf/anyOf unions that can be ambiguous for tool calling");
  }
  if (raw.length > 1_000_000) {
    issues.push("OpenAPI document is extremely large");
  }
  return issues;
}
