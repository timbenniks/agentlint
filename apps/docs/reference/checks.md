---
title: Checks and scope
description: Agentlint's check categories, evidence provenance, safety guarantees, and current boundaries.
---

# What Agentlint observes

Checks are grouped by the kind of agent-readiness question they answer. The exact applicable set depends on the target’s discovered capabilities.

## Categories

| Category | Typical questions |
| --- | --- |
| Discovery | Can an agent find the site’s pages, entity, docs, and machine-readable entry points? |
| Access | Can crawlers retrieve useful content without browser-only or robots barriers? |
| Understanding | Is the entity, offering, structure, and primary content understandable? |
| Developer | Are developer docs, examples, APIs, OpenAPI, or MCP surfaces usable when applicable? |
| Operation | Can an agent identify safe controls and plan tasks with bounded inputs? |
| Reliability | Are errors, rate limits, canonical hosts, and operational expectations explicit? |
| Security | Are instruction boundaries and non-mutating behavior supportable? |

## Evidence provenance

Reports label observations as:

- `STATIC`: parsed document content;
- `HTTP`: response or transport behavior;
- `BROWSER`: rendered browser observation;
- `PROTOCOL`: robots, sitemap, OpenAPI, MCP, or related protocol evidence;
- `LLM`: bounded reasoning result;
- `JOURNEY`: bounded outcome mission;
- `SEARCH`: reserved provenance for search evidence, not used by the 0.1 local scanner.

## Common surfaces

Depending on applicability, Agentlint can inspect:

- titles, descriptions, canonical URLs, headings, links, and main content;
- JSON-LD and Open Graph metadata;
- `robots.txt`, XML sitemaps, `llms.txt`, and alternate Markdown;
- developer portals and OpenAPI documents;
- typed error responses, authentication declarations, pagination, and rate-limit signals;
- MCP discovery documents and browser model-context signals;
- landmarks, controls, accessible names, and suspicious clickable elements;
- canonical-host consistency and error-page behavior.

## Current scope

Version 0.1 includes HTTP crawling, content and crawler-access checks, OpenAPI discovery, Playwright/WebMCP inspection, reasoning tasks, bounded missions, regression baselines, remediation prompts, and terminal/JSON/Markdown reports.

It does **not** include:

- model API calls;
- hosted accounts or cloud dashboards;
- external web search;
- authenticated or mutating journeys;
- form submission;
- live MCP handshake execution;
- a plugin system.

An absent out-of-scope feature should not be inferred from a score or report.

## Inspect the actual result

Run with `--verbose` to show evidence beside terminal checks, or open `.agentlint/latest.json` for the complete check objects.
