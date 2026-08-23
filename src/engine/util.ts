export function nowIso(): string {
  return new Date().toISOString();
}

export function evidence(
  type: "http" | "html" | "header" | "json" | "jsonld" | "browser" | "accessibility" | "openapi" | "mcp" | "search" | "text",
  source: string,
  value: unknown,
) {
  return { type, source, value, collectedAt: nowIso() };
}

export function sanitizeText(value: string, max = 200_000): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, max);
}

export function collapseWs(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function header(headers: Record<string, string>, name: string): string | undefined {
  const needle = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === needle) return value;
  }
  return undefined;
}

export function contentTypeIs(headers: Record<string, string>, part: string): boolean {
  return (header(headers, "content-type") ?? "").toLowerCase().includes(part.toLowerCase());
}

export function looksLikeHtml(body: string, contentType: string): boolean {
  if (contentType.includes("html")) return true;
  return /^\s*</.test(body);
}

export function looksLikeMarkdown(body: string): boolean {
  return (
    /^#{1,6}\s/m.test(body) ||
    /\[[^\]]+\]\([^)]+\)/.test(body) ||
    /^[-*]\s/m.test(body) ||
    /^```/m.test(body)
  );
}

export function extractMarkdownLinks(body: string): string[] {
  const links: string[] = [];
  const re = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body))) {
    const href = match[1];
    if (href && !href.startsWith("#")) links.push(href);
  }
  const bare = /https?:\/\/[^\s)]+/g;
  while ((match = bare.exec(body))) {
    if (match[0]) links.push(match[0]);
  }
  return [...new Set(links)];
}

export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index] as T, index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) || 1 }, () => worker());
  await Promise.all(workers);
  return results;
}

export function safeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120);
}
