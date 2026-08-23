---
title: Coding agents
description: Integrate Agentlint with Codex, Claude Code, Cursor, and other agent harnesses.
---

# Agentlint supplies the test; your agent supplies judgment

No special model provider is required. The integration contract is CLI commands, JSON Schema, and files, so any coding agent that can run shell commands and edit the site repository can complete it.

## Best setup

Install Agentlint in the website repository and initialize it:

```bash
npx @timbenniks/agentlint init https://example.com
```

This writes the workflow into a managed section of `AGENTS.md`. Agents that read repository instructions automatically receive the reasoning and remediation loop.

## Portable agent instructions

Use this when a harness does not read `AGENTS.md`:

```text
Run the project's Agentlint script.

If stdout contains AGENTLINT_REASONING_REQUIRED or JSON status is
reasoning_required:
1. Run `agentlint task get <id>`.
2. Answer using only the task instructions and evidence.
3. Return JSON matching outputSchema exactly.
4. Run `agentlint task resolve <id> --result '<json>'`.
5. Repeat until no tasks remain.

Then run `agentlint fix`, read `.agentlint/fix-prompt.md`, and implement
evidence-backed P0/P1 fixes in this site's repository. Rebuild or deploy,
rescan, and repeat until no P0/P1 findings or failed missions remain.

Do not invent pages, APIs, entities, or tools. N/A is not failure. Do not
authenticate, submit forms, deploy, or mutate the scanned target without
separate user authorization.
```

## Codex and Claude Code

Keep the initialized `AGENTS.md` in the repository. Ask the agent to run the Agentlint loop against the configured target and implement the fix prompt. The CLI’s `--agent` output gives exact pending task commands.

## Cursor

Generate a project-local skill in addition to `AGENTS.md`:

```bash
npx @timbenniks/agentlint init https://example.com --cursor-skill
```

This creates `.cursor/skills/agentlint/SKILL.md` with the target and bounded workflow.

## Custom harnesses

Use compact JSON status for control flow:

```bash
agentlint scan --agent --missions --json
```

Branch on:

- `reasoning_required`: retrieve and resolve IDs in `tasks`;
- `complete`: consume `latest.json` and `fix-prompt.md`;
- `error`: stop and surface `error` rather than attempting fixes.

Do not parse colored terminal output. `latest.json` is the durable API.

## Scanner repo versus site repo

Agentlint can run from anywhere against a public URL. Fix application belongs in the scanned site’s repository. Keeping the dependency there removes ambiguity: the config names the deployed target, the agent instructions are colocated with code, and the fix prompt is generated where it will be used.
