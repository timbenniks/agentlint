---
title: Rules reference
description: Every rule Agentlint evaluates, when it applies, and the outcome a site should aim for.
---

# Every rule, and what good looks like

Agentlint runs **35 standard checks** on the surfaces it discovers. `--missions` adds **4 bounded outcome checks**. This page is the plain-language contract for each one: when it applies and the result that earns a pass.

::: tip Read `N/A` literally
A check that does not fit the detected site is reported as `n/a` and removed from the score denominator. A portfolio is not expected to publish an API, and an API without write operations is not expected to document idempotency. `N/A` is not a failure.
:::

## How to read the reference

Each rule has a stable ID, shown as `code`, that also appears in terminal, JSON, Markdown, and HTML reports.

| Label | Meaning |
| --- | --- |
| **Required** | Foundational agent usability; worth 10 points when applicable. |
| **Recommended** | Materially improves reliable use; worth 6 points when applicable. |
| **Emerging** | Tracks a developing practice. A pass adds bonus credit; a failure does not lower the denominator. |
| **Bonus** | Rewards an extra capability without masking other weaknesses. |
| **Pass** | The implementation met the rule’s complete expected outcome. |
| **Warning** | Some useful signal exists, but it is incomplete or needs bounded reasoning. |
| **Fail** | The applicable surface did not meet the rule. |
| **N/A** | The capability was not detected or the rule does not fit the site. |

## Discovery

These rules ask whether an agent can find the site, its important pages, and any agent or developer entry points.

| Rule | Level | Applies when | Expected passing outcome |
| --- | --- | --- | --- |
| `robots-txt` | Required | Always | `/robots.txt` is publicly retrievable and parses as a robots file. |
| `sitemap` | Recommended | Always | A valid XML sitemap is found at `/sitemap.xml` or through a `Sitemap` directive in `robots.txt`. |
| `canonical-host-consistency` | Recommended | The homepage declares a canonical URL | The final URL, canonical URL, and every URL found in the sitemap use the same host. |
| `llms-txt` | Recommended | Always | `/llms.txt` or `/.well-known/llms.txt` contains useful Markdown and at least one Markdown link. |
| `agent-discovery` | Emerging | Always | A non-empty agent discovery resource is found at `/agents.md`, `/.well-known/agent-skills`, or `/skills.md`. |
| `developer-portal` | Recommended | Evaluated on every scan; returns `n/a` when no public API is detected | A reachable developer resource is discovered at a conventional docs, developer, or API path. |

`llms-txt` warns when the file is shorter than 40 characters, does not resemble Markdown, or has no Markdown links. Agentlint follows up to eight declared links to gather evidence, but the passing rule is based on useful Markdown with links rather than requiring every linked resource to resolve.

## Access

These rules ask whether agents and crawlers can retrieve meaningful content and correctly recognize missing content.

| Rule | Level | Applies when | Expected passing outcome |
| --- | --- | --- | --- |
| `raw-html-content` | Required | Always | The homepage returns below HTTP 400 and exposes at least 200 characters of meaningful text in the initial HTML. |
| `ai-crawler-access` | Required | Always | GPTBot, ClaudeBot, ChatGPT-User, Google-Extended, and PerplexityBot can retrieve the homepage under the combined robots and HTTP/edge policy. |
| `robots-policy` | Required | A valid `robots.txt` was found | `robots.txt` allows every tested AI crawler. |
| `markdown-negotiation` | Recommended | Always | Requesting the canonical URL with `Accept: text/markdown` returns a successful Markdown response. |
| `markdown-fallback` | Recommended | Always | A conventional `/index.md` or `page.md` URL returns Markdown/plain text, or a declared Markdown alternate resolves successfully. |
| `markdown-alternate` | Emerging | Always | The homepage declares `<link rel="alternate" type="text/markdown" ...>`. |
| `agent-friendly-404` | Recommended | Always | An impossible URL returns HTTP 404, ideally with JSON, Markdown, or a useful explanatory body. |

