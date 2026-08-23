---
title: Bounded missions
description: Test agent outcomes safely with evidence-only, non-executed missions.
---

# Test outcomes, not just artifacts

A site can expose `llms.txt` and an OpenAPI document while still being difficult or unsafe to use. `--missions` asks the invoking agent to demonstrate four concrete capabilities under evidence constraints.

## The four missions

### Content discovery

Find and retrieve a concrete primary-source resource from the supplied site evidence. This tests whether discovery artifacts lead somewhere useful rather than merely existing.

### Safe tool plan

Construct a non-executed, read-only OpenAPI plan. The mission checks operation selection, required inputs, evidence citations, request efficiency, and the absence of mutation.

### Instruction boundaries

Separate trusted site guidance from untrusted content found on a page. This tests whether a site gives agents enough structure to avoid treating arbitrary content as operational instruction.

### Recovery

Recover from a missing resource without inventing a replacement. A good result identifies evidence-backed alternatives or clearly reports the limitation.

## Grounding requirements

Mission answers must:

- match their JSON Schema;
- cite sources present in the task evidence;
- declare that no mutating action is planned;
- keep request and evidence-use counts coherent.

The CLI records efficiency metrics such as planned requests and evidence items used. These are useful for observing whether a site makes the safe path direct.

## What missions do not do

Missions do not execute tools, call endpoints, submit forms, authenticate, or modify the target. They evaluate the quality of an evidence-constrained plan. Live transactional journeys are outside the 0.1 scope.

## Run them

```bash
npx @timbenniks/agentlint scan https://example.com --agent --missions
```

Resolve mission tasks through the same [`task get` / `task resolve` loop](./reasoning-tasks) as semantic judgments.
