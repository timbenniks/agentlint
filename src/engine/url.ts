import { DEFAULT_USER_AGENT } from "../constants.ts";

export function normalizeInputUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("URL is required.");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

export function originOf(url: string): string {
  return new URL(url).origin;
}

export function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

export function resolveUrl(href: string, base: string): string | undefined {
  try {
    const url = new URL(href, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    url.hash = "";
    return url.href;
  } catch {
    return undefined;
  }
}

export function hostLabel(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function withUserAgent(ua: string): Record<string, string> {
  return { "user-agent": ua || DEFAULT_USER_AGENT };
}
