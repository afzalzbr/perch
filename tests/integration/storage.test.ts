import { afterEach, describe, it, expect } from "vitest";
import { getStorage, resetStorageForTests } from "@/lib/storage";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

afterEach(async () => {
  resetStorageForTests();
  try {
    await rm("./uploads-test-local", { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe("local storage adapter", () => {
  it("writes, serves a signed URL that round-trips, and deletes", async () => {
    process.env.STORAGE_DRIVER = "local";
    process.env.UPLOADS_DIR = "./uploads-test-local";
    resetStorageForTests();
    const storage = getStorage();
    const key = "avatars/x/test.png";
    const body = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await storage.put(key, body, { contentType: "image/png" });

    const url = await storage.getSignedUrl(key, 60);
    expect(url).toContain("/uploads/");
    expect(url).toContain("exp=");
    expect(url).toContain("sig=");

    const onDisk = await readFile(resolve("./uploads-test-local", key));
    expect(onDisk.equals(body)).toBe(true);

    await storage.delete(key);
    await expect(readFile(resolve("./uploads-test-local", key))).rejects.toThrow();
  });

  it("rejects traversal", async () => {
    process.env.STORAGE_DRIVER = "local";
    process.env.UPLOADS_DIR = "./uploads-test-local";
    resetStorageForTests();
    const storage = getStorage();
    await expect(storage.put("../etc/passwd", Buffer.from("x"), { contentType: "text/plain" })).rejects.toThrow();
  });
});
