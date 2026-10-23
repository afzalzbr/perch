import { describe, it, expect } from "vitest";
import { validateSlug, RESERVED_SLUGS } from "@/lib/slug";

describe("validateSlug", () => {
  it("accepts a plain slug", () => {
    expect(validateSlug("alex")).toBe("alex");
    expect(validateSlug("alex-perch")).toBe("alex-perch");
    expect(validateSlug("Alex-123")).toBe("alex-123");
  });

  it("lowercases", () => {
    expect(validateSlug("ALEX")).toBe("alex");
  });

  it("rejects short slugs", () => {
    expect(() => validateSlug("ab")).toThrow();
    expect(() => validateSlug("")).toThrow();
  });

  it("rejects slugs that start or end with a hyphen", () => {
    expect(() => validateSlug("-alex")).toThrow();
    expect(() => validateSlug("alex-")).toThrow();
  });

  it("rejects double hyphens", () => {
    expect(() => validateSlug("alex--perch")).toThrow();
  });

  it("rejects reserved slugs", () => {
    for (const r of RESERVED_SLUGS) {
      expect(() => validateSlug(r)).toThrow();
    }
  });

  it("rejects characters outside [a-z0-9-]", () => {
    expect(() => validateSlug("alex!")).toThrow();
    expect(() => validateSlug("alex perch")).toThrow();
    expect(() => validateSlug("álex")).toThrow();
  });
});
