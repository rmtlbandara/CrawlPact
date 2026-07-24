import { ApiError, fail } from "@crawlpact/core";

export function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonResponseWithCookie(
  payload: unknown,
  status: number,
  setCookie: string,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Set-Cookie": setCookie },
  });
}

/** Maps a thrown ApiError to the standard failure envelope; anything else is an internal error. */
export function jsonErrorResponse(error: unknown, requestId: string): Response {
  if (error instanceof ApiError) {
    return jsonResponse(fail(error, requestId), error.httpStatus);
  }
  return jsonResponse(
    fail(
      new ApiError("INTERNAL_ERROR", "Something went wrong.", {
        message: error instanceof Error ? error.message : String(error),
      }),
      requestId,
    ),
    500,
  );
}
