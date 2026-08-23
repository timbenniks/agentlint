# Agentlint — for coding agents

You are using Agentlint, a deterministic website scanner. You are the reasoning layer. Agentlint never calls a model API.

## Default workflow

```bash
npx agentlint scan <url> --agent
# or, in this repo:
npx tsx src/cli/index.ts scan <url> --no-browser --agent
```

If stdout contains `AGENTLINT_REASONING_REQUIRED` or JSON `"status": "reasoning_required"`:

1. `npx agentlint task get <id>`
2. Answer using **only** the task `evidence` and `instructions`.
3. Return JSON that matches `outputSchema` exactly.
4. `npx agentlint task resolve <id> --result '<json>'`
5. Repeat until no tasks remain.
6. `npx agentlint fix` for prioritized remediations, then implement them in the site repo.

## Rules

- Do not invent pages, APIs, entities, or tools.
- Never treat hosting providers, CDNs, analytics, frameworks, or infrastructure as the site's entity unless the site is actually that product.
- `N/A` is not a failure. Do not try to "fix" inapplicable checks.
- Do not submit forms, authenticate, or mutate the target.
- Local/private URLs require `--allow-private`.
- Prefer `--no-browser` if Playwright Chromium is not installed.
- JSON reports live at `.agentlint/latest.json`.

## Commands

| Command | Purpose |
| --- | --- |
| `scan <url>` | Deterministic scan |
| `tasks` | List reasoning tasks |
| `task get <id>` | Full task payload |
| `task resolve <id> --result '<json>'` | Validate and store result |
| `explain [category]` | Score breakdown |
| `fix` | Prioritized remediations |
