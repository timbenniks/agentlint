import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

function ipv4ToInt(ip: string): number | undefined {
  const parts = ip.split(".");
  if (parts.length !== 4) return undefined;
  let n = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return undefined;
    n = (n << 8) + octet;
  }
  return n >>> 0;
}

function inCidr(ip: string, cidr: string): boolean {
  const [range, bitsRaw] = cidr.split("/");
  if (!range) return false;
  const bits = Number(bitsRaw);
  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range);
  if (ipInt === undefined || rangeInt === undefined) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

function expandIpv6(ip: string): string {
  if (ip.includes(".")) {
    const last = ip.lastIndexOf(":");
    const v4 = ip.slice(last + 1);
    const v4int = ipv4ToInt(v4);
    if (v4int !== undefined) {
      const hi = ((v4int >>> 16) & 0xffff).toString(16);
      const lo = (v4IntLow(v4int)).toString(16);
      return expandIpv6(`${ip.slice(0, last)}:${hi}:${lo}`);
    }
  }
  const [head, tail] = ip.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const missing = 8 - headParts.length - tailParts.length;
  const filled = [
    ...headParts,
    ...Array.from({ length: Math.max(missing, 0) }, () => "0"),
    ...tailParts,
  ];
  return filled.map((p) => p.padStart(4, "0")).join(":");
}

function v4IntLow(n: number): number {
  return n & 0xffff;
}

function ipv6IsPrivateOrMetadata(ip: string): boolean {
  const full = expandIpv6(ip.toLowerCase());
  if (full === "0000:0000:0000:0000:0000:0000:0000:0001") return true;
  if (full.startsWith("fe80:")) return true;
  const first = parseInt(full.slice(0, 4), 16);
  if ((first & 0xfe00) === 0xfc00) return true;
  if (full.startsWith("0000:0000:0000:0000:0000:ffff:")) {
    const b = full.split(":");
    const hi = parseInt(b[6] ?? "0", 16);
    const lo = parseInt(b[7] ?? "0", 16);
    const v4 = `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
    return isPrivateOrMetadataIp(v4);
  }
  return false;
}

export function isPrivateOrMetadataIp(ip: string): boolean {
  if (ip.startsWith("::ffff:")) return isPrivateOrMetadataIp(ip.slice(7));
  if (isIP(ip) === 6) return ipv6IsPrivateOrMetadata(ip);
  return (
    inCidr(ip, "127.0.0.0/8") ||
    inCidr(ip, "10.0.0.0/8") ||
    inCidr(ip, "172.16.0.0/12") ||
    inCidr(ip, "192.168.0.0/16") ||
    inCidr(ip, "169.254.0.0/16") ||
    inCidr(ip, "0.0.0.0/8") ||
    inCidr(ip, "255.255.255.255/32") ||
    inCidr(ip, "224.0.0.0/4")
  );
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "metadata.google.internal" ||
    host.endsWith(".internal")
  );
}

export async function assertUrlAllowed(
  rawUrl: string,
  allowPrivate: boolean,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError(`Invalid URL: ${rawUrl}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError("Only http and https URLs are allowed.");
  }
  if (url.username || url.password) {
    throw new SsrfError("URLs with credentials are not allowed.");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  if (!allowPrivate && isBlockedHostname(hostname)) {
    throw new SsrfError(
      "Private or local hosts are blocked. Re-run with --allow-private.",
    );
  }

  if (isIP(hostname)) {
    if (!allowPrivate && isPrivateOrMetadataIp(hostname)) {
      throw new SsrfError(
        "Private or metadata IP addresses are blocked. Re-run with --allow-private.",
      );
    }
    return url;
  }

  try {
    const addresses = await lookup(hostname, { all: true });
    for (const address of addresses) {
      if (!allowPrivate && isPrivateOrMetadataIp(address.address)) {
        throw new SsrfError(
          `Host ${hostname} resolved to a private or metadata address. Re-run with --allow-private.`,
        );
      }
    }
  } catch (error) {
    if (error instanceof SsrfError) throw error;
    throw new SsrfError(`Could not resolve host: ${hostname}`);
  }

  return url;
}
