---
title: GitHub Actions
description: Generate and adapt the Agentlint GitHub Actions workflow.
---

# Scheduled evidence collection

Generate a workflow during initialization:

```bash
npx @timbenniks/agentlint init https://example.com --ci
```

The result lives at `.github/workflows/agentlint.yml` and uses the repository’s declared package manager.

## Generated workflow

The scaffold has two triggers:

```yaml
on:
  workflow_dispatch:
  schedule:
    - cron: "17 7 * * 1"
```

Its scan is deliberately deterministic and container-friendly:

```bash
agentlint scan --no-browser --json
```

The report directory uploads as an artifact with `if: always()` so collection failures remain diagnosable.

## Add browser evidence

If CI must evaluate rendered controls or browser model context, install Chromium and remove `--no-browser`:

```yaml
- run: npx playwright install --with-deps chromium
- run: npx @timbenniks/agentlint scan --json
```

## Add regression enforcement

Ensure `.agentlint/baseline.json` is restored, then add `--ci`:

```yaml
- run: npx @timbenniks/agentlint scan --no-browser --json --ci
```

Keep baseline updates in reviewed pull requests. Do not generate and accept a new baseline in the same unattended job; that would erase the meaning of a regression gate.

## Reasoning in CI

A deterministic scan can complete with pending reasoning tasks. The baseline comparison defers those unresolved judgments. If you add an agent job, give it only the report evidence and the repository permissions needed for the intended workflow. Agentlint itself requires no model secret.

For the full policy, see [CI and regressions](../guide/ci-regressions).

## Agentlint’s own release gate

The Agentlint repository tests its reusable contracts on Node 22 and 24. A separate release gate:

1. runs the generated HTML report in Chromium at desktop and mobile widths;
2. builds this documentation site;
3. packs the exact npm tarball;
4. installs it in a clean temporary project;
5. exercises `init`, scan, task resolution, HTML output, baselines, and CI comparison.

Run the same gate locally:

```bash
pnpm verify:release
```

Publishing happens only from a GitHub Release. Prereleases use npm’s `next` tag; stable releases use `latest`. The workflow uses npm trusted publishing and provenance, so the npm package should be linked to this GitHub repository before the first release.

## Documentation deployment

The repository’s `vercel.json` builds VitePress from the monorepo root and publishes `apps/docs/.vitepress/dist`. Import the GitHub repository in Vercel and leave its root directory at the repository root. Preview branches and pull requests then receive their own documentation deployment.
