export type CheckCategory =
  | "discovery"
  | "access"
  | "understanding"
  | "developer"
  | "operation"
  | "reliability"
  | "security";

export type Provenance =
  | "STATIC"
  | "HTTP"
  | "BROWSER"
  | "PROTOCOL"
  | "SEARCH"
  | "LLM"
  | "JOURNEY";

export type Severity = "required" | "recommended" | "emerging" | "bonus";

export type CheckStatus = "pass" | "fail" | "warning" | "na";

export type Applicability =
  | { applicable: true }
  | { applicable: false; reason: string };

export interface Evidence {
  type:
    | "http"
    | "html"
    | "header"
    | "json"
    | "jsonld"
    | "browser"
    | "accessibility"
    | "openapi"
    | "mcp"
    | "search"
    | "text";
  source: string;
  value: unknown;
  collectedAt: string;
}

export interface Recommendation {
  priority: "P0" | "P1" | "P2" | "P3";
  problem: string;
  impact: string;
  remediation: string;
}

export interface ReasoningTask {
  taskVersion: "1";
  id: string;
  type: "reasoning";
  title: string;
  instructions: string;
  evidence: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  status: "pending" | "resolved" | "invalid";
  result?: unknown;
}

export interface CheckResult {
  status: CheckStatus;
  score?: number;
  maxScore?: number;
  summary: string;
  evidence: Evidence[];
  recommendation?: Recommendation;
  reasoningTask?: ReasoningTask;
}

export interface Check {
  id: string;
  title: string;
  category: CheckCategory;
  provenance: Provenance;
  severity: Severity;
  applicability(context: ScanContext): Promise<Applicability> | Applicability;
  run(context: ScanContext): Promise<CheckResult> | CheckResult;
}

export interface HttpResponse {
  url: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  body: string;
  bodyBytes: number;
  truncated: boolean;
  contentType: string;
  redirectChain: { url: string; status: number }[];
  elapsedMs: number;
  error?: string;
}

export interface HeadingNode {
  level: number;
  text: string;
}

export interface PageEvidence {
  url: string;
  finalUrl: string;
  status: number;
  title?: string;
  description?: string;
  canonical?: string;
  language?: string;
  html?: string;
  text?: string;
  textLength: number;
  htmlLength: number;
  contentRatio: number;
  headings: HeadingNode[];
  links: { href: string; text: string; rel?: string }[];
  jsonLd: JsonLdEvidence[];
  openGraph: Record<string, string>;
  meta: Record<string, string>;
  alternateMarkdown?: string;
  hasMain: boolean;
  scriptBytes: number;
}

export interface RobotsEvidence {
  url: string;
  status: number;
  body: string;
  valid: boolean;
  sitemaps: string[];
  groups: { userAgent: string; allows: string[]; disallows: string[] }[];
}

export interface SitemapEvidence {
  url: string;
  status: number;
  kind?: "urlset" | "index";
  urls: string[];
  valid: boolean;
  error?: string;
}

export interface TextResourceEvidence {
  url: string;
  status: number;
  body: string;
  contentType: string;
}

export interface OpenApiEvidence {
  url: string;
  specVersion?: string;
  valid: boolean;
  parseError?: string;
  document: Record<string, unknown>;
  operations: OpenApiOperation[];
}

export interface OpenApiOperation {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags: string[];
  hasRequestSchema: boolean;
  hasResponseSchema: boolean;
  parameterCount: number;
  deprecated: boolean;
  security: boolean;
}

export interface McpEvidence {
  discoveredAt?: string;
  handshake?: Record<string, unknown>;
}

export interface OAuthEvidence {
  discoveredAt?: string;
}

export interface GraphQLEvidence {
  discoveredAt?: string;
}

export interface JsonLdEvidence {
  source: string;
  types: string[];
  data: Record<string, unknown>;
}

export interface MarkdownEvidence {
  url: string;
  via: "negotiation" | "fallback" | "alternate";
  status: number;
  contentType: string;
  body?: string;
}

export interface ControlEvidence {
  tag: string;
  role?: string;
  name: string;
  native: boolean;
  selector: string;
}

