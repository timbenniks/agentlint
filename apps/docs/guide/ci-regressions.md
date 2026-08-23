---
title: CI and regressions
description: Save an accepted readiness baseline and detect regressions in CI.
---

# Protect an accepted readiness baseline

A raw score threshold loses useful context. Agentlint instead compares a current report with a baseline you explicitly accepted.

## Save the baseline

Complete a scan and resolve its reasoning tasks, then save it:

```bash
npx @timbenniks/agentlint baseline save
```

This writes `.agentlint/baseline.json`. Unlike transient reports, the baseline must be available to future CI runs. Commit it intentionally if CI should use it; if `.agentlint/` is ignored, force-add only that file or store it as a CI artifact through your own workflow.

## Compare a fresh scan

```bash
npx @timbenniks/agentlint scan https://example.com --ci
```

Or compare the latest report explicitly:

```bash
npx @timbenniks/agentlint baseline compare
```

The command exits with status `1` when it finds a readiness regression and `2` for a scan or configuration error.

Pending reasoning tasks are deferred during comparison. A new deterministic scan should not appear worse merely because its bounded judgments have not been resolved yet.

## Scaffold GitHub Actions

Initialize with `--ci`:

```bash
npx @timbenniks/agentlint init https://example.com --ci
```

The generated `.github/workflows/agentlint.yml`:

- runs manually and on a weekly schedule;
- uses Node.js 22;
- installs with the detected package manager;
- runs a read-only, no-browser JSON scan;
- uploads `.agentlint/` as an artifact even when the scan fails.

The scaffold is a starting point. Add `--ci` to the generated scan command only after the workflow can restore a committed or downloaded baseline.

## Recommended pull-request pattern

1. Run the deterministic scan in CI.
2. Upload the full report on every result.
3. Fail only on operational errors or baseline regressions.
4. Resolve semantic tasks in a trusted coding-agent job or during development.
5. Update the baseline in a reviewed change, never automatically.

This keeps changing model judgment out of the gate while still making evidence regressions enforceable.
