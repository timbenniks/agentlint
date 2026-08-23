---
title: Reasoning tasks
description: See how semantic judgments remain structured, grounded, and reproducible.
---

# A closed world for semantic judgment

Some qualities are meaningful but not reliably derivable from markup alone: which entity the site represents, whether an offering is clear, or whether developer documentation is sufficient. Agentlint emits a task instead of faking certainty.

## Task anatomy

Every task includes:

```json
{
  "taskVersion": "1",
  "id": "offering-clarity",
  "type": "reasoning",
  "kind": "judgment",
  "title": "...",
  "instructions": "...",
  "evidence": {},
  "outputSchema": {},
  "scoring": {
    "scoreField": "score",
    "passAt": 80,
    "warningAt": 50
  },
  "status": "pending"
}
```

The answerer must treat `evidence` as a closed world. It may interpret that evidence according to `instructions`; it may not browse for supporting facts or invent missing resources.

## Task lifecycle

```bash
npx @timbenniks/agentlint tasks
npx @timbenniks/agentlint task get offering-clarity
npx @timbenniks/agentlint task resolve offering-clarity --result '<json>'
```

Statuses are:

- `pending`: needs an answer;
- `resolved`: passed schema and grounding validation;
- `invalid`: a stored or submitted result could not be accepted.

Resolving a task updates the latest report and its derived human and agent artifacts.

## Validation layers

Agentlint checks more than JSON syntax:

1. the value matches `outputSchema`;
2. required fields and enumerations are correct;
3. numeric metrics are coherent;
4. mission citations exist in supplied evidence;
5. safe plans contain no mutating action.

## Why the skill or AGENTS.md still helps

The CLI prints exact next commands, and `--json` exposes a `next` field. That is sufficient for a purpose-built harness. General coding agents, however, do not reliably infer the full repeat loop and safety rules from `--help` alone.

`agentlint init` therefore writes a managed `AGENTS.md` block. `--cursor-skill` can add the same workflow in Cursor’s local skill format. These instructions do not add scanner capability; they make orchestration explicit.

See [coding-agent integrations](../integrations/coding-agents) for the portable prompt.
