import type { APIRoute } from "astro";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { getPlan } from "../../../lib/plan";
import { hashIp } from "../../../lib/ip-hash";
import { isRateLimited, recordSecurityEvent } from "../../../lib/auth/rate-limit";
import {
  MAX_LOGO_BYTES,
  buildLogoObjectKey,
  buildLogoServingPath,
  detectImageType,
} from "../../../lib/agency-logo";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

// Not runtime-configurable — a deliberately fixed, generous-enough limit for
// a feature that produces at most one small image per agency-branded share.
const RATE_LIMIT_SCOPE = "agency_logo_upload";
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/**
 * POST /api/agency-branding/logo — uploads an agency-branding logo image to
 * R2 (SRS §29; see docs/data/D1_R2_DATA_PLACEMENT_POLICY.md's 2026-07-30
 * entry). Real image content is sniffed from the file's own bytes
 * (`detectImageType`), never trusted from the client's `Content-Type`
 * header or filename — SVG is rejected outright (inline-script XSS risk).
 * The returned path is later validated again by `share.ts` when it's
 * actually attached to a share, so an upload alone grants no visibility.
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const plan = await getPlan(db, user.planId);
    if (!plan.agencyBrandingEnabled) {
      throw new ApiError(
        "FORBIDDEN",
        "Your plan does not include agency branding on shared reports.",
      );
    }

    const ipHash = await hashIp(request);
    if (ipHash) {
      const limited = await isRateLimited(db, "rate_limit", ipHash, {
        max: RATE_LIMIT_MAX,
        windowMs: RATE_LIMIT_WINDOW_MS,
        scope: RATE_LIMIT_SCOPE,
      });
      if (limited) {
        throw new ApiError("RATE_LIMITED", "Too many logo uploads — try again later.");
      }
    }

    // Reject an oversized request before ever buffering/parsing its body —
    // multipart framing adds some overhead over the raw file, so allow a
    // generous margin rather than exactly MAX_LOGO_BYTES. A request with no
    // Content-Length (chunked) still hits the real size check below once
    // parsed; this is a cheap early rejection for the common case, not the
    // only enforcement.
    const contentLength = Number(request.headers.get("Content-Length") ?? "0");
    if (contentLength > MAX_LOGO_BYTES + 65_536) {
      throw new ApiError("VALIDATION_FAILED", "Logo file is too large.");
    }

    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");
    if (!(file instanceof File)) {
      throw new ApiError("VALIDATION_FAILED", "Missing file.");
    }
    if (file.size === 0 || file.size > MAX_LOGO_BYTES) {
      throw new ApiError(
        "VALIDATION_FAILED",
        `Logo must be between 1 byte and ${MAX_LOGO_BYTES} bytes.`,
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detectImageType(bytes);
    if (!detected) {
      throw new ApiError("VALIDATION_FAILED", "Logo must be a real PNG, JPEG, GIF, or WebP image.");
    }

    if (ipHash) {
      await recordSecurityEvent(db, "rate_limit", {
        ipHash,
        userId: user.id,
        target: RATE_LIMIT_SCOPE,
      });
    }

    const objectKey = buildLogoObjectKey(user.id, detected.ext);
    await getEnv().AGENCY_LOGOS.put(objectKey, bytes, {
      httpMetadata: { contentType: detected.contentType },
    });

    return jsonResponse(ok({ logoUrl: buildLogoServingPath(objectKey) }, requestId), 201);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
