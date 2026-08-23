---
title: Deterministic first
description: Understand Agentlint's evidence pipeline and division of responsibility.
---

# Observe first. Reason only when necessary.

Agentlint is not a model wrapped in a score. It is a deterministic scanner with an explicit handoff for questions that bytes alone cannot answer.

## The evidence pipeline

```text
URL
 └─ collect public evidence
     ├─ HTTP responses and headers
     ├─ HTML, metadata, links, and structured data
     ├─ robots.txt, sitemaps, llms.txt, OpenAPI, MCP discovery
     └─ optional browser and accessibility observations
          ↓
       run applicable checks
          ↓
       create bounded reasoning tasks only where needed
          ↓
       validate structured answers and score
          ↓
       emit reports, remediations, and regression data
```

Every check declares its provenance. Reports can distinguish a static observation from HTTP behavior, browser state, a protocol document, or a bounded reasoning result.

## Why the split matters

A fully model-driven audit is difficult to reproduce and may invent missing context. A purely syntactic audit cannot tell whether a page explains an offering clearly. Agentlint gives each layer only the job it can support:

| Scanner owns | Reasoner owns |
| --- | --- |
| Fetching and parsing | Semantic interpretation |
| Applicability | Choosing among evidence-backed labels |
| Schema validation | Returning the requested structured answer |
| Score calculation | Bounded mission planning |
| Durable reports | No collection, mutation, or outside research |

The scanner never calls OpenAI, Anthropic, Google, or another model API. Claude Code, Codex, Cursor, or another invoking agent can act as the reasoner.

## The public, read-only boundary

By default Agentlint:

- crawls same-origin pages only;
- limits depth and page count;
- does not submit forms;
- does not authenticate;
- does not execute mutations;
- blocks private network targets without explicit opt-in.

These are behavioral constraints, not merely recommendations for the generated prompt.

## Evidence is carried forward

Findings retain the evidence that produced them. The remediation prompt includes observed sources and verification steps so a coding agent can change the site without guessing at the original failure.

Reasoning missions add a second guard: citations must point to sources already present in the task payload. The answer cannot introduce a convenient page or API that the scanner never observed.
