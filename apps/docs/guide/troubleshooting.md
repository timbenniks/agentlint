---
title: Troubleshooting
description: Diagnose browser, URL, task, report, and baseline errors.
---

# Follow the failed boundary

Agentlint uses exit status `2` for handled scan, initialization, report, and baseline errors. Task validation and unexpected runtime failures also return non-zero. Use `--json` when another program must distinguish scan errors from findings.

## Playwright Chromium is missing

Install the browser:

```bash
npx playwright install chromium
```

Or continue without browser evidence:

```bash
npx @timbenniks/agentlint scan https://example.com --no-browser
```

## The URL is missing

Pass it directly, or initialize the project:

```bash
npx @timbenniks/agentlint init https://example.com
npx @timbenniks/agentlint scan
```

`package.json#homepage` can supply the initial target when it is a valid HTTP(S) URL.

## Localhost is blocked

Private targets require explicit consent:

```bash
npx @timbenniks/agentlint scan http://localhost:3000 --allow-private
```

## A task result is rejected

Retrieve the task again and compare the result against `outputSchema` exactly:

```bash
npx @timbenniks/agentlint task get <id>
```

Use only supplied evidence. For missions, cite exact sources found in the evidence and keep plans non-mutating. Do not add explanatory prose around the JSON object.

## `fix` says no report exists

Commands read `.agentlint/latest.json` unless `--output` points elsewhere. Run a scan in the same working directory or repeat the output option:

```bash
npx @timbenniks/agentlint scan https://example.com --output tmp/report
npx @timbenniks/agentlint fix --output tmp/report
```

## Baseline comparison cannot run

Both `.agentlint/latest.json` and `.agentlint/baseline.json` must exist under the selected output directory. Run and accept a scan before saving the baseline.

## The score did not change after an edit

Agentlint reads the served target. Rebuild, restart, or deploy the site before rescanning. Then use `agentlint explain [category]` to see which checks enter the score.

## `init` refuses to overwrite a file

This is intentional. Inspect the existing Agentlint-managed content, then use `--force` only if replacement is desired. An incomplete managed block in `AGENTS.md` must be repaired manually first.
