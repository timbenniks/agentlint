---
title: Reports and files
description: Understand canonical reports, scan history, reasoning state, prompts, and baselines.
---

# Reports are durable state

Agentlint writes every result under `.agentlint/` by default. Follow-up commands read these files; stdout is a view, not the only record.

## Directory layout

```text
.agentlint/
├── latest.json              canonical current report
├── latest.md                human-readable current report
├── latest.html              interactive, self-contained visual report
├── fix-prompt.md            self-contained coding-agent prompt
├── baseline.json            accepted regression baseline, when saved
└── scans/
    ├── <scan-id>.json       scan-specific report state
    ├── <scan-id>.md         matching human report
    └── <scan-id>.html       matching visual report
```

## `latest.json`

This is the canonical machine-readable report. It includes:

- target, canonical URL, scan ID, and timestamps;
- overall, surface, bounded-task, and category scores;
- check status, score, evidence, and recommendation;
- discovered capability map;
- entity resolution;
- reasoning tasks and stored results;
- collected evidence summaries.

Use `--format json` to emit this full object to stdout.

## `latest.md`

The Markdown report is meant for review, issue descriptions, and artifacts. It follows the same result as JSON but is not the canonical input for automation.

## `latest.html`

The visual report is a single portable HTML file with inline styling and behavior—no server, hosted runtime, web font, or external asset request is required. It includes:

- overall, surface, bounded-task, status, and category score traces;
- bounded mission and reasoning state;
- filters for actionable, passing, and N/A checks;
- expandable findings, evidence, and recommendations;
- the observed capability map;
- a complete remediation prompt with a copy action.

Open it directly from disk or upload it as a CI artifact. All scanned text and evidence are HTML-escaped before rendering.

## `fix-prompt.md`

Generated on every scan and refreshed after task resolution. Before reasoning is complete, it explains which tasks remain. After resolution, it contains prioritized findings, evidence, safety constraints, verification commands, and stopping conditions.

The prompt describes fixes but Agentlint never edits or deploys the scanned target.

## Scan history

Files under `scans/` preserve individual run IDs so a later scan does not erase the audit trail. `latest.*` always points conceptually to the newest state. Reasoning-task resolution refreshes the latest and matching scan-specific HTML, Markdown, and JSON so all three views stay synchronized.

## `baseline.json`

Created only by `baseline save`. It represents an accepted state for later comparisons. Treat baseline changes as reviewed policy changes.

## Custom output roots

```bash
agentlint scan https://example.com --output tmp/agent-readiness
agentlint task get <id> --output tmp/agent-readiness
agentlint prompt --output tmp/agent-readiness
```

Every command in a reasoning or regression sequence must use the same output directory.
