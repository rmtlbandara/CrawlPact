# Privacy Request Process

**Level 1 document (Current authoritative).** Internal process backing the public Privacy
Policy's (`/privacy`) "Your choices and rights" section. Established Phase 3, 2026-08-03. Owner:
Legal/business owner. Review cadence: annually, or after material changes.

## Channel

All privacy requests arrive at `info@crawlpact.com` (`TRUST_CONFIG.privacyContact`). This is a
manual process — there is no self-service data-export or deletion-request form beyond the
existing in-product account-deletion flow (see below).

## Request types handled

- Access
- Correction
- Deletion (see "Relationship to account deletion" below)
- Account-data questions
- Privacy objection
- Analytics questions

## Process

1. **Intake** — request received at `info@crawlpact.com`.
2. **Identity verification** — CrawlPact may need reasonable verification before fulfilling a
   sensitive request. There is no formal identity-verification method built into the product
   today; verification is a manual, case-by-case judgement (e.g. confirming request details match
   information only the account holder would know). CrawlPact does not request government ID or
   other unnecessary sensitive identity documents.
3. **Internal review** — the request is reviewed against what CrawlPact actually stores (see
   `docs/privacy/DATA_CATEGORY_AND_PURPOSE_INVENTORY.md`).
4. **Data search** — relevant records are located (account row, saved domains/scans, billing
   metadata where applicable).
5. **Response** — the requester is told what was found/done. No fixed response-time SLA is
   promised.
6. **Deletion or correction** — carried out where technically and legally possible. Billing
   records required for accounting or legal purposes are not deleted (see below).
7. **Exceptions** — a request may be partially fulfilled where retaining specific data is required
   for security, billing, legal, or accounting reasons; the requester is told which parts could
   not be fulfilled and why.
8. **Logging** — the request and its outcome are recorded internally (email thread is the current
   record; no dedicated privacy-request tracker exists).
9. **Closure** — the requester is informed the request is complete.

## Relationship to account deletion

Most deletion requests are better served by the existing self-service account-deletion flow
(`/app/account` → Delete account), which starts a cancellable 30-day grace period and then
purges private data via the real scheduled retention job — see
`docs/privacy/DATA_CATEGORY_AND_PURPOSE_INVENTORY.md` and `docs/data/DATA_RETENTION.md`. Email to
`info@crawlpact.com` is for requests the self-service flow doesn't cover (e.g. a request from
someone who never created an account, or a correction rather than a deletion).

## What is not promised

- No fixed response-time SLA.
- No guarantee that a specific legal right (e.g. a named data-subject right under a particular
  law) applies to every requester — CrawlPact handles requests reasonably and in good faith
  regardless, but does not assert which specific law governs any given requester's situation.
