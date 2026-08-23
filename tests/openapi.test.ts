import { describe, expect, it } from "vitest";
import { analyzeApiCapabilities, isStableOperationId, parseOpenApi } from "../src/protocols/openapi.ts";

const spec = `
openapi: 3.1.0
info:
  title: Demo
  version: 1.0.0
paths:
  /items:
    get:
      operationId: listItems
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: object
                properties:
                  items:
                    type: array
    post:
      operationId: createItem
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                name: { type: string }
      responses:
        "201":
          description: created
          content:
            application/json:
              schema:
                type: object
`;

describe("OpenAPI", () => {
  it("parses operations and capabilities", () => {
    const parsed = parseOpenApi(spec, "https://example.com/openapi.yaml");
    expect(parsed.valid).toBe(true);
    expect(parsed.specVersion).toBe("3.1.0");
    expect(parsed.operations).toHaveLength(2);
    expect(parsed.operations.every((o) => isStableOperationId(o.operationId))).toBe(true);
    const caps = analyzeApiCapabilities(parsed.operations);
    expect(caps.hasReads).toBe(true);
    expect(caps.hasWrites).toBe(true);
    expect(caps.hasDelete).toBe(false);
  });

  it("rejects non-specs", () => {
    const parsed = parseOpenApi('{"hello":true}', "https://example.com/x.json");
    expect(parsed.valid).toBe(false);
  });

  it("resolves referenced typed error responses", () => {
    const parsed = parseOpenApi(JSON.stringify({
      openapi: "3.1.0",
      info: { title: "Demo", version: "1" },
      paths: { "/items": { get: { operationId: "getItems", responses: {
        "200": { description: "ok", content: { "application/json": { schema: { type: "object" } } } },
        "429": { $ref: "#/components/responses/RateLimited" },
      } } } },
      components: { responses: { RateLimited: {
        description: "slow down",
        headers: { RateLimit: { schema: { type: "string" } } },
        content: { "application/problem+json": { schema: { type: "object" } } },
      } } },
    }), "https://example.com/openapi.json");
    expect(parsed.operations[0]?.typedErrorResponseCodes).toEqual(["429"]);
    expect(parsed.operations[0]?.rateLimitHeaders).toEqual(["RateLimit"]);
  });
});