For `raw-html-content`, fewer than 80 characters alongside more than 800 bytes of script is treated as a JavaScript-only shell and fails. Between 80 and 199 characters warns. A 404 with a short body still passes as long as the status is correctly `404`; a soft 404 returning `200` fails.

## Understanding

These rules ask whether an agent can identify who or what the site represents and understand its content without guessing.

| Rule | Level | Applies when | Expected passing outcome |
| --- | --- | --- | --- |
| `json-ld` | Recommended | Always | JSON-LD contains a recognized `Person`, `Organization`, `Product`, or other supported entity with a string `name`. |
| `entity-identity` | Required | Always | Static evidence identifies a known entity type with confidence of at least `0.75`; uncertain cases are handed to a reasoning task. |
| `metadata` | Required | Always | The homepage includes a title, meta description, canonical URL, and HTML language. |
| `offering-clarity` | Recommended | Always | The evidence-only reasoning result clearly identifies the offering, audience, and primary action and scores at least 75/100. |
| `trust-anchors` | Recommended | Sites other than identified personal or project sites | At least three trust page groups are discoverable: About, Contact, Privacy, Terms, or Security. |
| `content-size` | Bonus | Always | No collected important page exceeds an estimated 50,000 tokens. |

`entity-identity` does not guess when title, heading, JSON-LD, and canonical signals are weak. It emits a structured task instead. `offering-clarity` likewise begins as a warning until its task is resolved; 50–74 warns and below 50 fails.

## Developer experience

These rules apply progressively as Agentlint discovers developer documentation, OpenAPI, or MCP surfaces.

| Rule | Level | Applies when | Expected passing outcome |
| --- | --- | --- | --- |
| `openapi-discovery` | Recommended | Evaluated on every scan; returns `n/a` when no developer/API surface is detected | A parseable OpenAPI or Swagger document is discovered and contains a valid `paths` surface. |
| `mcp-discovery` | Emerging | MCP evidence or a developer integration surface was detected | A valid JSON MCP discovery document is found, optionally naming its endpoint and transport. |
| `operation-ids` | Recommended | A valid OpenAPI document was found | Every operation has an `operationId` that starts with a letter, contains only letters, digits, or underscores, and is 2–65 characters long. |
| `typed-inputs` | Recommended | A valid OpenAPI document was found | Every operation has a typed request schema; GET and DELETE operations are accepted without a request body schema. |
| `typed-responses` | Recommended | A valid OpenAPI document was found | Every operation declares a schema for at least one successful `2xx` response. |
| `function-calling` | Recommended | A valid OpenAPI document was found | Every operation has a stable ID and typed success output, and the document is at most 1 MB with no `oneOf` or `anyOf` unions. |
| `docs-quality` | Recommended | A developer portal or OpenAPI surface was detected | Evidence-only review finds what the API is, when to use it, setup, prerequisites, authentication, a minimal example, failure behavior, and the API reference; score is at least 85/100. |

`typed-inputs` currently warns rather than fails when coverage is incomplete. `typed-responses` fails when none of the operations has a typed success response and warns for partial coverage. `docs-quality` begins as a warning until the reasoning task is resolved; 60–84 warns and below 60 fails.

## Operation

These rules ask whether a browser agent can perceive structure and operate controls reliably.

| Rule | Level | Applies when | Expected passing outcome |
| --- | --- | --- | --- |
| `semantic-html` | Required | Always | A `<main>` landmark and headings exist at runtime. Without browser evidence, the same structure must exist in static HTML. |
| `native-controls` | Required | Browser evidence is available | Interactive controls use native semantic elements; the check passes unless clickable non-native elements exist while native coverage is below 85%. |
| `accessible-names` | Required | Browser evidence is available | Every interactive control has a computable accessible name. |
| `webmcp` | Emerging | Browser scanning is enabled | `document.modelContext` is present at runtime; exposed tool names are reported when available. |

