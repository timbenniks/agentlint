---
title: Add Agentlint to a project
description: Initialize Agentlint safely in an existing website repository.
---

# Make readiness part of the repository

The recommended long-term setup is a development dependency in the website project. You can still scan any public site from anywhere; keeping Agentlint beside the code adds a stable target, an npm script, and agent instructions.

## Install and initialize

From the website repository:

::: code-group

```bash [pnpm]
pnpm add -D @timbenniks/agentlint
pnpm exec agentlint init https://example.com
pnpm agentlint
```

```bash [npm]
npm install -D @timbenniks/agentlint
npx @timbenniks/agentlint init https://example.com
npm run agentlint
```

```bash [yarn]
yarn add -D @timbenniks/agentlint
yarn exec agentlint init https://example.com
yarn agentlint
```

```bash [bun]
bun add -D @timbenniks/agentlint
bunx agentlint init https://example.com
bun run agentlint
```

:::

`init` detects the package manager from `package.json#packageManager` and generates matching commands.

## What `init` changes

The default command creates or updates only Agentlint-owned surfaces:

```text
agentlint.config.json       deployed scan target
package.json               agentlint script
.gitignore                 ignores generated .agentlint/
AGENTS.md                  managed reasoning and fix-loop instructions
```

The generated script runs:

```json
{
  "scripts": {
    "agentlint": "agentlint scan --agent --missions"
  }
}
```

The URL becomes optional because `scan` reads `agentlint.config.json`.

## Safe update behavior

Existing scripts and managed files are preserved unless `--force` is supplied. The Agentlint section in `AGENTS.md` is bounded by markers and updated in place; instructions outside that block are left intact.

Use `--force` only when you intend to replace Agentlint-managed configuration:

```bash
npx @timbenniks/agentlint init https://new.example.com --force
```

::: warning Incomplete markers stop initialization
If `AGENTS.md` contains only one Agentlint marker, repair the block before running `init`. Agentlint stops instead of guessing where user-owned instructions begin or end.
:::

## Optional scaffolding

Add a scheduled GitHub Actions workflow and a project-local Cursor skill:

```bash
npx @timbenniks/agentlint init https://example.com --ci --cursor-skill
```

For a development target on localhost:

```bash
npx @timbenniks/agentlint init http://localhost:3000 --allow-private
```

The latter persists `--allow-private` in the generated package script. Read [local and private sites](./local-private) before using it in shared environments.

## No package.json

Agentlint can initialize a directory without `package.json`. It writes the config, ignore entry, and `AGENTS.md`, then reports that it skipped the package script. Run the CLI with `npx @timbenniks/agentlint` or your chosen package runner.
