# Error Catalogue

Canonical, stable error codes returned by CrawlPact's API in the standard error envelope
(see `docs/api/API_CONTRACTS.md`). Codes are implemented in
`packages/core/src/api/errors.ts` — this document and that module must stay in sync; the
module is the source of truth for the exact string values.

Every error response has the shape:

```json
{
  "ok": false,
  "error": {
    "code": "AUDIT_TARGET_UNSAFE",
    "message": "This target could not be safely audited.",
    "requestId": "01J...",
    "details": {}
  }
}
```

## General

| Code                  | HTTP status | Meaning                                                                          |
| --------------------- | ----------: | -------------------------------------------------------------------------------- |
| `VALIDATION_FAILED`   |         400 | Request body/query failed schema validation. `details` lists field-level issues. |
| `NOT_FOUND`           |         404 | The requested resource does not exist or is not visible to the caller.           |
| `UNAUTHENTICATED`     |         401 | No valid session was presented.                                                  |
| `FORBIDDEN`           |         403 | A valid session was presented but lacks permission for this resource.            |
| `RATE_LIMITED`        |         429 | The caller has exceeded a rate or quota limit. See `details.retryAfterSeconds`.  |
| `INTERNAL_ERROR`      |         500 | An unexpected server-side failure. Never exposes internal details to the client. |
| `SERVICE_UNAVAILABLE` |         503 | A dependency (e.g. D1) is unavailable, or maintenance mode is active.            |

## Audit

| Code                    | HTTP status | Meaning                                                                                                                       |
| ----------------------- | ----------: | ----------------------------------------------------------------------------------------------------------------------------- |
| `AUDIT_TARGET_INVALID`  |         400 | The submitted domain/URL failed normalisation or uses an unsupported scheme.                                                  |
| `AUDIT_TARGET_UNSAFE`   |         400 | The target resolves to a private, loopback, link-local, reserved, or metadata address, or is a literal IP.                    |
| `AUDIT_ENGINE_DISABLED` |         503 | The scanner is not enabled in this environment. Returned instead of any fabricated result — see `docs/status/KNOWN_RISKS.md`. |
| `AUDIT_NOT_FOUND`       |         404 | The referenced audit/scan ID does not exist or is not visible to the caller.                                                  |
| `AUDIT_QUOTA_EXCEEDED`  |         429 | The account has exhausted its plan's manual rescan quota for this domain.                                                     |
| `SCAN_ALREADY_RUNNING`  |         409 | A scan is already in progress for this domain (Phase 8 duplicate-scan lock, `domains.scan_lock_until`).                       |

## Authentication

| Code                         | HTTP status | Meaning                                                                        |
| ---------------------------- | ----------: | ------------------------------------------------------------------------------ |
| `AUTH_CHALLENGE_EXPIRED`     |         400 | The WebAuthn registration/assertion challenge expired before completion.       |
| `AUTH_CREDENTIAL_INVALID`    |         400 | The passkey assertion/attestation failed verification.                         |
| `AUTH_RECOVERY_CODE_INVALID` |         400 | The recovery code is unknown, already used, or malformed.                      |
| `AUTH_SESSION_EXPIRED`       |         401 | The session existed but has expired or been revoked.                           |
| `AUTH_STEP_UP_REQUIRED`      |         401 | The action requires a recent WebAuthn re-assertion (sensitive-action step-up). |

## Domains and groups

| Code                   | HTTP status | Meaning                                                          |
| ---------------------- | ----------: | ---------------------------------------------------------------- |
| `DOMAIN_LIMIT_REACHED` |         403 | Adding this domain would exceed the plan's saved-domain limit.   |
| `DOMAIN_DUPLICATE`     |         409 | The canonical origin is already saved on this account.           |
| `GROUP_NOT_EMPTY`      |         409 | The group cannot be deleted while domains remain assigned to it. |

## Billing

| Code                                | HTTP status | Meaning                                                                                           |
| ----------------------------------- | ----------: | ------------------------------------------------------------------------------------------------- |
| `BILLING_WEBHOOK_SIGNATURE_INVALID` |         400 | The Paddle webhook signature did not verify.                                                      |
| `BILLING_WEBHOOK_REPLAYED`          |         200 | A previously processed webhook event ID was received again; acknowledged as a no-op (idempotent). |
| `BILLING_SYNC_ERROR`                |         409 | Local entitlement state could not be reconciled with Paddle's reported state.                     |

## Report sharing

| Code                  | HTTP status | Meaning                                                  |
| --------------------- | ----------: | -------------------------------------------------------- |
| `SHARE_TOKEN_INVALID` |         404 | The shared-report token is unknown, expired, or revoked. |

## Admin

| Code                     | HTTP status | Meaning                                                                               |
| ------------------------ | ----------: | ------------------------------------------------------------------------------------- |
| `ADMIN_REASON_REQUIRED`  |         400 | A sensitive admin action was attempted without a recorded reason.                     |
| `ADMIN_ACTION_FORBIDDEN` |         403 | The caller is authenticated but not assigned the admin role required for this action. |