export interface BrowserEvidence {
  url: string;
  title?: string;
  modelContext: {
    present: boolean;
    tools: string[];
    detection: string;
  };
  landmarks: {
    main: number;
    nav: number;
    header: number;
    footer: number;
  };
  headings: HeadingNode[];
  controls: ControlEvidence[];
  namedControls: number;
  unnamedControls: number;
  clickableDivs: number;
  error?: string;
}

export interface EntityResolution {
  entity: string;
  entityType:
    | "person"
    | "company"
    | "product"
    | "project"
    | "organization"
    | "unknown";
  confidence: number;
  evidence: string[];
  source: "jsonld" | "metadata" | "config" | "llm";
}

export interface ApiCapabilities {
  hasReads: boolean;
  hasWrites: boolean;
  hasDelete: boolean;
  hasCollections: boolean;
  hasPagination: boolean;
  hasLongRunningOperations: boolean;
  hasAuthenticatedOperations: boolean;
  hasBulkOperations: boolean;
}

export interface CapabilityMap {
  api: ApiCapabilities;
  hasOpenApi: boolean;
  hasBrowser: boolean;
  hasLlmsTxt: boolean;
  hasDeveloperPortal: boolean;
  jsRequired: boolean;
}

export interface ScanTarget {
  inputUrl: string;
  canonicalUrl?: string;
  origin: string;
  finalUrl: string;
}

export interface ScanContext {
  scanId: string;
  startedAt: string;
  target: ScanTarget;
  pages: PageEvidence[];
  homepage?: PageEvidence;
  http: HttpEvidenceStore;
  browser?: BrowserEvidence;
  discovered: {
    robots?: RobotsEvidence;
    sitemap?: SitemapEvidence;
    llmsTxt?: TextResourceEvidence;
    agentsMd?: TextResourceEvidence;
    openApi?: OpenApiEvidence;
    mcp?: McpEvidence;
    oauth?: OAuthEvidence;
    graphql?: GraphQLEvidence;
    jsonLd: JsonLdEvidence[];
    markdown: MarkdownEvidence[];
    developerPortals: { url: string; status: number; title?: string }[];
    notFound?: HttpResponse;
    crawlerAccess: CrawlerAccessResult[];
  };
  entity?: EntityResolution;
  capabilities: CapabilityMap;
  options: ScanOptions;
}

export interface CrawlerAccessResult {
  userAgent: string;
  status: number;
  finalUrl: string;
  blocked: boolean;
  challenge: boolean;
  robotsAllowed?: boolean;
  bodyDiffers: boolean;
}

export interface HttpEvidenceStore {
  get(
    url: string,
    options?: {
      headers?: Record<string, string>;
      skipCache?: boolean;
    },
  ): Promise<HttpResponse>;
}

export interface ScanOptions {
  url: string;
  browser: boolean;
  depth: number;
  maxPages: number;
  format: "terminal" | "json" | "markdown";
  output: string;
  verbose: boolean;
  agent: boolean;
  json: boolean;
  allowPrivate: boolean;
  ci: boolean;
}

export interface ScoredCheck {
  check: Check;
  applicability: Applicability;
  result: CheckResult;
  earned: number;
  available: number;
}

export interface CategoryScore {
  id: CheckCategory;
  title: string;
  score: number | null;
  earned: number;
  available: number;
  passed: number;
  failed: number;
  warnings: number;
  na: number;
}

export interface Scorecard {
  overall: number | null;
  categories: CategoryScore[];
  passed: number;
  failed: number;
  warnings: number;
  na: number;
  label: string;
}

export interface ScanReport {
  schemaVersion: "1";
  agentlintVersion: string;
  scanId: string;
  target: ScanTarget;
  startedAt: string;
  completedAt: string;
  score: Scorecard;
  capabilities: CapabilityMap;
  categories: CategoryScore[];
  checks: ReportCheck[];
  reasoningTasks: ReasoningTask[];
  journeys: unknown[];
}

export interface ReportCheck {
  id: string;
  title: string;
  category: CheckCategory;
  provenance: Provenance;
  severity: Severity;
  status: CheckStatus;
  score?: number;
  maxScore?: number;
  summary: string;
  evidence: Evidence[];
  recommendation?: Recommendation;
  reasoningTaskId?: string;
  naReason?: string;
}
