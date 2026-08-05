/**
 * Minimal in-memory stand-in for R2Bucket. Unlike D1 (which has a real
 * local harness, d1-harness.ts), there is no lightweight way to run a real
 * R2 instance inside Vitest — this is a disclosed, accepted gap (see
 * docs/data/D1_R2_DATA_PLACEMENT_POLICY.md's 2026-07-30 entry). Implements
 * only the methods any route in this codebase currently calls (`put`, `get`,
 * `delete`, `list`); extend it if a future route needs more of the interface.
 */
export function createFakeR2Bucket(): R2Bucket {
  const store = new Map<string, { body: Uint8Array; contentType?: string; uploaded: Date }>();

  return {
    async put(key: string, value: unknown, options?: R2PutOptions) {
      const bytes =
        value instanceof ArrayBuffer
          ? new Uint8Array(value)
          : ArrayBuffer.isView(value)
            ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
            : new TextEncoder().encode(String(value));
      const httpMetadata = options?.httpMetadata as R2HTTPMetadata | undefined;
      store.set(key, { body: bytes, contentType: httpMetadata?.contentType, uploaded: new Date() });
      return null as unknown as R2Object;
    },
    async get(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      return {
        key,
        uploaded: entry.uploaded,
        body: entry.body,
        httpMetadata: { contentType: entry.contentType },
      } as unknown as R2ObjectBody;
    },
    async delete(keys: string | string[]) {
      for (const key of Array.isArray(keys) ? keys : [keys]) store.delete(key);
    },
    async list(options?: R2ListOptions) {
      const limit = options?.limit ?? 1000;
      const prefix = options?.prefix ?? "";
      const allKeys = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
      const startIndex = options?.cursor ? Number(options.cursor) : 0;
      const page = allKeys.slice(startIndex, startIndex + limit);
      const objects = page.map(
        (key) =>
          ({
            key,
            uploaded: store.get(key)!.uploaded,
            size: store.get(key)!.body.byteLength,
          }) as R2Object,
      );
      const truncated = startIndex + limit < allKeys.length;
      return truncated
        ? { objects, truncated: true, cursor: String(startIndex + limit), delimitedPrefixes: [] }
        : { objects, truncated: false, delimitedPrefixes: [] };
    },
    /** Test-only helper (not part of R2Bucket) — lets a test backdate an
     * object's `uploaded` timestamp to simulate an orphan old enough to
     * clear a grace period, without waiting in real time. */
    __setUploadedAt(key: string, uploaded: Date) {
      const entry = store.get(key);
      if (entry) entry.uploaded = uploaded;
    },
  } as unknown as R2Bucket & { __setUploadedAt: (key: string, uploaded: Date) => void };
}
