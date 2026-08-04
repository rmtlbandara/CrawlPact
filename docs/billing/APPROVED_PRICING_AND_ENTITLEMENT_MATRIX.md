# Approved pricing and entitlement matrix (Phase 6)

Authoritative, verbatim from the Phase 6 execution prompt's "Final Verified Pricing Plan." This
document is the single source every other Phase 6 artifact (schema, config, pricing page,
checkout, Super Admin, structured data, Paddle catalog) must trace back to. Do not restate these
values elsewhere without citing this file.

## Pricing

All amounts USD. Yearly amounts are the actual annual charge, not "12× monthly" — each plan's
yearly price is below what 12 months at the monthly rate would cost.

| Plan   | Monthly | Yearly  | Annual saving vs. 12×monthly |
| ------ | ------- | ------- | ---------------------------- |
| Free   | $0      | $0      | —                            |
| Solo   | $9.00   | $89.00  | $19.00                       |
| Pro    | $19.00  | $189.00 | $39.00                       |
| Agency | $39.00  | $389.00 | $79.00                       |

Minor units (cents), the form Paddle's API requires:

| Plan   | Monthly (cents) | Yearly (cents) |
| ------ | --------------- | -------------- |
| Solo   | 900             | 8900           |
| Pro    | 1900            | 18900          |
| Agency | 3900            | 38900          |

Effective monthly-equivalent value when paying yearly (display-only, never replaces the actual
yearly amount):

| Plan   | Yearly ÷ 12    |
| ------ | -------------- |
| Solo   | ≈ $7.42/month  |
| Pro    | $15.75/month   |
| Agency | ≈ $32.42/month |

- Billing toggle label: `Monthly | Yearly — Save up to 18%`.
- **Pro is marked "Most Popular." Agency is never marked "Most Popular."**
- Currency/tax copy: _"All prices are in USD. Applicable taxes may be calculated during Paddle
  checkout."_ No local-currency overrides, no country-specific price overrides, no public
  country/jurisdiction reference anywhere near pricing.
- No trial on any price, on any plan, ever, in this phase.

## Entitlements (unchanged from what's already live — verified against real seed data)

| Feature                           | Free    | Solo      | Pro       | Agency                            |
| --------------------------------- | ------- | --------- | --------- | --------------------------------- |
| Saved domains                     | 1       | 5         | 25        | 100                               |
| Automatic monitoring              | None    | Monthly   | Weekly    | Weekly                            |
| Manual rescans / domain / month   | 2       | 5         | 10        | 20                                |
| Audit-history retention           | 30 days | 12 months | 24 months | 36 months                         |
| Private Atom change feed          | No      | Yes       | Yes       | Yes                               |
| Domain groups                     | No      | No        | Yes       | Yes                               |
| CSV domain export                 | No      | No        | Yes       | Yes                               |
| Batch domain import               | No      | No        | Up to 10  | Up to 100                         |
| Agency-branded shared reports     | No      | No        | No        | Yes                               |
| Complete, accurate core audit     | Yes     | Yes       | Yes       | Yes (identical across every plan) |
| Print-friendly reports            | Yes     | Yes       | Yes       | Yes                               |
| Private, revocable report sharing | Yes     | Yes       | Yes       | Yes (never Pro/Agency-gated)      |

**Confirmed via `packages/database/seed/reference-data.sql`'s real `INSERT OR IGNORE INTO plans`
values**: every one of these already matches the live `plans` table exactly
(`free`/`solo`/`pro`/`agency` rows, `saved_domain_limit`, `monitoring_frequency`,
`history_retention_days` in days — 30/365/730/1095 — `manual_rescans_per_domain_per_month`,
`domain_groups_enabled`, `csv_export_enabled`, `private_atom_feed_enabled`, `batch_import_limit`,
`agency_branding_enabled`). **This phase makes zero entitlement changes** — only the pricing
representation changes (single annual price → monthly + yearly, with real Paddle price IDs
stored instead of env-var-only mapping).

## CTA labels

| Plan   | CTA              |
| ------ | ---------------- |
| Free   | Scan a website   |
| Solo   | Start monitoring |
| Pro    | Choose Pro       |
| Agency | Choose Agency    |

## Explicitly absent (do not implement, do not advertise)

Daily/hourly/real-time/custom-frequency monitoring; any free trial; unlimited/paid-tier-gated
ordinary private report sharing (private sharing is generally available, only Agency _branding_
on a shared report is Agency-only); portfolio risk overview, cross-domain comparisons, saved
policy presets, client-specific report views; automatic downgrade-domain selection or guaranteed
auto-pausing; separate support tiers; usage-based/overage billing; per-user or seat-based
pricing; add-on products; setup fees; lifetime plans; coupon campaigns; introductory pricing;
location-based price overrides; "Basic report"/"Full report" artificial tiers.
