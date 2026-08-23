import { describe, expect, it } from "vitest";
import {
  assertUrlAllowed,
  isPrivateOrMetadataIp,
  SsrfError,
} from "../src/engine/ssrf.ts";

describe("SSRF guards", () => {
  it("classifies loopback, RFC1918, and metadata IPs as private", () => {
    expect(isPrivateOrMetadataIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrMetadataIp("10.0.0.8")).toBe(true);
    expect(isPrivateOrMetadataIp("172.16.4.1")).toBe(true);
    expect(isPrivateOrMetadataIp("192.168.1.9")).toBe(true);
    expect(isPrivateOrMetadataIp("169.254.169.254")).toBe(true);
    expect(isPrivateOrMetadataIp("8.8.8.8")).toBe(false);
    expect(isPrivateOrMetadataIp("::1")).toBe(true);
  });

  it("rejects file and credentialed URLs", async () => {
    await expect(assertUrlAllowed("file:///etc/passwd", true)).rejects.toBeInstanceOf(SsrfError);
    await expect(assertUrlAllowed("https://user:pass@example.com", true)).rejects.toBeInstanceOf(SsrfError);
  });

  it("blocks localhost unless allowPrivate is set", async () => {
    await expect(assertUrlAllowed("http://localhost:3000", false)).rejects.toBeInstanceOf(SsrfError);
    await expect(assertUrlAllowed("http://127.0.0.1:3000", false)).rejects.toBeInstanceOf(SsrfError);
    const allowed = await assertUrlAllowed("http://127.0.0.1:3000", true);
    expect(allowed.hostname).toBe("127.0.0.1");
  });
});
