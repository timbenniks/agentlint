# Agentlint

**A deterministic-first website scanner for agent readiness.**

Agentlint tells you whether agents can find, understand, and use your website, and proves every conclusion with evidence.

```bash
npx agentlint https://example.com
```

Think Lighthouse for agents, designed around evidence rather than arbitrary AI judgment. The CLI never needs an OpenAI, Anthropic, Google, or other model API key. If a question requires semantic judgment, Agentlint hands a structured reasoning task back to the coding agent that invoked it.

```
Observe first.
Reason only when necessary.
Test actual tasks.
Score only what applies.
Show your work.
```

## Install

```bash
npm install -g agentlint
# or
npx agentlint https://example.com
```

Node.js 22+ is required. Browser checks use Playwright. After install:

```bash
npx playwright install chromium
```

Skip the browser with `--no-browser` if Chromium is not available.

## Commands

```bash
agentlint https://example.com
agentlint scan https://example.com
agentlint scan https://example.com --no-browser --depth 2 --max-pages 20
agentlint scan https://example.com --format json
agentlint scan https://example.com --agent
agentlint scan http://localhost:3000 --allow-private

agentlint tasks
agentlint task get entity-identification
agentlint task resolve entity-identification --result '{"entity":"Example","entityType":"organization","confidence":0.9,"evidence":["JSON-LD"]}'

agentlint explain reliability
agentlint fix
```

Default scan behavior:

- HTTP and static scanning enabled
- Playwright enabled
- max depth 2, max 20 pages, same-origin only
- no form submission, no mutations, no authentication

Private/local targets are blocked unless you pass `--allow-private`.

## Reports

Each scan writes:

```text
.agentlint/latest.json
.agentlint/latest.md
.agentlint/scans/<scan-id>.json
.agentlint/scans/<scan-id>.md
```

JSON is the canonical machine-readable format.

## Reasoning tasks

After a deterministic scan, unresolved semantic questions become tasks. In agent mode:

```text
AGENTLINT_REASONING_REQUIRED

Task ID: offering-clarity

Run:

agentlint task get offering-clarity
```

The surrounding harness (Claude Code, Codex, Cursor, and others) evaluates the evidence and schema, then resolves the task. Agentlint validates the result against JSON Schema. Invalid responses are rejected.

## For coding agents

Agents do **not** reliably infer this loop from a generic `--help` screen. Point them at `AGENTS.md` or the bundled Cursor skill (`.cursor/skills/agentlint/SKILL.md`).

After a scan, Agentlint prints `AGENTLINT_REASONING_REQUIRED` whenever tasks are pending, including the exact `task get` / `task resolve` commands. `--json` includes a `next` field.

Rules agents must follow:

1. Do not call a model API key. You are the reasoner.
2. Use only evidence from `task get`.
3. `N/A` is not a failure.
4. Implement `agentlint fix` recommendations on the scanned site.

`--json` returns a machine-friendly status payload:

```json
{
  "status": "reasoning_required",
  "scanId": "scan_...",
  "score": 87,
  "tasks": ["entity-identification", "offering-clarity"]
}
```

## Scoring

Only applicable checks enter the denominator. Sites are not penalized for APIs, pagination, or SDKs they do not have. Emerging checks never reduce the score. Category and overall scores cap at 100.

```bash
agentlint explain access
```

## Development

```bash
pnpm install
pnpm test
pnpm build
pnpm dev https://example.com --no-browser
```

## Status

This is MVP 0.1: HTTP crawling, content and crawler-access checks, OpenAPI discovery, Playwright/WebMCP inspection, reasoning tasks, and terminal/JSON/Markdown reports.

Not in 0.1: model APIs, hosted accounts, external search, MCP handshake, journeys, CI mode, plugins.
