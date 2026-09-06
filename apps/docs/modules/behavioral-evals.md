---
title: Behavioral evals
description: Run real implementation tasks without coupling Agentlint to a model vendor or execution platform.
---

# Behavioral evals

Static scans answer **what agent-facing material is exposed?** Behavioral evals answer **can an agent use the discoverable product surface to complete a concrete task?**

```bash
agentlint eval task.agentlint.yaml --command my-agent --arg=--non-interactive
```

The eval module owns a separate pipeline and result history:

```text
versioned task definition
→ runner adapter
→ temporary workspace adapter
→ deterministic validators
→ score and ordered trace
→ .agentlint/evals/latest.json
```

This prevents model credentials, long-running processes, arbitrary project code, and benchmark-specific policy from leaking into the deterministic scanner.

## Task definition

```yaml
schemaVersion: "1"
id: create-integration
title: Create a minimal integration
target: https://example.com/docs
prompt: |
  Discover the public documentation and implement the requested integration.
workspace:
  source: ./starter-project
successThreshold: 100
validators:
  - id: artifact
    type: file-exists
    path: integration.json
  - id: shape
    type: json-schema
    path: integration.json
    schema:
      type: object
      required: [name, steps]
```

Workspace sources resolve relative to the task file and are copied before the runner starts. Keeping agent selection out of the task makes the same benchmark portable across runners.

## Adapter boundaries

The public library exposes `EvalRunnerAdapter` and `EvalSandboxProvider`. V2 ships a command runner and a temporary-directory sandbox. Container, remote, or model-specific adapters can implement the same interfaces later without changing task definitions or scoring.

Runner adapters can attach numeric metrics and emit ordered trace events for tool calls, retries, token usage, or other harness-specific signals. The command runner reads the task and target URL from stdin, starts in the workspace, and also receives task metadata through `AGENTLINT_EVAL_*` environment variables. Agentlint itself does not call a model API.

## Validation and scoring

Validators are deterministic and weighted equally unless a `weight` is supplied:

- `file-exists`
- `file-contains`
- `json-schema`
- `command`

The score is the percentage of passing validator weight. The eval passes only when the runner exits successfully, does not time out, and the score meets `successThreshold`.

Command validators can run project tests, builds, or other acceptance checks. Because they originate in the task file, they are blocked by default and require `--allow-validator-commands`.

## Traces and results

Every result records timestamps, runner output and exit state, validator details, duration, scoring, and ordered trace events. V2 intentionally does not merge scan and eval scores. A later reporting layer can correlate them—for example, “MCP was exposed but the runner did not discover it”—without making the static score dependent on a particular agent or harness.

The default temporary directory is an execution workspace, not an OS security boundary. Choose an appropriate custom sandbox provider before running untrusted agent or project code.

## Recommended first benchmark

The repository includes `examples/evals/agentlint-project-setup.agentlint.yaml`. It asks an agent to discover Agentlint's public project-setup documentation and configure a small existing website fixture. The task needs no credentials or live mutation, preserves an existing script, and has deterministic validators for the config, package setup, and managed agent instructions.

This dogfood task is a better first behavioral signal than the minimal `create-integration` smoke example: success depends on product-specific documentation, while the outcome remains cheap and objectively testable.

## Sanity + Next.js implementation benchmark

`examples/evals/sanity-nextjs-studio.agentlint.yaml` is a heavier external-product benchmark. It gives the runner an existing Next.js App Router project and asks it to discover Sanity's public surface, add the official Next.js integration, embed Studio at `/studio`, define a post schema, query published content, document environment setup, and pass a production build.

```bash
agentlint eval examples/evals/sanity-nextjs-studio.agentlint.yaml \
  --command codex \
  --arg=exec \
  --arg=--ephemeral \
  --arg=--skip-git-repo-check \
  --arg=--approve-for-me \
  --arg=- \
  --allow-validator-commands \
  --keep-sandbox
```

This task intentionally stops before account mutation. It proves that the frontend, embedded Studio, schema, public client, setup state, and production build work without credentials. A live editing backend still requires a real Sanity project ID, dataset, allowed CORS origin, and an authenticated Studio session.
