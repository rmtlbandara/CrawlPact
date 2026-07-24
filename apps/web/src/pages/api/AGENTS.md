# AGENTS.md — apps/web/src/pages/api

Same-origin API routes (ADR-0001). Rules specific to this directory:

## Every endpoint must

1. Set `export const prerender = false;` (these are dynamic, never statically generated).
2. Validate its request body/query with a zod schema from `@crawlpact/core`'s
   `api/contracts/*` — never hand-roll validation.
3. Return the standard envelope (`ok()`/`fail()` from `@crawlpact/core`), never a bespoke shape.
4. Generate a fresh `requestId` (`crypto.randomUUID()`) per request and include it in every
   response, success or failure.
5. Never fabricate a successful result for a feature that isn't implemented — return a real
   error code (see `docs/api/ERROR_CATALOGUE.md`) such as `AUDIT_ENGINE_DISABLED`, not a fake
   `ok: true` payload.

## Auth/billing/admin endpoints

`apps/web/src/pages/api/auth/`, `apps/web/src/pages/api/billing/`, and
`apps/web/src/pages/api/admin/` each have their own nested `AGENTS.md` — read the relevant one
before touching those routes. Add the same treatment to any future subdirectory with its own
non-obvious rules, rather than overloading this file with rules specific to one area.

## Data access

Any endpoint touching D1 uses `createDb(getEnv().DB)` (`getEnv` from `../../lib/env`, `createDb`
from `@crawlpact/database`) — never construct a Drizzle client ad hoc, and never write raw SQL
string interpolation with request-derived values (use parameterised queries via Drizzle or
`.bind()`). Astro v6 removed `Astro.locals.runtime.env`; see `apps/web/src/lib/env.ts`.
