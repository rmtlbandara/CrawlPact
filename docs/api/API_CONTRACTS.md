# API Contracts

All typed contracts live in `packages/core/src/api/contracts/*.ts` (zod schemas, exported
TypeScript types). This document explains the conventions; the code is the source of truth for
exact shapes.

## Standard response envelope

Every endpoint returns one of:

```ts
{ ok: true, data: T, requestId: string }
{ ok: false, error: { code: ErrorCode, message: string, requestId: string, details?: object } }
```

`requestId` is a fresh UUID per request, always present, and safe to show to the caller for
support purposes (see `docs/api/ERROR_CATALOGUE.md` for the `code` vocabulary).

## Pagination

Cursor-based, not offset-based, so results stay stable under concurrent writes on large,
frequently-mutated tables (scans, findings, security events):

```ts
type PageRequest = { cursor?: string; limit?: number }; // limit defaults to 25, max 100
type PageResponse<T> = { items: T[]; nextCursor: string | null };
```

## Authentication and rate-limit errors

Modelled as ordinary envelope errors with dedicated codes (`UNAUTHENTICATED`, `FORBIDDEN`,
`RATE_LIMITED`) rather than a special-cased response shape — one envelope shape for every
endpoint keeps client-side handling uniform.

## Contracts defined vs. implemented in Part 1

| Contract                                 | Schema defined | Endpoint implemented                                     |
| ---------------------------------------- | -------------- | -------------------------------------------------------- |
| Audit creation/state/report (`audit.ts`) | Yes            | `POST /api/audit` only (returns `AUDIT_ENGINE_DISABLED`) |
| Authentication (`auth.ts`)               | Yes            | No                                                       |
| Domains (`domains.ts`)                   | Yes            | No                                                       |
| Groups (`groups.ts`)                     | Yes            | No                                                       |
| Notifications (`notifications.ts`)       | Yes            | No                                                       |
| Billing (`billing.ts`)                   | Yes            | No                                                       |
| Report sharing (`sharing.ts`)            | Yes            | No                                                       |
| Admin (`admin.ts`)                       | Yes            | No                                                       |

Per Step 12's instruction not to implement full business logic ahead of schedule, only the
audit-creation endpoint is wired to a route in Part 1; the rest exist as compile-time contracts
so later parts build against an agreed shape instead of inventing one ad hoc.
