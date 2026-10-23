import { describe, it, expect } from "vitest";
import { normalizeLinkUrl, normalizeSocialUrl, hostnameOf } from "@/lib/normalize-url";

describe("normalizeLinkUrl", () => {
  it("accepts https URLs", () => {
    const url = normalizeLinkUrl("HTTPS://example.com/path?q=1");
    expect(url.href).toBe("https://example.com/path?q=1");
    expect(url.hostname).toBe("example.com");
  });

  it("prefixes bare domains with https://", () => {
    expect(normalizeLinkUrl("example.com/x").href).toBe("https://example.com/x");
  });

  it("rejects javascript: URLs", () => {
    expect(() => normalizeLinkUrl("javascript:alert(1)")).toThrow();
  });

  it("rejects data: URLs", () => {
    expect(() => normalizeLinkUrl("data:text/html,<script>")).toThrow();
  });

  it("rejects file: URLs", () => {
    expect(() => normalizeLinkUrl("file:///etc/passwd")).toThrow();
  });

  it("rejects IPs and localhost", () => {
    expect(() => normalizeLinkUrl("http://127.0.0.1")).toThrow();
    expect(() => normalizeLinkUrl("http://localhost")).toThrow();
  });

  it("validates mailto: addresses", () => {
    const url = normalizeLinkUrl("mailto:alex@example.com");
    expect(url.href).toBe("mailto:alex@example.com");
    expect(() => normalizeLinkUrl("mailto:no-at-sign")).toThrow();
  });

  it("strips default ports", () => {
    expect(normalizeLinkUrl("https://example.com:443/x").href).toBe("https://example.com/x");
    expect(normalizeLinkUrl("http://example.com:80/x").href).toBe("http://example.com/x");
  });

  it("rejects empty input", () => {
    expect(() => normalizeLinkUrl("")).toThrow();
    expect(() => normalizeLinkUrl("   ")).toThrow();
  });
});

describe("normalizeSocialUrl", () => {
  it("accepts matching hostnames", () => {
    expect(normalizeSocialUrl("instagram", "https://instagram.com/alex").hostname).toBe("instagram.com");
    expect(normalizeSocialUrl("x", "https://twitter.com/alex").hostname).toBe("twitter.com");
  });
  it("rejects mismatched hostnames", () => {
    expect(() => normalizeSocialUrl("instagram", "https://example.com/alex")).toThrow();
  });
  it("rejects http (must be https)", () => {
    expect(() => normalizeSocialUrl("github", "http://github.com/alex")).toThrow();
  });
  it("website kind takes any https URL", () => {
    expect(normalizeSocialUrl("website", "https://alex.me").hostname).toBe("alex.me");
  });
});

describe("hostnameOf", () => {
  it("returns the host for http(s)", () => {
    expect(hostnameOf("https://example.com/x")).toBe("example.com");
  });
  it("returns null for mailto", () => {
    expect(hostnameOf("mailto:a@b.co")).toBeNull();
  });
  it("returns null for garbage", () => {
    expect(hostnameOf("not a url")).toBeNull();
  });
});
