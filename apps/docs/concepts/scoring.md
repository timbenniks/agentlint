---
title: Scoring
description: Learn how applicable checks, severity, reasoning, and mission scores combine.
---

# Score what applies

Agentlint scores readiness without pretending every website should expose the same capabilities.

## Applicability comes first

Each check decides whether it applies to the collected surface. An API reliability check should not penalize a personal portfolio with no API. An inapplicable check receives `n/a` and is excluded from the denominator.

`N/A` is therefore information, not failure and not missing work.

## Statuses and severity

Checks return `pass`, `warning`, `fail`, or `n/a`. Their definitions also carry a severity:

| Severity | Role |
| --- | --- |
| `required` | Foundational agent usability. |
| `recommended` | Materially improves reliable use. |
| `emerging` | Reports developing practices without reducing the score. |
| `bonus` | Rewards useful extra capability without masking other warnings. |

Category and overall values are capped at 100.

## Two views of readiness

Reports keep deterministic surface readiness distinct from bounded task success:

- **Surface readiness** summarizes applicable artifact and behavior checks.
- **Bounded task success** summarizes resolved reasoning judgments and missions.
- **Overall readiness** combines the applicable scored results without letting bonus points erase unresolved weaknesses.

That separation answers two different questions: “Is the site prepared?” and “Could an evidence-constrained agent complete the tested outcomes?”

## Reasoning results are not automatic passes

A resolved task maps back to its originating check. Numeric fields use the task’s declared pass and warning thresholds; a low-quality but schema-valid answer can still produce a warning or failure.

## Explain a score

Inspect every category:

```bash
npx @timbenniks/agentlint explain
```

Or one category:

```bash
npx @timbenniks/agentlint explain access
```

Available categories are `discovery`, `access`, `understanding`, `developer`, `operation`, `reliability`, and `security` when corresponding checks appear in the report.

## Use baselines for enforcement

A score is a summary, not a release policy. In CI, compare with a reviewed [regression baseline](../guide/ci-regressions) so an accepted change in applicability or capability does not become an unexplained threshold failure.
