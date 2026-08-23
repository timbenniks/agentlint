---
title: Run the agent loop
description: Resolve bounded reasoning, apply the fix prompt, and repeat safely.
---

# Scan, reason, fix, repeat

Agentlint deliberately splits mechanical collection from semantic judgment. A coding agent can complete the second half without an API key because it is already the reasoner.

## 1. Run the scan

Inside an initialized website repository:

```bash
npm run agentlint
```

Or without initialization:

```bash
npx @timbenniks/agentlint scan https://example.com --agent --missions
```

## 2. Inspect each pending task

When stdout contains `AGENTLINT_REASONING_REQUIRED` or JSON reports `"status": "reasoning_required"`:

```bash
npx @timbenniks/agentlint tasks
npx @timbenniks/agentlint task get entity-identification
```

The task payload contains four important boundaries:

- `instructions`: the exact judgment to make;
- `evidence`: the only facts the answer may use;
- `outputSchema`: the required JSON shape;
- `scoring`: how a numeric answer maps back to the check, when applicable.

## 3. Resolve with schema-valid JSON

Return only the requested object:

```bash
npx @timbenniks/agentlint task resolve entity-identification \
  --result '{"entity":"Example","entityType":"organization","confidence":0.9,"evidence":["JSON-LD"]}'
```

Agentlint validates the result. It rejects malformed JSON, schema violations, mission citations absent from supplied evidence, incoherent metrics, and mutating tool plans.

Repeat `task get` and `task resolve` until no pending tasks remain.

## 4. Hand the site a fix prompt

After resolution:

```bash
npx @timbenniks/agentlint fix
npx @timbenniks/agentlint prompt > agentlint-fix.md
```

`.agentlint/fix-prompt.md` is already self-contained. It includes:

- evidence-backed failures and warnings;
- P0–P3 priorities;
- observed sources and safety constraints;
- concrete remediation and verification steps;
- a repeat-until-clean loop.

Run that prompt with a coding agent **inside the scanned site’s source repository**. A remote scanner can identify the gap, but only the site repository has the code needed to implement it.

## 5. Rescan after the deployed change

The scanner reads the target URL, not unbuilt local source. Build and serve locally with `--allow-private`, or deploy the change, then rerun the scan.

Stop when:

- no P0 or P1 findings remain;
- no bounded mission fails;
- remaining warnings are understood and accepted;
- N/A checks remain N/A.

::: danger Keep the loop bounded
Do not let the agent authenticate, submit forms, deploy, or mutate the scanned target merely to improve a score. Do not invent pages, APIs, tools, or entities. Agentlint treats those actions as outside the scan contract.
:::

## Agent-native JSON control flow

Use `--json` when a harness needs a stable status and next action:

```bash
npx @timbenniks/agentlint scan https://example.com --agent --missions --json
```

```json
{
  "status": "reasoning_required",
  "scanId": "scan_...",
  "score": 87,
  "tasks": ["entity-identification", "offering-clarity"],
  "next": "agentlint task get entity-identification"
}
```
