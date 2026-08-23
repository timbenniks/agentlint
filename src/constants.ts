export const AGENTLINT_VERSION = "0.1.0-rc.1";

export const DEFAULT_USER_AGENT =
  "Agentlint/0.1.0-rc.1 (+https://github.com/timbenniks/agentlint)";

export const AI_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "ChatGPT-User",
  "Google-Extended",
  "PerplexityBot",
] as const;

export const DEVELOPER_PATHS = [
  "/developers",
  "/developer",
  "/docs",
  "/api",
  "/api-reference",
  "/documentation",
  "/dev",
];

export const OPENAPI_PATHS = [
  "/openapi.json",
  "/openapi.yaml",
  "/openapi.yml",
  "/swagger.json",
  "/swagger.yaml",
  "/api/openapi.json",
  "/api/openapi.yaml",
  "/.well-known/openapi.json",
  "/.well-known/openapi.yaml",
];

export const LLMS_PATHS = ["/llms.txt", "/.well-known/llms.txt"];

export const AGENT_DISCOVERY_PATHS = [
  "/agents.md",
  "/.well-known/agent-skills",
  "/skills.md",
];

export const TRUST_PATHS = [
  { id: "about", paths: ["/about", "/about-us", "/about.html"] },
  { id: "contact", paths: ["/contact", "/contact-us", "/contact.html"] },
  { id: "privacy", paths: ["/privacy", "/privacy-policy", "/privacy.html"] },
  { id: "terms", paths: ["/terms", "/terms-of-service", "/tos"] },
  { id: "security", paths: ["/security", "/security.html"] },
];

export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
export const REQUEST_TIMEOUT_MS = 15_000;
export const MAX_REDIRECTS = 5;
export const HTTP_CONCURRENCY = 6;

export const CATEGORY_TITLES: Record<string, string> = {
  discovery: "Discovery",
  access: "Access",
  understanding: "Understanding",
  developer: "Developer experience",
  operation: "Operation",
  reliability: "Reliability",
  security: "Security",
};

export const SEVERITY_POINTS: Record<string, number> = {
  required: 10,
  recommended: 6,
  emerging: 0,
  bonus: 0,
};

export const BONUS_POINTS = 3;
