---
title: Getting started
description: Run your first Agentlint scan and understand what happens next.
---

# Run your first evidence trace

Agentlint scans a website’s public surface and measures whether an agent can discover, understand, and safely plan work with it. The scanner is deterministic; it never sends your site to a model API.

## Prerequisites

- Node.js 22 or later.
- A public `http` or `https` URL.
- Playwright Chromium for browser checks, or the `--no-browser` flag.

## Scan any public site

Run without installing Agentlint globally:

```bash
npx @timbenniks/agentlint scan https://example.com --agent --missions
```

The shorthand form is equivalent:

```bash
npx @timbenniks/agentlint https://example.com --agent --missions
```

Use `--no-browser` when Chromium is unavailable:

```bash
npx @timbenniks/agentlint scan https://example.com --no-browser --agent --missions
```

::: tip Why include `--agent --missions`?
`--agent` prints the reasoning protocol when semantic tasks remain. `--missions` adds four bounded tests of actual agent outcomes, not just the presence of artifacts.
:::

## Read the result

A scan prints an overall score, category scores, check statuses, and paths to the durable reports. Four statuses are possible:

| Status | Meaning |
| --- | --- |
| `pass` | The supplied evidence meets the check. |
| `warning` | The surface is usable but incomplete or fragile. |
| `fail` | An applicable requirement is not met. |
| `n/a` | The check does not apply and does not enter the score. |

If the scan prints `AGENTLINT_REASONING_REQUIRED`, continue with the [agent loop](./agent-loop). Otherwise, inspect the prioritized work:

```bash
npx @timbenniks/agentlint fix
npx @timbenniks/agentlint prompt > agentlint-fix.md
```

## Where reports go

Every scan writes to `.agentlint/` by default. The most useful entry points are:

- `latest.json` for programs and agents;
- `latest.md` for people;
- `latest.html` for a portable, interactive visual overview;
- `fix-prompt.md` for a coding agent in the site repository.

See [reports and files](../reference/reports) for the full layout.

## Next step

For repeated use, [initialize Agentlint inside the website repository](./project-setup). That gives both humans and agents one stable command and the instructions needed to complete the loop.
