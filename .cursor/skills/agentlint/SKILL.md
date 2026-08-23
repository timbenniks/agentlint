---
name: agentlint
description: >-
  Scan websites for AI agent readiness with Agentlint. Use when the user
  asks to run agentlint, check agent readiness, llms.txt, MCP/WebMCP,
  OpenAPI tool-calling, or whether agents can find, understand, or use a
  site. Also use when implementing Agentlint fix recommendations.
---

# Agentlint

Agentlint is a deterministic CLI. You are the reasoning layer. Never call an OpenAI, Anthropic, Google, or other model API on Agentlint's behalf.

## Scan

```bash
npx agentlint scan <url> --agent
```

In the Agentlint repo:

```bash
npx tsx src/cli/index.ts scan <url> --no-browser --agent
```

Flags: `--no-browser` without Chromium, `--allow-private` for localhost, `--json` for a status payload.

## Reasoning loop

If output includes `AGENTLINT_REASONING_REQUIRED` or `"status": "reasoning_required"`:

1. Run `npx agentlint task get <id>`
2. Use only `evidence` + `instructions`
3. Emit JSON matching `outputSchema`
4. Run `npx agentlint task resolve <id> --result '<json>'`
5. Repeat for remaining task IDs
6. Run `npx agentlint fix` and implement P0/P1 remediations in the **target site**, not in Agentlint unless asked

Invalid JSON is rejected. Do not invent evidence.

## Scoring

`N/A` means the check does not apply. Do not treat it as a failure or add fake APIs/sitemaps to chase points.

## Reports

- `.agentlint/latest.json` — canonical
- `.agentlint/latest.md` — human summary
