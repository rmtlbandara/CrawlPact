import { AGENCY_LOGO_PATH_PATTERN } from "@crawlpact/core";

/**
 * A logo image is small by nature — this cap is deliberately tight (not
 * runtime-configurable) to bound R2 storage growth for a feature with one
 * object per agency-branded share. See
 * docs/data/D1_R2_DATA_PLACEMENT_POLICY.md's 2026-07-30 entry.
 */
export const MAX_LOGO_BYTES = 1_048_576; // 1 MiB

type DetectedImage = { ext: "png" | "jpg" | "gif" | "webp"; contentType: string };

/**
 * Real content sniffing (magic bytes), never trusting a client-supplied
 * `Content-Type` header or filename extension — both are trivially
 * spoofable. SVG is deliberately not supported: it can carry inline
 * `<script>`/event-handler payloads, the same class of risk this
 * codebase's SSRF chokepoint discipline exists to prevent elsewhere.
 */
export function detectImageType(bytes: Uint8Array): DetectedImage | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { ext: "png", contentType: "image/png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return { ext: "gif", contentType: "image/gif" };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { ext: "webp", contentType: "image/webp" };
  }
  return null;
}

/** The uploader never supplies the key — always server-generated from the
 * caller's own authenticated user id and a fresh random id. */
export function buildLogoObjectKey(userId: string, ext: string): string {
  return `${userId}/${crypto.randomUUID()}.${ext}`;
}

const LOGO_SERVING_PREFIX = "/api/agency-branding/logo/";

export function buildLogoServingPath(objectKey: string): string {
  return `${LOGO_SERVING_PREFIX}${objectKey}`;
}

/** Confirms a `logoUrl` path (already schema-validated to match
 * `AGENCY_LOGO_PATH_PATTERN`) was uploaded by this exact caller, not
 * referenced from another user's upload. */
export function logoPathBelongsToUser(logoUrl: string, userId: string): boolean {
  const match = AGENCY_LOGO_PATH_PATTERN.exec(logoUrl);
  return match?.[1] === userId;
}

/** Inverse of `buildLogoServingPath` — the R2 object key behind a stored
 * `logoUrl`, or `null` if it doesn't match the upload route's own shape.
 * Used to delete the R2 object when the share referencing it is revoked. */
export function objectKeyFromLogoUrl(logoUrl: string): string | null {
  if (!AGENCY_LOGO_PATH_PATTERN.test(logoUrl)) return null;
  return logoUrl.slice(LOGO_SERVING_PREFIX.length);
}
