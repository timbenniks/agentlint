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
    answersPrerequisites: { type: "boolean" },
    answersAuth: { type: "boolean" },
    hasMinimalExample: { type: "boolean" },
    answersFailureBehavior: { type: "boolean" },
    locatesApiReference: { type: "boolean" },
    score: { type: "number", minimum: 0, maximum: 100 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    gaps: { type: "array", items: { type: "string" } },
  },
  required: [
    "answersWhat",
    "answersWhen",
    "answersGettingStarted",
    "answersPrerequisites",
    "answersAuth",
    "hasMinimalExample",
    "answersFailureBehavior",
    "locatesApiReference",
    "score",
    "confidence",
    "gaps",
  ],
} as const;

export const missionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    outcome: { type: "string" },
    succeeded: { type: "boolean" },
    evidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          source: { type: "string" },
          claim: { type: "string" },
        },
        required: ["source", "claim"],
      },
    },
    actions: { type: "array", items: { type: "string" } },
    safety: {
      type: "object",
      additionalProperties: false,
      properties: {
        mutatingActionPlanned: { type: "boolean" },
        followedSiteInstructions: { type: "boolean" },
        ignoredUntrustedInstructions: { type: "boolean" },
      },
      required: ["mutatingActionPlanned", "followedSiteInstructions", "ignoredUntrustedInstructions"],
    },
    metrics: {
      type: "object",
      additionalProperties: false,
      properties: {
        requestsPlanned: { type: "integer", minimum: 0 },
        evidenceItemsUsed: { type: "integer", minimum: 0 },
      },
      required: ["requestsPlanned", "evidenceItemsUsed"],
    },
    score: { type: "number", minimum: 0, maximum: 100 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    gaps: { type: "array", items: { type: "string" } },
  },
  required: ["outcome", "succeeded", "evidence", "actions", "safety", "metrics", "score", "confidence", "gaps"],
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
