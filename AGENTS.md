# Agentlint — for coding agents

You are using Agentlint, a deterministic website scanner. You are the reasoning layer. Agentlint never calls a model API.

## Default workflow

```bash
pnpm agentlint scan <url> --agent
# include outcome, safety, efficiency, and recovery missions:
pnpm agentlint scan <url> --agent --missions
# or, in this repo:
npx tsx src/cli/index.ts scan <url> --no-browser --agent
```

If stdout contains `AGENTLINT_REASONING_REQUIRED` or JSON `"status": "reasoning_required"`:

1. `pnpm agentlint task get <id>`
2. Answer using **only** the task `evidence` and `instructions`.
3. Return JSON that matches `outputSchema` exactly.
4. `pnpm agentlint task resolve <id> --result '<json>'`
5. Repeat until no tasks remain.
6. `pnpm agentlint fix` for prioritized remediations.
7. Use `pnpm agentlint prompt` or `.agentlint/fix-prompt.md` in the target site repo.
8. Implement fixes, rescan, resolve tasks, and repeat until no P0/P1 findings or failed missions remain.

## Rules

- Do not invent pages, APIs, entities, or tools.
- Never treat hosting providers, CDNs, analytics, frameworks, or infrastructure as the site's entity unless the site is actually that product.
- `N/A` is not a failure. Do not try to "fix" inapplicable checks.
- Do not submit forms, authenticate, or mutate the target.
- Local/private URLs require `--allow-private`.
- Prefer `--no-browser` if Playwright Chromium is not installed.
- JSON reports live at `.agentlint/latest.json`.
- Mission evidence citations must name a source present in the task evidence.
- Mission results must never plan mutating actions.

## Commands

| Command | Purpose |
| --- | --- |
| `scan <url>` | Deterministic scan |
| `tasks` | List reasoning tasks |
| `task get <id>` | Full task payload |
| `task resolve <id> --result '<json>'` | Validate and store result |
| `explain [category]` | Score breakdown |
| `fix` | Prioritized remediations |
| `prompt` | Self-contained coding-agent remediation loop |
| `baseline save` | Save the accepted readiness state |
| `baseline compare` | Fail on agent-readiness regressions |
