/**
 * Minimal in-memory stand-in for R2Bucket. Unlike D1 (which has a real
 * local harness, d1-harness.ts), there is no lightweight way to run a real
 * R2 instance inside Vitest — this is a disclosed, accepted gap (see
 * docs/data/D1_R2_DATA_PLACEMENT_POLICY.md's 2026-07-30 entry). Implements
 * only the methods any route in this codebase currently calls (`put`, `get`,
 * `delete`); extend it if a future route needs more of the interface.
 */
export function createFakeR2Bucket(): R2Bucket {
  const store = new Map<string, { body: Uint8Array; contentType?: string }>();

  return {
    async put(key: string, value: unknown, options?: R2PutOptions) {
      const bytes =
        value instanceof ArrayBuffer
          ? new Uint8Array(value)
          : ArrayBuffer.isView(value)
            ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
            : new TextEncoder().encode(String(value));
      const httpMetadata = options?.httpMetadata as R2HTTPMetadata | undefined;
      store.set(key, { body: bytes, contentType: httpMetadata?.contentType });
      return null as unknown as R2Object;
    },
    async get(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      return {
        body: entry.body,
        httpMetadata: { contentType: entry.contentType },
      } as unknown as R2ObjectBody;
    },
    async delete(keys: string | string[]) {
      for (const key of Array.isArray(keys) ? keys : [keys]) store.delete(key);
    },
  } as unknown as R2Bucket;
}
