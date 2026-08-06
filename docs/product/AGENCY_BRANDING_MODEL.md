# Agency Branding Model

## What already exists (unchanged by this phase)

Per-share branding is a shipped, tested, Agency-gated feature: `shared_reports.agency_branding`
JSON column (migration 0006), `agencyBrandingSchema` (`agencyName`, `logoUrl`, `clientName`,
`introText` — all optional, length-capped), R2-backed logo upload with magic-byte sniffing
(`apps/web/src/lib/agency-logo.ts`), and unconditional rendering of CrawlPact's own methodology,
evidence, limitations, and registry/ruleset version regardless of branding
(`AuditReportView.tsx:402`, verified by reading the component, not assumed). None of this is
rebuilt.

## The genuine gap this phase fills

Today, `ShareReportDialog` asks the user to type their agency name and upload a logo **fresh, on
every single share** — there is no persistent, account-level place to set this once. §32's
"Agency Branding Profile" and the workspace IA's Section 8 both describe exactly this missing
piece.

## New: `agency_brand_profiles` (one row per Agency-plan user)

Minimal, per §32's "use minimal fields": `owner_user_id` (unique), `agency_name`, `logo_url` (same
R2 path-pattern constraint as the existing per-share `logoUrl` — reuses
`AGENCY_LOGO_PATH_PATTERN`), `created_at`, `updated_at`. **`clientName` and `introText` are
deliberately not persisted here** — they describe one specific client/report and would be wrong
defaults for the next one; they stay per-share, exactly as they work today.

`ShareReportDialog` is extended to pre-fill `agencyName`/logo from this profile when it exists
(still fully editable per-share — the profile is a convenience default, not a lock). This is the
only behavioural change to that component.

## Endpoints (new)

- `GET /api/agency-branding/profile` — the caller's own profile, or `null`.
- `PUT /api/agency-branding/profile` — upsert `agencyName`; gated on `plan.agencyBrandingEnabled`.
- Logo upload/removal reuses the **existing** `/api/agency-branding/logo` upload route and its
  existing validation (MIME + magic-byte sniffing, size limit, safe object key generation via
  `buildLogoObjectKey`) — this phase does not fork a second upload path; the profile simply stores
  the resulting `logoUrl` the same way a share already does.

## R2 lifecycle correction (required by this addition)

`findAndCleanupOrphanedLogos` (`apps/web/src/lib/r2-orphan-cleanup.ts`) currently treats a logo as
referenced only if some `shared_reports.agency_branding` row points to it. Once a profile logo can
exist with **no share referencing it yet** (a user sets up branding before their first share), that
function would wrongly flag it as orphaned. This phase updates it to treat a key as referenced if
_either_ a `shared_reports.agency_branding` row _or_ an `agency_brand_profiles.logo_url` row
references it — a one-line addition to the existing referenced-keys set, not a new sweep.

## Restrictions (unchanged, restated because they still apply to the new profile)

Agency entitlement required; no custom scripts, raw HTML, CSS injection, arbitrary fonts, or
external image hotlinking (the R2 path-pattern regex on `logoUrl` already makes hotlinking
impossible — the field cannot hold an external URL at all); no removal of methodology/limitations;
no false certification, impersonation, or partnership claim. Report copy remains "Prepared by
[Agency Name] using CrawlPact" (`AuditReportView.tsx`'s existing "Prepared for {clientName}" plus
the unconditional CrawlPact-attribution sentence at line 402) — not "white-label," since only a
name/logo/intro-text are customisable and the underlying report content, methodology, and
attribution are fixed.

## Accepted logo formats — existing minor divergence, noted not changed

The existing upload UI (`ShareReportDialog.tsx`) accepts PNG/JPEG/GIF/WebP; the Phase 9 prompt's
preferred list is PNG/JPEG/WebP (GIF not mentioned either way, SVG explicitly to be avoided). GIF
support already existed before this phase, is magic-byte validated the same as the other three
formats, and is not a security gap — this phase does not change accepted formats, since doing so
was not requested and is out of scope for "extend branding," not a fix for a defect.
