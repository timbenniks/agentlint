---
title: Local and private sites
description: Scan localhost safely and understand Agentlint's SSRF boundary.
---

# Test before deployment

Agentlint blocks localhost and private IP targets by default. This is an SSRF safety boundary for a CLI that follows links and fetches discovered resources.

## Enable an intentional local scan

Start the site, then opt in explicitly:

```bash
npx @timbenniks/agentlint scan http://localhost:3000 --allow-private --agent --missions
```

For a project-level script:

```bash
npx @timbenniks/agentlint init http://localhost:3000 --allow-private
```

## Browser versus HTTP-only

Use the browser when the rendered interface, accessibility tree, or WebMCP surface matters:

```bash
npx playwright install chromium
npx @timbenniks/agentlint scan http://localhost:3000 --allow-private
```

Use HTTP-only mode for containers or quick structural checks:

```bash
npx @timbenniks/agentlint scan http://localhost:3000 --allow-private --no-browser
```

HTTP-only scans cannot observe browser-derived controls, landmarks, client-rendered content, or model-context APIs.

## Safety guidance

- Use `--allow-private` only for a target you control.
- Bind preview servers narrowly when possible.
- Do not point untrusted automation at internal admin panels or cloud metadata endpoints.
- Remember that Agentlint remains read-only: it does not authenticate or submit forms.

## Local fixes still need a served build

Agentlint scans HTTP responses, not source files. After editing, rebuild or restart the preview server so the scanner sees the new output.
