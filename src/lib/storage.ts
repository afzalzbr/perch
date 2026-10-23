import { createHmac, randomUUID } from "node:crypto";
import {
  mkdir,
  writeFile,
  readFile,
  unlink,
  stat,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";

export type PutOptions = { contentType: string };
export type StorageAdapter = {
  put(key: string, body: Buffer, opts: PutOptions): Promise<void>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, ttlSeconds?: number): Promise<string>;
};

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function sanitizeKey(key: string): string {
  if (key.includes("..") || key.startsWith("/") || key.includes("\\")) {
    throw new Error("Invalid storage key");
  }
  return key;
}

/** Local filesystem adapter — used for dev and tests. */
class LocalStorage implements StorageAdapter {
  constructor(private readonly root: string, private readonly signingKey: string) {}

  private pathFor(key: string): string {
    return resolve(this.root, sanitizeKey(key));
  }

  async put(key: string, body: Buffer, _opts: PutOptions): Promise<void> {
    const full = this.pathFor(key);
    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, body);
  }

  async delete(key: string): Promise<void> {
    const full = this.pathFor(key);
    try {
      await unlink(full);
    } catch (err: unknown) {
      const code = (err as { code?: string } | undefined)?.code;
      if (code !== "ENOENT") throw err;
    }
  }

  async getSignedUrl(key: string, ttlSeconds = 300): Promise<string> {
    sanitizeKey(key);
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = createHmac("sha256", this.signingKey)
      .update(`${key}:${exp}`)
      .digest("hex")
      .slice(0, 32);
    return `/uploads/${key}?exp=${exp}&sig=${sig}`;
  }

  verifySignedUrl(key: string, exp: number, sig: string): boolean {
    if (Date.now() / 1000 > exp) return false;
    const expected = createHmac("sha256", this.signingKey)
      .update(`${key}:${exp}`)
      .digest("hex")
      .slice(0, 32);
    return timingSafeEqualHex(sig, expected);
  }

  async readRaw(key: string): Promise<Buffer | null> {
    const full = this.pathFor(key);
    if (!existsSync(full)) return null;
    const info = await stat(full);
    if (!info.isFile()) return null;
    return readFile(full);
  }
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

/* ---- S3 adapter (lazy-loaded so the local dev path has no AWS SDK cost) ---- */

class S3Storage implements StorageAdapter {
  private clientPromise: Promise<unknown> | null = null;
  constructor(
    private readonly bucket: string,
    private readonly region: string,
    private readonly accessKeyId: string,
    private readonly secretAccessKey: string,
    private readonly endpoint: string | undefined
  ) {}

  private async client(): Promise<{
    S3Client: new (cfg: unknown) => unknown;
    PutObjectCommand: new (cfg: unknown) => unknown;
    DeleteObjectCommand: new (cfg: unknown) => unknown;
    GetObjectCommand: new (cfg: unknown) => unknown;
    getSignedUrl: (c: unknown, cmd: unknown, opts: unknown) => Promise<string>;
    instance: unknown;
  }> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const [s3, presign] = await Promise.all([
          import("@aws-sdk/client-s3"),
          import("@aws-sdk/s3-request-presigner"),
        ]);
        const instance = new s3.S3Client({
          region: this.region,
          endpoint: this.endpoint,
          credentials: {
            accessKeyId: this.accessKeyId,
            secretAccessKey: this.secretAccessKey,
          },
          forcePathStyle: !!this.endpoint,
        });
        return {
          S3Client: s3.S3Client as unknown as new (c: unknown) => unknown,
          PutObjectCommand: s3.PutObjectCommand as unknown as new (c: unknown) => unknown,
          DeleteObjectCommand: s3.DeleteObjectCommand as unknown as new (c: unknown) => unknown,
          GetObjectCommand: s3.GetObjectCommand as unknown as new (c: unknown) => unknown,
          getSignedUrl: presign.getSignedUrl as unknown as (c: unknown, cmd: unknown, opts: unknown) => Promise<string>,
          instance,
        };
      })();
    }
    return this.clientPromise as Promise<ReturnType<S3Storage["client"]> extends Promise<infer T> ? T : never>;
  }

  async put(key: string, body: Buffer, opts: PutOptions): Promise<void> {
    const c = await this.client();
    const cmd = new c.PutObjectCommand({
      Bucket: this.bucket,
      Key: sanitizeKey(key),
      Body: body,
      ContentType: opts.contentType,
    });
    // @ts-expect-error — AWS SDK typing varies by version; runtime is correct.
    await c.instance.send(cmd);
  }

  async delete(key: string): Promise<void> {
    const c = await this.client();
    const cmd = new c.DeleteObjectCommand({ Bucket: this.bucket, Key: sanitizeKey(key) });
    // @ts-expect-error — see above
    await c.instance.send(cmd);
  }

  async getSignedUrl(key: string, ttlSeconds = 300): Promise<string> {
    const c = await this.client();
    const cmd = new c.GetObjectCommand({ Bucket: this.bucket, Key: sanitizeKey(key) });
    return c.getSignedUrl(c.instance, cmd, { expiresIn: ttlSeconds });
  }
}

/* ---- Factory ---- */

let _singleton: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (_singleton) return _singleton;
  const driver = (process.env.STORAGE_DRIVER ?? "local").toLowerCase();
  if (driver === "s3") {
    const bucket = required("S3_BUCKET");
    _singleton = new S3Storage(
      bucket,
      process.env.S3_REGION ?? "auto",
      required("S3_ACCESS_KEY_ID"),
      required("S3_SECRET_ACCESS_KEY"),
      process.env.S3_ENDPOINT || undefined
    );
  } else {
    const dir = resolve(process.env.UPLOADS_DIR ?? "./uploads");
    const secret = process.env.SESSION_SECRET ?? "perch-dev-signing-secret-not-for-prod";
    _singleton = new LocalStorage(dir, secret);
  }
  return _singleton;
}

export function resetStorageForTests(): void {
  _singleton = null;
}

/* ---- Avatar helpers ---- */

const AVATAR_EXT_FOR_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function allowedAvatarType(ct: string): boolean {
  return ct in AVATAR_EXT_FOR_TYPE;
}

export function buildAvatarKey(profileId: string, contentType: string): string {
  const ext = AVATAR_EXT_FOR_TYPE[contentType];
  if (!ext) throw new Error("Unsupported avatar type.");
  return `avatars/${profileId}/${randomUUID()}.${ext}`;
}

export const AVATAR_MAX_BYTES = MAX_AVATAR_BYTES;

export function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is not set`);
  return v;
}

/* ---- Serving: used by /uploads/[...path]/route.ts ---- */

export async function serveLocalFile(
  key: string,
  exp: string | null,
  sig: string | null
): Promise<{ body: Buffer; contentType: string } | null> {
  const storage = getStorage();
  if (!(storage instanceof LocalStorage)) return null;
  if (!exp || !sig) return null;
  const expN = Number(exp);
  if (!Number.isFinite(expN)) return null;
  if (!(storage as LocalStorage).verifySignedUrl(key, expN, sig)) return null;
  const body = await (storage as LocalStorage).readRaw(key);
  if (!body) return null;
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const ct =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";
  return { body, contentType: ct };
}
