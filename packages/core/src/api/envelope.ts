import type { ErrorCode } from "./errors";
import { ApiError } from "./errors";

/**
 * Standard response envelope used by every CrawlPact API endpoint (SRS
 * §Step 12: "Standard response envelope"). Success and error responses are
 * always discriminated on `ok` so clients can narrow the type without
 * inspecting HTTP status codes.
 */
export type ApiSuccess<T> = {
  ok: true;
  data: T;
  requestId: string;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
    details?: Record<string, unknown>;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function ok<T>(data: T, requestId: string): ApiSuccess<T> {
  return { ok: true, data, requestId };
}

export function fail(error: ApiError, requestId: string): ApiFailure {
  return {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      requestId,
      // Only set `details` when present — with `exactOptionalPropertyTypes`,
      // explicitly assigning `undefined` is a different (and disallowed)
      // thing from omitting the property entirely.
      ...(error.details !== undefined ? { details: error.details } : {}),
    },
  };
}

/**
 * Standard pagination request/response shape (SRS §Step 12: "Pagination
 * format"). Cursor-based rather than offset-based so large, frequently
 * mutated tables (scans, findings, security events) paginate consistently.
 */
export type PageRequest = {
  cursor?: string;
  limit?: number;
};

export type PageResponse<T> = {
  items: T[];
  nextCursor: string | null;
};

export const DEFAULT_PAGE_LIMIT = 25;
export const MAX_PAGE_LIMIT = 100;
