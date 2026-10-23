import { describe, it, expect } from "vitest";
import { classifyReferrer } from "@/lib/referrer";

describe("classifyReferrer", () => {
  it("direct when referrer is empty", () => {
    expect(classifyReferrer(null)).toBe("direct");
    expect(classifyReferrer(undefined)).toBe("direct");
    expect(classifyReferrer("")).toBe("direct");
  });

  it("search for known search engines", () => {
    expect(classifyReferrer("https://www.google.com/search?q=perch")).toBe("search");
    expect(classifyReferrer("https://duckduckgo.com/")).toBe("search");
    expect(classifyReferrer("https://google.co.uk/")).toBe("search");
  });

  it("social for known social hosts", () => {
    expect(classifyReferrer("https://instagram.com/alex")).toBe("social");
    expect(classifyReferrer("https://m.youtube.com/alex")).toBe("social");
    expect(classifyReferrer("https://t.co/abc")).toBe("social");
    expect(classifyReferrer("https://threads.net/alex")).toBe("social");
  });

  it("direct when referrer is the public origin itself", () => {
    expect(classifyReferrer("https://perch.app/alex", "https://perch.app")).toBe("direct");
  });

  it("other for unknown referrers", () => {
    expect(classifyReferrer("https://example.com/x")).toBe("other");
  });

  it("other for malformed referrers", () => {
    expect(classifyReferrer("not a url")).toBe("other");
  });
});