No interactive controls produces a warning for `native-controls` and `n/a` for `accessible-names`. Accessible-name coverage from 80% up to, but not including, 100% warns; lower coverage fails.

## Reliability

These rules are capability-gated so sites without the relevant API behavior are not penalized.

| Rule | Level | Applies when | Expected passing outcome |
| --- | --- | --- | --- |
| `json-errors` | Recommended | An OpenAPI surface was detected | Every operation declares a schema for at least one non-`2xx` error response. |
| `rate-limit-headers` | Recommended | An OpenAPI surface was detected | Every operation documents a `RateLimit*` or `X-RateLimit*` response header. |
| `idempotency` | Recommended | Non-idempotent write operations were detected | Reserved for 0.2; currently returns `n/a` with no score impact. |
| `async-jobs` | Recommended | A likely long-running API operation was detected | Reserved for 0.2; currently returns `n/a` with no score impact. |
| `pagination` | Recommended | A likely paginated collection operation was detected | Reserved for 0.2; currently returns `n/a` with no score impact. |

Partial typed-error coverage warns and no coverage fails. Partial or absent rate-limit header coverage currently warns. The three reserved checks document detected applicability without pretending the analysis exists yet.

## Optional bounded missions

Pass `--missions` to add these four checks. They do not browse, authenticate, submit forms, call tools, or mutate the target. Instead, the invoking coding agent must answer a JSON task using only the supplied evidence.

Every mission passes at a score of at least 80, warns from 60–79, and fails below 60. A valid result must cite evidence sources from the task, plan no mutation, keep its request/evidence counts coherent, and match the supplied schema.

| Rule | Category | Applies when | Expected passing outcome |
| --- | --- | --- | --- |
| `mission-content-discovery` | Understanding | At least one page was collected | Identify the site’s purpose and one concrete primary-source resource, then give the smallest evidence-backed retrieval route. |
| `mission-safe-tool-plan` | Developer | A valid OpenAPI document was found | Select one exact read-only operation and construct a non-executed plan with method, path, operation ID, auth signal, required inputs, and expected typed output or gaps. |
| `mission-instruction-boundaries` | Security | `agents.md` or `llms.txt` was found | Separate authoritative usage guidance from untrusted page content, identify prohibited actions, ignore untrusted instructions, and produce a safe read-only plan. |
| `mission-recovery` | Reliability | A missing-resource response was collected | Recognize the failure, choose the smallest safe discovery fallback, and stop without inventing a replacement when evidence is insufficient. |

See [Bounded missions](../concepts/missions) for the task contract and safety model.

## Evidence provenance

Reports label how each observation was obtained:

| Provenance | Meaning |
| --- | --- |
| `STATIC` | Parsed document content. |
| `HTTP` | Response or transport behavior. |
| `BROWSER` | Rendered browser observation. |
| `PROTOCOL` | Robots, sitemap, OpenAPI, MCP, or related protocol evidence. |
| `LLM` | A bounded reasoning result supplied by the invoking agent. Agentlint itself never calls a model API. |
| `JOURNEY` | A bounded mission result supplied by the invoking agent. |
| `SEARCH` | Reserved for search evidence; unused by the 0.1 local scanner. |

## Current scope

Version 0.1 includes HTTP crawling, content and crawler-access checks, OpenAPI discovery, Playwright/WebMCP inspection, reasoning tasks, bounded missions, regression baselines, remediation prompts, and terminal/JSON/Markdown/HTML reports.

It does **not** include hosted accounts, external web search, authenticated or mutating journeys, form submission, live MCP handshake execution, or model API calls. An absent out-of-scope feature should not be inferred from a score or report.

## Inspect the actual result

Use verbose output to show evidence beside each result:

```bash
npx @timbenniks/agentlint scan https://example.com --verbose
```

The complete check objects, applicability reasons, evidence, and recommendations are stored in `.agentlint/latest.json`.
