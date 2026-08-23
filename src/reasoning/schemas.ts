export const entityIdentificationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    entity: { type: "string" },
    entityType: {
      type: "string",
      enum: ["person", "company", "product", "project", "organization", "unknown"],
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    evidence: { type: "array", items: { type: "string" } },
  },
  required: ["entity", "entityType", "confidence", "evidence"],
} as const;

export const offeringClaritySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    offering: { type: "string" },
    audience: { type: "string" },
    primaryAction: { type: "string" },
    concrete: { type: "boolean" },
    score: { type: "number", minimum: 0, maximum: 100 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    notes: { type: "array", items: { type: "string" } },
  },
  required: ["offering", "audience", "primaryAction", "concrete", "score", "confidence", "notes"],
} as const;

export const docsQualitySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    answersWhat: { type: "boolean" },
    answersWhen: { type: "boolean" },
    answersGettingStarted: { type: "boolean" },
    answersAuth: { type: "boolean" },
    hasMinimalExample: { type: "boolean" },
    score: { type: "number", minimum: 0, maximum: 100 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    gaps: { type: "array", items: { type: "string" } },
  },
  required: [
    "answersWhat",
    "answersWhen",
    "answersGettingStarted",
    "answersAuth",
    "hasMinimalExample",
    "score",
    "confidence",
    "gaps",
  ],
} as const;

export const llmsAccuracySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    accurate: { type: "boolean" },
    missing: { type: "array", items: { type: "string" } },
    stale: { type: "array", items: { type: "string" } },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["accurate", "missing", "stale", "confidence"],
} as const;
