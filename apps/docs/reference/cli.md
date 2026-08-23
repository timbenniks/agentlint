---
title: CLI reference
description: Every Agentlint command, argument, option, output mode, and exit status.
---

# CLI reference

The executable is `agentlint`. Pass a URL directly as shorthand for `agentlint scan <url>`.

## `scan [url]`

Scan a website for agent readiness. When `[url]` is omitted, the target comes from `agentlint.config.json`.

```bash
agentlint scan https://example.com [options]
agentlint https://example.com [options]
```

<table class="option-table">
  <thead><tr><th>Option</th><th>Default</th><th>Purpose</th></tr></thead>
  <tbody>
    <tr><td><code>--no-browser</code></td><td>browser on</td><td>Disable Playwright and browser-derived checks.</td></tr>
    <tr><td><code>--depth &lt;n&gt;</code></td><td><code>2</code></td><td>Maximum same-origin crawl depth.</td></tr>
    <tr><td><code>--max-pages &lt;n&gt;</code></td><td><code>20</code></td><td>Maximum pages to crawl.</td></tr>
    <tr><td><code>--format &lt;fmt&gt;</code></td><td><code>terminal</code></td><td><code>terminal</code>, <code>json</code>, <code>markdown</code>, or <code>html</code>.</td></tr>
    <tr><td><code>--output &lt;dir&gt;</code></td><td><code>.agentlint</code></td><td>Report and task storage directory.</td></tr>
    <tr><td><code>--verbose</code></td><td>off</td><td>Show per-check evidence in terminal output.</td></tr>
    <tr><td><code>--agent</code></td><td>off</td><td>Print the agent-native protocol when tasks remain.</td></tr>
    <tr><td><code>--json</code></td><td>off</td><td>Print a compact machine-control status payload.</td></tr>
    <tr><td><code>--allow-private</code></td><td>off</td><td>Allow localhost and private IP targets.</td></tr>
    <tr><td><code>--ci</code></td><td>off</td><td>Compare with <code>baseline.json</code> and fail on regression.</td></tr>
    <tr><td><code>--missions</code></td><td>off</td><td>Add four bounded evidence-only agent missions.</td></tr>
  </tbody>
</table>

`--json` is different from `--format json`: the former emits compact control flow, while the latter emits the canonical full report.

`--format html` emits the same self-contained visual report that every scan writes to `.agentlint/latest.html`:

```bash
agentlint scan https://example.com --format html > agentlint-report.html
```

## `init [url]`

Configure Agentlint in an existing website project.

```bash
agentlint init https://example.com [options]
```

| Option | Purpose |
| --- | --- |
| `--force` | Replace existing Agentlint-managed config and scaffolding. |
| `--ci` | Add a scheduled and manually dispatchable GitHub Actions scan. |
| `--cursor-skill` | Add `.cursor/skills/agentlint/SKILL.md`. |
| `--allow-private` | Include `--allow-private` in the generated package script. |
| `--cwd <path>` | Initialize another project directory. Defaults to the current directory. |

See [project setup](../guide/project-setup) for file ownership and safe update behavior.

## `tasks`

List reasoning tasks from the latest report and show their statuses.

```bash
agentlint tasks [--output <dir>]
```

## `task get <id>`

Print a task’s complete instructions, evidence, output schema, scoring thresholds, and state as JSON.

```bash
agentlint task get offering-clarity [--output <dir>]
```

## `task resolve <id>`

Validate and store a structured task answer.

```bash
agentlint task resolve offering-clarity --result '<json>' [--output <dir>]
```

`--result <json>` is required. Shell quoting rules apply; single quotes around the JSON are usually simplest in POSIX shells.

## `explain [category]`

Print the score breakdown for all categories or one category.

```bash
agentlint explain
agentlint explain reliability
```

Reads the latest report from `--output <dir>`.

## `fix`

Print prioritized recommendations from the latest scan.

```bash
agentlint fix [--output <dir>]
```

## `prompt`

Print the self-contained remediation prompt generated from the latest report.

```bash
agentlint prompt [--output <dir>]
```

Redirect it when you want a portable copy:

```bash
agentlint prompt > agentlint-fix.md
```

## `baseline save`

Save the latest report as the accepted regression baseline.

```bash
agentlint baseline save [--output <dir>]
```

## `baseline compare`

Compare the latest report with the saved baseline.

```bash
agentlint baseline compare [--output <dir>]
```

## Global options

```bash
agentlint --help
agentlint --version
```

## Exit statuses

| Status | Meaning |
| --- | --- |
| `0` | Command completed without an enforced regression. Findings may still exist in a normal scan. |
| `1` | `--ci` or `baseline compare` found a regression. |
| `2` | A handled scan, initialization, report, or baseline error. |

Task validation and unexpected runtime failures also return a non-zero status; consumers should treat any value other than `0` as unsuccessful unless they specifically handle the regression status.

## Examples

```bash
# Public, deterministic and browser-assisted
agentlint https://example.com

# Agent-orchestrated complete test
agentlint scan https://example.com --agent --missions

# Fast structural scan in a container
agentlint scan https://example.com --no-browser --json

# Full canonical report on stdout
agentlint scan https://example.com --format json

# Local development build
agentlint scan http://localhost:4173 --allow-private --agent --missions
```
