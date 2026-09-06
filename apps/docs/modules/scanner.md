---
title: Static scanner
description: The deterministic Agentlint core for collecting and scoring agent-facing product surfaces.
---

# Static scanner

The scanner is Agentlint's lightweight core. It collects public evidence, runs only applicable checks, and delegates bounded semantic judgments back to the invoking coding agent.

```bash
agentlint scan https://example.com
```

Its pipeline remains independent from behavioral execution:

```text
target normalization
→ HTTP/browser collection
→ capability discovery
→ deterministic checks
→ applicability-aware scoring
→ scan reports and reasoning tasks
```

The scanner does not launch a coding-agent process, create an implementation workspace, or call a model API. Its canonical state remains `.agentlint/latest.json`, with historical reports below `.agentlint/scans/`.

Checks, protocols, collectors, and reporters that operate within this bounded pipeline are scanner features rather than separate modules. See the [rules reference](../reference/checks) for the complete current surface.
