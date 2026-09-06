---
title: Modules
description: Agentlint's core scanner, behavioral evals, and the boundaries for future modules.
---

# Modules

Agentlint is one product with a small core and additive modules. Each module owns a distinct user outcome, runtime boundary, CLI command, result format, and documentation.

| Module | Command | Runtime | Result |
| --- | --- | --- | --- |
| [Static scanner](./scanner) | `agentlint scan` | Bounded HTTP/browser collection and deterministic checks | `.agentlint/latest.json` |
| [Behavioral evals](./behavioral-evals) | `agentlint eval` | External agent runner in a temporary workspace | `.agentlint/evals/latest.json` |

The scanner remains the core because discovery and evidence collection support the whole product. Heavier capabilities live beside it rather than inside its execution path.

## Module contract

An independent module has:

- a stable module ID;
- one owned top-level CLI command;
- an internal runtime boundary;
- versioned input and output contracts;
- isolated state paths;
- tests and a VitePress page in this section.

CLI modules implement the exported `AgentlintModule` interface and are registered in `src/modules/index.ts`. The central CLI shell loads that registry; it does not need to know how each module executes.

```ts
interface AgentlintModule {
  readonly id: string
  readonly command: string
  readonly description: string
  register(program: Command): void
}
```

## Adding a module

1. Put the runtime in its own directory under `src/`.
2. Keep its types, state, reports, and adapters inside that boundary.
3. Expose a small `register…Command` function.
4. Add an `AgentlintModule` entry to `src/modules/index.ts`.
5. Export only the public library surface from `src/index.ts`.
6. Add unit, CLI, and packaged-install coverage.
7. Add its page under `apps/docs/modules/` and its entry to the module table above.

Features that merely extend scan collection or add a deterministic check should stay in the scanner. A separate module is appropriate when the feature introduces its own command, execution model, state lifecycle, or security boundary.
