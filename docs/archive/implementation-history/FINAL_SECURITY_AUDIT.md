# Final Security Audit

> **Historical document.** This file records an earlier CrawlPact implementation state and is
> not authoritative for the current product. See `docs/security/SECURITY_CHECKLIST.md` for
> current status.
>
> - **Original date**: 2026-07-24 (Part 3 Step 24)
> - **Archive date**: 2026-08-03 (Phase 1)
> - **Superseded by**: `docs/security/SECURITY_CHECKLIST.md`
> - **Reason archived**: despite its "Final" name, this report predates six days of subsequent
>   real work (Google Analytics added, R2 adopted, incident-tracking system shipped) — see
>   `docs/baseline/2026-08-03/DOCUMENTATION_CONFLICTS.md` DC-006. Preserved in full below as an
>   accurate historical record of the 2026-07-24 audit; not edited for currentness.

Part 3 Step 24 deliverable, run via the repository's own `/security-review` checklist
(`.claude/skills/security-review/SKILL.md`) — a focused review of the four areas SRS §33 treats
as launch-blocking, checked directly against current code, not restated from prior notes.

## 1. Scanner / SSRF (`packages/scanner`) — PASS, no findings

- Grepped every `fetch()` call outside `packages/scanner` across `apps/web/src`, all `packages/*`.
  Every one is either same-origin (`/api/*`, browser code calling this app's own routes) or
  `lib/billing/paddle-api.ts` calling Paddle's fixed API host with a server-derived
  `paddleCustomerId` — never a customer-supplied target. The scanner isolation boundary
  (ADR-0005) holds.
- `ip-classification.test.ts` (26 cases) exhaustively covers every category the checklist names:
  public, loopback, all three RFC1918 private ranges, 172.15/172.32 boundary correctness,
  100.64/10 shared space, cloud-metadata (`169.254.169.254`), link-local, multicast (v4 and v6),
  reserved, invalid, IPv6 equivalents, and the IPv4-mapped-IPv6 smuggling case
  (`::ffff:127.0.0.1` → loopback, `::ffff:10.0.0.1` → private).
- `safe-fetch.ts` calls `validateTarget` on every redirect hop, not just the initial target
  (confirmed reading the loop directly); `safe-fetch.test.ts` has dedicated tests for both
  "follows a redirect chain and revalidates the destination" and "rejects a redirect to an
  unsafe address."

## 2. Authentication — PASS, no findings

- No JWT or other stateless-authority token exists anywhere in the codebase; sessions are
  DB-backed (`sessions` table) and individually revocable (`revokeSession`, `revokedAt` flag),
  confirmed in `lib/auth/session.ts`.
- Recovery codes are stored only as a hash (`codeHash`, SHA-256 over the normalized code — never
  the plaintext), redemption is single-use (`WHERE codeHash = ? AND usedAt IS NULL`, then sets
  `usedAt`), and plaintext exists only in the one-time `generate.ts` response. SHA-256 without a
  per-code salt is deliberately fine here, not a shortcut: each code carries roughly 75 bits of
  entropy (15 chars from a 32-character alphabet), so the search space itself — not the hash's
  computational cost — provides the security margin, unlike a low-entropy user-chosen password.
  Redemption is additionally per-IP rate-limited (`recovery_code_failure` event type).
- Sensitive actions (`recovery-codes/generate`, `passkeys/*/remove`) are gated behind
  `requireRecentAuthentication`, confirmed still wired at both call sites.

## 3. Billing — PASS, no findings

- `webhook.ts` reads `request.text()` (the raw body) and passes it directly to
  `verifyPaddleWebhookSignature` before any JSON parsing — the exact ordering the codebase's own
  documentation warns is easy to get wrong (re-serializing parsed JSON silently breaks HMAC
  verification).
- Idempotency: `webhook_events.paddle_event_id` has a DB-level `UNIQUE` constraint, and
  `processPaddleWebhookEvent` explicitly checks for an existing row by that id before processing,
  returning `"duplicate"` for anything already `processed`/`ignored`/`permanently_failed`.
- Paddle remains the source of truth: the only writer of a user's `plan_id` from a subscription
  change is `webhook-processor.ts` (webhook-driven); the admin "resync" action
  (`lib/admin/subscriptions.ts`'s `resyncSubscription`) calls Paddle's real `getSubscription` API
  and writes the _fetched_ result locally — it never lets an admin type a new state directly.

## 4. Admin — PASS, no findings

- Every mutating route under `apps/web/src/pages/api/admin/` calls `requireAdminAction` (checked
  exhaustively: zero POST/PUT/DELETE/PATCH admin route lacks it). That function requires a
  recorded reason, step-up authentication, and writes the `admin_audit_logs` row itself — no call
  site can forget to.
- Zero matches for any admin route reading a role/permission claim from the request body or a
  client-supplied header; every role check (`hasAdminRole`, `getActiveAdminRoles`) reads from the
  `admin_role_assignments` table server-side.

## Two real findings from this pass (both fixed in Step 26 — see `docs/status/KNOWN_RISKS.md`'s "Fixed during Part 3 Step 26" section for what changed)

1. **No enforced minimum of two registered passkeys for Super Admin accounts** (SRS §28.20 states
   this explicitly). Nothing in `lib/auth/require-admin.ts` or the admin-promotion path checks or
   enforces it. Not launch-blocking for the customer product; real gap for admin account
   resilience.
2. **`apps/web/wrangler.jsonc`'s `env.preview` has no distinct D1 database binding** — it only
   overrides `vars`, so preview would share production's D1 unless a separate database is
   configured before first preview deploy. This directly contradicts SRS §28.20/§33's
   "separate production and preview access" requirement. `docs/security/SECURITY_CHECKLIST.md`
   previously (incorrectly) marked this row ✅ — corrected as part of this audit. **Must be
   resolved in Step 26 before any preview or production deployment.**

## One correction to existing security documentation

`docs/security/SECURITY_CHECKLIST.md` had two stale claims, fixed in this pass: "Administrative
audit logs" was marked "⏳ Part 3, schema only" (now fully implemented and tested — corrected to
✅), and "Production/preview separation" was marked ✅ (actually partial — see finding 2 above,
corrected to ⚠️). Both were caught by checking the claim against actual code rather than trusting
the document.

## What was already known and remains open (not new, not re-litigated here)

- Paddle webhook/portal payload shapes unverified against a live account (`docs/security/BILLING_SECURITY.md`).
- CSP allows `'unsafe-inline'` for scripts/styles — Astro island hydration and Tailwind's runtime
  both need it today (`docs/security/THREAT_MODEL.md`).
- DNS-rebinding residual risk against the scanner's own resolve-then-fetch check is not fully
  closable on Cloudflare Workers' current API (ADR-0005, `docs/security/SSRF_SECURITY_MODEL.md`).
- No cross-request target-frequency abuse monitoring across distributed anonymous callers.

## Recommendation

No critical or high-severity defect found across the four SRS §33 launch-blocking areas. The two
new findings are real but bounded and already scheduled: finding 1 as admin-hardening follow-up,
finding 2 as a hard blocker for Step 26 (production configuration) specifically, before any
deployment — not for continuing Part 3 development. Proceed to Step 25.
