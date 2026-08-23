---
title: Configuration
description: Reference for agentlint.config.json and project initialization.
---

# Configuration

Agentlint intentionally has one small project config. Scan behavior stays visible at the command line.

## `agentlint.config.json`

```json
{
  "schemaVersion": "1",
  "target": "https://example.com/"
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `schemaVersion` | yes | Config format version. Must currently be `"1"`. |
| `target` | yes | Absolute `http` or `https` URL used when `scan` receives no URL. |

The URL is normalized through the platform URL parser. Other protocols are rejected.

## Target resolution

For `scan`, an explicit CLI URL wins. Otherwise Agentlint reads `agentlint.config.json` from the current working directory.

For `init`, target resolution is:

1. explicit `[url]` argument;
2. an existing valid Agentlint config;
3. a valid `package.json#homepage`.

Initialization fails when none is available.

## Change the configured target

Agentlint will not silently replace an existing, different target:

```bash
npx @timbenniks/agentlint init https://new.example.com --force
```

## Output directory

Report storage is a scan option rather than config:

```bash
npx @timbenniks/agentlint scan --output .cache/readiness
npx @timbenniks/agentlint tasks --output .cache/readiness
```

Use the same `--output` value for follow-up commands.
