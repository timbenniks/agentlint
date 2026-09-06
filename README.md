# Agentlint

**A deterministic-first website scanner for agent readiness.**

Agentlint tells you whether agents can find, understand, and use your website, and proves every conclusion with evidence.

[Read the documentation](https://agentlint.timbenniks.dev)

```bash
npx @timbenniks/agentlint https://example.com
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
npm install -g @timbenniks/agentlint
# or
npx @timbenniks/agentlint https://example.com
```

For a website project, install it as a development dependency and initialize the project:

```bash
npm install -D @timbenniks/agentlint
npx @timbenniks/agentlint init https://example.com
npm run agentlint
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
agentlint init https://example.com
agentlint init https://example.com --ci --cursor-skill
agentlint scan https://example.com --no-browser --depth 2 --max-pages 20
agentlint scan https://example.com --format json
agentlint scan https://example.com --format html > agentlint-report.html
agentlint scan https://example.com --agent
agentlint scan https://example.com --agent --missions
agentlint scan http://localhost:3000 --allow-private

agentlint tasks
agentlint task get entity-identification
agentlint task resolve entity-identification --result '{"entity":"Example","entityType":"organization","confidence":0.9,"evidence":["JSON-LD"]}'

agentlint explain reliability
agentlint fix
agentlint prompt
agentlint baseline save
agentlint scan https://example.com --ci
agentlint baseline compare
```

Default scan behavior:

- HTTP and static scanning enabled
- Playwright enabled
- max depth 2, max 20 pages, same-origin only
- no form submission, no mutations, no authentication

Private/local targets are blocked unless you pass `--allow-private`.

## Project setup

`agentlint init [url]` safely configures Agentlint in an existing website repository. If the URL is omitted, a valid `package.json.homepage` is used. It creates or updates:

- `agentlint.config.json` with the deployed target;
- an `agentlint` package script using `--agent --missions`;
- `.gitignore` for generated `.agentlint/` reports;
- a managed Agentlint section in `AGENTS.md`.

It preserves existing scripts and files unless `--force` is supplied. The managed `AGENTS.md` section is updated in place and surrounding instructions are left untouched.

Optional flags:

- `--ci` adds a scheduled and manually dispatchable GitHub Actions scan with report artifacts;
- `--cursor-skill` adds a project-local Cursor skill;
- `--allow-private` configures the package script for localhost/private targets;
- `--cwd <path>` initializes another project directory;
- `--force` replaces existing Agentlint-managed config or scaffolding.

After initialization, the configured target makes the URL optional:

```bash
agentlint scan --agent --missions
```

## Reports

Each scan writes:

```text
.agentlint/latest.json
.agentlint/latest.md
.agentlint/latest.html
.agentlint/fix-prompt.md
.agentlint/baseline.json
.agentlint/scans/<scan-id>.json
.agentlint/scans/<scan-id>.md
.agentlint/scans/<scan-id>.html
```

JSON is the canonical machine-readable format.

HTML is a self-contained visual report using the same evidence-ledger design as the documentation site. It includes score traces, filterable checks, expandable evidence, bounded mission state, capabilities, and a copyable remediation prompt. It has no hosted runtime or external asset dependency, so it can be opened locally or uploaded as a CI artifact.

## Reasoning tasks

After a deterministic scan, unresolved semantic questions become tasks. In agent mode:

```text
AGENTLINT_REASONING_REQUIRED

Task ID: offering-clarity

Run:

agentlint task get offering-clarity
```

The surrounding harness (Claude Code, Codex, Cursor, and others) evaluates the evidence and schema, then resolves the task. Agentlint validates the result against JSON Schema. Invalid responses are rejected.

Reasoning scores are mapped back to the originating check instead of becoming unconditional passes. Reports separate deterministic **surface readiness** from resolved **bounded task success**.

## Bounded agent missions

Add `--missions` to test outcomes as well as artifacts. Agentlint creates evidence-only missions for:

- discovering and retrieving a concrete primary-source resource;
- constructing a non-executed, read-only OpenAPI tool plan;
- separating site guidance from untrusted page content;
- recovering from a missing resource without inventing a replacement.

Mission answers must match their JSON Schema, cite sources present in the supplied evidence, and declare that no mutating action is planned. Agentlint records efficiency metrics such as planned requests and evidence items used.

## Remediation loop prompt

Every scan writes `.agentlint/fix-prompt.md`. After reasoning tasks are resolved, it contains all evidence-backed failed and warning checks, priorities, observed evidence sources, safety constraints, verification steps, and a repeat-until-clean loop suitable for a coding agent working in the target site's repository.

```bash
agentlint prompt > agentlint-fix.md
```

Agentlint generates the prompt but never edits, authenticates to, submits forms on, or deploys the target site.

## Regression baselines

Save an accepted report and compare later scans in CI:

```bash
agentlint baseline save
agentlint scan https://example.com --ci
agentlint baseline compare
```

Pending reasoning tasks are deferred during comparison so a fresh scan does not look like a regression merely because its bounded judgments have not been resolved yet.

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

Only applicable checks enter the denominator. Sites are not penalized for APIs, pagination, or SDKs they do not have. Emerging checks never reduce the score. Category and overall scores cap at 100. Resolved numeric reasoning scores determine pass/warning/fail status and proportional points.

```bash
agentlint explain access
```

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm test:browser
pnpm test:fixtures
pnpm test:package
pnpm build
pnpm dev https://example.com --no-browser
```

Run the complete local publication gate with `pnpm verify:release`. It builds the docs, exercises the HTML report in Chromium, and installs the real packed tarball into a clean temporary consumer before running the init, reasoning, report, baseline, and CI workflows.

### Documentation

The CLI stays at the workspace root and the VitePress site lives in `apps/docs`.

```bash
pnpm docs:dev
pnpm docs:build
pnpm docs:preview
```

The workspace is intentionally shallow: future runnable examples can live under `examples/*` without moving or repackaging the published CLI.

The root `vercel.json` builds only the VitePress application and publishes `apps/docs/.vitepress/dist`. In Vercel, import the repository with the repository root as the project root; no dashboard build overrides are needed.

## Status

This is MVP 0.1: HTTP crawling, content and crawler-access checks, OpenAPI discovery, Playwright/WebMCP inspection, reasoning tasks, bounded missions, regression baselines, remediation-loop prompts, and terminal/JSON/Markdown reports.

Not in 0.1: model APIs, hosted accounts, external search, live mutating journeys, MCP handshake execution, or plugins.
